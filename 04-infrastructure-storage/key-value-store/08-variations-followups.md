# Key-Value Store - Variations and Follow-up Questions

## Common Variations

### 1. In-Memory Key-Value Store (Redis-like)
**Requirements:**
- All data stored in RAM for ultra-low latency
- Optional persistence to disk
- Single-threaded or multi-threaded architecture
- Support for complex data structures

**Key Differences:**
```
Architecture Changes:
- No LSM-tree, pure in-memory hash table
- Optional AOF (Append-Only File) for persistence
- Optional RDB snapshots for backup
- Single-threaded event loop or thread-per-core

Performance:
- Latency: <100μs (vs <1ms for disk-based)
- Throughput: 100K-1M ops/sec per node
- Memory: Limited by RAM (vs unlimited disk)

Trade-offs:
✅ Ultra-low latency
✅ Simple architecture
❌ Limited by memory
❌ Data loss risk on crash
❌ Higher cost per GB
```

**Follow-up Questions:**
- How do you handle data larger than available RAM?
- What persistence strategies ensure durability?
- How do you implement replication for high availability?
- What eviction policies do you use when memory is full?

### 2. Time-Series Key-Value Store
**Requirements:**
- Optimized for time-series data (metrics, logs, events)
- Efficient range queries by timestamp
- Data retention and downsampling
- High write throughput

**Key Differences:**
```
Data Model:
- Keys: metric_name:timestamp
- Values: numeric values or JSON
- Partitioning: Time-based partitioning
- Compaction: Time-window compaction

Optimizations:
- Columnar storage for compression
- Delta encoding for timestamps
- Downsampling for old data
- Automatic data expiration

Example Schema:
  cpu_usage:server1:1704729600 → 45.2
  cpu_usage:server1:1704729601 → 46.1
  cpu_usage:server1:1704729602 → 44.8
```

**Follow-up Questions:**
- How do you handle out-of-order writes?
- What downsampling strategies do you use?
- How do you implement efficient range queries?
- What retention policies do you support?

### 3. Geo-Distributed Key-Value Store
**Requirements:**
- Data replicated across multiple geographic regions
- Low latency for local reads
- Conflict resolution for concurrent writes
- Compliance with data residency requirements

**Key Differences:**
```
Architecture:
- Multi-region clusters
- Async cross-region replication
- Regional routing for reads
- Conflict resolution with vector clocks

Consistency:
- Local strong consistency
- Global eventual consistency
- Configurable per-key replication
- Conflict-free replicated data types (CRDTs)

Latency:
- Local reads: <5ms
- Cross-region reads: <100ms
- Cross-region writes: <200ms
```

**Follow-up Questions:**
- How do you handle network partitions between regions?
- What conflict resolution strategies do you use?
- How do you ensure data residency compliance?
- What's the replication lag between regions?

### 4. Strongly Consistent Key-Value Store (Spanner-like)
**Requirements:**
- Linearizable reads and writes
- Global transactions with ACID guarantees
- Distributed consensus (Paxos/Raft)
- External consistency using synchronized clocks

**Key Differences:**
```
Consensus:
- Paxos or Raft for leader election
- Quorum-based writes
- Synchronized clocks (TrueTime)
- Two-phase commit for transactions

Performance:
- Higher write latency (consensus overhead)
- Strong consistency guarantees
- Serializable isolation
- Global transactions

Trade-offs:
✅ Strong consistency
✅ ACID transactions
❌ Higher latency
❌ Lower availability during partitions
❌ Complex implementation
```

**Follow-up Questions:**
- How do you implement distributed transactions?
- What consensus algorithm do you use?
- How do you handle clock skew?
- What's the performance impact of strong consistency?

### 5. Document Store (MongoDB-like)
**Requirements:**
- Store JSON/BSON documents instead of simple values
- Support for nested fields and arrays
- Secondary indexes on document fields
- Rich query language

