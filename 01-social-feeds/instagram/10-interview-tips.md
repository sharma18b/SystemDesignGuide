# Design Instagram - Interview Tips

## Interview Approach Strategy

### Step 1: Requirements Clarification (5-10 minutes)

#### Essential Questions to Ask
```
Functional Requirements:
- "What are the core features? Just photo sharing, or also stories, DMs, shopping?"
- "Do we need to support videos?"
- "Should we implement filters and effects?"
- "Do we need real-time features like live streaming?"

Scale Requirements:
- "How many users? 500M, 1B, 2B?"
- "How many photos/videos uploaded per day?"
- "What's the read-to-write ratio?"
- "What's acceptable latency for feed loads and uploads?"

Non-Functional Requirements:
- "What's the availability requirement? 99.9%, 99.95%?"
- "Do we need to support multiple regions?"
- "Are there compliance requirements (GDPR, CCPA)?"
- "What's the budget constraint?"
```

#### Sample Clarification Dialog
```
Interviewer: "Design Instagram"

You: "Great! Let me clarify the requirements:

Core Features:
- Users can upload photos and videos
- Users can follow other users
- Users see a feed of posts from people they follow
- Users can like, comment, and share posts
- Should I include stories (24-hour content)?

Scale:
- Are we targeting Instagram's scale (2B users, 500M DAU)?
- Should I assume 100M photos and 50M videos per day?
- Is the read-to-write ratio around 500:1?

Performance:
- Is <1 second feed load acceptable?
- Should photo upload be <5 seconds?
- Do we need real-time updates or is eventual consistency okay?

Interviewer: "Yes, focus on core photo/video sharing and feed. 
Instagram scale is good. Real-time is nice-to-have."

You: "Perfect! Let me start with back-of-envelope calculations..."
```

### Step 2: Back-of-the-Envelope Calculations (5 minutes)

#### Calculate Scale
```
Users:
- Total users: 2B
- DAU: 500M (25%)
- Average followers: 150

Content:
- Photos per day: 100M
- Videos per day: 50M
- Stories per day: 500M
- Photos per second: 100M / 86400 = ~1,157 TPS
- Peak TPS: 3x = 3,500 TPS

Feed Requests:
- Each user checks feed 10 times/day
- Total requests: 500M × 10 = 5B requests/day
- Requests per second: 5B / 86400 = ~58K RPS
- Peak RPS: 3x = 174K RPS

Storage:
- Photo size: 2MB (original), 200KB (compressed)
- Video size: 20MB (original), 5MB (compressed)
- Daily storage: 100M × 2MB + 50M × 20MB = 1.2PB/day
- With compression: 100M × 200KB + 50M × 5MB = 270TB/day

Bandwidth:
- Ingress: 1.2PB/day = 14GB/s
- Egress: 5B requests × 20 posts × 200KB = 20PB/day = 231GB/s
- With CDN (90% hit rate): Origin serves 23GB/s
```

**Pro Tip**: Write these calculations on the whiteboard. Shows you understand scale.

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
│ Clients │────▶│   API   │────▶│  Upload  │────▶│   S3    │
└─────────┘     │ Gateway │     │ Service  │     └─────────┘
                └─────────┘     └──────────┘
                      │
                      ▼
                ┌──────────┐
                │   Feed   │
                │ Service  │
                └──────────┘

Step 3: Add Processing and CDN
[Full architecture with media processing, CDN, caching, etc.]
```

**Pro Tip**: Draw incrementally. Don't overwhelm with complexity upfront.

#### Key Components to Mention
```
1. API Gateway: Authentication, rate limiting, routing
2. Upload Service: Handle photo/video uploads
3. Media Processing Service: Resize, compress, transcode
4. Feed Service: Generate personalized feeds
5. Story Service: Handle 24-hour ephemeral content
6. User Service: User profiles and authentication
7. Social Graph Service: Follow relationships
8. Search Service: Full-text search
9. Notification Service: Push notifications
10. S3 + CDN: Media storage and delivery
11. Cache Layer: Redis for performance
12. Message Queue: Kafka for async processing
```

### Step 4: Deep Dive (15-20 minutes)

#### Critical Design Decisions

**Decision 1: Media Storage Strategy**
```
Interviewer: "How do you store and serve billions of photos?"

