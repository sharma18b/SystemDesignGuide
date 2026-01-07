# Digital Wallet - Database Design

**Reading Time**: 20 minutes

## Database Schema

### 1. Users Table
```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    phone_verified BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    kyc_status VARCHAR(20) DEFAULT 'pending',
    kyc_verified_at TIMESTAMP,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,
    country_code CHAR(2),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_kyc_status (kyc_status)
);
```

### 2. Devices Table
```sql
CREATE TABLE devices (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    device_token VARCHAR(255) UNIQUE NOT NULL,
    device_type VARCHAR(20) NOT NULL, -- ios, android, web
    device_model VARCHAR(100),
    os_version VARCHAR(50),
    app_version VARCHAR(50),
    biometric_enabled BOOLEAN DEFAULT FALSE,
    biometric_hash VARCHAR(255), -- Hashed biometric template
    last_active_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_id (user_id),
    INDEX idx_device_token (device_token),
    INDEX idx_status (status)
);
```

### 3. Payment Methods Table
```sql
CREATE TABLE payment_methods (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    type VARCHAR(20) NOT NULL, -- card, bank_account
    token_id BIGINT NOT NULL,
    card_network VARCHAR(20), -- visa, mastercard, amex
    last4 CHAR(4) NOT NULL,
    expiry_month SMALLINT,
    expiry_year SMALLINT,
    cardholder_name VARCHAR(100),
    billing_address_id BIGINT,
    is_default BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_id (user_id),
    INDEX idx_token_id (token_id),
    INDEX idx_status (status),
    UNIQUE (user_id, is_default) WHERE is_default = TRUE
);
```

### 4. Tokens Table (Encrypted)
```sql
CREATE TABLE tokens (
    id BIGSERIAL PRIMARY KEY,
    token_value VARCHAR(255) UNIQUE NOT NULL, -- Encrypted token
    card_hash VARCHAR(64) NOT NULL, -- SHA-256 of PAN
    token_type VARCHAR(20) DEFAULT 'payment',
    expiry_date DATE,
    status VARCHAR(20) DEFAULT 'active',
    provisioned_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP,
    use_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_token_value (token_value),
    INDEX idx_card_hash (card_hash),
    INDEX idx_status (status)
);

-- Encryption at rest using PostgreSQL pgcrypto
-- token_value stored as: pgp_sym_encrypt(value, key)
```

### 5. Transactions Table (Partitioned)
```sql
CREATE TABLE transactions (
    id BIGSERIAL,
    user_id BIGINT NOT NULL,
    payment_method_id BIGINT NOT NULL,
    transaction_type VARCHAR(20) NOT NULL, -- payment, refund, p2p
    amount DECIMAL(15, 2) NOT NULL,
    currency CHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL, -- pending, completed, failed
    merchant_id VARCHAR(100),
    merchant_name VARCHAR(255),
    merchant_category VARCHAR(50),
    description TEXT,
    reference_id VARCHAR(100) UNIQUE,
    idempotency_key VARCHAR(100) UNIQUE,
    fraud_score DECIMAL(5, 2),
    fraud_status VARCHAR(20),
    payment_network_response JSONB,
    error_code VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Partitions by month
CREATE TABLE transactions_2026_01 PARTITION OF transactions
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE transactions_2026_02 PARTITION OF transactions
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Indexes
CREATE INDEX idx_transactions_user_id ON transactions(user_id, created_at DESC);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_reference ON transactions(reference_id);
CREATE INDEX idx_transactions_idempotency ON transactions(idempotency_key);
```

### 6. Transaction Details Table
```sql
CREATE TABLE transaction_details (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL,
    device_id BIGINT,
    ip_address INET,
    user_agent TEXT,
    location_lat DECIMAL(10, 8),
    location_lon DECIMAL(11, 8),
    location_city VARCHAR(100),
    location_country CHAR(2),
    nfc_used BOOLEAN DEFAULT FALSE,
    authentication_method VARCHAR(50), -- biometric, pin, none
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_transaction_id (transaction_id)
);
```

