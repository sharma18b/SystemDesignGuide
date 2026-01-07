# Distributed Locking System - Database Design

## Storage Architecture Overview

### Persistent Storage Strategy
The distributed locking system uses a combination of:
- **Write-Ahead Log (WAL)**: Raft log for all operations
- **State Machine**: In-memory lock state
- **Snapshots**: Periodic checkpoints for recovery
- **Metadata Store**: Configuration and cluster state

### Storage Engine Choice
```
Recommended: RocksDB or LevelDB

Advantages:
- Embedded key-value store
- Fast sequential writes (WAL)
- Efficient compaction
- Snapshot support
- Proven at scale (etcd, TiKV)

Alternative: BoltDB (Go), LMDB
```

## Raft Log Storage

### Log Entry Structure
```go
type LogEntry struct {
    Index      uint64    // Log index (monotonic)
    Term       uint64    // Election term
    Type       EntryType // Command, Config, Snapshot
    Data       []byte    // Serialized command
    Timestamp  int64     // Creation timestamp
    Checksum   uint32    // Data integrity check
}

type EntryType int
const (
    EntryCommand  EntryType = 0  // Lock operation
    EntryConfig   EntryType = 1  // Cluster config change
    EntrySnapshot EntryType = 2  // Snapshot marker
)
```

### Log Storage Schema
```
RocksDB Key-Value Layout:

Log Entries:
Key: log/{index}
Value: Protobuf(LogEntry)

Example:
log/00000001 → {term:1, type:command, data:acquire_lock(/app/lock1)}
log/00000002 → {term:1, type:command, data:release_lock(/app/lock1)}
log/00000003 → {term:2, type:config, data:add_node(node4)}

Metadata:
Key: meta/last_index
Value: 1000000

Key: meta/last_term
Value: 5

Key: meta/commit_index
Value: 999950
```

## Lock State Storage

### In-Memory State Machine
```go
type LockState struct {
    Path          string
    Owner         string    // Session ID
    FencingToken  uint64    // Monotonic token
    AcquiredAt    time.Time
    ExpiresAt     time.Time
    LockType      LockType  // Exclusive, Shared
    WaitQueue     []string  // Waiting clients
    Version       uint64    // For optimistic locking
}

type SessionState struct {
    SessionID     string
    ClientID      string
    CreatedAt     time.Time
    LastHeartbeat time.Time
    Timeout       time.Duration
    Locks         []string  // Owned locks
    Watches       []string  // Active watches
}
```

### Snapshot Format
```protobuf
message Snapshot {
    uint64 last_included_index = 1;
    uint64 last_included_term = 2;
    repeated Lock locks = 3;
    repeated Session sessions = 4;
    map<string, bytes> metadata = 5;
}

message Lock {
    string path = 1;
    string owner_session = 2;
    uint64 fencing_token = 3;
    int64 acquired_at = 4;
    int64 expires_at = 5;
    LockType type = 6;
    repeated string wait_queue = 7;
}

message Session {
    string session_id = 1;
    string client_id = 2;
    int64 created_at = 3;
    int64 last_heartbeat = 4;
    int32 timeout_seconds = 5;
}
```

## Watch and Notification Storage

### Watch Registry
```go
type Watch struct {
    WatchID    string
    SessionID  string
    Path       string
    EventMask  EventType  // Created, Deleted, Modified
    OneTime    bool
    CreatedAt  time.Time
}

// In-memory watch index
type WatchIndex struct {
    PathToWatches map[string][]Watch
    SessionToWatches map[string][]Watch
}
```

## Cluster Metadata Storage

### Cluster Configuration
```
RocksDB Storage:

Cluster Members:
Key: cluster/nodes/{node_id}
Value: {
    "node_id": "node1",
    "address": "10.0.1.10:2380",
    "role": "voter",
    "joined_at": "2024-01-03T19:00:00Z"
}

Current Leader:
Key: cluster/leader
Value: {
    "node_id": "node1",
    "term": 5,
    "elected_at": "2024-01-03T19:30:00Z"
}

Cluster State:
Key: cluster/state
Value: {
    "cluster_id": "cluster-abc123",
    "version": "1.0.0",
    "created_at": "2024-01-01T00:00:00Z"
}
```

## Performance Optimization

### Indexing Strategy
```
Primary Indexes:
- Log index: B-tree on log entry index
- Lock path: Hash index on lock path
- Session ID: Hash index on session ID
- Fencing token: B-tree on token (for ordering)

Secondary Indexes:
- Expiry time: B-tree for timeout scanning
- Owner session: Hash index for session cleanup
- Watch path: Prefix tree for efficient matching
```

### Caching Strategy
```
L1 Cache (In-Memory):
- Active locks: 100K locks × 200 bytes = 20MB
- Active sessions: 10K sessions × 500 bytes = 5MB
- Recent log entries: Last 10K entries = 1MB
- Total: ~30MB per node

Cache Invalidation:
- Write-through for lock operations
- TTL-based for read caching
- Event-driven for watch notifications
```

## Backup and Recovery

### Snapshot Strategy
```
Snapshot Triggers:
- Log size > 10GB
- Time-based: Every 1 hour
- Manual trigger via API

Snapshot Process:
1. Pause log compaction
2. Serialize state machine
3. Write snapshot to disk
4. Update snapshot metadata
5. Truncate old log entries
6. Resume normal operation

Snapshot Retention:
- Keep last 3 snapshots
- Compress with gzip
- Store in separate directory
```

### Recovery Process
```
Node Recovery:
1. Load latest snapshot
2. Replay log entries after snapshot
3. Rebuild in-memory state
4. Rejoin cluster
5. Catch up with leader

Data Integrity:
- Checksums on all entries
- Verify snapshot integrity
- Detect corruption early
- Automatic repair from peers
```

This database design provides efficient storage and retrieval of lock state while maintaining strong consistency guarantees through Raft consensus.
