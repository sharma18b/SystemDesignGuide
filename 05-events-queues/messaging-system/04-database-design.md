# Distributed Messaging System - Database Design

## Log-Based Storage Model

### Commit Log Structure
The messaging system uses an append-only commit log as its primary storage model, similar to Kafka.

```
Partition Log File:
┌─────────────────────────────────────────────────────────┐
│ Offset | Size | Timestamp | Key Size | Key | Value     │
├─────────────────────────────────────────────────────────┤
│ 0      | 1024 | 167047... | 8        | u123| {...}     │
│ 1      | 2048 | 167047... | 8        | u456| {...}     │
│ 2      | 512  | 167047... | 8        | u789| {...}     │
└─────────────────────────────────────────────────────────┘

Properties:
- Immutable once written
- Sequential writes (fast)
- Sequential reads (fast)
- Indexed for random access
```

### Segment Files
```
Partition Directory: /data/topic-name/partition-0/
├── 00000000000000000000.log      (1GB segment)
├── 00000000000000000000.index    (Offset index)
├── 00000000000000000000.timeindex (Time index)
├── 00000000000001000000.log      (Next segment)
├── 00000000000001000000.index
└── 00000000000001000000.timeindex

Segment Naming:
- Name = Base offset (20 digits, zero-padded)
- Active segment: Currently being written
- Closed segments: Immutable, eligible for deletion

Segment Configuration:
- Max size: 1GB (segment.bytes)
- Max time: 7 days (segment.ms)
- Retention: 7 days (retention.ms)
- Cleanup policy: delete or compact
```

## Index Structures

### Offset Index
Maps offset to physical file position for fast random access.

```
Index File Format:
┌──────────────────────────────────┐
│ Relative Offset | File Position  │
├──────────────────────────────────┤
│ 0               | 0              │
│ 1000            | 1048576        │
│ 2000            | 2097152        │
│ 3000            | 3145728        │
└──────────────────────────────────┘

Properties:
- Sparse index (not every message)
- Index interval: 4KB (index.interval.bytes)
- Memory-mapped for fast access
- Binary search for lookup
```

### Time Index
Maps timestamp to offset for time-based queries.

```
Time Index Format:
┌──────────────────────────────────┐
│ Timestamp       | Offset         │
├──────────────────────────────────┤
│ 1670472000000   | 0              │
│ 1670472060000   | 1000           │
│ 1670472120000   | 2000           │
└──────────────────────────────────┘

Use Cases:
- Seek to timestamp
- Time-based retention
- Consumer rewind to time
```

## Message Format

### Message Structure (V2 Protocol)
```
Message:
├── Length: 4 bytes (total message size)
├── Attributes: 1 byte (compression, timestamp type)
├── Timestamp Delta: varint (delta from batch timestamp)
├── Offset Delta: varint (delta from batch base offset)
├── Key Length: varint
├── Key: variable bytes
├── Value Length: varint
├── Value: variable bytes
└── Headers: variable (key-value pairs)

Batch Structure:
├── Base Offset: 8 bytes
├── Batch Length: 4 bytes
├── Partition Leader Epoch: 4 bytes
├── Magic: 1 byte (version)
├── CRC: 4 bytes (checksum)
├── Attributes: 2 bytes (compression, timestamp type)
├── Last Offset Delta: 4 bytes
├── First Timestamp: 8 bytes
├── Max Timestamp: 8 bytes
├── Producer ID: 8 bytes
├── Producer Epoch: 2 bytes
├── Base Sequence: 4 bytes
├── Records Count: 4 bytes
└── Records: variable (array of messages)

Compression:
- None, Gzip, Snappy, LZ4, Zstd
- Applied to entire batch
- 3:1 compression ratio typical
```

## Metadata Storage

### Topic Metadata
```sql
-- Stored in ZooKeeper/Raft
Topic: user-events
{
  "name": "user-events",
  "partitions": 10,
  "replication_factor": 3,
  "config": {
    "retention.ms": 604800000,  // 7 days
    "segment.bytes": 1073741824,  // 1GB
    "compression.type": "snappy",
    "cleanup.policy": "delete",
    "min.insync.replicas": 2
  },
  "partition_assignment": {
    "0": {"leader": 1, "replicas": [1, 2, 3], "isr": [1, 2, 3]},
    "1": {"leader": 2, "replicas": [2, 3, 1], "isr": [2, 3, 1]},
    ...
  }
}
```

### Broker Metadata
```json
{
  "broker_id": 1,
  "host": "broker1.example.com",
  "port": 9092,
  "rack": "us-east-1a",
  "endpoints": {
    "PLAINTEXT": "broker1.example.com:9092",
    "SSL": "broker1.example.com:9093"
  },
  "jmx_port": 9999
}
```

## Consumer Offset Storage

### __consumer_offsets Topic
Special internal topic for storing consumer offsets.

