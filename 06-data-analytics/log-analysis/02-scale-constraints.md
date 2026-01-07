# Log Analysis System - Scale and Constraints

## Traffic Scale

### Log Ingestion Volume
```
Log Sources: 100,000 sources
Peak Ingestion: 1 million logs/sec
Daily Volume: 100 billion logs
Average Log Size: 500 bytes
Daily Raw Data: 50 TB
Compressed (5:1): 10 TB/day
Monthly: 300 TB
Annual: 3.6 PB
```

### Storage Tiers
```
Hot (90 days): 900 TB SSD
Warm (1 year): 3.6 PB HDD
Cold (7 years): 25 PB S3
Total: 29.5 PB
```

### Query Load
```
Concurrent Users: 10,000
Queries/sec: 100 peak
Dashboard Refreshes: 5,000/min
Real-time Streams: 1,000 concurrent
```

## Infrastructure

### Ingestion Nodes
```
Nodes: 50 nodes
CPU: 32 cores each
Memory: 128 GB each
Network: 10 Gbps
```

### Storage Cluster
```
Elasticsearch Nodes: 200 nodes
Storage per Node: 10 TB
Memory per Node: 256 GB
Total Capacity: 2 PB
```

### Query Nodes
```
Nodes: 100 nodes
CPU: 48 cores each
Memory: 384 GB each
```

## Cost Analysis

### Monthly Infrastructure
```
Compute: $50,000
Storage (Hot): $90,000
Storage (Warm): $36,000
Storage (Cold): $2,500
Network: $10,000
Total: $188,500
```

This scale analysis provides the foundation for architecting a log analysis system.
