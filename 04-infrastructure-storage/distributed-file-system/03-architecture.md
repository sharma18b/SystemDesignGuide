# Distributed File System - Architecture

## High-Level Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Clients                              │
│  (MapReduce, Spark, Applications)                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              NameNode (Master)                          │
│  - Namespace management                                 │
│  - Block mapping                                        │
│  - Replication management                               │
│  - Heartbeat processing                                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              DataNodes (Workers)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ DataNode │  │ DataNode │  │ DataNode │             │
│  │    1     │  │    2     │  │    N     │             │
│  │ Blocks:  │  │ Blocks:  │  │ Blocks:  │             │
│  │ 1,4,7... │  │ 2,5,8... │  │ 3,6,9... │             │
│  └──────────┘  └──────────┘  └──────────┘             │
└─────────────────────────────────────────────────────────┘
```

## NameNode (Master)
- **Namespace Management**: Directory tree, file metadata
- **Block Mapping**: File → Block locations
- **Replication Policy**: Maintain replication factor
- **Heartbeat Processing**: Monitor DataNode health
- **Block Reports**: Track block locations
- **Metadata Persistence**: Edit log + FSImage

## DataNode (Worker)
- **Block Storage**: Store file blocks on local disks
- **Block Serving**: Serve blocks to clients
- **Heartbeat**: Send periodic heartbeats to NameNode
- **Block Reports**: Report block inventory
- **Replication**: Replicate blocks to other DataNodes
- **Checksums**: Verify data integrity

## Write Flow
1. Client requests NameNode for block locations
2. NameNode allocates blocks and returns DataNode list
3. Client writes to first DataNode
4. First DataNode pipelines to second DataNode
5. Second DataNode pipelines to third DataNode
6. Acknowledgments flow back through pipeline
7. Client notifies NameNode of completion

## Read Flow
1. Client requests NameNode for block locations
2. NameNode returns list of DataNodes with blocks
3. Client reads from nearest DataNode
4. Client verifies checksums
5. Client reads next block if needed

## Replication Strategy
- **Rack-Aware**: First replica on local rack, second on different rack, third on same rack as second
- **Load Balancing**: Distribute replicas evenly
- **Network Topology**: Minimize cross-rack traffic
- **Failure Domains**: Protect against rack failures

This architecture provides high throughput, fault tolerance, and scalability for big data workloads.
