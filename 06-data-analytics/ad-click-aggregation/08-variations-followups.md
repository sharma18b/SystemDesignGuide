# Ad Click Aggregation - Variations and Follow-ups

## Common Variations

### 1. Impression Tracking
- Track ad impressions (views)
- Calculate CTR (click-through rate)
- Viewability tracking
- Frequency capping

### 2. Conversion Attribution
- Track post-click conversions
- Multi-touch attribution
- Attribution windows
- Revenue tracking

### 3. Real-time Bidding (RTB)
- Bid request aggregation
- Win rate calculation
- Bid optimization
- Budget pacing

### 4. Video Ad Analytics
- Video start/complete tracking
- Watch time aggregation
- Quality metrics
- Engagement tracking

## Follow-up Questions

**Q: How do you ensure exactly-once semantics?**
A: Flink checkpointing, idempotent writes, transactional sinks, deduplication with Redis, reconciliation jobs.

**Q: How do you detect click fraud?**
A: Rate limiting per user/IP, bot detection (user-agent, behavior), IP reputation, ML models, pattern analysis.

**Q: How do you handle late-arriving clicks?**
A: Watermarks with grace period, late data side output, batch reconciliation, allowed lateness configuration.

**Q: How do you deduplicate clicks?**
A: Redis cache with click_id (5 min TTL), Bloom filter for pre-check, database unique constraints.

**Q: How do you handle high cardinality?**
A: Pre-aggregation, dimension reduction, sampling for analytics, separate billing pipeline.

**Q: How do you ensure billing accuracy?**
A: Exactly-once processing, reconciliation jobs, audit trails, idempotent operations, transaction logs.

**Q: How do you optimize for cost?**
A: Compression (10:1), tiered storage, sampling for analytics, spot instances, retention policies.

**Q: How do you handle traffic spikes?**
A: Auto-scaling, Kafka buffering, backpressure, rate limiting, circuit breakers.

## Edge Cases

### Duplicate Clicks
- Network retries
- Browser back button
- Malicious duplication
- **Handling**: Deduplication with Redis, click_id tracking

### Clock Skew
- Client time incorrect
- Server time differences
- Timezone issues
- **Handling**: Server-side timestamps, NTP sync, validation

### Fraud Patterns
- Click farms
- Bot networks
- Competitor clicks
- **Handling**: ML models, IP reputation, behavior analysis, rate limiting

### System Failures
- Kafka outage
- Flink job failure
- Database unavailable
- **Handling**: Checkpointing, replay from Kafka, graceful degradation

These variations demonstrate comprehensive understanding of ad click aggregation systems.
