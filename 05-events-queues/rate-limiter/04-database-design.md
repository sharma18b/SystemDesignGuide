# API Rate Limiter - Database Design

## Data Model Overview

### Core Entities
1. **Rate Limit Rules**: Configuration for rate limiting policies
2. **Counters**: Current usage tracking for users/keys
3. **User Quotas**: Per-user rate limit allocations
4. **API Keys**: API key metadata and tier information
5. **Audit Logs**: Historical rate limiting decisions
6. **Metrics**: Aggregated statistics and analytics

## Redis Data Structures (Primary Storage)

### Token Bucket Implementation
```redis
# Token bucket for user rate limiting
HSET user:12345:bucket tokens 75
HSET user:12345:bucket last_refill 1704723600
HSET user:12345:bucket capacity 100
HSET user:12345:bucket refill_rate 10
EXPIRE user:12345:bucket 3600

# Lua script for atomic token consumption
local key = KEYS[1]
local tokens_requested = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refill_rate = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1]) or capacity
local last_refill = tonumber(bucket[2]) or now

-- Calculate tokens to add
local time_passed = now - last_refill
local tokens_to_add = time_passed * refill_rate
tokens = math.min(capacity, tokens + tokens_to_add)

-- Check if enough tokens
if tokens >= tokens_requested then
    tokens = tokens - tokens_requested
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    return 1  -- Allow
else
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    return 0  -- Deny
end
```

### Sliding Window Counter
```redis
# Current and previous window counters
SET user:12345:window:current 300 EX 3600
SET user:12345:window:previous 800 EX 7200
SET user:12345:window:start 1704722400 EX 7200

# Lua script for sliding window check
local current_key = KEYS[1]
local previous_key = KEYS[2]
local start_key = KEYS[3]
local limit = tonumber(ARGV[1])
local window_size = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local current_count = tonumber(redis.call('GET', current_key) or 0)
local previous_count = tonumber(redis.call('GET', previous_key) or 0)
local window_start = tonumber(redis.call('GET', start_key) or now)

-- Check if we need to roll window
if now - window_start >= window_size then
    redis.call('SET', previous_key, current_count, 'EX', window_size * 2)
    redis.call('SET', current_key, 0, 'EX', window_size)
    redis.call('SET', start_key, now, 'EX', window_size * 2)
    current_count = 0
    previous_count = current_count
end

-- Calculate weighted count
local progress = (now - window_start) / window_size
local weighted_count = math.floor(previous_count * (1 - progress) + current_count)

if weighted_count < limit then
    redis.call('INCR', current_key)
    return 1  -- Allow
else
    return 0  -- Deny
end
```

### Fixed Window Counter
```redis
# Simple counter with automatic expiration
INCR user:12345:window:1704722400
EXPIRE user:12345:window:1704722400 120

# Get current count
GET user:12345:window:1704722400

# Lua script for atomic check and increment
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

local count = tonumber(redis.call('GET', key) or 0)

if count < limit then
    redis.call('INCR', key)
    if count == 0 then
        redis.call('EXPIRE', key, ttl)
    end
    return 1  -- Allow
else
    return 0  -- Deny
end
```

### Sliding Window Log (Sorted Set)
```redis
# Store request timestamps in sorted set
ZADD user:12345:requests 1704720000 "req_uuid_1"
ZADD user:12345:requests 1704720015 "req_uuid_2"
ZADD user:12345:requests 1704720030 "req_uuid_3"

# Remove old entries and count
ZREMRANGEBYSCORE user:12345:requests 0 (now - 3600)
ZCARD user:12345:requests

# Lua script for atomic check and add
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local request_id = ARGV[4]

-- Remove old entries
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

-- Count current entries
local count = redis.call('ZCARD', key)

if count < limit then
    redis.call('ZADD', key, now, request_id)
    redis.call('EXPIRE', key, window * 2)
    return 1  -- Allow
else
    return 0  -- Deny
end
```

### Rule Cache
```redis
# Cache rate limit rules
HSET rules:cache:user:12345 limit 1000
HSET rules:cache:user:12345 window 3600
HSET rules:cache:user:12345 algorithm "token_bucket"
EXPIRE rules:cache:user:12345 300

# Cache API key metadata
HSET apikey:abc123 user_id 12345
HSET apikey:abc123 tier "premium"
HSET apikey:abc123 limit 10000
EXPIRE apikey:abc123 600
```

