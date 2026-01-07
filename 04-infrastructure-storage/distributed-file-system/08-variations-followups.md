# Distributed File System - Variations and Follow-ups

## Common Variations

### 1. Object Storage (S3-like)
**Key Differences:**
- Flat namespace (buckets + keys)
- HTTP API instead of POSIX
- Eventual consistency
- Versioning support
- Lifecycle policies

### 2. Distributed Block Storage
**Key Differences:**
- Block-level access
- Attached to VMs
- Lower latency
- Smaller block sizes (4KB-64KB)
- Snapshot support

### 3. Distributed Database Storage
**Key Differences:**
- Structured data
- ACID transactions
- Query support
- Indexes
- Smaller files

## Interview Follow-up Questions

### Q: How do you handle NameNode failure?
**Answer:**
- Active-Standby HA setup
- Shared edit log (NFS or QJM)
- Automatic failover (<30s)
- ZooKeeper for coordination
- Clients retry on failover

### Q: How do you ensure data locality?
**Answer:**
- Track block locations in NameNode
- Schedule tasks on nodes with data
- Rack-aware placement
- Network topology awareness
- Fallback to remote reads if needed

### Q: How do you handle small files?
**Answer:**
- Combine small files into larger files
- Use HAR (Hadoop Archive)
- Sequence files for key-value pairs
- Increase block size
- Consider object storage instead

### Q: How do you recover from disk failure?
**Answer:**
- Detect via heartbeat/block report
- Mark disk as failed
- Re-replicate blocks from other replicas
- Automatic recovery
- Alert administrators

### Q: How do you handle network partitions?
**Answer:**
- NameNode uses majority quorum
- DataNodes in minority partition marked dead
- Blocks re-replicated from majority
- Clients retry on failure
- Eventual consistency after partition heals

### Q: How do you optimize for read-heavy workloads?
**Answer:**
- Increase replication factor
- Cache frequently accessed blocks
- Short-circuit local reads
- Use SSDs for hot data
- CDN for static content

This guide covers common variations and deep-dive questions for distributed file system interviews.
