# Distributed Unique ID Generator - Database Design

## Database Architecture Overview

### Minimal Database Requirements
The ID generator is designed to be **stateless** and requires minimal persistent storage. The primary data storage needs are:
- **Configuration Storage**: Worker ID assignments and system configuration
- **Metrics Storage**: Historical performance and usage metrics
- **Audit Logs**: ID generation events for compliance and debugging

### Database Strategy
```
┌─────────────────────────────────────────────────────────────┐
│                    Storage Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐│
│  │  Configuration   │  │  Metrics Store   │  │ Audit Logs ││
│  │  (Zookeeper/etcd)│  │  (ClickHouse)    │  │ (S3/HDFS)  ││
│  │                  │  │                  │  │            ││
│  │  - Worker IDs    │  │  - Performance   │  │ - Events   ││
│  │  - DC mappings   │  │  - Usage stats   │  │ - Errors   ││
│  │  - Epoch config  │  │  - Alerts        │  │ - Audits   ││
│  └──────────────────┘  └──────────────────┘  └────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Configuration Storage (Zookeeper/etcd)

### Worker Registration Schema

#### Zookeeper Data Model
```
/id-generator
  /config
    /epoch                    # "1609459200000" (2021-01-01)
    /max_sequence             # "4095"
    /clock_drift_threshold    # "100" (milliseconds)
  
  /datacenters
    /dc0
      /name                   # "us-east-1"
      /region                 # "us-east"
      /workers
        /worker0              # Ephemeral node
          data: {
            "hostname": "id-gen-01.example.com",
            "ip": "10.0.1.10",
            "port": 8080,
            "started_at": "2024-01-03T19:00:00Z",
            "version": "1.2.3"
          }
        /worker1              # Ephemeral node
          data: {
            "hostname": "id-gen-02.example.com",
            "ip": "10.0.1.11",
            "port": 8080,
            "started_at": "2024-01-03T19:05:00Z",
            "version": "1.2.3"
          }
    /dc1
      /name                   # "eu-west-1"
      /region                 # "eu-west"
      /workers
        /worker0
        /worker1
  
  /retired_workers            # Grace period before reuse
    /dc0_worker5
      data: {
        "retired_at": "2024-01-03T18:00:00Z",
        "last_id": 1234567890123456789,
        "reuse_after": "2024-01-03T19:00:00Z"
      }
```

#### etcd Data Model (Alternative)
```
Key-Value Structure:

/id-generator/config/epoch
  Value: "1609459200000"

/id-generator/datacenters/dc0/name
  Value: "us-east-1"

/id-generator/datacenters/dc0/workers/worker0
  Value: {
    "hostname": "id-gen-01.example.com",
    "ip": "10.0.1.10",
    "port": 8080,
    "started_at": "2024-01-03T19:00:00Z",
    "version": "1.2.3"
  }
  Lease: 30 seconds (auto-renewal)

/id-generator/retired_workers/dc0_worker5
  Value: {
    "retired_at": "2024-01-03T18:00:00Z",
    "last_id": 1234567890123456789,
    "reuse_after": "2024-01-03T19:00:00Z"
  }
  TTL: 3600 seconds
```

### Configuration Management Operations

#### Worker Registration
```python
def register_worker(zk_client, datacenter_id, worker_id, node_info):
    """
    Register worker with Zookeeper
    """
    path = f"/id-generator/datacenters/dc{datacenter_id}/workers/worker{worker_id}"
    
    # Create ephemeral node
    zk_client.create(
        path,
        value=json.dumps(node_info).encode(),
        ephemeral=True,
        makepath=True
    )
    
    # Set up watch for configuration changes
    @zk_client.DataWatch(f"/id-generator/config/epoch")
    def watch_epoch(data, stat):
        if data:
            new_epoch = int(data.decode())
            update_epoch(new_epoch)
    
    return path
```

#### Worker Deregistration
```python
def deregister_worker(zk_client, datacenter_id, worker_id, last_id):
    """
    Gracefully deregister worker
    """
    # Move to retired workers
    retired_path = f"/id-generator/retired_workers/dc{datacenter_id}_worker{worker_id}"
    retired_info = {
        "retired_at": datetime.utcnow().isoformat(),
        "last_id": last_id,
        "reuse_after": (datetime.utcnow() + timedelta(hours=1)).isoformat()
    }
    
    zk_client.create(
        retired_path,
        value=json.dumps(retired_info).encode(),
        makepath=True
    )
    
    # Delete active worker node
    worker_path = f"/id-generator/datacenters/dc{datacenter_id}/workers/worker{worker_id}"
    zk_client.delete(worker_path)
