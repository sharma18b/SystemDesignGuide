# Distributed Task Scheduler - Database Design

## PostgreSQL Schema

### Tasks Table
```sql
CREATE TABLE tasks (
    task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_name VARCHAR(255) NOT NULL,
    task_type VARCHAR(50) NOT NULL,  -- one_time, recurring, cron
    
    -- Scheduling
    schedule_expression VARCHAR(255),  -- Cron expression or interval
    timezone VARCHAR(50) DEFAULT 'UTC',
    next_execution_time TIMESTAMP NOT NULL,
    last_execution_time TIMESTAMP,
    
    -- Task configuration
    payload JSONB NOT NULL,
    timeout_seconds INTEGER DEFAULT 300,
    max_retries INTEGER DEFAULT 3,
    retry_count INTEGER DEFAULT 0,
    priority VARCHAR(20) DEFAULT 'medium',  -- high, medium, low
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',  -- scheduled, running, completed, failed, cancelled
    enabled BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255),
    tags JSONB,
    
    -- Indexes
    INDEX idx_next_execution (next_execution_time, status, enabled) WHERE enabled = TRUE,
    INDEX idx_status (status, updated_at),
    INDEX idx_task_type (task_type),
    INDEX idx_created_by (created_by)
);

-- Example tasks
INSERT INTO tasks (task_name, task_type, schedule_expression, next_execution_time, payload)
VALUES 
  ('daily_report', 'cron', '0 0 * * *', '2024-01-09 00:00:00', '{"report_type": "daily"}'),
  ('health_check', 'recurring', '*/5 * * * *', '2024-01-08 10:05:00', '{"endpoint": "/health"}'),
  ('send_reminder', 'one_time', NULL, '2024-01-08 14:00:00', '{"user_id": 123, "message": "Meeting at 2 PM"}');
```

### Task Executions Table
```sql
CREATE TABLE task_executions (
    execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    
    -- Execution details
    worker_id VARCHAR(255),
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    
    -- Result
    status VARCHAR(50) NOT NULL,  -- success, failed, timeout, cancelled
    result JSONB,
    error_message TEXT,
    
    -- Retry information
    retry_number INTEGER DEFAULT 0,
    is_retry BOOLEAN DEFAULT FALSE,
    
    INDEX idx_task_executions (task_id, started_at DESC),
    INDEX idx_worker (worker_id, started_at DESC),
    INDEX idx_status_time (status, started_at DESC)
) PARTITION BY RANGE (started_at);

-- Create monthly partitions
CREATE TABLE task_executions_2024_01 PARTITION OF task_executions
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE task_executions_2024_02 PARTITION OF task_executions
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
```

### Task Dependencies Table
```sql
CREATE TABLE task_dependencies (
    dependency_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    depends_on_task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    
    -- Dependency configuration
    dependency_type VARCHAR(50) DEFAULT 'success',  -- success, completion, any
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE (task_id, depends_on_task_id),
    INDEX idx_task_deps (task_id),
    INDEX idx_depends_on (depends_on_task_id)
);

-- Example: Report generation depends on data processing
INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type)
VALUES 
  ('report_task_id', 'data_processing_task_id', 'success');
```

### Workers Table
```sql
CREATE TABLE workers (
    worker_id VARCHAR(255) PRIMARY KEY,
    worker_name VARCHAR(255),
    
    -- Worker status
    status VARCHAR(50) NOT NULL DEFAULT 'active',  -- active, inactive, draining
    capacity INTEGER DEFAULT 10,  -- Max concurrent tasks
    current_load INTEGER DEFAULT 0,
    
    -- Health
    last_heartbeat TIMESTAMP NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    
    -- Metadata
    hostname VARCHAR(255),
    ip_address INET,
    version VARCHAR(50),
    tags JSONB,
    
    INDEX idx_status_heartbeat (status, last_heartbeat DESC)
);

-- Worker heartbeat update
UPDATE workers 
SET last_heartbeat = NOW(), current_load = 5
WHERE worker_id = 'worker-1';

-- Find available workers
SELECT worker_id, capacity - current_load as available_capacity
FROM workers
WHERE status = 'active'
  AND last_heartbeat > NOW() - INTERVAL '30 seconds'
  AND current_load < capacity
ORDER BY available_capacity DESC
LIMIT 10;
```

### Task Locks Table
```sql
CREATE TABLE task_locks (
    task_id UUID PRIMARY KEY REFERENCES tasks(task_id) ON DELETE CASCADE,
    worker_id VARCHAR(255) NOT NULL,
    locked_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    
    INDEX idx_expires (expires_at)
);

-- Acquire lock
INSERT INTO task_locks (task_id, worker_id, expires_at)
VALUES ('task-uuid', 'worker-1', NOW() + INTERVAL '5 minutes')
ON CONFLICT (task_id) DO NOTHING
RETURNING task_id;

-- Release lock
DELETE FROM task_locks WHERE task_id = 'task-uuid' AND worker_id = 'worker-1';

-- Cleanup expired locks
DELETE FROM task_locks WHERE expires_at < NOW();
```

## Redis Data Structures

