# Design Twitter - Variations and Follow-up Questions

## Common Variations

### 1. Design Twitter with Direct Messages

**Additional Requirements**:
- One-on-one private messaging
- Group conversations (up to 50 participants)
- Message encryption
- Read receipts and typing indicators
- Media sharing in DMs

**Architecture Changes**:
```
New Services:
- Message Service: Handle DM creation and delivery
- Conversation Service: Manage conversation metadata
- Encryption Service: End-to-end encryption

Database Schema:
conversations (
  conversation_id BIGINT PRIMARY KEY,
  type VARCHAR(20), -- 'direct' or 'group'
  participants BIGINT[],
  created_at TIMESTAMP
)

messages (
  message_id BIGINT PRIMARY KEY,
  conversation_id BIGINT,
  sender_id BIGINT,
  encrypted_content TEXT,
  created_at TIMESTAMP,
  PRIMARY KEY (conversation_id, created_at, message_id)
)

Real-time Delivery:
- WebSocket connections for instant delivery
- Push notifications for offline users
- Message queue for reliable delivery
```

**Key Challenges**:
- End-to-end encryption key management
- Message ordering in group conversations
- Offline message synchronization
- Storage encryption at rest

### 2. Design Twitter with Live Video Streaming (Spaces/Periscope)

**Additional Requirements**:
- Live audio/video broadcasting
- Real-time audience participation
- Recording and playback
- Moderation tools

**Architecture Changes**:
```
New Services:
- Streaming Service: Handle live video ingestion
- Transcoding Service: Convert to multiple formats
- CDN Integration: Distribute live streams globally

Technology Stack:
- WebRTC for peer-to-peer connections
- RTMP for stream ingestion
- HLS/DASH for adaptive streaming
- Media servers: Wowza, Ant Media Server

Scaling Considerations:
- 100K+ concurrent viewers per stream
- Low latency (<3 seconds)
- Adaptive bitrate streaming
- Geographic distribution via CDN
```

### 3. Design Twitter with Advanced Search and Analytics

**Additional Requirements**:
- Advanced search filters (date range, location, sentiment)
- Real-time analytics dashboard
- Trending analysis with ML
- User behavior analytics

**Architecture Changes**:
```
New Services:
- Analytics Service: Process user behavior data
- ML Service: Sentiment analysis, trend prediction
- Reporting Service: Generate analytics reports

Technology Stack:
- Elasticsearch: Advanced search capabilities
- Apache Spark: Real-time stream processing
- Apache Flink: Complex event processing
- TensorFlow: ML models for sentiment analysis

Data Pipeline:
User Actions → Kafka → Spark Streaming → Analytics DB → Dashboard
```

### 4. Design Twitter with Algorithmic Timeline

**Additional Requirements**:
- Personalized tweet ranking
- ML-based content recommendation
- User engagement prediction
- A/B testing framework

**Architecture Changes**:
```
New Services:
- Ranking Service: Score and rank tweets
- ML Model Service: Serve ML models
- Feature Store: Store user/tweet features
- Experimentation Service: A/B testing

Ranking Algorithm:
Score = f(
  recency,
  engagement (likes, retweets, replies),
  user affinity (how often user engages with author),
  content quality (spam score, media presence),
  diversity (avoid showing similar content)
)

Implementation:
- Offline: Train ML models on historical data
- Online: Real-time feature computation and scoring
- Hybrid: Pre-compute scores, adjust in real-time
```

### 5. Design Twitter with Monetization (Ads and Promoted Tweets)

**Additional Requirements**:
- Ad serving and targeting
- Promoted tweets in timeline
- Advertiser dashboard
- Billing and payment processing

**Architecture Changes**:
```
New Services:
- Ad Service: Serve targeted ads
- Targeting Service: User segmentation and targeting
- Billing Service: Track impressions, clicks, payments
- Campaign Management: Advertiser tools

Ad Insertion:
- Insert promoted tweets in timeline (every 10th tweet)
- Target based on user interests, demographics, behavior
- Track impressions, clicks, conversions
- Real-time bidding for ad slots

Challenges:
- Ad relevance and quality
- User experience (not too many ads)
- Privacy concerns (data usage for targeting)
- Ad fraud detection
```