### 7. P2P Transfers Table
```sql
CREATE TABLE p2p_transfers (
    id BIGSERIAL PRIMARY KEY,
    sender_id BIGINT NOT NULL REFERENCES users(id),
    receiver_id BIGINT NOT NULL REFERENCES users(id),
    amount DECIMAL(15, 2) NOT NULL,
    currency CHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL, -- pending, completed, failed, cancelled
    message TEXT,
    reference_id VARCHAR(100) UNIQUE,
    idempotency_key VARCHAR(100) UNIQUE,
    sender_transaction_id BIGINT,
    receiver_transaction_id BIGINT,
    fee_amount DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    INDEX idx_sender_id (sender_id, created_at DESC),
    INDEX idx_receiver_id (receiver_id, created_at DESC),
    INDEX idx_status (status),
    INDEX idx_reference (reference_id)
);
```

### 8. Balances Table
```sql
CREATE TABLE balances (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL REFERENCES users(id),
    available_balance DECIMAL(15, 2) DEFAULT 0,
    pending_balance DECIMAL(15, 2) DEFAULT 0,
    currency CHAR(3) NOT NULL,
    last_updated_at TIMESTAMP DEFAULT NOW(),
    version INT DEFAULT 1, -- Optimistic locking
    INDEX idx_user_id (user_id)
);

-- Optimistic locking for concurrent updates
-- UPDATE balances SET available_balance = available_balance - 100,
--                     version = version + 1
-- WHERE user_id = ? AND version = ?
```

### 9. Transfer Limits Table
```sql
CREATE TABLE transfer_limits (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL REFERENCES users(id),
    daily_limit DECIMAL(15, 2) NOT NULL,
    per_transaction_limit DECIMAL(15, 2) NOT NULL,
    daily_used DECIMAL(15, 2) DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_id (user_id)
);
```

### 10. Fraud Rules Table
```sql
CREATE TABLE fraud_rules (
    id BIGSERIAL PRIMARY KEY,
    rule_name VARCHAR(100) UNIQUE NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- velocity, amount, geo, device
    rule_config JSONB NOT NULL,
    severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
    action VARCHAR(20) NOT NULL, -- block, review, alert, 2fa
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_rule_type (rule_type),
    INDEX idx_is_active (is_active)
);

-- Example rule_config:
-- {
--   "max_transactions_per_hour": 10,
--   "max_amount_per_day": 5000,
--   "allowed_countries": ["US", "CA", "UK"]
-- }
```

### 11. Fraud Events Table
```sql
CREATE TABLE fraud_events (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT,
    user_id BIGINT NOT NULL,
    rule_id BIGINT REFERENCES fraud_rules(id),
    fraud_score DECIMAL(5, 2) NOT NULL,
    risk_level VARCHAR(20) NOT NULL, -- low, medium, high, critical
    triggered_rules JSONB,
    action_taken VARCHAR(20), -- blocked, flagged, allowed
    reviewed_by BIGINT,
    review_status VARCHAR(20),
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_transaction_id (transaction_id),
    INDEX idx_user_id (user_id),
    INDEX idx_risk_level (risk_level),
    INDEX idx_created_at (created_at)
);
```

### 12. Notifications Table
```sql
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL, -- transaction, security, promotional
    channel VARCHAR(20) NOT NULL, -- push, email, sms, in_app
    title VARCHAR(255),
    message TEXT NOT NULL,
    data JSONB,
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed, read
    sent_at TIMESTAMP,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_id (user_id, created_at DESC),
    INDEX idx_status (status),
    INDEX idx_type (type)
);
```

### 13. Receipts Table
```sql
CREATE TABLE receipts (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    receipt_url VARCHAR(500), -- S3 URL
    receipt_data JSONB,
    format VARCHAR(20) DEFAULT 'pdf', -- pdf, json
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_transaction_id (transaction_id),
    INDEX idx_user_id (user_id)
);
```

### 14. Audit Logs Table
```sql
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id BIGINT,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_id (user_id, created_at DESC),
    INDEX idx_resource (resource_type, resource_id),
    INDEX idx_created_at (created_at)
);
```

## Database Sharding Strategy

### Sharding by User ID
```
Shard Key: user_id
Number of Shards: 1000 (initially)

Shard Calculation:
shard_id = user_id % 1000

Shard Distribution:
- Shard 0-249: Region US-East
- Shard 250-499: Region US-West
- Shard 500-749: Region EU-West
- Shard 750-999: Region Asia-Pacific

Tables to Shard:
- users
- devices
- payment_methods
- transactions
- p2p_transfers
- balances
- transfer_limits

Global Tables (Not Sharded):
- tokens (accessed by token_id, not user_id)
- fraud_rules
- audit_logs (centralized)
```

