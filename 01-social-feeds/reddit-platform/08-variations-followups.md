# Design Reddit - Variations and Follow-up Questions

## Common Variations

### 1. Add Reddit Chat
**Requirements**: Real-time messaging between users
**Changes**: WebSocket service, message storage, presence system

### 2. Add Reddit Live
**Requirements**: Live event threads with real-time updates
**Changes**: WebSocket for live updates, higher write throughput

### 3. Add Reddit Awards
**Requirements**: Give awards to posts/comments
**Changes**: Award system, payment processing, award display

### 4. Add Reddit Video
**Requirements**: Native video hosting
**Changes**: Video transcoding, CDN, adaptive streaming

## Follow-up Questions

### Q1: "How does the Hot algorithm work?"
**Answer**:
```python
Hot Score = log10(max(|score|, 1)) × sign(score) + (age_seconds / 45000)

Components:
- score = upvotes - downvotes
- log10: Diminishing returns for votes
- age_seconds: Time decay (older posts rank lower)
- 45000: ~12.5 hours to decay one rank

This balances popularity with recency.
```

### Q2: "How do you handle vote manipulation?"
**Answer**:
- Rate limiting: Max 1000 votes per hour
- Vote fuzzing: Add random noise to counts
- Shadow banning: Hide manipulated votes
- ML detection: Identify bot patterns
- IP tracking: Detect multiple accounts

### Q3: "How do you implement threaded comments?"
**Answer**:
```sql
-- Nested set model
CREATE TABLE comments (
    comment_id BIGINT PRIMARY KEY,
    post_id BIGINT,
    parent_comment_id BIGINT,
    depth INT,
    path VARCHAR(255),  -- e.g., "1.2.5"
    content TEXT
);

-- Query all children:
SELECT * FROM comments 
WHERE post_id = ? AND path LIKE '1.2.%'
ORDER BY path;
```

### Q4: "How do you handle controversial posts?"
**Answer**:
```
Controversial Score = (upvotes + downvotes)^(min(ups,downs)/(ups+downs))

High score when:
- Many total votes
- Similar up/down ratio (50/50 is most controversial)

Use case: Show posts with heated debate
```

### Q5: "How do you implement AutoModerator?"
**Answer**:
- Rule engine: If-then rules defined by mods
- Triggers: Post/comment creation, user actions
- Actions: Remove, approve, report, ban
- Filters: Regex, keyword lists, karma thresholds
- Queue: Async processing via Kafka

### Q6: "How do you handle subreddit bans?"
**Answer**:
- Store: banned_users table per subreddit
- Check: Before allowing post/comment
- Cache: Cache ban list in Redis
- Propagate: Remove existing content
- Appeal: Mod mail system for appeals

### Q7: "How do you implement karma?"
**Answer**:
```
Post Karma = Sum of (upvotes - downvotes) on user's posts
Comment Karma = Sum of (upvotes - downvotes) on user's comments

Calculation:
- Async aggregation job (hourly)
- Cache in Redis
- Display on user profile
```

### Q8: "How do you prevent spam?"
**Answer**:
- Rate limiting: 10 posts per hour
- Karma threshold: Min karma to post
- Account age: Min 7 days old
- ML detection: Spam classifier
- Shadow banning: Hide spam posts
- Community reports: User reporting

## Edge Cases

### 1. Deeply Nested Comments (>10 levels)
**Solution**: Limit depth to 10, show "continue thread" link

### 2. Viral Post with 100K Comments
**Solution**: Pagination, lazy loading, cache comment trees

### 3. Vote Brigading
**Solution**: Rate limiting, vote fuzzing, shadow banning

### 4. Subreddit with 50M Subscribers
**Solution**: Sharding, caching, separate infrastructure

### 5. User Deletes Highly Upvoted Post
**Solution**: Soft delete, show [deleted], keep in rankings temporarily

This guide covers common variations and follow-up questions for Reddit design.
