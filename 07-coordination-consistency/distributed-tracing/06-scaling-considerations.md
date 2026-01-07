# Distributed Tracing System - Scaling Considerations

## Ingestion Scaling

### Collector Scaling
```
Horizontal Scaling:
- Stateless collectors
- Load balancer distribution
- Auto-scaling based on queue depth

Capacity per Collector:
- 10K spans/sec per collector
- 10 collectors = 100K spans/sec
- Linear scaling
```

### Sampling Strategies
```
Adaptive Sampling:
- High-traffic services: 0.1% sampling
- Low-traffic services: 100% sampling
- Error traces: Always sample
- Slow traces: Always sample

Benefits:
- Reduced storage (10-100x)
- Lower overhead
- Keep important traces
```

## Storage Scaling

### Cassandra Scaling
```
Horizontal Scaling:
- Add nodes to cluster
- Rebalance data
- Linear write throughput

Capacity Planning:
- 1 node: 10K writes/sec
- 10 nodes: 100K writes/sec
- 3x replication factor
```

### Data Retention
```
Tiered Storage:
- Hot (7 days): SSD, full data
- Warm (30 days): HDD, sampled
- Cold (90 days): S3, aggregated

Automatic Cleanup:
- TTL-based deletion
- Compaction
- Archive to S3
```

This scaling guide ensures the tracing system handles growing workloads efficiently.