Strong Answer:
"I'd use a multi-tier storage and delivery strategy:

1. Storage (S3):
   - Store original and compressed versions
   - Original: 2MB (for editing, downloads)
   - Compressed: 200KB (for feed display)
   - Thumbnail: 20KB (for grid view)
   - Lifecycle policies for archival

2. CDN (CloudFront):
   - 90% cache hit rate
   - 200+ edge locations globally
   - Automatic image optimization
   - Reduce origin load to 10%

3. Optimization:
   - Compress images (JPEG quality 85, WebP)
   - Multiple sizes for different contexts
   - Lazy loading for images
   - Progressive JPEG for faster rendering

This provides fast delivery (<500ms) while minimizing storage costs."
```

**Decision 2: Feed Generation Strategy**
```
Interviewer: "How do you generate personalized feeds?"

Strong Answer:
"I'd use a hybrid fan-out approach:

1. Regular Users (<10K followers):
   - Fan-out on write (push model)
   - Pre-compute feeds when post is created
   - Store in Cassandra partitioned by user_id
   - Fast reads (<100ms)

2. Celebrity Users (>1M followers):
   - Fan-out on read (pull model)
   - Fetch posts on-demand
   - Merge with pre-computed feed
   - Cache aggressively (TTL: 5 minutes)

3. Feed Ranking:
   - Fetch candidate posts (1000+)
   - Score using ML model (engagement prediction)
   - Rank by score
   - Apply business rules (diversity, freshness)
   - Return top 20 posts

This balances write and read performance across different user types."
```

**Decision 3: Handling Celebrity Posts**
```
Interviewer: "What if a celebrity with 600M followers posts a photo?"

Strong Answer:
"This is the 'hot user problem'. Solutions:

1. Skip fan-out for celebrity users:
   - Don't write to 600M feeds
   - Fetch celebrity posts on-demand
   - Merge with pre-computed feed

2. Separate infrastructure:
   - Dedicated cache for celebrity posts
   - Higher cache TTL (1 hour vs 5 minutes)
   - CDN caching for popular content

3. Rate limiting:
   - Limit fan-out to 20K writes/second
   - Process in batches of 1000
   - Use priority queue (active users first)

4. Async processing:
   - Fan-out via Kafka
   - Non-blocking for user
   - Eventual consistency acceptable

This prevents celebrity posts from overwhelming the system."
```

## Common Pitfalls to Avoid

### Pitfall 1: Ignoring Media Processing
```
❌ Wrong: "Store photos directly in database"
✅ Right: "Upload to S3, process asynchronously, store multiple sizes"

Always consider media processing pipeline.
```

### Pitfall 2: Not Considering Storage Costs
```
❌ Wrong: "Store all photos at original resolution"
✅ Right: "Compress to 200KB for feed, store original for editing"

Storage costs are significant at scale (2PB+ for 5 years).
```

### Pitfall 3: Forgetting CDN
```
❌ Wrong: "Serve all media from origin servers"
✅ Right: "Use CDN with 90% hit rate to reduce origin load"

CDN is critical for media-heavy applications.
```

### Pitfall 4: Not Handling Celebrity Users
```
❌ Wrong: "Fan-out to all followers for every post"
✅ Right: "Use hybrid approach based on follower count"

Celebrity users require special handling.
```

### Pitfall 5: Ignoring Stories
```
❌ Wrong: Only discussing permanent posts
✅ Right: "Stories require 24-hour expiration, different storage strategy"

Stories are a major feature of Instagram.
```

## Impressive Points to Mention

### Technical Depth
```
1. Perceptual Hashing:
   "For deduplication, I'd use perceptual hashing (pHash):
   - Hash images based on visual content
   - Detect duplicate uploads
   - Store once, reference multiple times
   - 20% storage savings"

2. Adaptive Bitrate Streaming:
   "For videos, I'd use adaptive bitrate streaming:
   - Transcode to multiple quality levels (1080p, 720p, 480p)
   - HLS/DASH protocol
   - Client selects quality based on bandwidth
   - Better user experience"

3. Image Optimization:
   "For image delivery, I'd use:
   - WebP format for modern browsers (30% smaller)
   - Progressive JPEG for faster rendering
   - Responsive images (srcset)
   - Lazy loading for images below fold"