### Read Replicas
```
Primary: 1 per shard (writes)
Replicas: 3 per shard (reads)

Read Distribution:
- Transaction history: Replicas (90% of reads)
- Balance checks: Replicas
- Payment authorization: Primary (consistency)
- P2P transfers: Primary (consistency)

Replication Lag: < 100ms
```

## Caching Strategy

### Redis Cache Layers

#### L1: Hot User Data (TTL: 5 minutes)
```
Key Pattern: user:{user_id}
Value: User profile JSON
Size: ~1 KB per user
Total: 20M active users × 1 KB = 20 GB

Key Pattern: balance:{user_id}
Value: Available balance
Size: ~100 bytes per user
Total: 20M users × 100 bytes = 2 GB
```

#### L2: Payment Methods (TTL: 15 minutes)
```
Key Pattern: payment_methods:{user_id}
Value: List of payment methods JSON
Size: ~2 KB per user
Total: 20M users × 2 KB = 40 GB
```

#### L3: Recent Transactions (TTL: 1 hour)
```
Key Pattern: transactions:{user_id}:recent
Value: Last 20 transactions JSON
Size: ~10 KB per user
Total: 20M users × 10 KB = 200 GB
```

#### L4: Tokens (TTL: 1 hour)
```
Key Pattern: token:{token_id}
Value: Token details (encrypted)
Size: ~500 bytes per token
Total: 50M active tokens × 500 bytes = 25 GB

Total Redis Memory: ~287 GB
Redis Cluster: 6 nodes × 64 GB = 384 GB
```

### Cache Invalidation
```
Write-Through:
- Update database first
- Then update cache
- If cache update fails, log and continue

Cache-Aside:
- Read from cache
- If miss, read from database
- Write to cache
- Return data

Invalidation Events:
- User profile update → Invalidate user:{user_id}
- Payment method added → Invalidate payment_methods:{user_id}
- Transaction completed → Invalidate transactions:{user_id}:recent
```

## Data Consistency

### ACID Transactions

#### P2P Transfer (Two-Phase Commit)
```sql
BEGIN;

-- Lock sender balance
SELECT available_balance FROM balances
WHERE user_id = :sender_id FOR UPDATE;

-- Debit sender
UPDATE balances
SET available_balance = available_balance - :amount,
    version = version + 1
WHERE user_id = :sender_id AND version = :sender_version;

-- Credit receiver
UPDATE balances
SET available_balance = available_balance + :amount,
    version = version + 1
WHERE user_id = :receiver_id AND version = :receiver_version;

-- Record transfer
INSERT INTO p2p_transfers (sender_id, receiver_id, amount, status)
VALUES (:sender_id, :receiver_id, :amount, 'completed');

COMMIT;
```

### Idempotency
```sql
-- Prevent duplicate transactions
INSERT INTO transactions (
    user_id, amount, idempotency_key, status
) VALUES (
    :user_id, :amount, :idempotency_key, 'pending'
)
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING id;

-- If no rows returned, transaction already exists
```

## Data Archival

### Archival Strategy
```
Hot Data (0-90 days):
- Storage: PostgreSQL SSD
- Access: Real-time
- Retention: 90 days

Warm Data (90 days - 5 years):
- Storage: PostgreSQL HDD (partitioned)
- Access: Moderate (1-2 seconds)
- Retention: 5 years

Cold Data (5+ years):
- Storage: S3 Glacier
- Access: Rare (minutes to hours)
- Retention: 7 years (compliance)

Archival Process:
1. Daily job identifies old partitions
2. Export to Parquet format
3. Upload to S3 Glacier
4. Drop old partition
5. Update metadata table
```

## Interview Discussion Points

**Q: How handle high write throughput?**
- Sharding by user_id (1000 shards)
- Batch inserts for audit logs
- Async writes for non-critical data
- Write-ahead logging

**Q: How ensure data consistency in P2P?**
- ACID transactions with row-level locks
- Optimistic locking (version field)
- Two-phase commit pattern
- Idempotency keys

**Q: How optimize transaction history queries?**
- Partition by month
- Index on (user_id, created_at DESC)
- Cache recent 20 transactions
- Elasticsearch for complex searches

---
*Estimated Reading Time: 20 minutes*
