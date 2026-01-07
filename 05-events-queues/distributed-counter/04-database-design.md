# Distributed Counter - Database Design

## Redis Data Structures

### Simple Counter
```redis
# String-based counter (atomic operations)
SET counter:page_views:article_123 1234567
INCR counter:page_views:article_123
INCRBY counter:page_views:article_123 10
GET counter:page_views:article_123

# With expiration (time-windowed)
SETEX counter:api_requests:user_123:2024_01_08_10 3600 100
INCR counter:api_requests:user_123:2024_01_08_10

# Lua script for atomic increment with metadata
EVAL "
  local key = KEYS[1]
  local delta = tonumber(ARGV[1])
  local value = redis.call('INCRBY', key, delta)
  redis.call('HSET', key .. ':meta', 'updated_at', ARGV[2])
  return value
" 1 counter:page_views:article_123 1 1704708000
```

### Sharded Counter
```redis
# Multiple shards for high-throughput counters
SET counter:page_views:article_123:shard:0 123456
SET counter:page_views:article_123:shard:1 234567
SET counter:page_views:article_123:shard:2 345678
SET counter:page_views:article_123:shard:3 456789

# Increment random shard
INCR counter:page_views:article_123:shard:{random(0,3)}

# Read total (Lua script for atomicity)
EVAL "
  local prefix = KEYS[1]
  local total = 0
  for i = 0, 3 do
    local value = redis.call('GET', prefix .. ':shard:' .. i)
    if value then
      total = total + tonumber(value)
    end
  end
  return total
" 1 counter:page_views:article_123

# Configuration
HSET counter:page_views:article_123:config num_shards 4
```

### Time-Windowed Counter (Sorted Set)
```redis
# Store counts with timestamps
ZADD counter:api_requests:user_123 1704708000 "100"
ZADD counter:api_requests:user_123 1704708060 "150"
ZADD counter:api_requests:user_123 1704708120 "200"

# Get count in last hour
ZRANGEBYSCORE counter:api_requests:user_123 (now-3600) +inf WITHSCORES

# Remove old entries
ZREMRANGEBYSCORE counter:api_requests:user_123 -inf (now-3600)

# Increment current minute bucket
EVAL "
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local bucket = math.floor(now / 60) * 60
  local delta = tonumber(ARGV[2])
  
  local current = redis.call('ZSCORE', key, bucket)
  if current then
    redis.call('ZADD', key, 'XX', bucket, current + delta)
  else
    redis.call('ZADD', key, bucket, delta)
  end
  
  -- Remove old buckets
  redis.call('ZREMRANGEBYSCORE', key, '-inf', now - 3600)
  
  return redis.call('ZRANGE', key, 0, -1, 'WITHSCORES')
" 1 counter:api_requests:user_123 1704708000 1
```

### HyperLogLog (Unique Counts)
```redis
# Count unique visitors
PFADD counter:unique_visitors:article_123 "user_1"
PFADD counter:unique_visitors:article_123 "user_2"
PFADD counter:unique_visitors:article_123 "user_1"  # Duplicate, not counted

# Get unique count
PFCOUNT counter:unique_visitors:article_123  # Returns 2

# Merge multiple HyperLogLogs
PFMERGE counter:unique_visitors:all \
  counter:unique_visitors:article_123 \
  counter:unique_visitors:article_456

# Memory: 12KB per counter, 0.81% error rate
```

### Hash-Based Counter (Multiple Fields)
```redis
# Store multiple related counters
HINCRBY counter:article_123 views 1
HINCRBY counter:article_123 likes 1
HINCRBY counter:article_123 shares 1

# Get all counters
HGETALL counter:article_123
# Returns: {views: 1234, likes: 567, shares: 89}

# Get specific counter
HGET counter:article_123 views

# Atomic multi-field increment
EVAL "
  local key = KEYS[1]
  redis.call('HINCRBY', key, 'views', ARGV[1])
  redis.call('HINCRBY', key, 'likes', ARGV[2])
  return redis.call('HGETALL', key)
" 1 counter:article_123 1 0
```

## PostgreSQL Schema

### Counters Table
```sql
CREATE TABLE counters (
    counter_id VARCHAR(255) PRIMARY KEY,
    value BIGINT NOT NULL DEFAULT 0,
    shard_count INTEGER DEFAULT 1,
    counter_type VARCHAR(50) NOT NULL,  -- simple, sharded, windowed
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_sync_at TIMESTAMP,
    
    -- Configuration
    config JSONB,  -- {window_size: 3600, num_shards: 4}
    
    -- Indexes
    INDEX idx_counter_type (counter_type),
    INDEX idx_updated_at (updated_at DESC)
);

-- Example records
INSERT INTO counters (counter_id, value, counter_type, config)
VALUES 
  ('page_views:article_123', 1234567, 'simple', '{}'),
  ('api_requests:user_123', 0, 'windowed', '{"window_size": 3600}'),
  ('unique_visitors:article_123', 0, 'hyperloglog', '{}');
```

### Counter Shards Table
```sql
CREATE TABLE counter_shards (
    counter_id VARCHAR(255) NOT NULL,
    shard_id INTEGER NOT NULL,
    value BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    
    PRIMARY KEY (counter_id, shard_id),
    FOREIGN KEY (counter_id) REFERENCES counters(counter_id) ON DELETE CASCADE,
    
    INDEX idx_counter_shard (counter_id, shard_id)
);

-- Example: Sharded counter with 4 shards
INSERT INTO counter_shards (counter_id, shard_id, value)
VALUES 
  ('page_views:article_123', 0, 123456),
  ('page_views:article_123', 1, 234567),
  ('page_views:article_123', 2, 345678),
  ('page_views:article_123', 3, 456789);

-- Get total count
SELECT counter_id, SUM(value) as total_value
FROM counter_shards
WHERE counter_id = 'page_views:article_123'
GROUP BY counter_id;
```

