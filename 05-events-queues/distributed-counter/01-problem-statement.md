# Distributed Counter - Problem Statement

## Overview
Design a distributed counting system that can accurately count events across multiple servers with high throughput and eventual consistency. The system should handle scenarios like counting page views, likes, video plays, API requests, and real-time analytics with minimal latency overhead.

## Functional Requirements

### Core Counting Features
- **Increment Counter**: Atomically increment counter values
- **Decrement Counter**: Atomically decrement counter values
- **Get Count**: Retrieve current counter value
- **Reset Counter**: Reset counter to zero or specific value
- **Batch Operations**: Increment/decrement by arbitrary amounts
- **Multiple Counters**: Support millions of independent counters

### Counter Types
- **Global Counters**: Single counter across all servers (e.g., total users)
- **Sharded Counters**: Distributed across multiple shards for scalability
- **Time-Windowed Counters**: Count within time windows (hourly, daily)
- **Approximate Counters**: Trade accuracy for performance
- **Exact Counters**: Guarantee 100% accuracy (slower)

### Query Operations
- **Point Query**: Get count at specific time
- **Range Query**: Get count between time ranges
- **Top-K Query**: Get top K counters by value
- **Aggregation**: Sum, average, min, max across counters
- **Real-time Updates**: Subscribe to counter changes

## Non-Functional Requirements

### Performance Requirements
- **Increment Latency**: <1ms P99 for local increments
- **Read Latency**: <5ms P99 for counter reads
- **Throughput**: 1 million increments per second per server
- **Batch Size**: Support batches of 10,000 increments
- **Memory Efficiency**: <100 bytes per counter

### Scalability Requirements
- **Concurrent Increments**: 100K+ concurrent increment operations
- **Total Counters**: Support 100 million active counters
- **Horizontal Scaling**: Linear scaling with server additions
- **Geographic Distribution**: Multi-region deployment support

### Accuracy Requirements
- **Eventual Consistency**: 99%+ accuracy within 1 second
- **Strong Consistency**: 100% accuracy (optional, slower)
- **Convergence Time**: <1 second for distributed updates
- **Conflict Resolution**: Handle concurrent updates correctly

### Reliability Requirements
- **System Uptime**: 99.9% availability
- **Data Durability**: No count loss on server failure
- **Fault Tolerance**: Continue operating with partial failures
- **Recovery Time**: <30 seconds after server restart

## Use Cases

### 1. Page View Counter
```
Scenario: Count page views for articles
Scale: 1 million page views per second
Accuracy: 99% acceptable (approximate)
Latency: <1ms increment, <10ms read

Requirements:
- High write throughput
- Eventual consistency acceptable
- Real-time dashboard updates
```

### 2. Like/Vote Counter
```
Scenario: Count likes on social media posts
Scale: 100K likes per second
Accuracy: 100% required (exact)
Latency: <5ms increment, <5ms read

Requirements:
- Strong consistency
- No double-counting
- Prevent negative counts
```

### 3. API Rate Limiting Counter
```
Scenario: Count API requests per user
Scale: 10 million requests per second
Accuracy: 99.9% required
Latency: <1ms increment, <1ms read

Requirements:
- Very low latency
- Time-windowed counts
- Automatic expiration
```

### 4. Real-time Analytics
```
Scenario: Count events for dashboards
Scale: 1 million events per second
Accuracy: 95% acceptable
Latency: <10ms read

Requirements:
- Multiple time windows (1m, 5m, 1h, 1d)
- Aggregation across dimensions
- Historical data retention
```

## Edge Cases and Constraints

### Concurrent Updates
- **Race Conditions**: Multiple servers incrementing simultaneously
- **Lost Updates**: Network failures during increment
- **Duplicate Increments**: Retry logic causing double-counting
- **Clock Skew**: Time synchronization across servers

### Network Partitions
- **Split Brain**: Different counts in different partitions
- **Reconciliation**: Merging counts after partition heals
- **Consistency**: Maintaining accuracy during partition

### High Cardinality
- **Memory Pressure**: Millions of counters in memory
- **Eviction Policy**: Which counters to keep in cache
- **Cold Start**: Loading counters after restart

## Success Metrics

### Performance Metrics
- **Increment Throughput**: 1M+ ops/second per server
- **Read Throughput**: 100K+ reads/second per server
- **Latency P50**: <0.5ms for increments
- **Latency P99**: <2ms for increments
- **Memory Usage**: <10GB for 100M counters

### Accuracy Metrics
- **Accuracy Rate**: 99%+ for approximate counters
- **Convergence Time**: <1 second for eventual consistency
- **Error Rate**: <0.1% for exact counters
- **Conflict Rate**: <0.01% of operations

### Business Metrics
- **Cost per Operation**: <$0.0001 per million operations
- **Infrastructure Cost**: <$5K per billion operations/month
- **Operational Overhead**: <0.5 FTE per 1000 servers

This problem statement provides the foundation for designing a scalable, accurate, and efficient distributed counting system.
