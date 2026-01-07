# Distributed Tracing System - Scale and Constraints

## Scale Estimation

### Traffic Analysis
- **Services**: 1,000 microservices
- **Requests**: 100K requests/sec
- **Spans per Request**: 10 spans average
- **Span Generation**: 1M spans/sec
- **Sampling Rate**: 1% (10K spans/sec stored)

### Data Volume
```
Daily Span Generation:
- 1M spans/sec × 86,400 sec = 86.4B spans/day
- With 1% sampling: 864M spans/day stored

Per Span Storage:
- Span data: 500 bytes average
- 864M × 500 bytes = 432GB/day
- With compression (10:1): 43GB/day

Monthly Storage:
- 43GB/day × 30 days = 1.3TB/month
```

## Capacity Planning

### Collector Cluster
```
Ingestion Capacity:
- 1 collector: 10K spans/sec
- 10 collectors: 100K spans/sec
- Auto-scaling based on load

Processing Pipeline:
- Validation: 1ms per span
- Enrichment: 0.5ms per span
- Batching: 100 spans per batch
- Total: ~150ms per batch
```

### Storage Cluster
```
Cassandra/Elasticsearch:
- 10 nodes for 1.3TB/month
- 3x replication factor
- 4TB total storage
- SSD for query performance
```

This scale analysis ensures the tracing system handles enterprise workloads efficiently.