### Task Queue (Priority Queues)
```redis
# High priority queue
ZADD task_queue:high {timestamp} {task_id}

# Medium priority queue
ZADD task_queue:medium {timestamp} {task_id}

# Low priority queue
ZADD task_queue:low {timestamp} {task_id}

# Pop tasks ready for execution
ZRANGEBYSCORE task_queue:high 0 {current_timestamp} LIMIT 0 100

# Remove executed task
ZREM task_queue:high {task_id}
```

### Task Locks (Distributed Locking)
```redis
# Acquire lock with expiration
SET task:lock:{task_id} {worker_id} NX EX 300

# Check lock ownership
GET task:lock:{task_id}

# Extend lock for long-running tasks
EXPIRE task:lock:{task_id} 300

# Release lock
DEL task:lock:{task_id}

# Lua script for atomic lock acquisition
EVAL "
  local key = KEYS[1]
  local worker_id = ARGV[1]
  local ttl = tonumber(ARGV[2])
  
  local current = redis.call('GET', key)
  if current == false then
    redis.call('SET', key, worker_id, 'EX', ttl)
    return 1
  elseif current == worker_id then
    redis.call('EXPIRE', key, ttl)
    return 1
  else
    return 0
  end
" 1 task:lock:task-123 worker-1 300
```

### Worker Registry
```redis
# Register worker with heartbeat
HSET worker:{worker_id} status active capacity 10 current_load 0
EXPIRE worker:{worker_id} 60

# Update heartbeat
EXPIRE worker:{worker_id} 60

# Get all active workers
KEYS worker:*

# Worker capacity tracking
HINCRBY worker:{worker_id} current_load 1
HINCRBY worker:{worker_id} current_load -1
```

### Task Cache (Hot Tasks)
```redis
# Cache task details
HSET task:cache:{task_id} payload {json} schedule {cron} priority high
EXPIRE task:cache:{task_id} 3600

# Get cached task
HGETALL task:cache:{task_id}

# Invalidate cache
DEL task:cache:{task_id}
```

## Time-Series Data (InfluxDB)

### Task Execution Metrics
```influxdb
# Write execution metrics
task_execution,task_id=task-123,worker_id=worker-1,status=success duration=5000,retry_count=0 1704708000000000000

# Query average execution time
SELECT MEAN(duration) 
FROM task_execution 
WHERE time > now() - 24h 
GROUP BY task_id

# Query success rate
SELECT COUNT(duration) 
FROM task_execution 
WHERE time > now() - 24h 
GROUP BY status

# Query P99 latency
SELECT PERCENTILE(duration, 99) 
FROM task_execution 
WHERE time > now() - 1h
```

### Worker Metrics
```influxdb
# Write worker metrics
worker_metrics,worker_id=worker-1 cpu_usage=45.2,memory_usage=60.5,tasks_running=5 1704708000000000000

# Query worker utilization
SELECT MEAN(cpu_usage), MEAN(memory_usage) 
FROM worker_metrics 
WHERE time > now() - 1h 
GROUP BY worker_id
```

## Data Retention and Archival

### Retention Policies
```sql
-- Delete old task executions (keep 90 days)
DELETE FROM task_executions
WHERE started_at < NOW() - INTERVAL '90 days';

-- Archive completed one-time tasks (keep 30 days)
DELETE FROM tasks
WHERE task_type = 'one_time'
  AND status = 'completed'
  AND updated_at < NOW() - INTERVAL '30 days';

-- Cleanup cancelled tasks
DELETE FROM tasks
WHERE status = 'cancelled'
  AND updated_at < NOW() - INTERVAL '7 days';
```

### Archival Strategy
```sql
-- Create archive table
CREATE TABLE task_executions_archive (
    LIKE task_executions INCLUDING ALL
);

-- Move old data to archive
INSERT INTO task_executions_archive
SELECT * FROM task_executions
WHERE started_at < NOW() - INTERVAL '90 days';

-- Compress and export to S3
COPY (SELECT * FROM task_executions_archive)
TO PROGRAM 'gzip > /tmp/executions_2023.csv.gz'
WITH CSV HEADER;

-- Upload to S3
aws s3 cp /tmp/executions_2023.csv.gz s3://task-scheduler-archive/2023/
```

## Backup and Recovery

### Backup Strategy
```bash
# Daily full backup
pg_dump -Fc task_scheduler > backup_$(date +%Y%m%d).dump

# Continuous archiving (WAL)
archive_mode = on
archive_command = 'aws s3 cp %p s3://backups/wal/%f'

# Point-in-time recovery
restore_command = 'aws s3 cp s3://backups/wal/%f %p'
recovery_target_time = '2024-01-08 10:00:00'
```

### Redis Persistence
```redis
# RDB snapshots
save 900 1      # After 900 sec if at least 1 key changed
save 300 10     # After 300 sec if at least 10 keys changed
save 60 10000   # After 60 sec if at least 10000 keys changed

# AOF (Append Only File)
appendonly yes
appendfsync everysec

# Backup to S3
redis-cli --rdb /tmp/dump.rdb
aws s3 cp /tmp/dump.rdb s3://backups/redis/$(date +%Y%m%d)/
```

This database design provides efficient storage, fast queries, and reliable data management for distributed task scheduling at scale.
