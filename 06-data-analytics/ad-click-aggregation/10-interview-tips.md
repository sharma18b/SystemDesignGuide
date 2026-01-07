# Ad Click Aggregation - Interview Tips

## Interview Approach

### 1. Clarify Requirements (5 minutes)
**Key Questions**:
- Click volume: Clicks per second?
- Accuracy: Exactly-once for billing?
- Latency: Real-time or batch acceptable?
- Fraud: How important is fraud detection?
- Dimensions: What aggregation dimensions?

### 2. High-Level Design (10 minutes)
**Components**:
- Click ingestion (CDN, API)
- Message queue (Kafka)
- Stream processing (Flink)
- Storage (ClickHouse)
- Fraud detection
- Dashboard/API

### 3. Deep Dive (20 minutes)
**Focus Areas**:
- Exactly-once semantics
- Deduplication strategy
- Fraud detection approach
- Aggregation windows
- Scaling strategy

### 4. Tradeoffs (10 minutes)
**Discuss**:
- Exactly-once vs at-least-once
- Real-time vs batch
- Accuracy vs latency
- Cost vs performance

## Common Pitfalls

### Don't
- Ignore exactly-once requirement for billing
- Forget about fraud detection
- Overlook deduplication
- Ignore late-arriving data
- Forget about cost optimization

### Do
- Emphasize billing accuracy
- Discuss fraud prevention
- Consider deduplication carefully
- Think about failure modes
- Mention reconciliation

## Key Topics

### Exactly-Once Processing
- Flink checkpointing
- Idempotent writes
- Transactional sinks
- Deduplication

### Fraud Detection
- Rate limiting
- Bot detection
- IP reputation
- ML models

### Aggregation
- Tumbling windows
- State management
- Late data handling
- Pre-aggregation

### Scaling
- Kafka partitioning
- Flink parallelism
- Storage sharding
- Cost optimization

## Strong Signals

### Technical Depth
- Understand stream processing
- Know exactly-once semantics
- Familiar with fraud detection
- Understand distributed systems

### System Thinking
- Consider billing accuracy
- Think about fraud
- Discuss failure modes
- Consider cost

## Sample Answers

**Q: How do you ensure exactly-once for billing?**
A: Flink exactly-once with checkpointing, idempotent writes to ClickHouse, deduplication with Redis, reconciliation jobs.

**Q: How do you detect fraud?**
A: Rate limiting per user/IP, bot detection via user-agent and behavior, IP reputation, ML models, pattern analysis.

**Q: How do you handle 10M clicks/sec?**
A: Kafka with 10K partitions, Flink cluster with 500 nodes, ClickHouse with 100 nodes, horizontal scaling, compression.

This structured approach demonstrates comprehensive understanding of ad click aggregation systems.
