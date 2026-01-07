# Key-Value Store - System Architecture

## High-Level Architecture Overview

### System Architecture Principles
- **Distributed Hash Table (DHT)**: Consistent hashing for data distribution
- **Masterless Architecture**: No single point of failure, peer-to-peer design
- **Tunable Consistency**: Configurable consistency levels per operation
- **Horizontal Scalability**: Linear scaling by adding nodes
- **Fault Tolerance**: Automatic replication and failover
- **Eventually Consistent**: AP system with optional strong consistency

### Core Architecture Components
```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   SDK/CLI    │  │  REST API    │  │  Binary      │         │
│  │   Clients    │  │  Gateway     │  │  Protocol    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Coordination Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Request    │  │   Partition  │  │   Membership │         │
│  │   Router     │  │   Manager    │  │   Protocol   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Storage Nodes                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Node 1     │  │   Node 2     │  │   Node N     │         │
│  │  ┌────────┐  │  │  ┌────────┐  │  │  ┌────────┐  │         │
│  │  │MemTable│  │  │  │MemTable│  │  │  │MemTable│  │         │
│  │  │  WAL   │  │  │  │  WAL   │  │  │  │  WAL   │  │         │
│  │  │ SSTables│  │  │  │ SSTables│  │  │  │ SSTables│  │         │
│  │  └────────┘  │  │  └────────┘  │  │  └────────┘  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Replication Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Quorum     │  │   Anti-      │  │   Hinted     │         │
│  │   Protocol   │  │   Entropy    │  │   Handoff    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

## Data Partitioning and Distribution

### Consistent Hashing Architecture
```
                    Hash Ring (0 to 2^128-1)
                           
                    Node A (vnodes: 0-255)
                          ╱
                         ╱
        Node D ────────●────────── Node B
       (vnodes:        │           (vnodes:
        768-1023)      │           256-511)
                       │
                       │
                    Node C
                 (vnodes: 512-767)

Key Distribution:
- hash("user:123") → 42 → Node A
- hash("session:xyz") → 300 → Node B
- hash("cache:abc") → 650 → Node C
```

### Virtual Nodes (VNodes)
- **VNodes per Physical Node**: 256 virtual nodes
- **Purpose**: Even data distribution and flexible rebalancing
- **Token Assignment**: Random or evenly spaced tokens on ring
- **Rebalancing**: Move vnodes instead of entire node's data
- **Hot Spot Mitigation**: Split hot vnodes to multiple physical nodes
- **Failure Handling**: Distribute failed node's vnodes across cluster

### Partition Strategy
- **Partition Key**: Hash of primary key determines partition
- **Hash Function**: MD5 or MurmurHash3 for uniform distribution
- **Partition Count**: 256 vnodes × 100 nodes = 25,600 partitions
- **Partition Size**: Target 1-2GB per partition
- **Replication**: Each partition replicated to N nodes (N=3)
- **Preference List**: Ordered list of N nodes responsible for key

## Storage Engine Architecture

### LSM-Tree Storage Engine
```
┌─────────────────────────────────────────────────────────────────┐
│                        Write Path                               │
│                                                                 │
│  Client Write → MemTable (in-memory) → WAL (disk)              │
│                     │                                           │
│                     ▼ (when full)                               │
│                 Immutable MemTable                              │
│                     │                                           │
│                     ▼ (flush)                                   │
│                 SSTable Level 0                                 │
│                     │                                           │
│                     ▼ (compaction)                              │
│         ┌───────────┴───────────┐                               │
│         ▼                       ▼                               │
│    SSTable Level 1         SSTable Level 2                      │
│         │                       │                               │
│         ▼                       ▼                               │
│    SSTable Level 3    ...   SSTable Level N                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        Read Path                                │
│                                                                 │
│  Client Read → MemTable → Immutable MemTable → Bloom Filters   │
│                                                      │           │
│                                                      ▼           │
│                                              SSTable Index       │
│                                                      │           │
│                                                      ▼           │
│                                              SSTable Data        │
│                                                      │           │
│                                                      ▼           │
│                                              Return Value        │
└─────────────────────────────────────────────────────────────────┘
```

### Write-Ahead Log (WAL)
- **Purpose**: Durability and crash recovery
- **Format**: Append-only sequential writes
- **Sync Policy**: fsync every 100ms or 1000 writes
- **Rotation**: New WAL file every 1GB or 10 minutes
- **Replay**: Reconstruct MemTable on node restart
- **Cleanup**: Delete WAL after MemTable flushed to SSTable

### MemTable (In-Memory Buffer)
- **Data Structure**: Skip list or red-black tree for sorted keys
- **Size**: 64MB default, configurable per table
- **Write Buffer**: Multiple MemTables for concurrent writes
- **Flush Trigger**: Size threshold or time-based
- **Immutable MemTable**: Read-only during flush to SSTable
- **Concurrent Access**: Lock-free reads, synchronized writes

### SSTable (Sorted String Table)
- **Format**: Immutable sorted key-value files on disk
- **Structure**: Data blocks + index blocks + bloom filter + metadata
- **Compression**: Snappy or LZ4 for data blocks
- **Block Size**: 4KB-64KB for efficient I/O
- **Index**: Sparse index for fast key lookup
- **Bloom Filter**: Probabilistic filter to avoid unnecessary reads

## Compaction Strategy

### Leveled Compaction
```
Level 0: [SST1] [SST2] [SST3] [SST4]  (overlapping ranges)
           │      │      │      │
           └──────┴──────┴──────┘
                  │
                  ▼ (compact)
