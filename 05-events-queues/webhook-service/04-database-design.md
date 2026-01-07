# Webhook Notification Service - Database Design

## PostgreSQL Schema

### Webhooks Table
```sql
CREATE TABLE webhooks (
    webhook_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL,
    webhook_url TEXT NOT NULL,
    
    -- Configuration
    secret VARCHAR(255) NOT NULL,  -- HMAC secret
    enabled BOOLEAN DEFAULT TRUE,
    description TEXT,
    
    -- Delivery settings
    timeout_seconds INTEGER DEFAULT 30,
    max_retries INTEGER DEFAULT 5,
    retry_strategy VARCHAR(50) DEFAULT 'exponential',
    
    -- Filters
    event_filters JSONB,  -- {event_types: [...], conditions: {...}}
    
    -- Security
    ip_allowlist INET[],
    auth_type VARCHAR(50),  -- none, bearer, basic
    auth_credentials TEXT,  -- Encrypted
    
    -- Status
    status VARCHAR(50) DEFAULT 'active',  -- active, paused, disabled
    failure_count INTEGER DEFAULT 0,
    last_success_at TIMESTAMP,
    last_failure_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_user_webhooks (user_id, enabled),
    INDEX idx_status (status, enabled)
);
```

### Subscriptions Table
```sql
CREATE TABLE webhook_subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(webhook_id) ON DELETE CASCADE,
    event_type VARCHAR(255) NOT NULL,
    
    -- Filters
    filters JSONB,  -- Additional event-specific filters
    
    -- Status
    enabled BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE (webhook_id, event_type),
    INDEX idx_event_type (event_type, enabled) WHERE enabled = TRUE
);

-- Example subscriptions
INSERT INTO webhook_subscriptions (webhook_id, event_type, filters)
VALUES 
  ('webhook-uuid-1', 'payment.success', '{"amount": {"gt": 100}}'),
  ('webhook-uuid-1', 'payment.failed', NULL),
  ('webhook-uuid-2', 'order.created', '{"region": "US"}');
```

### Deliveries Table
```sql
CREATE TABLE webhook_deliveries (
    delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(webhook_id),
    event_id UUID NOT NULL,
    
    -- Delivery details
    attempt_number INTEGER DEFAULT 1,
    status VARCHAR(50) NOT NULL,  -- pending, success, failed, retrying
    
    -- Request
    request_url TEXT NOT NULL,
    request_headers JSONB,
    request_body JSONB,
    request_sent_at TIMESTAMP,
    
    -- Response
    response_status INTEGER,
    response_headers JSONB,
    response_body TEXT,
    response_received_at TIMESTAMP,
    response_time_ms INTEGER,
    
    -- Error handling
    error_message TEXT,
    next_retry_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_webhook_deliveries (webhook_id, created_at DESC),
    INDEX idx_event_deliveries (event_id),
    INDEX idx_status_retry (status, next_retry_at) WHERE status = 'retrying',
    INDEX idx_pending (status, created_at) WHERE status = 'pending'
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE webhook_deliveries_2024_01 PARTITION OF webhook_deliveries
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Events Table
```sql
CREATE TABLE webhook_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(255) NOT NULL,
    event_data JSONB NOT NULL,
    
    -- Metadata
    source_service VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    
    -- Delivery tracking
    webhook_count INTEGER DEFAULT 0,  -- Number of webhooks triggered
    delivery_success_count INTEGER DEFAULT 0,
    delivery_failure_count INTEGER DEFAULT 0,
    
    INDEX idx_event_type (event_type, created_at DESC),
    INDEX idx_created_at (created_at DESC)
) PARTITION BY RANGE (created_at);

-- Create daily partitions for high volume
CREATE TABLE webhook_events_2024_01_08 PARTITION OF webhook_events
    FOR VALUES FROM ('2024-01-08') TO ('2024-01-09');
```

### Dead Letter Queue Table
```sql
CREATE TABLE webhook_dlq (
    dlq_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL,
    event_id UUID NOT NULL,
    delivery_id UUID NOT NULL,
    
    -- Failure details
    failure_reason TEXT NOT NULL,
    attempt_count INTEGER NOT NULL,
    last_error TEXT,
    last_response_status INTEGER,
    
    -- Resolution
    status VARCHAR(50) DEFAULT 'pending',  -- pending, resolved, discarded
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(255),
    resolution_notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_webhook_dlq (webhook_id, created_at DESC),
    INDEX idx_status (status, created_at)
);
```

## Redis Data Structures

### Delivery Queue
```redis
# Priority queue for pending deliveries
ZADD delivery_queue {timestamp} {delivery_id}

