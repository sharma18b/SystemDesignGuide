# Distributed Messaging System - Problem Statement

## Overview
Design a distributed message queue system similar to Apache Kafka or RabbitMQ that can handle high-throughput message publishing and consumption with durability, ordering guarantees, and fault tolerance. The system should support pub/sub patterns, message persistence, consumer groups, and horizontal scalability.

## Functional Requirements

### Core Messaging Features
- **Message Publishing**: Producers can publish messages to topics
- **Message Consumption**: Consumers can subscribe to topics and receive messages
- **Topic Management**: Create, delete, and configure topics dynamically
- **Message Ordering**: Guarantee message order within partitions
- **Message Persistence**: Durable storage of messages for replay
- **Message Retention**: Configurable retention policies (time-based, size-based)

### Pub/Sub Patterns
- **Point-to-Point**: Single consumer receives each message
- **Publish-Subscribe**: Multiple consumers receive same message
- **Consumer Groups**: Load balancing across multiple consumers
- **Broadcast**: Send message to all subscribers
- **Fanout**: Route messages to multiple queues
- **Topic Routing**: Route messages based on routing keys

### Message Delivery Guarantees
- **At-Most-Once**: Fire and forget, no guarantees
- **At-Least-Once**: Message delivered at least once (may duplicate)
- **Exactly-Once**: Message delivered exactly once (no duplicates)
- **Ordered Delivery**: Messages delivered in publish order
- **Acknowledgments**: Consumer confirms message processing
- **Dead Letter Queue**: Handle failed messages after retries

### Consumer Management
- **Consumer Groups**: Multiple consumers share topic load
- **Partition Assignment**: Automatic partition distribution
- **Rebalancing**: Redistribute partitions when consumers join/leave
- **Offset Management**: Track consumer progress per partition
- **Offset Commit**: Manual or automatic offset commits
- **Offset Reset**: Start from beginning, end, or specific offset

### Message Features
- **Message Headers**: Metadata attached to messages
- **Message Keys**: Partition assignment based on keys
- **Message Timestamps**: Producer or broker timestamps
- **Message Compression**: Gzip, Snappy, LZ4, Zstd
- **Message Batching**: Batch multiple messages for efficiency
- **Message Filtering**: Server-side message filtering

## Non-Functional Requirements

### Performance Requirements
- **Throughput**: 1 million messages per second per broker
- **Latency**: <10ms end-to-end latency (producer to consumer)
- **Publishing Latency**: <5ms to acknowledge message receipt
- **Consumption Latency**: <5ms to fetch messages
- **Batch Processing**: 10,000+ messages per batch
- **Network Efficiency**: <1KB overhead per message

### Scalability Requirements
- **Horizontal Scaling**: Add brokers to increase capacity
- **Topics**: Support 10,000+ topics per cluster
- **Partitions**: 100,000+ partitions across cluster
- **Consumers**: 100,000+ concurrent consumers
- **Producers**: 10,000+ concurrent producers
- **Message Size**: Support messages up to 10MB

