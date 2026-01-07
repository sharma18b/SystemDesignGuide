# Database Batch Auditing Service - Scaling Considerations

## Ingestion Scaling

### CDC Agent Scaling
```
Horizontal Scaling:
- 1 agent per database
- Independent scaling
- No coordination needed

Capacity:
- 1 agent: 10K changes/sec
- 1,000 agents: 10M changes/sec
- Linear scaling
```

### Kafka Partitioning
```
Partitioning Strategy:
- Partition by database
- 100 partitions
- Parallel processing
- Load balancing

Throughput:
- 100K changes/sec per partition
- 10M changes/sec total
```

## Storage Scaling

### ClickHouse Scaling
```
Horizontal Scaling:
- Add nodes to cluster
- Distributed tables
- Parallel queries

Capacity:
- 1 node: 100K inserts/sec
- 10 nodes: 1M inserts/sec
- 3x replication
```

### Tiered Storage
```
Hot Tier (30 days):
- ClickHouse on SSD
- Fast queries
- 5TB storage

Warm Tier (1 year):
- ClickHouse on HDD
- Slower queries
- 60TB storage

Cold Tier (7 years):
- S3 Glacier
- Archive only
- 100TB storage
```

This scaling guide ensures the auditing system handles growing data volumes efficiently.
