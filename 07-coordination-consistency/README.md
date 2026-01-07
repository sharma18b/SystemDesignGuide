# IDs, Consistency, and Coordination

This category focuses on designing coordination services, distributed algorithms, and consistency mechanisms that enable reliable operation of distributed systems.

## Problems in this Category

### 1. Design a Distributed Unique ID Generator (✅ Complete)
**Folder**: `unique-id-generator/`
**Problem Statement**: Design a system that generates globally unique IDs across multiple machines without coordination, with requirements for time-ordering, scalability, and minimal collision probability.
**Status**: All 10 files completed with comprehensive technical documentation covering Snowflake-style ID generation, worker ID management, clock synchronization, sequence overflow handling, and alternative approaches (UUID, ULID).

### 2. Design a Distributed Locking System (✅ Complete)
**Folder**: `distributed-locking/`
**Problem Statement**: Design a distributed locking service like Apache Zookeeper or etcd that provides mutual exclusion, leader election, and coordination primitives for distributed applications.
**Status**: All 10 files completed covering Raft consensus algorithm, session management, watch notifications, fencing tokens, split-brain prevention, and production-ready implementation strategies.

### 3. Design a Resource Allocation Service (✅ Complete)
**Folder**: `resource-allocation/`
**Problem Statement**: Design a system that allocates and manages shared resources (compute, memory, storage, licenses) across multiple applications with fairness, efficiency, and priority-based scheduling.
**Status**: All 10 files completed covering fair share scheduling, quota management, preemption strategies, multi-tenancy, starvation prevention, and cost-effective resource utilization.

### 4. Design a Distributed Tracing System (✅ Complete)
**Folder**: `distributed-tracing/`
**Problem Statement**: Design a distributed tracing system like Jaeger or Zipkin that tracks requests across multiple microservices, providing visibility into system performance and debugging capabilities.
**Status**: All 10 files completed covering OpenTelemetry integration, sampling strategies, span collection, Cassandra/Elasticsearch storage, query optimization, and low-overhead instrumentation (<1% CPU).

### 5. Design a Database Batch Auditing Service (✅ Complete)
**Folder**: `batch-auditing/`
**Problem Statement**: Design a system that audits database changes across multiple databases using Change Data Capture (CDC), ensuring data integrity, compliance (GDPR, SOX, HIPAA), and providing complete audit trails.
**Status**: All 10 files completed covering CDC implementation (Debezium), Kafka streaming, ClickHouse analytics, compliance reporting, anomaly detection, and 7-year retention strategies.

## Files to Create for Each Problem

### 1. `01-problem-statement.md`
- **Functional requirements** (ID generation, locking, resource allocation)
- **Non-functional requirements** (latency, consistency, availability)
- **Coordination constraints** (consensus, clock synchronization)
- **Safety and liveness** guarantees

### 2. `02-scale-constraints.md`
- **Throughput requirements** (operations per second)
- **Cluster size** (number of nodes, quorum requirements)
- **Storage requirements** (state size, log retention)
- **Network constraints** (latency, bandwidth)

### 3. `03-architecture.md`
- **Consensus architecture** (Raft, Paxos implementation)
- **State machine** replication
- **Leader election** mechanisms
- **Coordination primitives** (locks, barriers, semaphores)

### 4. `04-database-design.md`
- **State storage** (persistent logs, snapshots)
- **Metadata management** (configuration, cluster state)
- **Replication strategy** (log-based, state-based)
- **Recovery mechanisms** (snapshot + replay)

### 5. `05-api-design.md`
- **Client APIs** (acquire, release, query operations)
- **Admin APIs** (cluster management, configuration)
- **Watch APIs** (notifications, event streams)
- **Client libraries** (Java, Python, Go examples)

### 6. `06-scaling-considerations.md`
- **Horizontal scaling** limits and strategies
- **Quorum sizing** and fault tolerance
- **Performance optimization** (batching, caching)
- **Geographic distribution** (multi-datacenter)

### 7. `07-tradeoffs-alternatives.md`
- **Consistency vs availability** trade-offs
- **Coordination vs coordination-free** approaches
- **Alternative algorithms** (Raft vs Paxos vs Multi-Paxos)
- **Storage options** (RocksDB, etcd, Zookeeper)

### 8. `08-variations-followups.md`
- **Advanced features** (priority locks, read-write locks)
- **Optimization techniques** (batching, pipelining)
- **Edge cases** (clock regression, network partitions)
- **Integration patterns** (service discovery, configuration)

### 9. `09-security-privacy.md`
- **Authentication** and authorization
- **Encryption** (TLS, at-rest encryption)
- **Audit logging** and compliance
- **Access control** (RBAC, ACLs)

### 10. `10-interview-tips.md`
- **Consensus algorithm** explanation
- **CAP theorem** discussion
- **Failure scenarios** and handling
- **Performance characteristics** and trade-offs