# Pop deliveries ready for processing
ZRANGEBYSCORE delivery_queue 0 {current_timestamp} LIMIT 0 100
ZREM delivery_queue {delivery_id}

# Retry queue with delay
ZADD retry_queue {retry_timestamp} {delivery_id}
```

### Webhook Cache
```redis
# Cache webhook configuration
HSET webhook:{webhook_id} url {url} secret {secret} timeout 30 max_retries 5
EXPIRE webhook:{webhook_id} 3600

# Cache subscriptions by event type
SADD subscriptions:{event_type} {webhook_id_1} {webhook_id_2}
EXPIRE subscriptions:{event_type} 3600

# Get webhooks for event
SMEMBERS subscriptions:payment.success
```

### Circuit Breaker State
```redis
# Track circuit breaker state
HSET circuit:{webhook_id} state closed failures 0 last_failure 0
EXPIRE circuit:{webhook_id} 3600

# Increment failure count
HINCRBY circuit:{webhook_id} failures 1

# Check state
HGET circuit:{webhook_id} state
```

### Rate Limiting
```redis
# Rate limit deliveries per endpoint
INCR rate_limit:{webhook_id}:{minute}
EXPIRE rate_limit:{webhook_id}:{minute} 120

# Check if rate limited
GET rate_limit:{webhook_id}:{current_minute}
```

## Time-Series Data (InfluxDB)

### Delivery Metrics
```influxdb
# Write delivery metrics
webhook_delivery,webhook_id=webhook-123,status=success response_time=250,attempt=1 1704708000000000000

# Query success rate
SELECT COUNT(response_time) 
FROM webhook_delivery 
WHERE time > now() - 24h 
GROUP BY status

# Query P99 latency
SELECT PERCENTILE(response_time, 99) 
FROM webhook_delivery 
WHERE time > now() - 1h 
GROUP BY webhook_id
```

### Endpoint Health Metrics
```influxdb
# Write endpoint health
endpoint_health,url=example.com status_code=200,response_time=250,success=1 1704708000000000000

# Query endpoint availability
SELECT MEAN(success) 
FROM endpoint_health 
WHERE time > now() - 1h 
GROUP BY url
```

## Data Retention and Cleanup

### Retention Policies
```sql
-- Delete old deliveries (keep 90 days)
DELETE FROM webhook_deliveries
WHERE created_at < NOW() - INTERVAL '90 days';

-- Archive old events (keep 30 days in main table)
INSERT INTO webhook_events_archive
SELECT * FROM webhook_events
WHERE created_at < NOW() - INTERVAL '30 days';

DELETE FROM webhook_events
WHERE created_at < NOW() - INTERVAL '30 days';

-- Cleanup resolved DLQ entries (keep 7 days)
DELETE FROM webhook_dlq
WHERE status = 'resolved'
  AND resolved_at < NOW() - INTERVAL '7 days';
```

### Archival Strategy
```bash
# Compress and export to S3
pg_dump -t webhook_deliveries_2023_12 | gzip > deliveries_2023_12.sql.gz
aws s3 cp deliveries_2023_12.sql.gz s3://webhook-archive/2023/12/

# Drop old partition
DROP TABLE webhook_deliveries_2023_12;
```

## Backup and Recovery

### Backup Strategy
```bash
# Daily full backup
pg_dump -Fc webhook_service > backup_$(date +%Y%m%d).dump

# Continuous archiving
archive_mode = on
archive_command = 'aws s3 cp %p s3://backups/wal/%f'

# Point-in-time recovery
restore_command = 'aws s3 cp s3://backups/wal/%f %p'
recovery_target_time = '2024-01-08 10:00:00'
```

### Redis Persistence
```redis
# RDB snapshots
save 900 1
save 300 10
save 60 10000

# AOF
appendonly yes
appendfsync everysec

# Backup
redis-cli --rdb /tmp/dump.rdb
aws s3 cp /tmp/dump.rdb s3://backups/redis/$(date +%Y%m%d)/
```

This database design provides efficient storage, fast queries, and reliable tracking for webhook deliveries at scale.
