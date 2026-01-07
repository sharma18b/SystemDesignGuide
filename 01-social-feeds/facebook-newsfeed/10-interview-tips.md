# Design Facebook Newsfeed - Interview Tips

## Interview Approach

### Step 1: Requirements Clarification (5-10 min)
```
Questions to Ask:
- "What are core features? Just feed, or also stories, groups, pages?"
- "Do we need ML-based ranking or chronological?"
- "How many users? 1B, 2B, 3B?"
- "What's acceptable feed load time?"
- "Do we need real-time updates?"

Sample Dialog:
Interviewer: "Design Facebook's newsfeed"
You: "Let me clarify:
- Core features: Personalized feed from friends, pages, groups?
- Scale: Facebook's scale (3B users, 2B DAU)?
- Ranking: ML-based algorithmic ranking?
- Performance: <1s feed load acceptable?
- Real-time: Live updates or eventual consistency?"
```

### Step 2: Back-of-Envelope (5 min)
```
Users:
- Total: 3B
- DAU: 2B (67%)
- Avg friends: 338

Content:
- Posts/day: 500M
- Posts/second: 5,787 TPS
- Peak: 17,000 TPS

Feed Requests:
- Requests/day: 100B
- Requests/second: 1.16M RPS
- Peak: 3.5M RPS

Storage:
- Post text: 500M × 500 bytes = 250GB/day
- Media: 450M × 2MB = 900TB/day
- Total: ~900TB/day

Bandwidth:
- Ingress: 10.5GB/s
- Egress: 1,200GB/s (with CDN: 120GB/s origin)
```

### Step 3: High-Level Design (10-15 min)
```
Start Simple:
[Clients] → [API Gateway] → [Feed Service] → [Database]

Add Components:
- Post Service (create posts)
- Fan-out Service (distribute to feeds)
- Ranking Service (ML-based ranking)
- Social Graph (TAO)
- Notification Service
- Cache Layer (Memcached)
- Message Queue (Kafka)
- CDN (media delivery)
```

### Step 4: Deep Dive (15-20 min)

#### Critical Decision 1: Feed Ranking
```
Interviewer: "How do you rank posts in the feed?"

Strong Answer:
"I'd use ML-based ranking:

1. Candidate Generation:
   - Fetch posts from friends, pages, groups
   - Get 1000+ candidate posts

2. Feature Engineering:
   - User-author affinity (interaction history)
   - Post type (photo, video, link)
   - Engagement signals (likes, comments)
   - Recency (time decay)
   - Content quality (spam score)

3. ML Model:
   - Gradient Boosted Decision Trees (GBDT)
   - Predict engagement probability
   - Train offline on historical data
   - Serve in real-time

4. Ranking:
   - Score all candidates
   - Sort by predicted engagement
   - Apply business rules (diversity)
   - Return top 20 posts

This provides personalized, engaging feeds."
```

#### Critical Decision 2: Fan-out Strategy
```
Interviewer: "How do you handle celebrity users?"

Strong Answer:
"I'd use hybrid fan-out:

Regular Users (<1K friends):
- Fan-out on write (push)
- Pre-compute feeds
- Fast reads

Power Users (1K-100K):
- Partial fan-out
- Active followers only

Celebrity (>100K):
- Fan-out on read (pull)
- Fetch on-demand
- Cache aggressively

This prevents celebrity posts from overwhelming the system."
```

#### Critical Decision 3: Real-time Updates
```
Interviewer: "How do you show new posts in real-time?"

Strong Answer:
"I'd use WebSocket connections:

1. Connection Management:
   - Persistent WebSocket connections
   - Connection pooling
   - Sticky sessions

2. Event Publishing:
   - Post created → Kafka
   - Fan-out service consumes
   - Publish to WebSocket

3. Client Updates:
   - Receive event via WebSocket
   - Show notification banner
   - Fetch new posts on user action

4. Fallback:
   - Long polling for restricted networks
   - Graceful degradation

This provides real-time updates with reliability."
```

## Common Pitfalls

### Pitfall 1: Ignoring ML Ranking
❌ Wrong: "Just show posts chronologically"
✅ Right: "Use ML-based ranking for personalization"

### Pitfall 2: Not Handling Celebrities
❌ Wrong: "Fan-out to all followers"
✅ Right: "Hybrid approach based on follower count"

### Pitfall 3: Forgetting Privacy
❌ Wrong: "Show all posts to everyone"
✅ Right: "Check privacy settings before serving"

### Pitfall 4: Ignoring Real-time
❌ Wrong: "User refreshes to see new posts"
✅ Right: "WebSocket for real-time updates"

## Impressive Points

### Technical Depth
```
1. TAO (The Associations and Objects):
   "Facebook uses TAO, a custom graph database:
   - Distributed graph storage
   - MySQL backend with caching
   - Optimized for social graph queries"

2. EdgeRank Algorithm:
   "Original Facebook ranking algorithm:
   - Affinity: User-author relationship
   - Weight: Post type importance
   - Time decay: Recency factor"

3. FBLearner Flow:
   "Facebook's ML platform:
   - Feature engineering pipeline
   - Model training and serving
   - A/B testing framework"
```

### System Design Patterns
```
1. Fan-out on Write vs Read:
   "Trade-off between write and read performance"

2. Lambda Architecture:
   "Batch + real-time processing for analytics"

3. CQRS:
   "Separate read and write models for optimization"
```

## Time Management
```
0-5 min: Requirements
5-10 min: Calculations
10-25 min: High-level design
25-40 min: Deep dive (2-3 components)
40-45 min: Wrap-up, edge cases
```

## Final Tips

### Do's ✅
- Ask about ML ranking
- Discuss fan-out strategies
- Mention privacy controls
- Consider real-time updates
- Think about celebrities
- Explain tradeoffs

### Don'ts ❌
- Don't ignore ML ranking
- Don't forget privacy
- Don't overlook celebrities
- Don't skip real-time
- Don't ignore scale

Remember: Show your thinking process, discuss tradeoffs, and make informed decisions!