## Follow-up Questions and Answers

### Q1: "How would you handle a tweet going viral with millions of retweets?"

**Answer**:
```
Detection:
- Monitor engagement velocity (likes/retweets per minute)
- Threshold: >1000 engagements per minute = viral

Actions:
1. Increase cache TTL for viral tweet (1 hour → 24 hours)
2. Pre-warm CDN cache globally
3. Scale up read replicas for tweet database
4. Enable aggressive caching at all levels
5. Rate limit writes to prevent database overload
6. Use separate infrastructure for viral content

Optimization:
- Serve from CDN edge locations
- Use stale-while-revalidate caching
- Implement request coalescing
- Add circuit breakers to prevent cascading failures
```

### Q2: "How do you ensure tweet ordering in the timeline?"

**Answer**:
```
Ordering Strategy:
1. Assign timestamp to each tweet (created_at)
2. Use Snowflake ID (timestamp + machine ID + sequence)
3. Store tweets in timeline sorted by timestamp
4. Use clustering key in Cassandra for sorted storage

Challenges:
- Clock skew across servers
- Out-of-order delivery in distributed systems
- Retweets and quote tweets ordering

Solutions:
- Use logical clocks (Lamport timestamps)
- Sequence numbers per user
- Client-side sorting as fallback
- Eventual consistency acceptable (5-second lag)
```

### Q3: "How would you implement tweet edit functionality?"

**Answer**:
```
Design Approach:
1. Store tweet versions in separate table
2. Keep edit history for transparency
3. Show "edited" indicator on tweet
4. Allow edits within 30 minutes of posting

Database Schema:
tweet_versions (
  tweet_id BIGINT,
  version INT,
  text TEXT,
  edited_at TIMESTAMP,
  PRIMARY KEY (tweet_id, version)
)

Implementation:
- Original tweet: version 1
- Each edit: increment version
- Display latest version by default
- Show edit history on click
- Invalidate caches on edit

Challenges:
- Propagate edits to all timelines
- Handle retweets of edited tweets
- Prevent abuse (changing tweet meaning after viral)
```

### Q4: "How do you handle spam and bot detection?"

**Answer**:
```
Detection Strategies:
1. Rate Limiting:
   - Max 300 tweets per 3 hours
   - Max 1000 follows per day
   - Exponential backoff for violations

2. ML-Based Detection:
   - Train models on labeled spam data
   - Features: tweet frequency, content similarity, account age
   - Real-time scoring (0-1, >0.8 = likely spam)

3. Behavioral Analysis:
   - Detect automated patterns
   - Unusual activity spikes
   - Coordinated behavior across accounts

4. Content Analysis:
   - Duplicate content detection
   - Malicious link detection
   - Inappropriate content filtering

Actions:
- Shadow ban (hide from timelines)
- Rate limit aggressively
- Require CAPTCHA verification
- Suspend account temporarily
- Permanent ban for severe violations
```

### Q5: "How would you implement a 'For You' recommendation page?"

**Answer**:
```
Recommendation System:
1. Collaborative Filtering:
   - Find similar users based on engagement patterns
   - Recommend tweets liked by similar users

2. Content-Based Filtering:
   - Analyze tweet content (hashtags, topics)
   - Recommend similar content to user's interests

3. Hybrid Approach:
   - Combine collaborative and content-based
   - Use ML model to weight different signals

Features:
- User engagement history (likes, retweets, replies)
- Tweet content (text, hashtags, media)
- Author information (verified, follower count)
- Recency (prefer recent tweets)
- Diversity (avoid filter bubble)

Architecture:
Offline:
- Train ML models on historical data
- Compute user embeddings
- Generate candidate tweets

Online:
- Fetch candidate tweets (1000s)
- Score and rank in real-time
- Apply business rules (diversity, freshness)
- Return top 50 tweets

Challenges:
- Cold start problem (new users)
- Filter bubble (echo chamber)
- Computational cost (real-time scoring)
- A/B testing and experimentation
```

### Q6: "How do you handle data privacy and GDPR compliance?"