Level 1: [SST5────────] [SST6────────]  (non-overlapping, 10x L0)
           │              │
           └──────────────┘
                  │
                  ▼ (compact)
Level 2: [SST7──────────────────────]  (non-overlapping, 10x L1)
```

### Compaction Process
- **Trigger**: Level size exceeds threshold (L0: 4 files, L1: 10MB, L2: 100MB)
- **Selection**: Pick overlapping SSTables from adjacent levels
- **Merge**: Merge-sort keys, apply tombstones, remove duplicates
- **Output**: Write new SSTables to next level
- **Cleanup**: Delete old SSTables after compaction
- **Throttling**: Limit compaction I/O to avoid impacting reads/writes

### Compaction Strategies
- **Size-Tiered**: Merge SSTables of similar size (write-heavy workloads)
- **Leveled**: Merge into non-overlapping levels (read-heavy workloads)
- **Time-Window**: Compact by time windows (time-series data)
- **Hybrid**: Combine strategies for different data patterns

## Replication and Consistency

### Quorum-Based Replication
```
Client Request (W=2, R=2, N=3)

Write Request:
Client → Coordinator → Node A (success) ─┐
                    → Node B (success) ─┼→ Ack to Client (W=2 met)
                    → Node C (pending) ─┘

Read Request:
Client → Coordinator → Node A (v1, ts=100) ─┐
                    → Node B (v2, ts=105) ─┼→ Return v2 (latest)
                    → Node C (timeout)    ─┘
```

### Consistency Levels
- **ONE**: Wait for 1 replica (fastest, least consistent)
- **QUORUM**: Wait for majority (N/2 + 1) replicas (balanced)
- **ALL**: Wait for all N replicas (slowest, most consistent)
- **LOCAL_QUORUM**: Quorum within local datacenter
- **EACH_QUORUM**: Quorum in each datacenter
- **ANY**: Write to any node including hints (highest availability)

### Conflict Resolution
- **Last-Write-Wins (LWW)**: Use timestamp to resolve conflicts
- **Vector Clocks**: Track causality for concurrent writes
- **Application-Defined**: Custom merge functions for complex types
- **Read Repair**: Fix inconsistencies during read operations
- **Anti-Entropy**: Background process to sync replicas

### Hinted Handoff
- **Purpose**: Handle temporary node failures
- **Mechanism**: Store writes for unavailable nodes
- **Hint Storage**: Separate storage for hints per target node
- **Hint Replay**: Deliver hints when target node recovers
- **Hint Expiration**: Delete hints after 3 hours
- **Hint Throttling**: Limit hint replay rate to avoid overwhelming recovered node

## Membership and Failure Detection

### Gossip Protocol
```
Node A                Node B                Node C
  │                     │                     │
  ├─── Gossip Msg ─────→│                     │
  │    (heartbeat,      │                     │
  │     node states)    │                     │
  │                     ├─── Gossip Msg ─────→│
  │                     │                     │
  │←─── Gossip Msg ─────┤                     │
  │                     │                     │
  │                     │←─── Gossip Msg ─────┤