**Key Differences:**
```
Data Model:
- Values: JSON documents (not just bytes)
- Schema: Flexible, schema-less
- Indexes: Multiple secondary indexes
- Queries: Complex queries with filters, projections

Example:
  Key: user:123
  Value: {
    "name": "John Doe",
    "email": "john@example.com",
    "address": {
      "city": "New York",
      "zip": "10001"
    },
    "tags": ["premium", "verified"]
  }

Query: Find users in New York with "premium" tag
```

**Follow-up Questions:**
- How do you implement secondary indexes?
- What query optimization techniques do you use?
- How do you handle schema evolution?
- What's the performance impact of complex queries?

## Interview Follow-up Questions

### Capacity and Scaling
**Q: How would you handle 10x traffic growth?**
```
Approach:
1. Horizontal Scaling:
   - Add 10x nodes (10 → 100 nodes)
   - Rebalance data across new nodes
   - Update routing tables

2. Vertical Scaling:
   - Upgrade to larger instances
   - More RAM for caching
   - Faster SSDs for storage

3. Optimization:
   - Increase cache hit rate
   - Optimize hot paths
   - Batch operations
   - Compression

Cost Analysis:
- Current: 10 nodes × $500 = $5,000/month
- 10x traffic: 100 nodes × $500 = $50,000/month
- With optimization: 50 nodes × $500 = $25,000/month
```

**Q: How do you handle hot keys?**
```
Detection:
- Monitor access patterns
- Track requests per key
- Alert on threshold (>10K req/min)

Mitigation:
1. Replication: Replicate hot key to more nodes
2. Caching: Cache hot key on all nodes
3. Sharding: Split hot key into sub-keys
4. Rate Limiting: Limit requests per client
5. Load Balancing: Distribute reads across replicas

Example:
  Hot key: "trending_topics"
  Solution: Replicate to 20 nodes, cache on all nodes
  Result: 100K req/sec → 5K req/sec per node
```

### Consistency and Availability

**Q: How do you handle network partitions?**
```
Scenario: Network partition splits cluster into two groups

Group A (2 nodes):
- Can't reach Group B
- Continues serving reads (stale data possible)
- Rejects writes (can't achieve quorum W=2)

Group B (1 node):
- Can't reach Group A
- Continues serving reads (stale data possible)
- Rejects writes (can't achieve quorum W=2)

After Partition Heals:
1. Detect partition recovery
2. Run anti-entropy repair
3. Resolve conflicts using vector clocks
4. Resume normal operations

Trade-off:
- Availability: Reads continue during partition
- Consistency: Writes blocked to prevent split-brain
```

**Q: How do you ensure data consistency across replicas?**
```
Mechanisms:
1. Quorum Writes: W=2, R=2, N=3 (R+W>N)
2. Read Repair: Fix inconsistencies during reads
3. Anti-Entropy: Background process to sync replicas
4. Hinted Handoff: Store writes for unavailable nodes
5. Merkle Trees: Efficient comparison of replica data

Example Read Repair:
  Client reads key "user:123" with R=2
  Node A: version=5, value="Alice"
  Node B: version=6, value="Bob"
  
  Coordinator:
  1. Returns latest value ("Bob") to client
  2. Background: Updates Node A to version=6
```

### Performance and Optimization

**Q: How do you optimize for read-heavy workloads?**
```
Strategies:
1. Caching:
   - In-memory cache for hot data
   - 95% hit rate → 20x throughput
   - LRU eviction policy

2. Read Replicas:
   - Add more replicas (N=3 → N=5)
   - Route reads to nearest replica
   - Eventual consistency acceptable

3. Bloom Filters:
   - Reduce unnecessary disk reads
   - 1% false positive rate
   - 90% reduction in disk I/O

4. Compression:
   - Reduce I/O with Snappy/LZ4
   - 3x compression ratio
   - Lower network bandwidth

Result:
- Before: 10K reads/sec, 10ms latency
- After: 200K reads/sec, 1ms latency
```

