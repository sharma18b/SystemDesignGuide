# Design Twitter - Interview Tips

## Interview Approach Strategy

### Step 1: Requirements Clarification (5-10 minutes)

#### Essential Questions to Ask
```
Functional Requirements:
- "What are the core features? Just tweets and timelines, or also DMs, search, trending?"
- "Do we need to support media (images, videos)?"
- "Should we implement retweets, likes, and replies?"
- "Do we need real-time notifications?"

Scale Requirements:
- "How many users are we designing for? 100M, 500M, 1B?"
- "How many tweets per day? 100M, 500M, 1B?"
- "What's the read-to-write ratio? 100:1, 1000:1?"
- "What's the acceptable latency for timeline loads?"

Non-Functional Requirements:
- "What's the availability requirement? 99.9%, 99.99%?"
- "Do we need to support multiple regions?"
- "Are there any compliance requirements (GDPR, CCPA)?"
- "What's the budget constraint?"
```

#### Sample Clarification Dialog
```
Interviewer: "Design Twitter"

You: "Great! Let me clarify the requirements:

Core Features:
- Users can post tweets (280 characters)
- Users can follow other users
- Users see a timeline of tweets from people they follow
- Users can like, retweet, and reply to tweets
- Should I include DMs, search, and trending topics?

Scale:
- Are we targeting Twitter's scale (500M users, 200M DAU)?
- Should I assume 500M tweets per day?
- Is the read-to-write ratio around 100:1?

Performance:
- Is <1 second timeline load acceptable?
- Should tweet posting be <200ms?
- Do we need real-time updates or is 5-second delay okay?

Interviewer: "Yes, focus on core features. Twitter scale is good. 
Real-time is nice-to-have but not critical."

You: "Perfect! Let me start with high-level architecture..."
```

### Step 2: Back-of-the-Envelope Calculations (5 minutes)

#### Calculate Scale
```
Users:
- Total users: 500M
- DAU: 200M (40%)
- Average followers: 200

Tweets:
- Tweets per day: 500M
- Tweets per second: 500M / 86400 = ~6K TPS
- Peak TPS: 3x = 18K TPS

Timeline Requests:
- Each user checks timeline 10 times/day
- Total requests: 200M × 10 = 2B requests/day
- Requests per second: 2B / 86400 = ~23K RPS
- Peak RPS: 3x = 70K RPS

Storage:
- Tweet size: 200 bytes (text) + 500 bytes (metadata) = 700 bytes
- Daily storage: 500M × 700 bytes = 350GB/day
- With media (50% have media, avg 200KB): 250M × 200KB = 50TB/day
- Total: ~50TB/day

Bandwidth:
- Ingress: 50TB/day = 580MB/s
- Egress: 2B requests × 50 tweets × 700 bytes = 70TB/day = 810MB/s
- With CDN: 85% offload, origin serves 120MB/s
```

**Pro Tip**: Write these calculations on the whiteboard. Shows you understand scale and can do quick math.

### Step 3: High-Level Design (10-15 minutes)

#### Start Simple
```
Step 1: Basic Architecture
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Clients │────▶│   API   │────▶│Database │
└─────────┘     │ Gateway │     └─────────┘
                └─────────┘

Step 2: Add Core Services
┌─────────┐     ┌─────────┐     ┌──────────┐     ┌─────────┐
│ Clients │────▶│   API   │────▶│  Tweet   │────▶│Database │
└─────────┘     │ Gateway │     │ Service  │     └─────────┘
                └─────────┘     └──────────┘
                      │
                      ▼
                ┌──────────┐
                │ Timeline │
                │ Service  │
                └──────────┘

Step 3: Add Caching and Queues
[Full architecture with cache, message queue, CDN, etc.]
```

**Pro Tip**: Draw incrementally. Don't overwhelm with complexity upfront.

#### Key Components to Mention
```
1. API Gateway: Authentication, rate limiting, routing
2. Tweet Service: Create, read, delete tweets
3. Timeline Service: Generate personalized timelines
4. Fan-out Service: Distribute tweets to followers
5. User Service: User profiles and authentication
6. Social Graph Service: Follow relationships
7. Media Service: Handle images and videos
8. Search Service: Full-text search
9. Notification Service: Push notifications
10. Cache Layer: Redis for performance
11. Message Queue: Kafka for async processing
12. CDN: Media delivery
```

### Step 4: Deep Dive (15-20 minutes)

