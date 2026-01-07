# Distributed Messaging System - System Architecture

## High-Level Architecture

### Core Components
```
┌─────────────────────────────────────────────────────────────┐
│                     Producers                               │
│  (Applications publishing messages)                         │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Load Balancer                             │
│  (Route to healthy brokers)                                 │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                  Broker Cluster                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Broker 1 │  │ Broker 2 │  │ Broker 3 │  ...             │
│  │ Leader   │  │ Follower │  │ Follower │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                  ZooKeeper/Raft                             │
│  (Metadata, leader election, coordination)                  │
└─────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Consumers                                 │
│  (Applications consuming messages)                          │
└─────────────────────────────────────────────────────────────┘
```

## Broker Architecture

### Broker Internal Components
```
┌─────────────────────────────────────────────────────────────┐
│                      Broker                                 │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Network    │  │   Request    │  │   Replication│      │
│  │   Layer      │→ │   Handler    │→ │   Manager    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │             │
│         ▼                  ▼                  ▼             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Log        │  │   Offset     │  │   Metadata   │      │
│  │   Manager    │  │   Manager    │  │   Cache      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │             │
│         ▼                  ▼                  ▼             │
│  ┌──────────────────────────────────────────────────┐      │
│  │              Storage Layer                       │      │
│  │  (Partitioned log files on disk)                 │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Log Storage Structure
```
Topic: user-events
├── Partition 0 (Leader: Broker 1)
│   ├── 00000000000000000000.log (1GB segment)
│   ├── 00000000000001000000.log
│   ├── 00000000000002000000.log
│   └── 00000000000002000000.index
├── Partition 1 (Leader: Broker 2)
│   ├── 00000000000000000000.log
│   └── 00000000000000000000.index
└── Partition 2 (Leader: Broker 3)
    ├── 00000000000000000000.log
    └── 00000000000000000000.index

Log Segment Structure:
- Segment size: 1GB (configurable)
- Index: Offset → File position mapping
- Time index: Timestamp → Offset mapping
- Immutable once written
- Deleted after retention period
```

## Message Flow

### Producer to Broker Flow
```
1. Producer creates message
   ├── Key: user_id (for partitioning)
   ├── Value: event data
   ├── Headers: metadata
   └── Timestamp: event time

2. Partition selection
   ├── If key exists: hash(key) % num_partitions
   ├── If no key: round-robin
   └── Custom partitioner: user-defined logic

3. Batching (for efficiency)
   ├── Batch size: 16KB default
   ├── Linger time: 10ms default
   └── Compression: gzip/snappy/lz4

4. Send to leader broker
   ├── Network protocol: TCP
   ├── Serialization: Binary protocol
   └── Acknowledgment: acks=all (wait for replicas)

5. Broker writes to log
   ├── Append to active segment
   ├── Replicate to followers
   ├── Update high watermark
   └── Send acknowledgment to producer
```

### Broker to Consumer Flow
```
1. Consumer subscribes to topic
   ├── Join consumer group
   ├── Trigger rebalance
   └── Receive partition assignment

2. Consumer fetches messages
   ├── Send fetch request with offset
   ├── Broker reads from log (zero-copy)
   ├── Return batch of messages
   └── Consumer processes messages

3. Offset management
   ├── Consumer commits offset
   ├── Store in __consumer_offsets topic
   ├── Periodic commits (5s default)
   └── Manual or automatic commits

4. Rebalancing (when consumer joins/leaves)
   ├── Stop consuming
   ├── Revoke partitions
   ├── Reassign partitions
   └── Resume consuming
```

## Replication Architecture

### Leader-Follower Replication
```
Partition: user-events-0
├── Leader (Broker 1)
│   ├── Handles all reads/writes
│   ├── Maintains in-sync replicas (ISR)
│   └── Updates high watermark
├── Follower 1 (Broker 2)
│   ├── Fetches from leader
│   ├── Writes to local log
│   └── Sends acknowledgment
└── Follower 2 (Broker 3)
    ├── Fetches from leader
    ├── Writes to local log
    └── Sends acknowledgment

Replication Flow:
1. Producer sends message to leader
2. Leader appends to local log
3. Leader waits for ISR acknowledgments
4. Followers fetch new messages
5. Followers append to local log
6. Followers send acknowledgment
7. Leader updates high watermark
8. Leader sends acknowledgment to producer
```

### In-Sync Replicas (ISR)
```
ISR Criteria:
- Replica is alive (heartbeat within 10s)
- Replica is caught up (lag < 10s)
- Replica is fetching regularly