```

### Failure Detection
- **Heartbeat Interval**: 1 second between gossip messages
- **Failure Threshold**: Mark node as suspected after 10 seconds
- **Failure Confirmation**: Mark node as down after 30 seconds
- **Phi Accrual Detector**: Adaptive failure detection based on history
- **False Positive Rate**: <1% false positives
- **Recovery Detection**: Automatic detection when node comes back

### Cluster Membership
- **Seed Nodes**: Bootstrap nodes for new nodes to join
- **Join Process**: New node contacts seed, receives cluster state
- **Token Assignment**: Coordinator assigns vnodes to new node
- **Data Streaming**: Transfer data for assigned vnodes
- **Decommission**: Gracefully remove node and redistribute data
- **Replace**: Replace failed node with new node at same tokens

## Caching Architecture

### Multi-Level Cache
```
┌─────────────────────────────────────────────────────────────────┐
│  L1: In-Process Cache (per node)                               │
│  - Size: 1GB                                                    │
│  - Eviction: LRU                                                │
│  - Hit Rate: 60%                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  L2: Distributed Cache (Redis/Memcached)                       │
│  - Size: 100GB cluster-wide                                     │
│  - Eviction: LRU with TTL                                       │
│  - Hit Rate: 30%                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  L3: Persistent Storage (SSTables)                             │
│  - Size: 33TB                                                   │
│  - Hit Rate: 10% (cache misses)                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Cache Strategies
- **Read-Through**: Load from storage on cache miss
- **Write-Through**: Write to cache and storage synchronously
- **Write-Behind**: Write to cache, async write to storage
- **Cache-Aside**: Application manages cache explicitly
- **TTL-Based**: Automatic expiration for time-sensitive data
- **Invalidation**: Explicit cache invalidation on updates

## Query Processing

### Read Path Optimization
1. **Check MemTable**: Search in-memory buffer first
2. **Check Immutable MemTable**: Search flushing buffer
3. **Bloom Filter Check**: Skip SSTables that don't contain key
4. **Index Lookup**: Use SSTable index to find data block
5. **Data Block Read**: Read and decompress data block
6. **Merge Results**: Combine results from multiple SSTables
7. **Return Latest**: Return value with highest timestamp

### Write Path Optimization
1. **Write to WAL**: Append to write-ahead log for durability
2. **Write to MemTable**: Insert into in-memory sorted structure
3. **Replicate**: Send write to N-1 replica nodes
4. **Wait for Quorum**: Wait for W replicas to acknowledge
5. **Return Success**: Acknowledge write to client
6. **Background Flush**: Async flush MemTable to SSTable

### Batch Operations
- **Batch Writes**: Group multiple writes into single transaction
- **Batch Reads**: Fetch multiple keys in single request
- **Pipelining**: Send multiple requests without waiting for responses
- **Parallel Execution**: Execute independent operations concurrently
- **Atomic Batches**: All-or-nothing semantics for batch writes

## Monitoring and Observability

### Key Metrics
- **Latency**: P50, P95, P99, P99.9 for reads and writes
- **Throughput**: Operations per second (reads, writes, deletes)
- **Error Rate**: Failed operations per second
- **Cache Hit Rate**: Percentage of reads served from cache
- **Compaction**: Compaction queue size and throughput
- **Replication Lag**: Time delay for replica synchronization

### Health Checks
- **Node Health**: CPU, memory, disk, network utilization
- **Cluster Health**: Number of nodes up/down/suspected
- **Data Health**: Replication factor, consistency level compliance
- **Performance Health**: Latency and throughput SLA compliance
- **Capacity Health**: Disk space, memory usage, connection count

This comprehensive architecture provides the foundation for building a highly scalable, available, and performant distributed key-value store.