```
Topic: __consumer_offsets
Partitions: 50 (configurable)
Replication: 3

Key Format:
{
  "group": "analytics-service",
  "topic": "user-events",
  "partition": 0
}

Value Format:
{
  "offset": 1234567,
  "metadata": "committed by consumer-1",
  "commit_timestamp": 1670472000000,
  "expire_timestamp": 1670558400000
}

Compaction:
- Cleanup policy: compact
- Keep only latest offset per key
- Delete expired offsets
```

### Offset Commit Protocol
```
1. Consumer processes messages up to offset 1000
2. Consumer commits offset 1001 (next to read)
3. Broker writes to __consumer_offsets
4. Broker acknowledges commit
5. On restart, consumer reads from offset 1001

Commit Strategies:
- Auto-commit: Every 5 seconds (default)
- Manual commit: After processing batch
- Sync commit: Wait for acknowledgment
- Async commit: Fire and forget
```

## Log Compaction

### Compaction Strategy
For topics with cleanup.policy=compact, keep only the latest value for each key.

```
Before Compaction:
Offset | Key  | Value
0      | u123 | {name: "Alice", age: 25}
1      | u456 | {name: "Bob", age: 30}
2      | u123 | {name: "Alice", age: 26}  // Update
3      | u789 | {name: "Charlie", age: 35}
4      | u456 | null  // Tombstone (delete)

After Compaction:
Offset | Key  | Value
2      | u123 | {name: "Alice", age: 26}  // Latest
3      | u789 | {name: "Charlie", age: 35}
// u456 deleted (tombstone)

Use Cases:
- Database changelog
- User profile updates
- Configuration management
- State snapshots
```

### Compaction Process
```
1. Cleaner thread scans old segments
2. Build offset map (key → latest offset)
3. Copy latest records to new segment
4. Replace old segments with new
5. Delete old segments

Configuration:
- min.cleanable.dirty.ratio: 0.5 (50% dirty)
- delete.retention.ms: 86400000 (1 day for tombstones)
- min.compaction.lag.ms: 0 (immediate)
```

## Replication State

### Replica State Machine
```
States:
- NewReplica: Just created
- OnlineReplica: Catching up or in-sync
- OfflineReplica: Broker down
- ReplicaDeletionStarted: Being deleted
- ReplicaDeletionSuccessful: Deleted
- ReplicaDeletionIneligible: Cannot delete
- NonExistentReplica: Doesn't exist

Transitions:
NewReplica → OnlineReplica (catch up complete)
OnlineReplica → OfflineReplica (broker failure)
OfflineReplica → OnlineReplica (broker recovery)
```

### High Watermark and Log End Offset
```
Partition Log:
┌─────────────────────────────────────────────────┐
│ 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11│
└─────────────────────────────────────────────────┘
                    ↑           ↑
                    HW          LEO

HW (High Watermark): 5
- Last offset replicated to all ISR
- Consumers can only read up to HW
- Guarantees durability

LEO (Log End Offset): 11
- Last offset in leader's log
- May not be replicated yet
- Not visible to consumers

Leader Election:
- New leader must have offset >= HW
- Ensures no data loss
- Prefers in-sync replicas
```

## Transaction Support

### Transactional Messages
For exactly-once semantics, messages can be written transactionally.

```
Transaction Coordinator:
- Manages transaction state
- Assigns transaction IDs
- Coordinates commit/abort

Transaction Log:
Topic: __transaction_state
- Stores transaction metadata
- Compacted topic
- Replicated for durability

Transaction Flow:
1. Producer begins transaction
2. Producer sends messages (marked transactional)
3. Producer commits transaction
4. Coordinator writes commit marker
5. Consumers see messages atomically

Isolation Levels:
- read_uncommitted: See all messages
- read_committed: See only committed messages
```

## Storage Optimization

### Tiered Storage
```
Hot Tier (Local SSD):
- Recent messages (7 days)
- Fast access
- Expensive

Warm Tier (HDD):
- Older messages (30 days)
- Slower access
- Cheaper

Cold Tier (Object Storage):
- Archive (1 year)
- Rare access
- Very cheap

Migration:
- Automatic based on age
- Transparent to consumers
- Configurable policies
```

### Compression Strategies
```
Compression Types:
1. Gzip: Best compression (3:1), slower
2. Snappy: Fast, good compression (2:1)
3. LZ4: Very fast, decent compression (2:1)
4. Zstd: Best balance (3:1), fast

Recommendation:
- Logs: Gzip (high compression)
- Events: Snappy (balance)
- Metrics: LZ4 (speed)
```

## Backup and Recovery

### Backup Strategy
```
1. Replication (Primary):
   - 3x replication across brokers
   - Automatic failover
   - No data loss

2. Snapshots (Secondary):
   - Daily snapshots to S3
   - Compressed and encrypted
   - 30-day retention

3. Cross-Region Replication:
   - Mirror topics to DR region
   - Async replication
   - 1-minute lag acceptable

Recovery:
- Broker failure: Automatic (replicas)
- Partition loss: Restore from snapshot
- Region failure: Failover to DR region
```

This database design provides efficient, durable, and scalable storage for high-throughput messaging workloads.
