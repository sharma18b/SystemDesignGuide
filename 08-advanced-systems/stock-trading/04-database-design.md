# Stock Trading Platform - Database Design

## Database Technology Stack

### Primary Databases
- **In-Memory**: Custom lock-free structures (order books)
- **PostgreSQL**: Transactional data (trades, orders, accounts)
- **TimescaleDB**: Time-series data (market data, OHLCV)
- **Redis**: Caching and session management
- **Kafka**: Audit log and event streaming

## Core Schema Design

### Orders Table
```sql
CREATE TABLE orders (
    order_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    side VARCHAR(4) NOT NULL, -- BUY, SELL
    order_type VARCHAR(10) NOT NULL, -- MARKET, LIMIT, STOP
    price DECIMAL(10,4),
    quantity INTEGER NOT NULL,
    filled_quantity INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL, -- PENDING, FILLED, CANCELLED
    time_in_force VARCHAR(10) DEFAULT 'DAY', -- DAY, GTC, IOC, FOK
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    filled_at TIMESTAMP(6),
    cancelled_at TIMESTAMP(6),
    INDEX idx_user_symbol (user_id, symbol, created_at DESC),
    INDEX idx_symbol_status (symbol, status, created_at DESC),
    INDEX idx_created_at (created_at DESC)
) PARTITION BY RANGE (created_at);

-- Partitions by day for performance
CREATE TABLE orders_2026_01_08 PARTITION OF orders
    FOR VALUES FROM ('2026-01-08') TO ('2026-01-09');
```

### Trades Table
```sql
CREATE TABLE trades (
    trade_id BIGSERIAL PRIMARY KEY,
    buy_order_id BIGINT NOT NULL,
    sell_order_id BIGINT NOT NULL,
    buyer_id BIGINT NOT NULL,
    seller_id BIGINT NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    price DECIMAL(10,4) NOT NULL,
    quantity INTEGER NOT NULL,
    trade_value DECIMAL(15,2) NOT NULL,
    executed_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    settlement_status VARCHAR(20) DEFAULT 'PENDING',
    settled_at TIMESTAMP(6),
    INDEX idx_buyer (buyer_id, executed_at DESC),
    INDEX idx_seller (seller_id, executed_at DESC),
    INDEX idx_symbol (symbol, executed_at DESC),
    INDEX idx_executed_at (executed_at DESC),
    FOREIGN KEY (buy_order_id) REFERENCES orders(order_id),
    FOREIGN KEY (sell_order_id) REFERENCES orders(order_id)
) PARTITION BY RANGE (executed_at);
```

### Accounts Table
```sql
CREATE TABLE accounts (
    account_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    account_type VARCHAR(20) NOT NULL, -- CASH, MARGIN
    cash_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    buying_power DECIMAL(15,2) NOT NULL DEFAULT 0,
    margin_used DECIMAL(15,2) NOT NULL DEFAULT 0,
    account_status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 0, -- Optimistic locking
    INDEX idx_user (user_id),
    INDEX idx_status (account_status)
);
```

### Positions Table
```sql
CREATE TABLE positions (
    position_id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    quantity INTEGER NOT NULL,
    average_cost DECIMAL(10,4) NOT NULL,
    market_value DECIMAL(15,2),
    unrealized_pnl DECIMAL(15,2),
    realized_pnl DECIMAL(15,2) DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (account_id, symbol),
    INDEX idx_account (account_id),
    INDEX idx_symbol (symbol),
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);
```

### Transactions Table (Ledger)
```sql
CREATE TABLE transactions (
    transaction_id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL,
    transaction_type VARCHAR(20) NOT NULL,
    -- DEPOSIT, WITHDRAWAL, TRADE_BUY, TRADE_SELL, DIVIDEND, FEE
    amount DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,
    reference_id BIGINT, -- Order ID or Trade ID
    description TEXT,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_account_time (account_id, created_at DESC),
    INDEX idx_type (transaction_type, created_at DESC),
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
) PARTITION BY RANGE (created_at);
```

## Market Data Schema (TimescaleDB)

### Ticks Table
```sql
CREATE TABLE market_data_ticks (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    price DECIMAL(10,4) NOT NULL,
    quantity INTEGER NOT NULL,
    side VARCHAR(4), -- BUY, SELL
    exchange VARCHAR(10),
    PRIMARY KEY (time, symbol)
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('market_data_ticks', 'time');

-- Compression policy (compress data older than 1 day)
ALTER TABLE market_data_ticks SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol'
);

SELECT add_compression_policy('market_data_ticks', INTERVAL '1 day');

-- Retention policy (keep 5 years)
SELECT add_retention_policy('market_data_ticks', INTERVAL '5 years');
```

### OHLCV Table (Candlestick Data)
```sql
CREATE TABLE ohlcv (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    interval VARCHAR(10) NOT NULL, -- 1m, 5m, 1h, 1d
    open DECIMAL(10,4) NOT NULL,
    high DECIMAL(10,4) NOT NULL,
    low DECIMAL(10,4) NOT NULL,
    close DECIMAL(10,4) NOT NULL,
    volume BIGINT NOT NULL,
    PRIMARY KEY (time, symbol, interval)
);

SELECT create_hypertable('ohlcv', 'time');

-- Continuous aggregate for 1-minute candles
CREATE MATERIALIZED VIEW ohlcv_1m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 minute', time) AS time,
    symbol,
    first(price, time) AS open,
    max(price) AS high,
    min(price) AS low,
    last(price, time) AS close,
    sum(quantity) AS volume
FROM market_data_ticks
GROUP BY time_bucket('1 minute', time), symbol;
```

