# Ad Click Aggregation - Scale and Constraints

## Traffic Scale

### Click Volume
```
Peak Clicks/Second: 10 million
Average Clicks/Second: 5.8 million
Daily Clicks: 500 billion
Monthly Clicks: 15 trillion
Click Size: 200 bytes
Daily Raw Data: 100 TB
Compressed (5:1): 20 TB/day
```

### Aggregation Volume
```
Time Windows: 1min, 1hour, 1day
Aggregation Dimensions: 10
Unique Aggregates: 1 billion
Updates/Second: 100,000
Storage per Aggregate: 100 bytes
Total Aggregate Storage: 100 GB
```

## Infrastructure

### Ingestion Layer
```
Nodes: 100 nodes
CPU: 32 cores each
Memory: 128 GB each
Network: 25 Gbps each
Throughput: 10M clicks/sec
```

### Stream Processing
```
Flink Cluster: 500 nodes
CPU: 48 cores each
Memory: 256 GB each
State Storage: 50 TB
Checkpoints: Every 1 minute
```

### Storage
```
ClickHouse Cluster: 100 nodes
Storage per Node: 20 TB
Total Storage: 2 PB
Replication: 3x
Query Nodes: 50 nodes
```

## Cost Analysis

### Monthly Infrastructure
```
Compute (Ingestion): $20,000
Compute (Processing): $150,000
Storage: $60,000
Network: $30,000
Total: $260,000
Cost per Billion Clicks: $17.33
```

This scale analysis provides the foundation for a high-throughput ad click system.