## PostgreSQL Schema (Configuration Storage)

### Rate Limit Rules Table
```sql
CREATE TABLE rate_limit_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(255) NOT NULL UNIQUE,
    priority INTEGER NOT NULL DEFAULT 100,
    
    -- Matching conditions
    user_tier VARCHAR(50),
    endpoint_pattern VARCHAR(500),
    http_method VARCHAR(10),
    ip_range CIDR,
    
    -- Rate limit configuration
    algorithm VARCHAR(50) NOT NULL, -- token_bucket, sliding_window, etc.
    requests_per_second INTEGER,
    requests_per_minute INTEGER,
    requests_per_hour INTEGER,
    requests_per_day INTEGER,
    burst_size INTEGER,
    
    -- Actions
    action VARCHAR(50) NOT NULL DEFAULT 'throttle', -- throttle, block, allow
    response_status INTEGER DEFAULT 429,
    response_message TEXT,
    retry_after_seconds INTEGER,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255),
    enabled BOOLEAN DEFAULT TRUE,
    
    INDEX idx_priority (priority DESC),
    INDEX idx_enabled (enabled),
    INDEX idx_user_tier (user_tier),
    INDEX idx_endpoint_pattern (endpoint_pattern)
);

-- Example rules
INSERT INTO rate_limit_rules (rule_name, priority, user_tier, algorithm, requests_per_hour, burst_size)
VALUES ('free_tier_limit', 700, 'free', 'token_bucket', 1000, 20);

INSERT INTO rate_limit_rules (rule_name, priority, endpoint_pattern, algorithm, requests_per_second)
VALUES ('api_v1_limit', 600, '/api/v1/*', 'sliding_window', 100);
```

### User Quotas Table
```sql
CREATE TABLE user_quotas (
    user_id BIGINT PRIMARY KEY,
    tier VARCHAR(50) NOT NULL DEFAULT 'free',
    
    -- Custom limits (override defaults)
    custom_limit_per_hour INTEGER,
    custom_limit_per_day INTEGER,
    custom_burst_size INTEGER,
    
    -- Usage tracking
    total_requests_today BIGINT DEFAULT 0,
    total_requests_month BIGINT DEFAULT 0,
    last_request_at TIMESTAMP,
    
    -- Quota management
    quota_reset_at TIMESTAMP,
    quota_exceeded_count INTEGER DEFAULT 0,
    
    -- Status
    is_blocked BOOLEAN DEFAULT FALSE,
    block_reason TEXT,
    blocked_until TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_tier (tier),
    INDEX idx_blocked (is_blocked),
    INDEX idx_last_request (last_request_at)
);
```

### API Keys Table
```sql
CREATE TABLE api_keys (
    api_key_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_hash VARCHAR(255) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL REFERENCES user_quotas(user_id),
    
    -- Key metadata
    key_name VARCHAR(255),
    tier VARCHAR(50) NOT NULL DEFAULT 'free',
    
    -- Rate limits
    requests_per_second INTEGER,
    requests_per_hour INTEGER,
    requests_per_day INTEGER,
    burst_size INTEGER,
    
    -- Usage tracking
    total_requests BIGINT DEFAULT 0,
    last_used_at TIMESTAMP,
    
    -- Key management
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP,
    revoked_by VARCHAR(255),
    
    INDEX idx_user_id (user_id),
    INDEX idx_tier (tier),
    INDEX idx_active (is_active),
    INDEX idx_expires (expires_at)
);
```

### Audit Logs Table (Time-Series)
```sql
CREATE TABLE rate_limit_audit_logs (
    log_id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Request identifiers
    user_id BIGINT,
    api_key_id UUID,
    ip_address INET,
    endpoint VARCHAR(500),
    http_method VARCHAR(10),
    
    -- Rate limit decision
    rule_id UUID REFERENCES rate_limit_rules(rule_id),
    decision VARCHAR(20) NOT NULL, -- allowed, throttled, blocked
    current_count INTEGER,
    limit_value INTEGER,
    
    -- Response
    response_status INTEGER,
    retry_after_seconds INTEGER,
    
    -- Metadata
    region VARCHAR(50),
    server_id VARCHAR(100),
    latency_ms INTEGER
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions
CREATE TABLE rate_limit_audit_logs_2024_01 PARTITION OF rate_limit_audit_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Indexes on partitions
CREATE INDEX idx_audit_timestamp ON rate_limit_audit_logs (timestamp DESC);
CREATE INDEX idx_audit_user ON rate_limit_audit_logs (user_id, timestamp DESC);
CREATE INDEX idx_audit_decision ON rate_limit_audit_logs (decision, timestamp DESC);
```

