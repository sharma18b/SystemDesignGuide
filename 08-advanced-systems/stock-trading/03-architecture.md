# Stock Trading Platform - System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   Web    │  │  Mobile  │  │   API    │  │   FIX    │  │
│  │   App    │  │   Apps   │  │ Clients  │  │ Protocol │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼─────────────┼─────────────┼─────────────┼─────────┘
        │             │             │             │
        └─────────────┼─────────────┼─────────────┘
                      │
        ┌─────────────┴─────────────┐
        │      API Gateway           │
        │  (Auth, Rate Limit)        │
        └─────────────┬──────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
┌───┴────────┐  ┌─────┴──────┐  ┌──────┴───────┐
│   Order    │  │   Market   │  │    Risk      │
│  Gateway   │  │    Data    │  │  Management  │
└───┬────────┘  └─────┬──────┘  └──────┬───────┘
    │                 │                 │
    └─────────────────┼─────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │    Matching Engine         │
        │  (Lock-Free, In-Memory)    │
        └─────────────┬──────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
┌───┴────────┐  ┌─────┴──────┐  ┌──────┴───────┐
│   Trade    │  │ Portfolio  │  │   Audit      │
│Settlement  │  │  Service   │  │    Log       │
└───┬────────┘  └─────┬──────┘  └──────┬───────┘
    │                 │                 │
    └─────────────────┼─────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │      Data Layer            │
        │  (In-Memory + Persistent)  │
        └────────────────────────────┘
```

## Core Components

### 1. Matching Engine
**Purpose**: Match buy and sell orders with microsecond latency

**Architecture**:
```
Lock-Free Order Book:
- Separate book per symbol
- Price-time priority (FIFO)
- Lock-free data structures
- CPU pinning for deterministic performance

Data Structure:
BuyOrders (Max Heap):  SellOrders (Min Heap):
Price: $100.50 (100)   Price: $100.51 (200)
Price: $100.49 (50)    Price: $100.52 (150)
Price: $100.48 (75)    Price: $100.53 (100)

Matching Algorithm:
1. New order arrives
2. Check opposite side of book
3. If price matches:
   - Execute trade
   - Update order quantities
   - Remove filled orders
4. If partial fill:
   - Add remaining to book
5. If no match:
   - Add to order book
```

**Implementation**:
```cpp
class OrderBook {
    // Lock-free data structures
    std::atomic<Order*> best_bid;
    std::atomic<Order*> best_ask;
    
    // Price levels (lock-free skip list)
    LockFreeSkipList<Price, OrderQueue> bids;
    LockFreeSkipList<Price, OrderQueue> asks;
    
    // Match order (< 500 microseconds)
    std::vector<Trade> match(Order& order) {
        std::vector<Trade> trades;
        
        if (order.side == BUY) {
            while (!asks.empty() && 
                   order.price >= asks.top().price &&
                   order.quantity > 0) {
                Trade trade = execute(order, asks.top());
                trades.push_back(trade);
            }
        }
        
        if (order.quantity > 0) {
            bids.insert(order.price, order);
        }
        
        return trades;
    }
};
```

**Performance Optimization**:
```
CPU Pinning:
- Dedicate cores to matching engine
- Avoid context switches
- NUMA-aware allocation

Memory:
- Huge pages (2 MB)
- Cache-line alignment
- Pre-allocated memory pools

Network:
- Kernel bypass (DPDK)
- Zero-copy operations
- Direct NIC access
```

### 2. Market Data Gateway
**Purpose**: Receive and distribute market data with minimal latency

**Data Flow**:
```
Exchange → Market Data Gateway → Normalization → 
Distribution → Subscribers

Latency Budget:
- Receive from exchange: 10 μs
- Normalize: 20 μs
- Distribute: 20 μs
Total: 50 μs
```

**Implementation**:
```
Multicast Distribution:
- Use UDP multicast for fan-out
- Single send reaches all subscribers
- No per-subscriber overhead
- 1 Gbps → 10 Gbps with multicast

Message Format:
struct MarketDataTick {
    uint64_t timestamp;    // Nanoseconds
    uint32_t symbol_id;    // Symbol identifier
    uint32_t price;        // Fixed-point (4 decimals)
    uint32_t quantity;
    uint8_t  side;         // BUY/SELL
    uint8_t  type;         // TRADE/QUOTE
} __attribute__((packed));  // 26 bytes
```

### 3. Risk Management Service
**Purpose**: Real-time risk checks before order execution

**Risk Checks** (<100 microseconds):
```
1. Account Balance:
   - Sufficient funds for order
   - Margin requirements
   - Buying power

2. Position Limits:
   - Max position per symbol
   - Max portfolio concentration
   - Sector exposure limits