## How to Start Designing

### Step 1: Understand Coordination Requirements (5 minutes)
**Key Questions:**
- What type of coordination is needed? (locks, IDs, leader election)
- What consistency guarantees are required? (strong, eventual)
- How many nodes in the cluster? (3, 5, 7 for quorum)
- What's the acceptable latency? (<10ms, <100ms)
- How do we handle failures? (crash-fail, Byzantine)

### Step 2: Choose Consensus Algorithm (5 minutes)
**Options:**
- **Raft**: Understandable, leader-based, proven (etcd, Consul)
- **Paxos**: Theoretically proven, complex, flexible
- **Multi-Paxos**: Optimized Paxos for multiple decisions
- **No Consensus**: Coordination-free approaches (Snowflake IDs)

### Step 3: Design State Management (10 minutes)
**Components:**
- **Write-Ahead Log**: Persistent operation log
- **State Machine**: In-memory state
- **Snapshots**: Periodic checkpoints
- **Replication**: Quorum-based replication

### Step 4: Handle Failures and Edge Cases (20 minutes)
**Focus Areas:**
- Leader election and failover
- Network partitions and split-brain
- Clock synchronization and drift
- Deadlock prevention and detection

## Major Interview Questions

### Consensus and Coordination
- "How does Raft consensus work?"
- "How do you prevent split-brain in distributed systems?"
- "How would you implement leader election?"
- "What happens during a network partition?"

### Scaling Questions
- "How do you scale a distributed locking system?"
- "What are the limits of consensus-based systems?"
- "How would you handle 1 million lock operations per second?"
- "How do you optimize for read-heavy vs write-heavy workloads?"

### Technical Deep Dives
- "How do you generate unique IDs without coordination?"
- "How do fencing tokens prevent stale lock holders?"
- "How would you implement distributed tracing with minimal overhead?"
- "How do you ensure audit data integrity and immutability?"

## Key Bottlenecks and Solutions

### 1. Distributed Consensus
**Problem**: Achieving agreement across distributed nodes
**Solutions**:
- Consensus algorithms (Raft, Paxos, PBFT)
- Leader election mechanisms
- Quorum-based decision making (N/2 + 1)
- Log replication with acknowledgments

### 2. Clock Synchronization
**Problem**: Maintaining consistent time across distributed systems
**Solutions**:
- Logical clocks (Lamport timestamps)
- Vector clocks for causality
- Hybrid logical clocks (HLC)
- NTP synchronization with drift monitoring
- Fencing tokens for correctness

### 3. Deadlock Prevention
**Problem**: Avoiding deadlocks in distributed locking
**Solutions**:
- Lock ordering protocols
- Timeout-based lock acquisition
- Deadlock detection algorithms
- Try-lock with backoff

### 4. Split-Brain Prevention
**Problem**: Multiple leaders in partitioned network
**Solutions**:
- Quorum-based decisions
- Fencing tokens
- Lease-based leadership
- Witness nodes for tie-breaking

## Scaling Strategies

### Consensus Systems
- **Cluster Sizing**: 3, 5, or 7 nodes (odd numbers for quorum)
- **Read Scaling**: Follower reads with bounded staleness
- **Write Scaling**: Limited by leader capacity
- **Geographic Distribution**: Single cluster or multiple independent clusters

### Coordination-Free Systems
- **ID Generation**: Snowflake-style with worker IDs
- **Horizontal Scaling**: Linear scaling with more workers
- **No Coordination**: Independent operation per node
- **Clock Dependency**: NTP synchronization required

### Storage Optimization
- **Log Compaction**: Periodic snapshots and truncation
- **Batching**: Group operations for efficiency
- **Caching**: In-memory state for fast access
- **Tiered Storage**: Hot/warm/cold data separation

## Common Patterns Across Coordination Systems

### Consensus Patterns
- **Leader Election**: Raft, Paxos for single leader
- **Log Replication**: Write-ahead log with quorum
- **State Machine**: Deterministic state transitions
- **Snapshots**: Periodic checkpoints for recovery

### Coordination Primitives
- **Distributed Locks**: Mutual exclusion with fencing
- **Barriers**: Synchronize multiple processes
- **Semaphores**: Limit concurrent access
- **Counters**: Atomic increment/decrement

### Failure Handling
- **Heartbeats**: Detect node failures
- **Timeouts**: Automatic resource release
- **Retries**: Exponential backoff
- **Circuit Breakers**: Prevent cascade failures

### Observability
- **Metrics**: Latency, throughput, error rates
- **Tracing**: Request flow across services
- **Logging**: Structured audit logs
- **Alerting**: Proactive issue detection

---
*Category Status: ✅ COMPLETED (5/5 problems completed)*
