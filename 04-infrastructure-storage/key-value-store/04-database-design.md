# Key-Value Store - Database Design

## Data Model

### Core Data Structure
```
Key-Value Pair:
{
  key: string,              // Primary identifier (max 1KB)
  value: bytes,             // Arbitrary data (max 1MB)
  timestamp: int64,         // Microsecond precision
  ttl: int32,              // Time-to-live in seconds (optional)
  version: int64,          // Version number for optimistic locking
  metadata: {
    created_at: timestamp,
    updated_at: timestamp,
    size: int32,
    checksum: string
  }
}
```

### Key Design Patterns
- **Simple Keys**: `user:12345`, `session:abc-def-ghi`
- **Hierarchical Keys**: `app:prod:cache:user:12345`
- **Composite Keys**: `tenant_id:user_id:resource_type:resource_id`
- **Time-Based Keys**: `metrics:2024-01-08:server1:cpu`
- **Hash-Based Keys**: `shard_0:user:12345` (for manual sharding)

### Value Types and Encoding
- **String**: UTF-8 encoded text
- **Binary**: Raw bytes (images, serialized objects)
- **JSON**: Structured data with schema flexibility
- **Protocol Buffers**: Efficient binary serialization
- **MessagePack**: Compact binary JSON-like format
- **Compressed**: Snappy/LZ4 compression for large values

## Storage Schema

### SSTable File Format
```
┌─────────────────────────────────────────────────────────────────┐
│                        SSTable File                             │
├─────────────────────────────────────────────────────────────────┤
│  File Header (64 bytes)                                         │
│  - Magic Number: 0x5354414C (STAL)                              │
│  - Version: 1                                                   │
│  - Compression: Snappy/LZ4/None                                 │
│  - Block Size: 4KB-64KB                                         │
│  - Key Count: int64                                             │
│  - Min Key: string                                              │
│  - Max Key: string                                              │
│  - Created At: timestamp                                        │
├─────────────────────────────────────────────────────────────────┤
│  Data Blocks (variable size)                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Block 1: [key1:value1, key2:value2, ..., keyN:valueN]  │   │
│  │ Block 2: [...]                                          │   │
│  │ ...                                                     │   │
│  │ Block M: [...]                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Index Block (sparse index)                                     │
│  - Block 1 Offset: 1024, First Key: "aaa"                      │
│  - Block 2 Offset: 5120, First Key: "mmm"                      │
│  - Block M Offset: 98304, First Key: "zzz"                     │
├─────────────────────────────────────────────────────────────────┤
│  Bloom Filter (probabilistic filter)                            │
│  - Bit Array: 10KB-1MB                                          │
│  - Hash Functions: 3-5 hash functions                           │
│  - False Positive Rate: 1%                                      │
├─────────────────────────────────────────────────────────────────┤
│  Metadata Block                                                 │
│  - Statistics: min/max/avg key size, value size                 │
│  - Compression Ratio: 3.2x                                      │
│  - Checksum: CRC32 for data integrity                           │
│  - Footer Offset: pointer to footer                             │
├─────────────────────────────────────────────────────────────────┤
│  Footer (fixed size)                                            │
│  - Index Block Offset: int64                                    │
│  - Bloom Filter Offset: int64                                   │
│  - Metadata Block Offset: int64                                 │
│  - Magic Number: 0x464F4F54 (FOOT)                              │
└─────────────────────────────────────────────────────────────────┘
```

