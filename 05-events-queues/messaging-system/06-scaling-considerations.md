# Distributed Messaging System - Scaling Considerations

## Horizontal Scaling Strategies

### Adding Brokers
```
Initial Cluster (3 brokers):
Broker 1: 333 partitions
Broker 2: 333 partitions
Broker 3: 334 partitions

After Adding Broker 4:
Broker 1: 250 partitions (moved 83)
Broker 2: 250 partitions (moved 83)
Broker 3: 250 partitions (moved 84)
Broker 4: 250 partitions (new)

Process:
1. Add new broker to cluster
2. Reassign partitions to new broker
3. Replicate data to new broker
4. Update metadata
5. Remove old replicas

Considerations:
- Minimize data movement
- Maintain availability during rebalance
- Monitor replication lag
- Gradual rollout (10% at a time)
```

### Partition Scaling
```
Increasing Partitions:
Topic: user-events (10 → 20 partitions)

Impact:
✓ Higher throughput (2x parallelism)
✓ More consumers possible
✗ Cannot decrease partitions
✗ Key-based ordering affected
✗ Rebalancing required

Best Practices:
- Plan partition count upfront
- Use 2-3x current throughput needs
- Consider: partitions = max(consumers, throughput/100MB/s)
- Typical: 10-100 partitions per topic
- Maximum: 1000 partitions per topic
```

### Consumer Scaling
```
Consumer Group Scaling:
1 Consumer:  10 partitions → 10K msg/s
5 Consumers: 2 partitions each → 50K msg/s
10 Consumers: 1 partition each → 100K msg/s
20 Consumers: Some idle (max 10 useful)

Rules:
- Max useful consumers = partition count
- Extra consumers remain idle
- Add partitions to scale beyond
- Use multiple consumer groups for fan-out
```

## Performance Optimization

### Producer Optimization
```
Batching Configuration:
batch.size=16384           # 16KB (default)
linger.ms=10               # Wait 10ms
buffer.memory=33554432     # 32MB

Impact:
- Small batches: Low latency, low throughput
- Large batches: High latency, high throughput
- Optimal: 16KB-64KB batches

Compression:
compression.type=snappy    # 2:1 ratio, fast
compression.type=lz4       # 2:1 ratio, very fast
compression.type=gzip      # 3:1 ratio, slower
compression.type=zstd      # 3:1 ratio, balanced

Recommendation:
- Logs: gzip (high compression)
- Events: snappy (balanced)
- Metrics: lz4 (speed)
```

### Consumer Optimization
```
Fetch Configuration:
fetch.min.bytes=1024       # Min 1KB
fetch.max.wait.ms=500      # Max 500ms wait
max.poll.records=500       # 500 records per poll
max.partition.fetch.bytes=1048576  # 1MB per partition

Strategies:
1. Increase fetch.min.bytes for higher throughput
2. Decrease fetch.max.wait.ms for lower latency
3. Increase max.poll.records for batch processing
4. Tune based on message size and processing time

Processing Patterns:
- Single-threaded: Simple, ordered
- Thread pool: Parallel, unordered
- Async processing: Non-blocking, complex
```

### Broker Optimization
```
OS-Level Tuning:
# Increase file descriptors
ulimit -n 100000

# Increase network buffers
net.core.rmem_max=134217728
net.core.wmem_max=134217728
net.ipv4.tcp_rmem=4096 87380 134217728
net.ipv4.tcp_wmem=4096 65536 134217728

# Disable swap
vm.swappiness=1

# Increase dirty page ratio
vm.dirty_ratio=80
vm.dirty_background_ratio=5

JVM Tuning:
-Xms16g -Xmx16g           # 16GB heap
-XX:+UseG1GC              # G1 garbage collector
-XX:MaxGCPauseMillis=20   # 20ms GC pause target
-XX:InitiatingHeapOccupancyPercent=35

Disk Configuration:
- RAID 10 for redundancy and performance
- XFS filesystem (better than ext4)
- Separate disks for logs and data
- NVMe SSDs for high IOPS
```

## Replication Scaling

### Replication Factor Trade-offs
```
RF=1 (No Replication):
✓ Highest throughput
✓ Lowest latency
✓ Lowest storage cost
✗ No fault tolerance
✗ Data loss on failure

RF=2 (Single Replica):
✓ Good throughput
✓ Low latency
✓ Moderate storage cost
✓ Survives 1 broker failure
✗ Risk during maintenance

RF=3 (Two Replicas) - Recommended:
✓ Good throughput
✓ Acceptable latency
✓ Survives 2 broker failures
✓ Safe for production
✗ 3x storage cost

RF=5 (Four Replicas):
✓ Maximum durability
✓ Survives 4 broker failures
✗ Lower throughput
✗ Higher latency
✗ 5x storage cost
```

### Replication Lag Management
```
Monitoring:
- Replica lag time (ms)
- Replica lag messages (count)
- Under-replicated partitions
- Offline partitions

Causes of Lag:
1. Slow disk I/O
2. Network congestion
3. CPU saturation
4. GC pauses
5. Broker overload

Solutions:
1. Add more brokers
2. Increase replica.fetch.max.bytes
3. Tune replica.fetch.min.bytes
4. Optimize disk I/O
5. Upgrade hardware
```

## Geographic Distribution