**Q: How do you handle large values (>1MB)?**
```
Approaches:
1. Chunking:
   - Split large value into chunks
   - Store chunks as separate keys
   - Reassemble on read
   
   Example:
     Original: "large_file" → 10MB data
     Chunked:
       "large_file:chunk:0" → 1MB
       "large_file:chunk:1" → 1MB
       ...
       "large_file:chunk:9" → 1MB
       "large_file:metadata" → {"chunks": 10, "size": 10MB}

2. External Storage:
   - Store large values in object storage (S3)
   - Store reference in key-value store
   
   Example:
     Key: "large_file"
     Value: {"s3_url": "s3://bucket/large_file", "size": 10MB}

3. Compression:
   - Compress large values
   - Store compressed data
   - Decompress on read

Trade-offs:
- Chunking: More operations, complex logic
- External: Network latency, dependency
- Compression: CPU overhead, latency
```

### Failure Scenarios

**Q: What happens when a node fails?**
```
Failure Detection:
1. Heartbeat timeout (10 seconds)
2. Mark node as suspected
3. Confirm failure (30 seconds)
4. Mark node as down

Failover Process:
1. Identify affected partitions
2. Promote replicas to primary
3. Update routing tables
4. Reroute traffic to healthy nodes
5. Trigger hinted handoff replay

Recovery Process:
1. Node comes back online
2. Rejoin cluster
3. Receive hinted handoff data
4. Run repair to sync data
5. Resume normal operations

Impact:
- Availability: No downtime (replicas available)
- Performance: Slight increase in latency
- Data Loss: Zero (with quorum writes)
```

**Q: How do you handle data corruption?**
```
Detection:
1. Checksums: Verify data integrity on read
2. Scrubbing: Background process to check data
3. Replication: Compare replicas for consistency

Recovery:
1. Detect corrupted data (checksum mismatch)
2. Fetch data from healthy replica
3. Overwrite corrupted data
4. Log corruption event
5. Alert monitoring system

Prevention:
- ECC memory
- Checksums on disk
- Replication (N=3)
- Regular backups
- Monitoring and alerts
```

### Advanced Topics

**Q: How would you implement transactions?**
```
Two-Phase Commit (2PC):

Phase 1 (Prepare):
1. Coordinator sends PREPARE to all participants
2. Participants lock resources and vote YES/NO
3. Coordinator collects votes

Phase 2 (Commit):
1. If all YES: Coordinator sends COMMIT
2. If any NO: Coordinator sends ABORT
3. Participants commit/abort and release locks

Example:
  Transaction: Transfer $100 from A to B
  
  Prepare:
    - Lock account A
    - Lock account B
    - Check balance A >= $100
    - Vote YES
  
  Commit:
    - Deduct $100 from A
    - Add $100 to B
    - Release locks

Trade-offs:
✅ ACID guarantees
✅ Strong consistency
❌ Higher latency
❌ Blocking protocol
❌ Coordinator failure risk
```

**Q: How do you implement pub/sub?**
```
Architecture:
1. Channel Registry:
   - Map channel → subscribers
   - Store in distributed hash table

2. Message Broker:
   - Receive publish requests
   - Lookup subscribers
   - Deliver messages

3. Subscription Management:
   - Add/remove subscribers
   - Pattern matching (e.g., "user:*")
   - Persistent subscriptions

Example:
  Channel: "notifications"
  Subscribers: [client1, client2, client3]
  
  Publish:
    1. Client publishes to "notifications"
    2. Broker looks up subscribers
    3. Broker delivers to all subscribers
    4. Acknowledge delivery

Scaling:
- Partition channels across nodes
- Use consistent hashing
- Replicate channel registry
- Load balance subscribers
```

This comprehensive guide covers common variations and follow-up questions that help demonstrate deep understanding of distributed key-value store design and implementation.