#### Critical Design Decisions

**Decision 1: Fan-out Strategy**
```
Interviewer: "How do you deliver tweets to followers?"

Strong Answer:
"I'd use a hybrid fan-out approach:

For regular users (<10K followers):
- Fan-out on write (push model)
- Pre-compute timelines when tweet is posted
- Fast reads, slower writes
- Store in timeline table partitioned by user_id

For celebrity users (>1M followers):
- Fan-out on read (pull model)
- Fetch tweets on-demand when timeline requested
- Fast writes, slower reads
- Cache aggressively to mitigate read cost

For medium users (10K-1M):
- Partial fan-out to active followers only
- Pull for inactive followers

This balances write and read performance across different user types."
```

**Decision 2: Database Choice**
```
Interviewer: "What database would you use?"

Strong Answer:
"I'd use polyglot persistence:

Cassandra for tweets and timelines:
- High write throughput (6K TPS)
- Time-series data model
- Horizontal scalability
- Partition by tweet_id or user_id

PostgreSQL for user data:
- ACID compliance for critical data
- Relational model for user profiles
- Master-replica for read scaling

Redis for caching:
- In-memory for fast access
- Cache timelines, user profiles, social graph
- 90%+ cache hit rate target

This optimizes for each data access pattern."
```

**Decision 3: Handling Celebrity Users**
```
Interviewer: "What if a user has 150M followers?"

Strong Answer:
"This is the 'hot user problem'. Solutions:

1. Skip fan-out for celebrity users:
   - Don't write to 150M timelines
   - Fetch celebrity tweets on-demand
   - Merge with pre-computed timeline

2. Separate infrastructure:
   - Dedicated cache for celebrity tweets
   - Higher cache TTL (24 hours vs 5 minutes)
   - CDN caching for popular content

3. Rate limiting:
   - Limit fan-out to 10K writes/second
   - Process in batches of 1000
   - Use priority queue (active users first)

4. Async processing:
   - Fan-out via message queue
   - Non-blocking for user
   - Eventual consistency acceptable

This prevents celebrity tweets from overwhelming the system."
```

## Common Pitfalls to Avoid

### Pitfall 1: Jumping to Implementation Details
```
❌ Wrong: "I'll use Kafka with 100 partitions and..."
✅ Right: "I need a message queue for async processing. Kafka would work well because..."

Explain WHY before HOW.
```

### Pitfall 2: Ignoring Scale
```
❌ Wrong: "I'll use a single database server..."
✅ Right: "With 6K writes/second, I need database sharding..."

Always consider scale implications.
```

### Pitfall 3: Over-Engineering
```
❌ Wrong: "I'll implement CQRS, event sourcing, saga pattern..."
✅ Right: "I'll start with microservices and add complexity as needed..."

Start simple, add complexity when justified.
```

### Pitfall 4: Not Discussing Tradeoffs
```
❌ Wrong: "I'll use eventual consistency."
✅ Right: "I'll use eventual consistency for timelines because 5-second delay is acceptable, but strong consistency for follow operations because..."

Always explain tradeoffs.
```

### Pitfall 5: Forgetting Edge Cases
```
❌ Wrong: Only discussing happy path
✅ Right: "What if a tweet goes viral? What if a user deletes a tweet after it's been retweeted?"

Proactively mention edge cases.
```

## Impressive Points to Mention

### Technical Depth
```
1. Snowflake ID Generation:
   "For tweet IDs, I'd use Snowflake algorithm: 
   - 41 bits timestamp
   - 10 bits machine ID
   - 12 bits sequence number
   - Sortable, unique, distributed generation"

2. Consistent Hashing:
   "For cache distribution, I'd use consistent hashing:
   - Minimize cache misses during scaling
   - Virtual nodes for even distribution
   - Handles node failures gracefully"

3. Count-Min Sketch:
   "For trending topics, I'd use Count-Min Sketch:
   - Probabilistic data structure
   - Space-efficient counting
   - Acceptable error rate for trends"

4. Bloom Filters:
   "For spam detection, I'd use Bloom filters:
   - Check if tweet is duplicate
   - Space-efficient
   - False positives acceptable"
```

