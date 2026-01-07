# Web Analytics Tool - Variations and Follow-ups

## Common Variations

### 1. Mobile App Analytics
**Additional Requirements**:
- App lifecycle tracking (install, open, close)
- Screen view tracking instead of page views
- Crash reporting and error tracking
- App version and build tracking
- Push notification analytics

**Key Differences**:
- Native SDKs for iOS/Android
- Offline-first with local queue
- Battery and data usage optimization
- App store attribution tracking

### 2. E-commerce Analytics
**Enhanced Features**:
- Product impression tracking
- Shopping cart analytics
- Checkout funnel analysis
- Revenue attribution
- Product performance reports
- Customer lifetime value

**Additional Data**:
- Product catalog integration
- Inventory tracking
- Order management system integration
- Payment gateway data

### 3. Video Analytics
**Specialized Tracking**:
- Video play/pause/complete events
- Watch time and engagement
- Quality/bitrate changes
- Buffer events
- Drop-off analysis

**Metrics**:
- Average view duration
- Completion rate
- Engagement rate
- Quality of experience

### 4. Real-time Alerting System
**Alert Types**:
- Traffic spike detection
- Conversion drop alerts
- Error rate monitoring
- Performance degradation
- Anomaly detection

**Implementation**:
- Stream processing with Flink CEP
- Statistical anomaly detection
- Multi-channel notifications (email, Slack, PagerDuty)
- Alert rules engine

### 5. Attribution Modeling
**Models**:
- Last-click attribution
- First-click attribution
- Linear attribution
- Time-decay attribution
- Position-based attribution
- Data-driven attribution (ML)

**Challenges**:
- Cross-device tracking
- Multi-touch attribution
- Long conversion windows
- Offline conversions

## Follow-up Questions

### Data Processing
**Q: How do you handle late-arriving events?**
A: Use watermarks in Flink with 5-minute grace period. Late events beyond watermark go to side output for batch reprocessing. Daily batch jobs reconcile any discrepancies.

**Q: How do you deduplicate events?**
A: Client generates unique event_id (UUID). Use bloom filter in stream processor to detect duplicates within 1-hour window. Store event_ids in Redis with 1-hour TTL for exact deduplication.

**Q: How do you handle bot traffic?**
A: Multi-layer approach:
1. User-agent analysis (known bot patterns)
2. Behavioral analysis (too fast, no mouse movement)
3. IP reputation checking
4. Challenge-response for suspicious traffic
5. ML model for sophisticated bot detection

### Scalability
**Q: How do you handle a website with 1B pageviews/day?**
A: 
- Dedicated Kafka partitions (100+ partitions)
- Separate ClickHouse shard
- Sampling (10% rate) for queries
- Pre-aggregated data in Druid
- Dedicated query nodes
- CDN for SDK delivery

**Q: How do you scale to 100M concurrent users?**
A:
- Geographic distribution (10+ regions)
- 10,000+ ingestion nodes
- Kafka cluster with 1000+ brokers
- ClickHouse cluster with 1000+ nodes
- Redis cluster with 500+ nodes
- Multi-region active-active setup

### Query Performance
**Q: How do you optimize queries on high-cardinality dimensions?**
A:
- Use approximate algorithms (HyperLogLog for unique counts)
- Pre-aggregate common dimension combinations
- Limit cardinality in UI (top 1000 values)
- Use sampling for exploratory queries
- Bloom filters for existence checks

**Q: How do you handle queries spanning multiple years?**
A:
- Query warm/cold storage separately
- Use pre-aggregated data (daily/monthly rollups)
- Implement query result caching
- Suggest narrower time ranges
- Async query processing for large ranges

### Data Quality
**Q: How do you ensure data accuracy?**
A:
- End-to-end checksums
- Reconciliation jobs (stream vs batch)
- Data validation at ingestion
- Monitoring for data anomalies
- Regular audits against source systems

**Q: How do you handle timezone issues?**
A:
- Store all timestamps in UTC
- Convert to website timezone for display
- Handle DST transitions
- Validate client timestamps against server time
- Allow timezone override in reports

### Privacy and Compliance
**Q: How do you handle GDPR data deletion requests?**
A:
- User ID to event mapping in metadata store
- Async deletion job marks events for deletion
- Batch job removes events from ClickHouse
- Purge from backups and archives
- Deletion confirmation within 30 days

**Q: How do you implement consent management?**
A:
- Consent signal in tracking call
- Store consent status in Redis
- Filter events without consent
- Retroactive consent application
- Consent audit trail

### Cost Optimization
**Q: How do you reduce storage costs?**
A:
- Aggressive compression (4:1 ratio)
- Tiered storage (hot/warm/cold)
- Data lifecycle policies
- Sampling for high-traffic sites
- Columnar storage format
- Drop unnecessary fields

**Q: How do you optimize compute costs?**
A:
- Spot instances for batch jobs (70% savings)
- Auto-scaling based on load
- Query result caching
- Pre-aggregated data
- Right-sized instances
- Reserved instances for base load

### Advanced Features
**Q: How would you implement A/B testing?**
A:
- Experiment ID in tracking call
- Variant assignment service
- Statistical significance calculation
- Real-time experiment monitoring
- Automatic winner detection

**Q: How would you add machine learning predictions?**
A:
- Churn prediction model
- Conversion probability scoring
- Anomaly detection
- Personalization recommendations
- Fraud detection
- Traffic forecasting

### Integration
**Q: How do you integrate with data warehouses?**
A:
- Daily batch export to S3
- Snowflake/BigQuery connectors
- Parquet format for efficiency
- Incremental exports
- Schema evolution handling

**Q: How do you integrate with marketing tools?**
A:
- Webhook for real-time events
- API for bidirectional sync
- UTM parameter tracking
- Conversion pixel integration
- Audience export for retargeting

## Edge Cases

### High-Traffic Events
- Black Friday: 10x normal traffic
- Product launches: Sudden spikes
- Viral content: Unpredictable load
- DDoS attacks: Malicious traffic

**Handling**:
- Auto-scaling with aggressive policies
- Rate limiting per IP/user
- Queue-based backpressure
- Graceful degradation

### Data Anomalies
- Clock skew: Client time incorrect
- Duplicate events: Network retries
- Missing data: Tracking failures
- Invalid data: Malformed events

**Handling**:
- Timestamp validation and correction
- Deduplication with bloom filters
- Gap detection and alerting
- Schema validation and sanitization

### System Failures
- Kafka outage: Message queue down
- ClickHouse failure: Storage unavailable
- Network partition: Split brain
- Data center outage: Regional failure

**Handling**:
- Client-side queuing and retry
- Multi-region replication
- Automatic failover
- Disaster recovery procedures

These variations and follow-ups demonstrate deep understanding of web analytics systems and their real-world challenges.
