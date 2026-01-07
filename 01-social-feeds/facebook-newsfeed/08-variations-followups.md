# Design Facebook Newsfeed - Variations and Follow-up Questions

## Common Variations

### 1. Add Facebook Stories
**Requirements**: 24-hour ephemeral content at top of feed
**Changes**: Story service, 24h TTL, separate storage, CDN caching

### 2. Add Facebook Live
**Requirements**: Live video streaming in feed
**Changes**: RTMP ingestion, HLS/DASH streaming, real-time comments

### 3. Add Facebook Watch
**Requirements**: Long-form video platform
**Changes**: Video recommendation engine, watch history, subscriptions

### 4. Add Facebook Marketplace
**Requirements**: Buy/sell platform integrated in feed
**Changes**: Product catalog, search, messaging, payments

### 5. Add Facebook Groups Feed
**Requirements**: Separate feed for group content
**Changes**: Group-specific ranking, moderation, notifications

## Follow-up Questions

### Q1: "How do you handle viral posts?"
**Answer**:
- Detect: Monitor engagement velocity (>100K reactions/min)
- Cache: Increase TTL (5 min → 1 hour)
- Scale: Add read replicas, CDN pre-warming
- Rate limit: Prevent write overload

### Q2: "How does the ML ranking model work?"
**Answer**:
- Features: User-post affinity, engagement history, content type
- Model: Gradient Boosted Decision Trees (GBDT)
- Training: Offline on historical data (daily)
- Serving: Real-time feature computation
- Prediction: Engagement probability (0-1)
- Ranking: Sort by predicted engagement

### Q3: "How do you handle privacy settings?"
**Answer**:
- Privacy levels: Public, Friends, Friends of Friends, Custom
- Check: Verify privacy before serving post
- Filter: Remove posts user can't see
- Cache: Cache privacy checks
- Update: Propagate privacy changes asynchronously

### Q4: "How do you prevent spam?"
**Answer**:
- Rate limiting: Max 100 posts per hour
- ML detection: Spam classifier (0-1 score)
- Content analysis: Duplicate detection, link checking
- User reports: Queue for human review
- Actions: Shadow ban, rate limit, suspend

### Q5: "How do you handle deleted posts?"
**Answer**:
- Soft delete: Mark as deleted, keep data
- Propagation: Remove from feeds asynchronously
- Tombstone: Show "post deleted" placeholder
- Cleanup: Background job removes after 30 days
- CDN: Invalidate cached content

### Q6: "How do you implement reactions (like, love, etc.)?"
**Answer**:
- Store: reaction_type in reactions table
- Count: Aggregate by type
- Update: Eventually consistent counts
- Cache: Cache reaction counts
- Real-time: WebSocket for live updates

### Q7: "How do you handle A/B testing?"
**Answer**:
- Experiment platform: Custom A/B testing framework
- User bucketing: Consistent hashing by user_id
- Metrics: Track engagement, retention, revenue
- Analysis: Statistical significance testing
- Rollout: Gradual rollout based on results

### Q8: "How do you ensure GDPR compliance?"
**Answer**:
- Data export: Provide all user data in JSON
- Data deletion: Delete account and all data
- Consent: Explicit consent for data collection
- Portability: Export in machine-readable format
- Audit: Log all data access

## Edge Cases

### 1. User Posts Then Immediately Deletes
**Solution**: Lazy deletion, tombstone markers, eventual consistency

### 2. User Changes Privacy After Sharing
**Solution**: Background job propagates changes, eventual consistency

### 3. Celebrity Posts to 100M Friends
**Solution**: Skip fan-out, pull-based feed, aggressive caching

### 4. Network Partition Between Regions
**Solution**: Multi-region active-active, conflict resolution

### 5. User Unfriends After Seeing Post
**Solution**: Lazy removal from feed, eventual consistency

This guide covers common variations and follow-up questions for Facebook newsfeed design.