### Multi-Region Deployment
```
Region 1 (US-East):
- 3 brokers
- Primary cluster
- Low latency for US users

Region 2 (EU-West):
- 3 brokers
- Secondary cluster
- Low latency for EU users

Region 3 (Asia-Pacific):
- 3 brokers
- Secondary cluster
- Low latency for Asia users

Cross-Region Replication:
- MirrorMaker 2.0
- Async replication
- 100-300ms lag acceptable
- Active-active or active-passive
```

### MirrorMaker Configuration
```
# Source cluster
source.cluster.alias=us-east
source.cluster.bootstrap.servers=broker1:9092

# Target cluster
target.cluster.alias=eu-west
target.cluster.bootstrap.servers=broker4:9092

# Replication flow
us-east->eu-west.enabled=true
us-east->eu-west.topics=user-events,orders

# Performance
tasks.max=10
replication.factor=3
sync.topic.configs.enabled=true
```

## Capacity Planning

### Throughput Calculation
```
Single Broker Capacity:
- Network: 10 Gbps = 1.25 GB/s
- Disk: 500 MB/s write, 1 GB/s read
- CPU: 16 cores

Effective Throughput:
- Replication factor 3: 1.25 GB/s / 3 = 416 MB/s write
- Consumer reads: 1 GB/s read
- Total: ~400 MB/s sustained

Messages per Second:
- 1KB messages: 400,000 msg/s per broker
- 10KB messages: 40,000 msg/s per broker
- 100KB messages: 4,000 msg/s per broker

Cluster Capacity (10 brokers):
- 4 million msg/s (1KB messages)
- 400,000 msg/s (10KB messages)
```

### Storage Calculation
```
Storage Requirements:
Messages: 1M msg/s × 1KB × 86400s = 86.4 GB/day
Retention: 7 days × 86.4 GB = 604.8 GB
Replication: 604.8 GB × 3 = 1.8 TB
Overhead: 1.8 TB × 1.2 = 2.2 TB per broker

Cluster Storage (10 brokers):
- 22 TB total
- 2.2 TB per broker
- NVMe SSD recommended
```

## Load Balancing

### Producer Load Balancing
```
Partition Selection:
1. Round-robin (no key):
   - Even distribution
   - No ordering guarantee
   
2. Key-based (with key):
   - hash(key) % num_partitions
   - Ordering per key
   - May cause hot partitions

3. Custom partitioner:
   - Business logic based
   - Flexible distribution
   - Complex implementation

Hot Partition Mitigation:
- Increase partition count
- Use composite keys
- Add random suffix to keys
- Monitor partition metrics
```

### Consumer Load Balancing
```
Partition Assignment:
1. Range Assignor:
   - Consecutive partitions
   - Simple but uneven
   
2. Round Robin:
   - Even distribution
   - May cause rebalancing
   
3. Sticky Assignor:
   - Minimize movement
   - Preserve assignments
   
4. Cooperative Sticky:
   - Incremental rebalancing
   - No stop-the-world
   - Recommended for production
```

## Monitoring and Alerting

### Key Metrics
```
Broker Metrics:
- MessagesInPerSec: >10K (healthy)
- BytesInPerSec: >10MB (healthy)
- BytesOutPerSec: >100MB (healthy)
- RequestLatency: <10ms P99
- UnderReplicatedPartitions: 0
- OfflinePartitions: 0
- ActiveControllerCount: 1

Producer Metrics:
- RecordSendRate: Actual throughput
- RecordErrorRate: <0.1%
- RecordRetryRate: <1%
- RequestLatency: <5ms P99
- BufferAvailableBytes: >10MB

Consumer Metrics:
- RecordsConsumedRate: Actual throughput
- RecordsLagMax: <1000 messages
- FetchLatency: <5ms P99
- CommitLatency: <10ms P99
- RebalanceRate: <1 per hour
```

### Alerting Rules
```
Critical Alerts:
- OfflinePartitions > 0
- UnderReplicatedPartitions > 10
- ActiveControllerCount != 1
- BrokerDown for >5 minutes
- ConsumerLag > 100K messages

Warning Alerts:
- RequestLatency P99 > 20ms
- ReplicaLag > 10 seconds
- DiskUsage > 80%
- CPUUsage > 80%
- ConsumerLag > 10K messages
```

## Cost Optimization

### Resource Right-Sizing
```
Over-Provisioned (Before):
- 20 brokers × $500/month = $10K
- 40% average utilization
- Wasted: $6K/month

Right-Sized (After):
- 12 brokers × $500/month = $6K
- 70% average utilization
- Savings: $4K/month (40%)

Strategies:
- Monitor actual usage
- Scale down during off-peak
- Use spot instances (70% savings)
- Reserved instances (40% savings)
```

### Storage Optimization
```
Retention Tuning:
- Default: 7 days
- Logs: 1 day (save 85%)
- Events: 3 days (save 57%)
- Critical: 30 days

Compression:
- None: 100 GB
- Snappy: 50 GB (50% savings)
- Gzip: 33 GB (67% savings)

Tiered Storage:
- Hot (SSD): 7 days, $0.10/GB = $10/TB
- Warm (HDD): 30 days, $0.05/GB = $5/TB
- Cold (S3): 1 year, $0.02/GB = $2/TB
```

This comprehensive scaling strategy ensures the messaging system can handle growth while maintaining performance and controlling costs.
