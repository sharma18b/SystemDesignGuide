# Top-K Analysis System - Scale and Constraints

## Traffic Scale

### Event Volume
```
Peak Events/Second: 1 million
Average Events/Second: 500K
Daily Events: 43.2 billion
Event Size: 100 bytes
Daily Data: 4.32 TB raw
Compressed: 864 GB (5:1)
```

### Top-K Tracking
```
K Value: 100
Time Windows: 5 (1min, 5min, 1hour, 1day, 1week)
Dimensions: 10
Unique Items: 1 billion
Memory per Counter: 16 bytes
Count-Min Sketch: 10 MB per dimension
Total Memory: 100 MB
```

## Infrastructure

### Stream Processing
```
Flink Cluster: 50 nodes
CPU: 32 cores each
Memory: 128 GB each
State Storage: 1 TB
```

### Storage
```
Redis Cluster: 20 nodes
Memory per Node: 256 GB
Total Memory: 5 TB
Persistence: RDB + AOF
```

### Query Nodes
```
API Nodes: 10 nodes
CPU: 16 cores each
Memory: 64 GB each
Cache: 10 GB per node
```

## Cost Analysis

### Monthly Infrastructure
```
Compute (Processing): $15,000
Storage (Redis): $20,000
Storage (Historical): $5,000
Network: $3,000
Total: $43,000
Cost per Billion Events: $1.00
```

This scale analysis provides the foundation for a high-performance top-K system.
