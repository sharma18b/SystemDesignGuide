# Distributed Unique ID Generator - Problem Statement

## Overview
Design a distributed system that generates globally unique IDs across multiple machines without requiring coordination between nodes. The system must provide high throughput, low latency, and guarantee uniqueness while supporting ordering and scalability requirements for large-scale distributed applications.

## Functional Requirements

### Core ID Generation Features
- **Unique ID Generation**: Generate IDs that are globally unique across all nodes
- **High Throughput**: Support millions of ID generations per second per node
- **No Coordination**: Generate IDs without inter-node communication
- **Sortable IDs**: IDs should be roughly time-ordered for efficient indexing
- **64-bit Integer**: IDs fit in a 64-bit signed integer for database compatibility
- **Collision-Free**: Zero probability of ID collisions under normal operation

### ID Properties and Characteristics
- **Monotonically Increasing**: IDs increase over time within a single node
- **Roughly Sortable**: IDs from different nodes can be sorted by creation time
- **Compact Format**: Efficient storage and transmission
- **Human-Readable Option**: Support for base62/base64 encoded string IDs
- **Custom Epoch**: Configurable epoch for extended ID lifetime
- **Embedded Metadata**: Optional embedding of shard/datacenter information

### Multi-Datacenter Support
- **Geographic Distribution**: Generate IDs across multiple datacenters
- **Datacenter Awareness**: Embed datacenter ID in generated IDs
- **Independent Operation**: Each datacenter operates independently
- **Clock Skew Tolerance**: Handle clock differences between datacenters
- **Failover Support**: Continue ID generation during datacenter failures
- **Cross-Region Uniqueness**: Guarantee uniqueness across all regions

### Node Management
- **Dynamic Node Addition**: Add new ID generator nodes without downtime
- **Node Decommissioning**: Safely remove nodes from the cluster
- **Worker ID Assignment**: Automatic or manual worker ID allocation
- **Worker ID Reuse**: Safe reuse of worker IDs after node retirement
- **Health Monitoring**: Track node health and ID generation metrics
- **Configuration Management**: Centralized configuration for all nodes

### ID Format Variations
- **Twitter Snowflake**: 64-bit with timestamp, datacenter, worker, sequence
- **Instagram Style**: 64-bit with timestamp, shard ID, sequence
- **UUID v1**: 128-bit time-based UUID with MAC address
- **UUID v4**: 128-bit random UUID
- **ULID**: 128-bit lexicographically sortable UUID
- **Custom Formats**: Support for application-specific ID formats

### API and Integration
- **REST API**: HTTP endpoints for ID generation
- **gRPC Service**: High-performance RPC interface
- **Client Libraries**: SDKs for Java, Python, Go, Node.js
- **Batch Generation**: Generate multiple IDs in a single request
- **ID Parsing**: Extract timestamp and metadata from IDs
- **ID Validation**: Verify ID format and validity

## Non-Functional Requirements

### Performance Requirements
- **Generation Latency**: <1ms per ID generation on average
- **Throughput**: 10,000+ IDs per second per node
- **Batch Performance**: 100,000+ IDs per second in batch mode
- **CPU Efficiency**: <5% CPU usage at normal load
- **Memory Footprint**: <100MB per node
- **Network Overhead**: Minimal network usage for ID generation

### Scalability Requirements
- **Horizontal Scaling**: Support 1,000+ ID generator nodes
- **Worker ID Space**: Support 1,024 unique worker IDs per datacenter
- **Datacenter Scaling**: Support 32+ datacenters globally
- **ID Space**: Generate 2^63 unique IDs before exhaustion
- **Lifetime**: 69+ years of ID generation at 1M IDs/sec
- **Concurrent Requests**: Handle 100,000+ concurrent requests

### Reliability Requirements
- **Availability**: 99.99% uptime (52 minutes downtime per year)
- **Uniqueness Guarantee**: 100% uniqueness under normal operation
- **Fault Tolerance**: Continue operation during node failures
- **Data Durability**: No persistent state required
- **Graceful Degradation**: Fallback mechanisms for clock issues
- **Zero Data Loss**: No risk of ID loss or corruption

### Consistency Requirements
- **Uniqueness**: Strong guarantee of global uniqueness
- **Ordering**: Eventual consistency for time-based ordering
- **Clock Synchronization**: Tolerate up to 1 second clock drift
- **Sequence Consistency**: Monotonic increase within single node
- **Cross-Node Ordering**: Best-effort ordering across nodes
- **Timestamp Accuracy**: Within 1 second of actual time