4. Content ID Matching:
   "For copyright protection, I'd use:
   - Hash-based matching for images
   - Audio fingerprinting for videos
   - Visual similarity detection using ML
   - Automated DMCA takedown process"
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

3. Cache-Aside Pattern:
   "For feed caching:
   - Check cache first
   - If miss, query database
   - Update cache with result
   - Set appropriate TTL (5 minutes)"
```

### Real-World Considerations
```
1. Cost Optimization:
   "To reduce costs:
   - Aggressive image compression (2MB → 200KB)
   - CDN caching (90% hit rate)
   - Tiered storage (hot/warm/cold)
   - Deduplication (20% savings)
   - Target: <$0.52 per DAU per month"

2. Monitoring:
   "Key metrics to monitor:
   - Upload success rate (>99.9%)
   - Feed load time (p95 <1s)
   - Image load time (p95 <500ms)
   - CDN hit rate (>90%)
   - Error rate (<0.1%)"

3. Disaster Recovery:
   "Multi-region active-active:
   - Async replication between regions
   - RPO: 1 hour
   - RTO: 4 hours
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
- Media storage and delivery (S3 + CDN)
- Feed generation strategy
- Database design
- Scaling approach

Nice to Have:
- Stories feature
- Security and privacy
- Monitoring and alerting
- Cost optimization

Skip if Time Limited:
- Detailed API design
- Specific code implementations
- Advanced ML algorithms
```

## Sample Interview Questions and Answers

### Q: "How would you implement the photo upload flow?"

**Strong Answer**:
```
"I'd use an asynchronous upload flow:

1. Client requests upload URL:
   - POST /api/v1/posts/upload
   - Server generates pre-signed S3 URL
   - Returns URL to client

2. Client uploads directly to S3:
   - Direct upload to S3 (no server bottleneck)
   - S3 triggers SNS notification
   - Fast response to user (<1 second)

3. Async processing:
   - SQS queue picks up notification
   - Media processing workers:
     a. Resize to multiple sizes
     b. Compress (2MB → 200KB)
     c. Generate thumbnail
     d. Extract metadata
   - Store processed images in S3
   - Update metadata in database

4. Completion:
   - Warm CDN cache
   - Publish event to Kafka
   - Fan-out to followers
   - Notify user of completion

This provides fast upload response while handling processing asynchronously."
```

### Q: "How do you handle stories that expire after 24 hours?"

**Strong Answer**:
```
"I'd use multiple mechanisms for story expiration:

1. S3 Lifecycle Policy:
   - Set 24-hour TTL on story objects
   - Automatic deletion by S3
   - No manual cleanup needed

2. Redis TTL:
   - Store story metadata in Redis
   - Set 24-hour TTL
   - Automatic expiration

3. Database Cleanup:
   - Mark stories as expired
   - Background job runs hourly
   - Delete expired stories
   - Update user stats

4. CDN Cache Invalidation:
   - Invalidate CDN cache after 24 hours
   - Prevent serving expired stories
   - Use cache headers (max-age: 86400)

This ensures stories disappear after 24 hours with eventual consistency."
```

## Final Tips

### Do's ✅
- Ask clarifying questions upfront
- Start with simple design, add complexity gradually
- Explain reasoning for each decision
- Discuss tradeoffs explicitly
- Consider media storage and delivery
- Mention CDN and caching strategies
- Think about celebrity users
- Be prepared to dive deep into any component

### Don'ts ❌
- Don't jump straight to implementation
- Don't ignore storage costs
- Don't forget about CDN
- Don't overlook media processing
- Don't ignore celebrity user problem
- Don't forget about stories
- Don't assume unlimited resources
- Don't forget to manage time

### If You Get Stuck
```
1. Ask for hints: "Could you give me a hint about X?"
2. Think out loud: "I'm considering two approaches..."
3. Discuss tradeoffs: "Approach A has X benefit but Y drawback..."
4. Relate to experience: "In my previous project, we used..."
5. Be honest: "I'm not familiar with X, but I would approach it by..."
```

Remember: The goal is to demonstrate your system design thinking process, not to create a perfect solution. Show how you approach complex problems, consider tradeoffs, and make informed decisions.