**Answer**:
```
GDPR Requirements:
1. Right to Access:
   - Provide user data export (JSON/CSV)
   - Include all tweets, likes, follows, DMs

2. Right to Deletion:
   - Delete user account and all data
   - Propagate deletion across all systems
   - 30-day grace period before permanent deletion

3. Right to Portability:
   - Export data in machine-readable format
   - Allow transfer to other platforms

4. Consent Management:
   - Explicit consent for data collection
   - Granular privacy settings
   - Opt-out of data sharing

Implementation:
- Data inventory: Map all user data locations
- Deletion pipeline: Async job to delete from all systems
- Audit logging: Track all data access and modifications
- Encryption: Encrypt sensitive data at rest and in transit
- Data minimization: Collect only necessary data
- Retention policies: Delete old data automatically

Challenges:
- Distributed data across multiple databases
- Backup and archive deletion
- Third-party integrations
- Compliance across regions
```

### Q7: "How would you implement rate limiting at scale?"

**Answer**:
```
Rate Limiting Strategies:
1. Token Bucket Algorithm:
   - Each user has bucket with tokens
   - Tokens refill at fixed rate
   - Request consumes token
   - Reject if no tokens available

2. Sliding Window:
   - Track requests in time window
   - Count requests in last N minutes
   - Reject if exceeds limit

3. Distributed Rate Limiting:
   - Use Redis for shared state
   - Atomic increment operations
   - TTL for automatic cleanup

Implementation:
Key: rate_limit:{user_id}:{endpoint}
Value: Request count
TTL: Time window (15 minutes)

INCR rate_limit:123:tweets
EXPIRE rate_limit:123:tweets 900
GET rate_limit:123:tweets
IF count > limit THEN reject

Challenges:
- Clock synchronization across servers
- Race conditions in distributed system
- Handling burst traffic
- Different limits per endpoint

Solutions:
- Use Redis cluster for scalability
- Lua scripts for atomic operations
- Graceful degradation (allow some over-limit)
- Tiered limits (free vs premium users)
```

### Q8: "How do you handle database failover and disaster recovery?"

**Answer**:
```
Failover Strategy:
1. Detection:
   - Health checks every 5 seconds
   - Declare failure after 3 consecutive failures
   - Automatic failover trigger

2. Promotion:
   - Promote read replica to master
   - Update DNS to point to new master
   - Redirect write traffic

3. Recovery:
   - Bring failed master back as replica
   - Sync data from new master
   - Monitor replication lag

Disaster Recovery:
1. Multi-Region Replication:
   - Async replication to secondary region
   - RPO: 15 minutes (data loss acceptable)
   - RTO: 2 hours (recovery time)

2. Backup Strategy:
   - Continuous replication
   - Hourly snapshots (last 24 hours)
   - Daily snapshots (last 30 days)
   - Weekly snapshots (last 1 year)

3. Recovery Process:
   - Detect primary region failure
   - Promote secondary region to primary
   - Update DNS (5 minutes)
   - Verify data integrity
   - Resume operations

Challenges:
- Data consistency during failover
- Split-brain scenario (two masters)
- Replication lag
- DNS propagation delay

Solutions:
- Use consensus algorithm (Raft, Paxos)
- Fencing to prevent split-brain
- Monitor replication lag closely
- Use short DNS TTL (60 seconds)
```

## Edge Cases

### 1. User Deletes Tweet After It Goes Viral
**Challenge**: Tweet already in millions of timelines
**Solution**: Lazy deletion with tombstone markers, background cleanup job

### 2. User Changes Username
**Challenge**: Update username across all systems
**Solution**: Use user_id as primary key, username as display name, async propagation

### 3. Clock Skew Across Servers
**Challenge**: Tweets appear out of order
**Solution**: Use logical clocks (Lamport timestamps), client-side sorting

### 4. Database Shard Rebalancing
**Challenge**: Move data without downtime
**Solution**: Consistent hashing, gradual migration, dual writes during transition

### 5. Celebrity User Unfollows Everyone
**Challenge**: Remove millions of follow relationships
**Solution**: Async batch deletion, rate limiting, background job

This comprehensive guide covers common variations and follow-up questions that interviewers might ask when designing Twitter, providing detailed answers and implementation strategies.