## Technical Constraints

### ID Format Constraints
- **Bit Allocation**: Efficient use of 64-bit space
  - Timestamp: 41 bits (69 years with custom epoch)
  - Datacenter ID: 5 bits (32 datacenters)
  - Worker ID: 5 bits (32 workers per datacenter)
  - Sequence: 12 bits (4096 IDs per millisecond)
- **Epoch**: Custom epoch (e.g., 2020-01-01) to extend lifetime
- **Sign Bit**: Positive integers only for database compatibility
- **Overflow Handling**: Graceful handling of sequence overflow

### Clock Synchronization
- **NTP Synchronization**: All nodes synchronized via NTP
- **Clock Drift Detection**: Monitor and alert on clock drift >100ms
- **Backward Clock Movement**: Handle clock adjustments gracefully
- **Leap Second Handling**: Proper handling of leap seconds
- **Time Source**: Multiple NTP servers for redundancy
- **Fallback Mechanism**: Continue operation during NTP failures

### Worker ID Management
- **Static Assignment**: Manual worker ID configuration
- **Dynamic Assignment**: Automatic worker ID allocation via coordination service
- **ID Reuse Policy**: Wait period before reusing worker IDs
- **Conflict Detection**: Detect and prevent worker ID conflicts
- **Registration Service**: Optional Zookeeper/etcd for worker registration
- **Deregistration**: Clean worker ID release on shutdown

### Sequence Number Management
- **Per-Millisecond Reset**: Reset sequence to 0 each millisecond
- **Overflow Handling**: Wait for next millisecond on sequence overflow
- **Thread Safety**: Thread-safe sequence increment
- **Lock-Free Implementation**: Use atomic operations for performance
- **Sequence Exhaustion**: Handle 4096 IDs/ms limit gracefully
- **Burst Handling**: Support burst traffic within sequence limits

## Edge Cases and Failure Scenarios

### Clock-Related Issues
- **Clock Regression**: Handle backward time adjustments
- **Clock Skew**: Tolerate clock differences between nodes
- **NTP Failure**: Continue operation without NTP synchronization
- **Leap Seconds**: Handle leap second insertions correctly
- **Time Zone Changes**: Operate in UTC to avoid timezone issues
- **System Time Changes**: Detect and handle manual time changes

### High Load Scenarios
- **Sequence Exhaustion**: Handle >4096 IDs per millisecond
- **Burst Traffic**: Handle sudden spikes in ID requests
- **Sustained High Load**: Maintain performance under continuous load
- **Resource Exhaustion**: Handle memory/CPU constraints
- **Network Congestion**: Operate during network issues
- **Cascading Failures**: Prevent failures from spreading

### Operational Challenges
- **Node Restart**: Resume ID generation after restart
- **Configuration Changes**: Apply config updates without downtime
- **Worker ID Conflicts**: Detect and resolve ID conflicts
- **Datacenter Failover**: Handle datacenter outages
- **Split Brain**: Prevent duplicate worker IDs in network partitions
- **Monitoring Gaps**: Detect and alert on generation issues

## Success Metrics

### Performance Metrics
- **Average Latency**: <1ms for 99th percentile
- **Throughput**: 10,000+ IDs/sec per node sustained
- **CPU Utilization**: <5% at normal load
- **Memory Usage**: <100MB per node
- **Network Bandwidth**: <1Mbps per node
- **Error Rate**: <0.001% failed generations

### Reliability Metrics
- **Uptime**: 99.99% availability
- **Uniqueness**: 100% unique IDs generated
- **Clock Drift**: <100ms drift detected and corrected
- **Sequence Overflow**: <0.01% requests delayed due to overflow
- **Node Failures**: <1 minute recovery time
- **Data Corruption**: Zero corrupted IDs

### Business Metrics
- **Cost per Million IDs**: <$0.01 infrastructure cost
- **Operational Overhead**: <1 hour/week maintenance
- **Deployment Time**: <5 minutes for new node deployment
- **Incident Response**: <15 minutes mean time to resolution
- **Scalability**: Support 10x traffic growth without redesign
- **Developer Satisfaction**: 90%+ satisfaction with API usability

This problem statement provides the foundation for designing a robust, scalable, and efficient distributed unique ID generation system suitable for large-scale applications requiring billions of unique identifiers.