ISR Management:
- Leader maintains ISR list
- Remove slow replicas from ISR
- Add caught-up replicas to ISR
- Minimum ISR size: 2 (configurable)

Failure Scenarios:
- Leader fails → Elect new leader from ISR
- Follower fails → Remove from ISR, continue
- All ISR fails → Wait or elect from out-of-sync replicas
```

## Partition Management

### Partition Assignment
```
Topic: user-events (10 partitions, 3 brokers)

Distribution:
Broker 1: P0(L), P1(F), P2(F), P3(L)
Broker 2: P1(L), P2(L), P4(F), P5(L)
Broker 3: P0(F), P3(F), P4(L), P5(F)

L = Leader, F = Follower

Goals:
- Even distribution of leaders
- Even distribution of replicas
- Rack awareness (if configured)
- Minimize cross-rack traffic
```

### Partition Rebalancing
```
Triggers:
- Broker added/removed
- Partition added to topic
- Replica reassignment
- Rack configuration change

Process:
1. Calculate new assignment
2. Add new replicas
3. Wait for sync
4. Remove old replicas
5. Update metadata

Challenges:
- Minimize data movement
- Maintain availability
- Avoid overloading brokers
- Preserve ordering guarantees
```

## Consumer Group Coordination

### Consumer Group Protocol
```
Consumer Group: analytics-service
├── Consumer 1: [P0, P1, P2]
├── Consumer 2: [P3, P4, P5]
└── Consumer 3: [P6, P7, P8, P9]

Coordinator (Broker):
- Manages group membership
- Triggers rebalancing
- Stores offset commits
- Handles heartbeats

Rebalance Protocol:
1. Consumer joins group
2. Coordinator triggers rebalance
3. All consumers stop consuming
4. Coordinator assigns partitions
5. Consumers resume consuming
```

### Partition Assignment Strategies
```
1. Range Assignor:
   - Assign consecutive partitions
   - P0-P2 → C1, P3-P5 → C2, P6-P9 → C3
   - Simple but uneven

2. Round Robin Assignor:
   - Distribute evenly
   - P0,P3,P6,P9 → C1, P1,P4,P7 → C2, P2,P5,P8 → C3
   - Even distribution

3. Sticky Assignor:
   - Minimize partition movement
   - Keep existing assignments
   - Rebalance only affected partitions

4. Cooperative Sticky:
   - Incremental rebalancing
   - Don't stop all consumers
   - Move partitions one at a time
```

## Metadata Management

### ZooKeeper/Raft for Coordination
```
Metadata Stored:
├── Broker registry
│   ├── Broker IDs
│   ├── Host/port
│   └── Rack information
├── Topic configuration
│   ├── Partition count
│   ├── Replication factor
│   └── Retention policy
├── Partition state
│   ├── Leader broker
│   ├── ISR list
│   └── Replica list
└── Consumer groups
    ├── Group members
    ├── Partition assignments
    └── Offset commits

Leader Election:
- Use Raft consensus
- Elect controller broker
- Controller manages metadata
- Automatic failover on failure
```

## Performance Optimizations

### Zero-Copy Transfer
```
Traditional Copy:
Disk → Kernel buffer → Application buffer → Socket buffer → NIC
(4 copies, 2 context switches)

Zero-Copy (sendfile):
Disk → Kernel buffer → NIC
(1 copy, 0 context switches)

Benefits:
- 2-3x throughput improvement
- Lower CPU usage
- Lower latency
```

### Batch Processing
```
Producer Batching:
- Accumulate messages (16KB batch)
- Wait up to 10ms
- Compress batch
- Send single request

Consumer Batching:
- Fetch multiple messages (1MB)
- Process in batch
- Commit offset once

Benefits:
- Reduce network overhead
- Better compression ratio
- Higher throughput
```

### Page Cache Utilization
```
Strategy:
- Don't cache in application
- Rely on OS page cache
- Sequential writes to disk
- Sequential reads from cache

Benefits:
- Automatic memory management
- Efficient use of RAM
- Fast reads from cache
- Graceful degradation
```

## Monitoring and Observability

### Key Metrics
```
Broker Metrics:
- Messages in/out per second
- Bytes in/out per second
- Request latency (P50, P99)
- Replication lag
- Under-replicated partitions
- Offline partitions

Producer Metrics:
- Send rate
- Send latency
- Error rate
- Batch size
- Compression ratio

Consumer Metrics:
- Fetch rate
- Fetch latency
- Consumer lag
- Commit rate
- Rebalance frequency
```

This architecture provides a robust foundation for building a high-throughput, fault-tolerant distributed messaging system.