### Metrics Aggregation Table
```sql
CREATE TABLE rate_limit_metrics (
    metric_id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    granularity VARCHAR(20) NOT NULL, -- minute, hour, day
    
    -- Dimensions
    user_id BIGINT,
    endpoint VARCHAR(500),
    region VARCHAR(50),
    
    -- Metrics
    total_requests BIGINT DEFAULT 0,
    allowed_requests BIGINT DEFAULT 0,
    throttled_requests BIGINT DEFAULT 0,
    blocked_requests BIGINT DEFAULT 0,
    
    -- Latency percentiles
    latency_p50_ms INTEGER,
    latency_p95_ms INTEGER,
    latency_p99_ms INTEGER,
    
    -- Cache metrics
    cache_hits BIGINT DEFAULT 0,
    cache_misses BIGINT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE (timestamp, granularity, user_id, endpoint, region)
) PARTITION BY RANGE (timestamp);

-- Indexes
CREATE INDEX idx_metrics_timestamp ON rate_limit_metrics (timestamp DESC, granularity);
CREATE INDEX idx_metrics_user ON rate_limit_metrics (user_id, timestamp DESC);
```

## Data Sharding Strategy

### User-Based Sharding
```
Shard Key: user_id % num_shards

Shard 0: user_id % 10 = 0 (users 0, 10, 20, ...)
Shard 1: user_id % 10 = 1 (users 1, 11, 21, ...)
...
Shard 9: user_id % 10 = 9 (users 9, 19, 29, ...)

Benefits:
- Even distribution of users
- All user data on same shard
- Simple routing logic

Challenges:
- Hot users create hot shards
- Difficult to rebalance
```

### Consistent Hashing
```
Hash Ring: 0 to 2^32-1

Servers:
- Server A: hash("server_a") = 1000000000
- Server B: hash("server_b") = 2000000000
- Server C: hash("server_c") = 3000000000

User Routing:
- user_12345: hash("user_12345") = 1500000000 → Server B
- user_67890: hash("user_67890") = 2500000000 → Server C

Benefits:
- Easy to add/remove servers
- Minimal data movement
- Handles hot users better

Virtual Nodes:
- Each server has 100 virtual nodes
- Better distribution
- Smoother rebalancing
```

## Data Retention and Archival

### Hot Data (Redis)
- **Retention**: 1 hour for counters
- **TTL**: Automatic expiration
- **Size**: 130 GB per region

### Warm Data (PostgreSQL)
- **Retention**: 90 days for audit logs
- **Partitioning**: Monthly partitions
- **Size**: 10 TB per year

### Cold Data (S3)
- **Retention**: 7 years for compliance
- **Compression**: Parquet format
- **Size**: 1 TB per year (compressed)

### Archival Strategy
```sql
-- Archive old partitions to S3
COPY (
    SELECT * FROM rate_limit_audit_logs_2023_01
) TO 's3://rate-limiter-archive/2023/01/audit_logs.parquet'
WITH (FORMAT PARQUET, COMPRESSION SNAPPY);

-- Drop old partition
DROP TABLE rate_limit_audit_logs_2023_01;
```

## Backup and Disaster Recovery

### Redis Backup
```bash
# RDB snapshots every 5 minutes
save 300 1

# AOF for durability
appendonly yes
appendfsync everysec

# Backup to S3
redis-cli --rdb /tmp/dump.rdb
aws s3 cp /tmp/dump.rdb s3://backups/redis/$(date +%Y%m%d)/
```

### PostgreSQL Backup
```bash
# Continuous archiving with WAL
archive_mode = on
archive_command = 'aws s3 cp %p s3://backups/postgres/wal/%f'

# Daily base backup
pg_basebackup -D /backup -Ft -z -P
aws s3 cp /backup s3://backups/postgres/base/$(date +%Y%m%d)/

# Point-in-time recovery
restore_command = 'aws s3 cp s3://backups/postgres/wal/%f %p'
```

This database design provides efficient storage, fast lookups, and comprehensive tracking for a high-performance rate limiting system.
