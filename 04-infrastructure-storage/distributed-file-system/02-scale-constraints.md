# Distributed File System - Scale and Constraints

## Storage Capacity
- **Total Storage**: 10PB raw capacity
- **Replication Factor**: 3x
- **Usable Storage**: 3.3PB (after replication)
- **Number of Files**: 100 million files
- **Average File Size**: 33GB
- **Block Size**: 128MB
- **Total Blocks**: 250 million blocks

## Cluster Configuration
- **DataNodes**: 1,000 nodes
- **Storage per Node**: 10TB (10 × 1TB disks)
- **Memory per Node**: 64GB RAM
- **CPU per Node**: 16 cores
- **Network**: 10Gbps per node

## Throughput Requirements
- **Write Throughput**: 10GB/s cluster-wide
- **Read Throughput**: 20GB/s cluster-wide
- **Metadata Operations**: 100K ops/sec
- **Concurrent Clients**: 10,000 clients
- **Per-Client Throughput**: 100MB/s write, 200MB/s read

## Network Bandwidth
- **Intra-Rack**: 10Gbps
- **Inter-Rack**: 1Gbps
- **Replication Traffic**: 30GB/s (3x write throughput)
- **Total Bandwidth**: 10Tbps cluster-wide

## Cost Estimation
- **Storage**: 10PB × $20/TB = $200K/month
- **Compute**: 1,000 nodes × $200 = $200K/month
- **Network**: $50K/month
- **Total**: $450K/month ($0.015/GB/month)