### Write-Ahead Log (WAL) Format
```
┌─────────────────────────────────────────────────────────────────┐
│                        WAL File                                 │
├─────────────────────────────────────────────────────────────────┤
│  File Header                                                    │
│  - Magic Number: 0x57414C00 (WAL)                               │
│  - Version: 1                                                   │
│  - Created At: timestamp                                        │
│  - Sequence Number: int64 (starting sequence)                   │
├─────────────────────────────────────────────────────────────────┤
│  Log Records (append-only)                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Record 1:                                               │   │
│  │   - Sequence: int64                                     │   │
│  │   - Timestamp: int64                                    │   │
│  │   - Operation: PUT/DELETE/UPDATE                        │   │
│  │   - Key Length: int32                                   │   │
│  │   - Value Length: int32                                 │   │
│  │   - Key: bytes                                          │   │
│  │   - Value: bytes                                        │   │
│  │   - Checksum: CRC32                                     │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Record 2: [...]                                         │   │
│  │ ...                                                     │   │
│  │ Record N: [...]                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Metadata Management

### Node Metadata
```sql
-- Stored in distributed configuration service (ZooKeeper/etcd)

Node:
  node_id: UUID
  hostname: string
  ip_address: string
  port: int
  datacenter: string
  rack: string
  status: JOINING|NORMAL|LEAVING|DOWN
  tokens: [int64]  -- Virtual node tokens
  load: float      -- Data size in GB
  cpu_usage: float
  memory_usage: float
  last_heartbeat: timestamp
```

### Partition Metadata
```sql
Partition:
  partition_id: int64
  token_range: (start_token, end_token)
  replicas: [node_id]  -- Ordered preference list
  primary_node: node_id
  size_bytes: int64
  key_count: int64
  last_compaction: timestamp
  status: HEALTHY|DEGRADED|UNAVAILABLE
```

### SSTable Metadata
```sql
SSTable:
  sstable_id: UUID
  node_id: UUID
  level: int  -- LSM tree level (0-6)
  file_path: string
  size_bytes: int64
  key_count: int64
  min_key: string
  max_key: string
  min_timestamp: int64
  max_timestamp: int64
  bloom_filter_size: int64
  compression_ratio: float
  created_at: timestamp
  last_accessed: timestamp
```

## Indexing Strategy

### Primary Index (Key-Based)
- **Structure**: Hash index for MemTable, sorted index for SSTables
- **Lookup**: O(1) for MemTable, O(log N) for SSTables
- **Storage**: In-memory for MemTable, on-disk for SSTables
- **Updates**: Append-only, no in-place updates
- **Compaction**: Merge and rebuild indexes during compaction

### Bloom Filters
- **Purpose**: Avoid unnecessary SSTable reads
- **Size**: 10 bits per key (1% false positive rate)
- **Hash Functions**: 3-5 independent hash functions
- **Memory**: 1.25 bytes per key (for 1% FPR)
- **Effectiveness**: Reduce disk reads by 90%+

### Secondary Indexes (Optional)
```
Secondary Index Structure:
  index_name: string
  indexed_field: string
  index_type: HASH|BTREE|BITMAP
  
Index Entry:
  indexed_value: any
  primary_keys: [string]  -- List of keys with this value
  
Example:
  Index: user_email
  Entry: "john@example.com" → ["user:123", "session:abc"]
```

## Data Partitioning

### Partition Key Selection
- **Hash Partitioning**: MD5(key) % partition_count
- **Range Partitioning**: Lexicographic key ranges
- **Composite Partitioning**: Hash(tenant_id) + Range(timestamp)
- **Custom Partitioning**: Application-defined partition function

### Partition Distribution
```
Consistent Hash Ring:
  Total Tokens: 2^64
  Nodes: 100
  VNodes per Node: 256
  Total VNodes: 25,600
  
Token Assignment:
  Node 1: [0, 256, 512, ..., 25344]
  Node 2: [1, 257, 513, ..., 25345]
  ...
  Node 100: [99, 355, 611, ..., 25443]
  
Key Placement:
  hash("user:123") = 42 → Token 42 → Node 1
  Replicas: Node 1 (primary), Node 2, Node 3
```

## Replication Schema

### Replication Metadata
```sql
Replication_Config:
  keyspace: string
  replication_factor: int  -- N (typically 3)
  replication_strategy: SIMPLE|NETWORK_TOPOLOGY
  datacenters: {
    dc1: replication_factor: 3
    dc2: replication_factor: 2
  }
  