## In-Memory Data Structures

### Order Book (Custom C++)
```cpp
// Lock-free order book
struct Order {
    uint64_t order_id;
    uint64_t user_id;
    uint32_t symbol_id;
    uint32_t price;      // Fixed-point (4 decimals)
    uint32_t quantity;
    uint8_t  side;       // BUY=0, SELL=1
    uint8_t  type;       // MARKET=0, LIMIT=1
    uint64_t timestamp;  // Nanoseconds
} __attribute__((packed));  // 40 bytes

// Price level
struct PriceLevel {
    uint32_t price;
    std::atomic<uint32_t> total_quantity;
    LockFreeQueue<Order> orders;  // FIFO queue
};

// Order book
class OrderBook {
    uint32_t symbol_id;
    
    // Lock-free skip list for price levels
    LockFreeSkipList<uint32_t, PriceLevel> bids;  // Descending
    LockFreeSkipList<uint32_t, PriceLevel> asks;  // Ascending
    
    // Fast lookup
    std::unordered_map<uint64_t, Order*> order_index;
    
    // Statistics
    std::atomic<uint64_t> last_trade_price;
    std::atomic<uint64_t> total_volume;
};
```

### Active Orders (Redis)
```
# Order by ID
HSET order:{order_id}
    user_id {user_id}
    symbol {symbol}
    side {BUY|SELL}
    price {price}
    quantity {quantity}
    status {PENDING}
    created_at {timestamp}

# User's active orders
ZADD user:{user_id}:orders {timestamp} {order_id}

# Symbol's active orders
ZADD symbol:{symbol}:orders {timestamp} {order_id}

# Expiration
EXPIRE order:{order_id} 86400  # 24 hours
```

## Audit Log (Kafka)

### Event Schema
```json
{
  "event_id": "uuid",
  "timestamp": "2026-01-08T10:00:00.123456Z",
  "event_type": "ORDER_PLACED",
  "user_id": 12345,
  "data": {
    "order_id": 67890,
    "symbol": "AAPL",
    "side": "BUY",
    "order_type": "LIMIT",
    "price": 150.25,
    "quantity": 100
  },
  "metadata": {
    "ip_address": "192.168.1.1",
    "user_agent": "TradingApp/1.0",
    "session_id": "session123"
  }
}
```

### Kafka Topics
```
orders-events: All order events
trades-events: All trade executions
account-events: Balance/position updates
risk-events: Risk violations
audit-log: Complete audit trail

Retention: 7 years (regulatory requirement)
Replication: 3x
Partitions: 100 (by user_id hash)
```

## Sharding Strategy

### Horizontal Sharding
```
Shard by User ID:
- 10 shards (0-9)
- shard_id = user_id % 10
- Even distribution
- Independent scaling

Benefits:
- User queries stay on one shard
- No cross-shard transactions
- Easy to scale

Challenges:
- Symbol queries span shards
- Reporting requires aggregation
```

## Data Consistency

### ACID Guarantees
```sql
-- Trade execution with ACID
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Update buyer's account
UPDATE accounts 
SET cash_balance = cash_balance - :trade_value,
    version = version + 1
WHERE account_id = :buyer_account_id 
AND version = :expected_version;

-- Update seller's account
UPDATE accounts 
SET cash_balance = cash_balance + :trade_value,
    version = version + 1
WHERE account_id = :seller_account_id
AND version = :expected_version;

-- Update positions
INSERT INTO positions (account_id, symbol, quantity, average_cost)
VALUES (:buyer_account_id, :symbol, :quantity, :price)
ON CONFLICT (account_id, symbol) 
DO UPDATE SET quantity = positions.quantity + :quantity;

-- Record trade
INSERT INTO trades (buy_order_id, sell_order_id, ...)
VALUES (...);

COMMIT;
```

### Optimistic Locking
```sql
-- Prevent concurrent updates
UPDATE accounts
SET cash_balance = :new_balance,
    version = version + 1
WHERE account_id = :account_id
AND version = :expected_version;

-- Check affected rows
IF affected_rows = 0 THEN
    -- Version mismatch, retry
    ROLLBACK;
    RETRY;
END IF;
```

## Backup and Recovery

### Backup Strategy
```
Hot Backup (In-Memory):
- Snapshot every 1 second
- Write-ahead log for replay
- Recovery time: <1 second

Database Backup:
- Full backup: Daily
- Incremental: Every hour
- Point-in-time recovery
- Retention: 30 days

Audit Log Backup:
- Continuous replication
- 3x copies across regions
- Immutable storage
- Retention: 7 years
```

### Disaster Recovery
```
Primary Site Failure:
1. Detect failure (<10ms)
2. Promote secondary site
3. Load latest snapshot
4. Replay event log
5. Resume trading

Recovery Time: <1 second
Data Loss: Zero (RPO = 0)
```

This database design ensures ACID guarantees, microsecond performance through in-memory structures, and complete audit trails for regulatory compliance.
