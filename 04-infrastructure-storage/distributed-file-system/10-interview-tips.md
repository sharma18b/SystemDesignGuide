# Distributed File System - Interview Tips

## Interview Approach

### Initial Questions (5 min)
1. **Scale**: How much data? How many files?
2. **Access Pattern**: Read-heavy or write-heavy?
3. **File Size**: Small files or large files?
4. **Consistency**: Strong or eventual consistency?
5. **Use Case**: Batch processing, streaming, or random access?

### Design Progression

**Step 1: High-Level Architecture (5 min)**
```
Clients → NameNode (metadata) → DataNodes (storage)
```

**Step 2: Data Model (5 min)**
- Files split into blocks (128MB)
- Blocks replicated 3x
- NameNode tracks block locations
- DataNodes store blocks

**Step 3: Write Flow (5 min)**
- Client requests NameNode
- NameNode allocates blocks
- Client writes to DataNodes
- Pipeline replication
- Acknowledgment

**Step 4: Read Flow (5 min)**
- Client requests NameNode
- NameNode returns block locations
- Client reads from nearest DataNode
- Checksum verification

**Step 5: Fault Tolerance (5 min)**
- Heartbeat monitoring
- Automatic re-replication
- NameNode HA
- Data integrity checks

**Step 6: Scaling (5 min)**
- Add DataNodes for capacity
- Federation for namespace scaling
- Rack-aware placement
- Data locality optimization

## Key Topics to Cover

### Must Cover
- ✅ Block-based storage
- ✅ Replication strategy
- ✅ NameNode architecture
- ✅ Write and read flows
- ✅ Fault tolerance

### Should Cover
- ✅ Data locality
- ✅ Rack awareness
- ✅ NameNode HA
- ✅ Checksums

### Nice to Cover
- ✅ Erasure coding
- ✅ Federation
- ✅ Small file problem
- ✅ Performance optimization

## Common Pitfalls

❌ **Not discussing block size trade-offs**
✅ Explain why 128MB blocks for large files

❌ **Ignoring NameNode as bottleneck**
✅ Discuss HA and federation

❌ **Forgetting about rack awareness**
✅ Explain replica placement strategy

❌ **Not considering small files**
✅ Discuss limitations and solutions

## Talking Points

### Block-Based Storage
"We split files into 128MB blocks for efficiency. Large blocks reduce metadata overhead and improve throughput for big data workloads. Each block is replicated 3x for fault tolerance."

### Replication Strategy
"We use rack-aware replication: first replica on local rack, second on different rack, third on same rack as second. This protects against rack failures while minimizing network traffic."

### NameNode HA
"We use Active-Standby HA with shared edit log. ZooKeeper coordinates failover. Standby NameNode maintains hot standby state for fast failover (<30s)."

### Data Locality
"We schedule computation on nodes with data to minimize network transfer. This is key for MapReduce and Spark performance."

## Time Management

### 45-Minute Interview
- 0-5 min: Clarify requirements
- 5-15 min: High-level architecture
- 15-25 min: Deep dive (write/read flows)
- 25-35 min: Fault tolerance and scaling
- 35-40 min: Follow-up questions
- 40-45 min: Wrap-up

## Practice Recommendations

1. **Study HDFS**: Read HDFS architecture paper
2. **Understand GFS**: Read Google File System paper
3. **Practice diagrams**: Draw architecture quickly
4. **Know trade-offs**: Replication vs erasure coding
5. **Real-world experience**: Mention Hadoop, Spark usage

This guide helps you approach distributed file system design interviews with confidence.