Replica_State:
  key: string
  replicas: [
    {
      node_id: UUID,
      version: int64,
      timestamp: int64,
      status: SYNCED|LAGGING|DIVERGED
    }
  ]
```

### Version Vectors
```
Version Vector (for conflict resolution):
  key: "user:123"
  versions: {
    node_1: 5,  -- Node 1 has seen 5 updates
    node_2: 4,  -- Node 2 has seen 4 updates
    node_3: 5   -- Node 3 has seen 5 updates
  }
  
Conflict Detection:
  V1 = {node_1: 5, node_2: 4, node_3: 5}
  V2 = {node_1: 4, node_2: 5, node_3: 5}
  → Concurrent writes detected (neither dominates)
  → Application must resolve conflict
```

## Data Lifecycle Management

### TTL (Time-To-Live)
```
TTL Implementation:
  - Store expiration timestamp with each key
  - Lazy deletion: Check TTL on read
  - Active deletion: Background process scans and deletes
  - Tombstone: Mark as deleted, remove during compaction
  
TTL Storage:
  key: "session:abc"
  value: {...}
  ttl: 3600  -- seconds
  expires_at: current_time + 3600
```

### Compaction and Garbage Collection
- **Tombstone Removal**: Delete tombstones older than gc_grace_seconds
- **Version Pruning**: Keep only latest version of each key
- **Expired Key Removal**: Delete keys past TTL
- **Orphan Cleanup**: Remove data for deleted partitions
- **Space Reclamation**: Reclaim disk space from deleted data

### Data Archival
```
Archival Strategy:
  - Hot Data: <30 days, on NVMe SSD
  - Warm Data: 30-365 days, on SATA SSD
  - Cold Data: >365 days, on object storage (S3)
  
Archival Process:
  1. Identify old SSTables (last_accessed > 30 days)
  2. Upload to object storage
  3. Create stub with pointer to archived location
  4. Delete local SSTable
  5. On read: Fetch from object storage if needed
```

## Consistency and Conflict Resolution

### Conflict Resolution Strategies
```
Last-Write-Wins (LWW):
  - Use timestamp to determine winner
  - Simple but may lose concurrent updates
  
  Example:
    Write 1: key="user:123", value="Alice", ts=100
    Write 2: key="user:123", value="Bob", ts=105
    Result: value="Bob" (higher timestamp wins)

Vector Clocks:
  - Track causality for each replica
  - Detect concurrent writes
  - Preserve all conflicting versions
  
  Example:
    Node A: [A:1] → "Alice"
    Node B: [B:1] → "Bob"
    Conflict: Both versions preserved
    Application resolves: merge or choose one
```

### Read Repair
```
Read Repair Process:
  1. Client reads with R=2 from 3 replicas
  2. Coordinator receives:
     - Node A: value="Alice", version=5
     - Node B: value="Bob", version=6
  3. Coordinator detects inconsistency
  4. Return latest value ("Bob") to client
  5. Background: Update Node A to version=6
```

## Backup and Recovery

### Backup Schema
```
Backup Metadata:
  backup_id: UUID
  backup_type: FULL|INCREMENTAL
  started_at: timestamp
  completed_at: timestamp
  size_bytes: int64
  node_count: int
  sstable_count: int
  status: IN_PROGRESS|COMPLETED|FAILED
  
Backup Contents:
  - SSTables: All SSTable files
  - Metadata: Node and partition metadata
  - WAL: Recent write-ahead logs
  - Configuration: Cluster configuration
  - Schemas: Keyspace and table schemas
```

### Recovery Process
1. **Restore Metadata**: Recreate cluster topology
2. **Restore SSTables**: Copy SSTable files to nodes
3. **Rebuild Indexes**: Recreate bloom filters and indexes
4. **Replay WAL**: Apply recent writes from WAL
5. **Verify Consistency**: Run repair to ensure consistency
6. **Resume Operations**: Bring cluster online

This database design provides a solid foundation for implementing a production-grade distributed key-value store with strong durability, consistency, and performance characteristics.