```

## Metrics Storage (ClickHouse)

### ID Generation Events Table
```sql
CREATE TABLE id_generation_events (
    event_id UUID DEFAULT generateUUIDv4(),
    timestamp DateTime64(3) DEFAULT now64(),
    datacenter_id UInt8,
    worker_id UInt8,
    generated_id Int64,
    sequence_number UInt16,
    generation_latency_us UInt32,
    client_ip String,
    client_user_agent String,
    request_id String,
    error_code UInt16 DEFAULT 0,
    error_message String DEFAULT ''
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (datacenter_id, worker_id, timestamp)
SETTINGS index_granularity = 8192;

-- Indexes for common queries
CREATE INDEX idx_timestamp ON id_generation_events(timestamp) TYPE minmax;
CREATE INDEX idx_worker ON id_generation_events(datacenter_id, worker_id) TYPE set(100);
CREATE INDEX idx_error ON id_generation_events(error_code) TYPE set(10);
```

### Performance Metrics Table
```sql
CREATE TABLE performance_metrics (
    timestamp DateTime,
    datacenter_id UInt8,
    worker_id UInt8,
    metric_name String,
    metric_value Float64,
    tags Map(String, String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (datacenter_id, worker_id, metric_name, timestamp)
SETTINGS index_granularity = 8192;

-- Materialized view for aggregated metrics
CREATE MATERIALIZED VIEW performance_metrics_hourly
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (datacenter_id, worker_id, metric_name, toStartOfHour(timestamp))
AS SELECT
    toStartOfHour(timestamp) as timestamp,
    datacenter_id,
    worker_id,
    metric_name,
    avg(metric_value) as avg_value,
    max(metric_value) as max_value,
    min(metric_value) as min_value,
    count() as sample_count
FROM performance_metrics
GROUP BY timestamp, datacenter_id, worker_id, metric_name;
```

### Clock Drift Monitoring Table
```sql
CREATE TABLE clock_drift_events (
    timestamp DateTime64(3),
    datacenter_id UInt8,
    worker_id UInt8,
    drift_ms Int32,
    ntp_server String,
    ntp_stratum UInt8,
    system_time DateTime64(3),
    ntp_time DateTime64(3),
    corrective_action String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (datacenter_id, worker_id, timestamp)
SETTINGS index_granularity = 8192;
```

### Sequence Overflow Events Table
```sql
CREATE TABLE sequence_overflow_events (
    timestamp DateTime64(3),
    datacenter_id UInt8,
    worker_id UInt8,
    overflow_count UInt32,
    wait_time_ms UInt32,
    requests_queued UInt32,
    load_factor Float32
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (datacenter_id, worker_id, timestamp)
SETTINGS index_granularity = 8192;
```

## Audit Logging (S3/HDFS)

### Audit Log Format
```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-03T19:30:00.123Z",
  "event_type": "id_generated",
  "datacenter_id": 0,
  "worker_id": 5,
  "generated_id": 1234567890123456789,
  "id_components": {
    "timestamp_ms": 1704310200123,
    "datacenter_id": 0,
    "worker_id": 5,
    "sequence": 42
  },
  "request_metadata": {
    "client_ip": "192.168.1.100",
    "user_agent": "MyApp/1.0",
    "request_id": "req-123456",
    "api_version": "v1"
  },
  "performance": {
    "generation_latency_us": 45,
    "queue_time_us": 10,
    "total_latency_us": 55
  }
}
```

### Audit Log Partitioning Strategy
```
S3 Bucket Structure:
s3://id-generator-audit-logs/
  year=2024/
    month=01/
      day=03/
        hour=19/
          dc0_worker5_20240103_19.json.gz
          dc0_worker6_20240103_19.json.gz
          dc1_worker0_20240103_19.json.gz

Retention Policy:
- Hot storage (S3 Standard): 30 days
- Warm storage (S3 IA): 31-365 days
- Cold storage (S3 Glacier): 1-7 years
- Deletion: After 7 years
```

## Analytics and Reporting Queries

### Common Query Patterns

#### IDs Generated Per Second
```sql
SELECT
    toStartOfMinute(timestamp) as minute,
    datacenter_id,
    worker_id,
    count() as ids_generated,
    count() / 60 as ids_per_second
FROM id_generation_events
WHERE timestamp >= now() - INTERVAL 1 HOUR
GROUP BY minute, datacenter_id, worker_id
ORDER BY minute DESC, datacenter_id, worker_id;
```

#### Average Generation Latency
```sql
SELECT
    datacenter_id,
    worker_id,
    avg(generation_latency_us) as avg_latency_us,
    quantile(0.50)(generation_latency_us) as p50_latency_us,
    quantile(0.95)(generation_latency_us) as p95_latency_us,
    quantile(0.99)(generation_latency_us) as p99_latency_us
FROM id_generation_events
WHERE timestamp >= now() - INTERVAL 1 HOUR
GROUP BY datacenter_id, worker_id
ORDER BY datacenter_id, worker_id;
```

#### Clock Drift Analysis
```sql
SELECT
    toStartOfHour(timestamp) as hour,
    datacenter_id,
    worker_id,
    avg(drift_ms) as avg_drift_ms,
    max(drift_ms) as max_drift_ms,
    count() as drift_events
FROM clock_drift_events
WHERE timestamp >= now() - INTERVAL 24 HOUR
  AND abs(drift_ms) > 10
GROUP BY hour, datacenter_id, worker_id
ORDER BY hour DESC, max_drift_ms DESC;
```

#### Sequence Overflow Analysis
```sql
SELECT
    toStartOfHour(timestamp) as hour,
    datacenter_id,
    worker_id,
    sum(overflow_count) as total_overflows,
    avg(wait_time_ms) as avg_wait_ms,
    max(wait_time_ms) as max_wait_ms,
    avg(load_factor) as avg_load_factor
FROM sequence_overflow_events
WHERE timestamp >= now() - INTERVAL 24 HOUR
GROUP BY hour, datacenter_id, worker_id
HAVING total_overflows > 0
ORDER BY hour DESC, total_overflows DESC;
```

#### Error Rate Analysis
```sql
SELECT
    toStartOfMinute(timestamp) as minute,
    datacenter_id,
    worker_id,
    error_code,
    error_message,
    count() as error_count,
    count() * 100.0 / (
        SELECT count()
        FROM id_generation_events
        WHERE timestamp >= now() - INTERVAL 1 HOUR
    ) as error_rate_percent
FROM id_generation_events
WHERE timestamp >= now() - INTERVAL 1 HOUR
  AND error_code != 0
GROUP BY minute, datacenter_id, worker_id, error_code, error_message
ORDER BY minute DESC, error_count DESC;
```

## Data Retention and Archival

### Retention Policies
```sql
-- Drop old partitions (ClickHouse)
ALTER TABLE id_generation_events 
DROP PARTITION '202312';  -- Drop December 2023 data

-- Automated retention policy
CREATE TABLE retention_policy (
    table_name String,
    retention_days UInt16,
    partition_key String
) ENGINE = Memory;

INSERT INTO retention_policy VALUES
    ('id_generation_events', 90, 'toYYYYMM(timestamp)'),
    ('performance_metrics', 365, 'toYYYYMM(timestamp)'),
    ('clock_drift_events', 180, 'toYYYYMM(timestamp)'),
    ('sequence_overflow_events', 180, 'toYYYYMM(timestamp)');
```

### Backup Strategy
```bash
# ClickHouse backup script
#!/bin/bash

# Backup configuration
BACKUP_DIR="/backups/clickhouse"
RETENTION_DAYS=30

# Create backup
clickhouse-backup create "backup_$(date +%Y%m%d_%H%M%S)"

# Upload to S3
clickhouse-backup upload "backup_$(date +%Y%m%d_%H%M%S)"

# Clean old backups
clickhouse-backup delete local --keep-last 7
clickhouse-backup delete remote --keep-last 30
```

## Caching Strategy

### In-Memory Configuration Cache
```python
class ConfigCache:
    def __init__(self, zk_client):
        self.zk_client = zk_client
        self.cache = {}
        self.cache_ttl = 60  # seconds
        self.last_update = {}
        
    def get_config(self, key):
        now = time.time()
        
        # Check cache freshness
        if key in self.cache and \
           now - self.last_update.get(key, 0) < self.cache_ttl:
            return self.cache[key]
        
        # Fetch from Zookeeper
        path = f"/id-generator/config/{key}"
        data, stat = self.zk_client.get(path)
        value = data.decode()
        
        # Update cache
        self.cache[key] = value
        self.last_update[key] = now
        
        return value
```

## Database Performance Optimization

### ClickHouse Optimization
```sql
-- Optimize table (merge parts)
OPTIMIZE TABLE id_generation_events FINAL;

-- Update statistics
ANALYZE TABLE id_generation_events;

-- Check table size
SELECT
    table,
    formatReadableSize(sum(bytes)) as size,
    sum(rows) as rows,
    max(modification_time) as latest_modification
FROM system.parts
WHERE table = 'id_generation_events'
  AND active
GROUP BY table;
```

### Query Performance Tuning
```sql
-- Use materialized views for common aggregations
CREATE MATERIALIZED VIEW daily_id_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, datacenter_id, worker_id)
AS SELECT
    toDate(timestamp) as date,
    datacenter_id,
    worker_id,
    count() as total_ids,
    avg(generation_latency_us) as avg_latency,
    max(generation_latency_us) as max_latency
FROM id_generation_events
GROUP BY date, datacenter_id, worker_id;
```

This database design provides efficient storage and retrieval of configuration, metrics, and audit data while maintaining the stateless nature of the ID generation service itself.
