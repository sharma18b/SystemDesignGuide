# Ad Click Aggregation - Tradeoffs and Alternatives

## Processing Model Tradeoffs

### Exactly-Once vs At-Least-Once
**Exactly-Once (Billing)**
- Pros: 100% accuracy, no duplicates
- Cons: Higher latency, more complex
- Use for: Billing, financial data

**At-Least-Once (Analytics)**
- Pros: Lower latency, simpler
- Cons: Possible duplicates
- Use for: Dashboards, trends

**Decision**: Exactly-once for billing, at-least-once for analytics

### Real-time vs Batch Aggregation
**Real-time (Flink)**
- Pros: Immediate insights, live dashboards
- Cons: Higher cost, more complex
- Use for: Real-time monitoring

**Batch (Spark)**
- Pros: Simpler, cheaper, accurate
- Cons: Delayed insights
- Use for: Billing reports, historical

**Decision**: Real-time for dashboards, batch for billing reconciliation

## Storage Tradeoffs

### ClickHouse vs Druid
**ClickHouse**
- Pros: Better compression, faster writes, SQL
- Cons: Less mature for real-time
- Best for: High write volume, cost-sensitive

**Druid**
- Pros: Better for real-time, OLAP optimized
- Cons: More complex, higher cost
- Best for: Real-time analytics, high QPS

**Decision**: ClickHouse for cost and write performance

### Deduplication Strategy
**Redis Cache**
- Pros: Fast, simple, good enough
- Cons: Limited window, memory cost
- Use for: Short-term dedup (5 min)

**Bloom Filter**
- Pros: Memory efficient, fast
- Cons: False positives possible
- Use for: Long-term dedup check

**Decision**: Redis for exact dedup, Bloom filter for pre-check

## Fraud Detection Tradeoffs

### Real-time vs Batch
**Real-time**
- Pros: Immediate blocking, prevent fraud
- Cons: Higher latency, false positives
- Use for: High-risk clicks

**Batch**
- Pros: More accurate, lower cost
- Cons: Delayed detection
- Use for: Billing adjustments

**Decision**: Real-time scoring + batch reconciliation

## Alternative Approaches

### Managed Services
**Google Analytics, AWS Kinesis**
- Pros: No operations, integrated
- Cons: High cost, limited customization
- Best for: Small scale, standard needs

**Self-built**
- Pros: Full control, optimized for use case
- Cons: Development and operational cost
- Best for: Large scale, specific requirements

These tradeoffs guide architectural decisions for ad click aggregation systems.