3. Order Limits:
   - Max order size
   - Max order value
   - Daily order count

4. Price Limits:
   - Collar checks (±10% from last price)
   - Fat finger detection
   - Market manipulation detection

Implementation:
- In-memory risk calculations
- Pre-computed limits
- Lock-free updates
- Async limit updates
```

### 4. Order Gateway
**Purpose**: Receive, validate, and route orders

**Order Processing Pipeline**:
```
1. Receive Order (FIX/REST/WebSocket)
2. Parse and Validate:
   - Required fields present
   - Valid symbol
   - Valid price/quantity
   - Valid order type
3. Risk Check (100 μs)
4. Route to Matching Engine
5. Acknowledge to Client
6. Async: Write to audit log

Total: <1 millisecond
```

### 5. Trade Settlement Service
**Purpose**: Settle executed trades and update portfolios

**Settlement Flow**:
```
Trade Executed → Settlement Service → Update Portfolio → 
Update Balances → Notify User → Audit Log

Operations:
1. Debit buyer's cash
2. Credit buyer's position
3. Credit seller's cash
4. Debit seller's position
5. Record transaction
6. Update margin requirements

Timing:
- Real-time settlement (T+0)
- Async database writes
- Eventual consistency for reporting
```

## Data Storage Architecture

### In-Memory Storage (Hot Data)
```
Order Books:
- Technology: Custom lock-free structures
- Size: 10 GB (10K symbols)
- Persistence: Snapshots every 1 second

Active Orders:
- Technology: Hash map + priority queue
- Size: 2 GB (10M orders)
- Persistence: Write-ahead log

User Sessions:
- Technology: Redis
- Size: 10 GB (1M users)
- TTL: 24 hours
```

### Persistent Storage (Warm/Cold Data)
```
Trades (PostgreSQL):
- Partitioned by date
- Indexed by symbol, user, timestamp
- Replication: 3x
- Retention: 7 years

Orders (PostgreSQL):
- Partitioned by date
- Indexed by user, symbol, status
- Replication: 3x
- Retention: 7 years

Market Data (TimescaleDB):
- Time-series optimized
- Compression: 10x
- Retention: 5 years
- Downsampling for old data
```

### Audit Log (Immutable)
```
Technology: Append-only log (Kafka)
- Every order, trade, modification
- Immutable and tamper-proof
- Retention: 7 years (regulatory)
- Replication: 3x across regions

Format:
{
  "timestamp": "2026-01-08T10:00:00.123456Z",
  "event_type": "ORDER_PLACED",
  "user_id": "user123",
  "order_id": "order456",
  "symbol": "AAPL",
  "side": "BUY",
  "price": 150.25,
  "quantity": 100,
  "order_type": "LIMIT"
}
```

## Network Architecture

### Co-Location
```
Physical Setup:
- Servers in same data center as exchange
- <50 microsecond network latency
- Direct fiber connections
- Redundant network paths

Benefits:
- Minimize latency
- Reliable connectivity
- Competitive advantage
```

### Kernel Bypass Networking
```
Technology: DPDK (Data Plane Development Kit)

Benefits:
- Bypass kernel network stack
- Zero-copy operations
- Poll mode (no interrupts)
- 10x lower latency

Performance:
- Traditional: 50-100 μs
- DPDK: 5-10 μs
- Improvement: 10x faster
```

## Failover and High Availability

### Active-Active Architecture
```
Primary Data Center:
- Handles 100% of traffic
- Real-time matching
- Sub-millisecond latency

Secondary Data Center:
- Hot standby
- Receives all events
- Ready to take over in <100ms

Failover Process:
1. Detect primary failure (<10ms)
2. Promote secondary to primary
3. Redirect traffic (<50ms)
4. Resume trading (<100ms total)
```

### State Replication
```
Order Book State:
- Snapshot every 1 second
- Event log for replay
- Replicate to secondary

Recovery:
1. Load latest snapshot
2. Replay events since snapshot
3. Rebuild order book
4. Resume matching

Recovery Time: <1 second
```

## Monitoring and Observability

### Real-Time Metrics
```
Latency Metrics:
- Order placement latency (p50, p95, p99)
- Matching engine latency
- Market data latency
- End-to-end latency

Throughput Metrics:
- Orders per second
- Trades per second
- Market data ticks per second

Business Metrics:
- Trading volume
- Active users
- Fill rate
- Cancellation rate

Alerting:
- Latency p99 > 1ms
- Error rate > 0.01%
- Failover events
- Regulatory violations
```

This architecture achieves microsecond latencies through co-location, kernel bypass networking, lock-free data structures, and in-memory processing while maintaining ACID guarantees and regulatory compliance.