### System Design Patterns
```
1. Circuit Breaker:
   "Prevent cascading failures with circuit breakers:
   - Open circuit after N failures
   - Fail fast instead of waiting
   - Periodic health checks to close circuit"

2. Bulkhead Pattern:
   "Isolate resources to prevent total failure:
   - Separate thread pools per service
   - Limit connections per dependency
   - One service failure doesn't affect others"

3. CQRS (if asked about advanced topics):
   "Separate read and write models:
   - Optimize writes for tweet creation
   - Optimize reads for timeline generation
   - Different databases for each"
```

### Real-World Considerations
```
1. Cost Optimization:
   "To reduce costs:
   - Tiered storage (hot/warm/cold)
   - Aggressive CDN caching (85% hit rate)
   - Compress media files
   - Archive old tweets to S3 Glacier
   - Target: <$0.11 per DAU per month"

2. Monitoring:
   "Key metrics to monitor:
   - Tweet posting latency (p95 <200ms)
   - Timeline load time (p95 <1s)
   - Error rate (<0.1%)
   - Cache hit rate (>90%)
   - Database query latency (p95 <10ms)"

3. Disaster Recovery:
   "Multi-region active-active:
   - Async replication between regions
   - RPO: 15 minutes
   - RTO: 2 hours
   - Automatic failover with health checks"
```

## Time Management

### 45-Minute Interview Breakdown
```
0-5 min: Requirements clarification
5-10 min: Back-of-envelope calculations
10-25 min: High-level design and core components
25-40 min: Deep dive into 2-3 components
40-45 min: Wrap-up, edge cases, questions

Adjust based on interviewer's focus.
```

### What to Prioritize
```
Must Cover:
- High-level architecture
- Database design
- Fan-out strategy
- Caching strategy
- Scaling approach

Nice to Have:
- Security and privacy
- Monitoring and alerting
- Cost optimization
- Disaster recovery

Skip if Time Limited:
- Detailed API design
- Specific code implementations
- Advanced ML algorithms
```

## Sample Interview Questions and Answers

### Q: "How would you implement the home timeline?"

**Strong Answer**:
```
"I'd use a hybrid approach:

1. For regular users:
   - Pre-compute timeline using fan-out on write
   - Store in Cassandra partitioned by user_id
   - Cache in Redis for fast access

2. For celebrity users:
   - Fetch tweets on-demand (fan-out on read)
   - Merge with pre-computed timeline
   - Cache aggressively

3. Timeline generation:
   - Fetch from cache (Redis)
   - If miss, query database
   - Merge celebrity tweets
   - Sort by timestamp
   - Return top 50 tweets
   - Cache result (TTL: 5 minutes)

4. Optimization:
   - Cursor-based pagination
   - Lazy loading for media
   - Prefetch next page

This provides <1 second load time for 95% of requests."
```

### Q: "How do you handle a viral tweet?"

**Strong Answer**:
```
"Viral tweets require special handling:

1. Detection:
   - Monitor engagement velocity
   - Threshold: >1000 likes/minute

2. Actions:
   - Increase cache TTL (5 min → 1 hour)
   - Pre-warm CDN cache globally
   - Scale up read replicas
   - Enable aggressive caching

3. Optimization:
   - Serve from CDN edge locations
   - Use stale-while-revalidate
   - Implement request coalescing
   - Add circuit breakers

4. Monitoring:
   - Track cache hit rate
   - Monitor database load
   - Alert on anomalies

This prevents viral content from overwhelming the system."
```

## Final Tips

### Do's ✅
- Ask clarifying questions upfront
- Start with simple design, add complexity gradually
- Explain your reasoning for each decision
- Discuss tradeoffs explicitly
- Consider scale at every step
- Mention edge cases proactively
- Be prepared to dive deep into any component
- Show enthusiasm and engagement

### Don'ts ❌
- Don't jump straight to implementation
- Don't ignore scale requirements
- Don't over-engineer from the start
- Don't forget about failures and edge cases
- Don't be afraid to say "I don't know"
- Don't argue with interviewer
- Don't spend too long on one component
- Don't forget to manage time

### If You Get Stuck
```
1. Ask for hints: "Could you give me a hint about X?"
2. Think out loud: "I'm thinking about two approaches..."
3. Discuss tradeoffs: "Approach A has X benefit but Y drawback..."
4. Relate to experience: "In my previous project, we used..."
5. Be honest: "I'm not familiar with X, but I would approach it by..."
```

Remember: The goal is to demonstrate your system design thinking process, not to create a perfect solution. Show how you approach complex problems, consider tradeoffs, and make informed decisions.
