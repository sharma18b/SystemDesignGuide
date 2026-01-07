# Distributed Locking System - Scale and Constraints

## Scale Estimation

### Traffic Analysis
- **Total Applications**: 1,000 distributed applications
- **Active Clients**: 10,000 concurrent clients
- **Lock Operations**: 10,000 ops/sec average
- **Peak Traffic**: 50,000 ops/sec (5x normal)
- **Active Locks**: 100,000 locks at any time
- **Watch Operations**: 50,000 active watches

### Operation Breakdown
```
Daily Operations:
- Lock acquisitions: 10K ops/sec × 86,400 sec = 864M/day
- Lock releases: 10K ops/sec × 86,400 sec = 864M/day
- Heartbeats: 10K clients × 1/sec × 86,400 = 864M/day
- Watch notifications: 5K/sec × 86,400 = 432M/day
- Total operations: ~3 billion/day

Lock Duration Distribution:
- Short locks (<1 sec): 60%
- Medium locks (1-10 sec): 30%
- Long locks (>10 sec): 10%
- Average duration: 5 seconds
```

### Storage Requirements
```
Per Lock State:
- Lock path: 100 bytes
- Owner session ID: 16 bytes
- Fencing token: 8 bytes
- Timestamps: 24 bytes
- Metadata: 52 bytes
Total: ~200 bytes per lock

Cluster Storage:
- 100K active locks × 200 bytes = 20MB
- Log entries (1 day): 3B ops × 100 bytes = 300GB
- Snapshots: 100MB per snapshot
- Total: ~500GB with retention
```

## Capacity Planning

### Cluster Configuration
```
Recommended Cluster Sizes:

Small (Development):
- 3 nodes
- 10K ops/sec
- 1K concurrent clients
- 10K active locks

Medium (Production):
- 5 nodes
- 50K ops/sec
- 5K concurrent clients
- 50K active locks

Large (Enterprise):
- 7 nodes
- 100K ops/sec
- 10K concurrent clients
- 100K active locks

Why Odd Numbers?
- Quorum: (N/2 + 1) for consensus
- 3 nodes: Tolerates 1 failure
- 5 nodes: Tolerates 2 failures
- 7 nodes: Tolerates 3 failures
```