### Reliability Requirements
- **System Uptime**: 99.99% availability
- **Data Durability**: 99.999999999% (11 9's) message durability
- **Replication**: 3x replication across brokers
- **Fault Tolerance**: Survive multiple broker failures
- **Zero Data Loss**: No message loss on broker failure
- **Disaster Recovery**: <15 minutes RTO, <1 minute RPO

### Consistency Requirements
- **Partition Ordering**: Strict ordering within partitions
- **Cross-Partition**: No ordering guarantees across partitions
- **Replication Consistency**: Synchronous or asynchronous replication
- **Consumer Consistency**: Read-your-writes for same consumer
- **Offset Consistency**: Consistent offset tracking
- **Metadata Consistency**: Consistent topic/partition metadata

## Message Ordering Guarantees

### Partition-Level Ordering
```
Topic: user-events
Partition 0: [msg1, msg2, msg3] → Ordered
Partition 1: [msg4, msg5, msg6] → Ordered
Partition 2: [msg7, msg8, msg9] → Ordered

Guarantee: Messages within same partition are ordered
No Guarantee: Messages across partitions
```

### Key-Based Ordering
```
Messages with same key → Same partition → Ordered

user_id=123 → Partition 0 → [login, update, logout] (ordered)
user_id=456 → Partition 1 → [login, update, logout] (ordered)

Use Case: User activity events must be processed in order
```

### Global Ordering
```
Single Partition Topic:
- All messages go to one partition
- Strict global ordering
- Limited throughput (single partition bottleneck)

Use Case: Financial transactions requiring strict ordering
```

## Delivery Semantics

### At-Most-Once Delivery
```
Producer → Broker (no ack) → Consumer (no ack)

Characteristics:
- Fastest performance
- Possible message loss
- No duplicates
- Fire and forget

Use Cases:
- Metrics and monitoring
- Non-critical logs
- Real-time analytics
```

### At-Least-Once Delivery
```
Producer → Broker (ack) → Consumer (ack after processing)

Characteristics:
- Guaranteed delivery
- Possible duplicates
- Retry on failure
- Idempotent processing required

Use Cases:
- Event processing
- Data pipelines
- Most production workloads
```

### Exactly-Once Delivery
```
Producer → Broker (transactional) → Consumer (transactional)

Characteristics:
- No duplicates
- No message loss
- Highest latency
- Complex implementation

Use Cases:
- Financial transactions
- Payment processing
- Critical data pipelines
```

## Edge Cases and Constraints

### Producer Challenges
- **Network Failures**: Handle connection drops during send
- **Broker Failures**: Retry to different brokers
- **Slow Brokers**: Timeout and retry logic
- **Message Too Large**: Reject or split messages
- **Buffer Full**: Block or drop messages
- **Partition Unavailable**: Retry or fail

### Consumer Challenges
- **Slow Processing**: Backpressure and flow control
- **Consumer Failures**: Rebalance and reassign partitions
- **Duplicate Messages**: Idempotent processing
- **Message Skipping**: Offset management
- **Poison Messages**: Dead letter queue
- **Consumer Lag**: Monitor and alert

### Broker Challenges
- **Disk Full**: Stop accepting messages, alert
- **Memory Pressure**: Flush to disk, throttle
- **Network Saturation**: Backpressure, rate limiting
- **Replication Lag**: Slow down producers
- **Leader Election**: Automatic failover
- **Split Brain**: Prevent with quorum

### Operational Challenges
- **Topic Deletion**: Clean up data and metadata
- **Partition Rebalancing**: Minimize disruption
- **Broker Maintenance**: Rolling restarts
- **Version Upgrades**: Backward compatibility
- **Monitoring**: Comprehensive metrics
- **Debugging**: Distributed tracing

## Success Metrics

### Performance Metrics
- **Throughput**: 1M+ messages/second per broker
- **Latency P50**: <5ms end-to-end
- **Latency P99**: <20ms end-to-end
- **Batch Size**: 10,000+ messages per batch
- **Compression Ratio**: 3:1 average
- **Network Utilization**: <80% of capacity

### Reliability Metrics
- **Message Durability**: 99.999999999% (11 9's)
- **System Availability**: 99.99% uptime
- **Replication Success**: 99.99% of messages replicated
- **Zero Data Loss**: 0 messages lost on broker failure
- **Recovery Time**: <15 minutes for broker failure
- **Consumer Lag**: <1 second for 95% of consumers

### Operational Metrics
- **Broker CPU**: <70% average utilization
- **Broker Memory**: <80% utilization
- **Disk I/O**: <80% of capacity
- **Network I/O**: <80% of bandwidth
- **Rebalance Time**: <30 seconds
- **Leader Election**: <5 seconds

### Business Metrics
- **Cost per Message**: <$0.0001 per million messages
- **Infrastructure Cost**: <$10K per billion messages/month
- **Operational Overhead**: <1 FTE per 100 brokers
- **Incident Rate**: <1 critical incident per quarter
- **Customer Satisfaction**: >4.5/5 rating
- **Adoption Rate**: 80%+ of services using messaging

This problem statement provides the foundation for designing a robust, scalable, and reliable distributed messaging system that can handle massive message volumes while maintaining strong guarantees.