### Time-Series Counters Table
```sql
CREATE TABLE counter_timeseries (
    counter_id VARCHAR(255) NOT NULL,
    bucket_timestamp TIMESTAMP NOT NULL,
    value BIGINT NOT NULL DEFAULT 0,
    
    PRIMARY KEY (counter_id, bucket_timestamp),
    INDEX idx_counter_time (counter_id, bucket_timestamp DESC)
) PARTITION BY RANGE (bucket_timestamp);

-- Create monthly partitions
CREATE TABLE counter_timeseries_2024_01 PARTITION OF counter_timeseries
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE counter_timeseries_2024_02 PARTITION OF counter_timeseries
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Insert time-series data
INSERT INTO counter_timeseries (counter_id, bucket_timestamp, value)
VALUES 
  ('api_requests:user_123', '2024-01-08 10:00:00', 100),
  ('api_requests:user_123', '2024-01-08 10:01:00', 150),
  ('api_requests:user_123', '2024-01-08 10:02:00', 200);

-- Query last hour
SELECT SUM(value) as total_requests
FROM counter_timeseries
WHERE counter_id = 'api_requests:user_123'
  AND bucket_timestamp >= NOW() - INTERVAL '1 hour';
```

### Counter Aggregates Table
```sql
CREATE TABLE counter_aggregates (
    counter_id VARCHAR(255) NOT NULL,
    granularity VARCHAR(20) NOT NULL,  -- minute, hour, day, month
    period_start TIMESTAMP NOT NULL,
    value BIGINT NOT NULL,
    
    PRIMARY KEY (counter_id, granularity, period_start),
    INDEX idx_counter_period (counter_id, granularity, period_start DESC)
);

-- Pre-aggregated data for fast queries
INSERT INTO counter_aggregates (counter_id, granularity, period_start, value)
VALUES 
  ('page_views:article_123', 'hour', '2024-01-08 10:00:00', 15000),
  ('page_views:article_123', 'day', '2024-01-08 00:00:00', 350000),
  ('page_views:article_123', 'month', '2024-01-01 00:00:00', 10000000);

-- Fast query for daily stats
SELECT period_start, value
FROM counter_aggregates
WHERE counter_id = 'page_views:article_123'
  AND granularity = 'day'
  AND period_start >= '2024-01-01'
ORDER BY period_start DESC;
```

## Data Synchronization

### Sync Queue Table
```sql
CREATE TABLE counter_sync_queue (
    id BIGSERIAL PRIMARY KEY,
    counter_id VARCHAR(255) NOT NULL,
    delta BIGINT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    synced BOOLEAN DEFAULT FALSE,
    
    INDEX idx_unsynced (synced, timestamp) WHERE NOT synced
);

-- Buffer increments for batch sync
INSERT INTO counter_sync_queue (counter_id, delta)
VALUES ('page_views:article_123', 1);

-- Batch sync every 1 second
UPDATE counters c
SET value = c.value + q.total_delta,
    updated_at = NOW(),
    last_sync_at = NOW()
FROM (
    SELECT counter_id, SUM(delta) as total_delta
    FROM counter_sync_queue
    WHERE NOT synced
    GROUP BY counter_id
) q
WHERE c.counter_id = q.counter_id;

-- Mark as synced
UPDATE counter_sync_queue
SET synced = TRUE
WHERE NOT synced;
```

## Backup and Recovery

### Snapshot Strategy
```sql
-- Create snapshot table
CREATE TABLE counter_snapshots (
    snapshot_id BIGSERIAL PRIMARY KEY,
    counter_id VARCHAR(255) NOT NULL,
    value BIGINT NOT NULL,
    snapshot_timestamp TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_snapshot_time (snapshot_timestamp DESC)
);

-- Daily snapshot
INSERT INTO counter_snapshots (counter_id, value)
SELECT counter_id, value
FROM counters;

-- Point-in-time recovery
SELECT counter_id, value
FROM counter_snapshots
WHERE snapshot_timestamp <= '2024-01-08 10:00:00'
ORDER BY snapshot_timestamp DESC
LIMIT 1;
```

### Audit Log
```sql
CREATE TABLE counter_audit_log (
    id BIGSERIAL PRIMARY KEY,
    counter_id VARCHAR(255) NOT NULL,
    operation VARCHAR(20) NOT NULL,  -- increment, decrement, reset
    delta BIGINT,
    old_value BIGINT,
    new_value BIGINT,
    user_id VARCHAR(255),
    timestamp TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_counter_audit (counter_id, timestamp DESC)
) PARTITION BY RANGE (timestamp);

-- Log every operation
INSERT INTO counter_audit_log (counter_id, operation, delta, old_value, new_value)
VALUES ('page_views:article_123', 'increment', 1, 1234567, 1234568);
```

## Data Retention and Cleanup

### Retention Policies
```sql
-- Delete old time-series data (keep 30 days)
DELETE FROM counter_timeseries
WHERE bucket_timestamp < NOW() - INTERVAL '30 days';

-- Archive old aggregates (keep 1 year in main table)
INSERT INTO counter_aggregates_archive
SELECT * FROM counter_aggregates
WHERE period_start < NOW() - INTERVAL '1 year';

DELETE FROM counter_aggregates
WHERE period_start < NOW() - INTERVAL '1 year';

-- Cleanup inactive counters (no updates in 90 days)
DELETE FROM counters
WHERE updated_at < NOW() - INTERVAL '90 days'
  AND counter_type != 'permanent';
```

This database design provides efficient storage, fast queries, and reliable synchronization for distributed counters at scale.
