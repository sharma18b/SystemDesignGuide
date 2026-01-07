# Design Reddit - Interview Tips

## Interview Approach

### Step 1: Requirements (5-10 min)
```
Questions:
- "Core features: Subreddits, posts, comments, voting?"
- "Scale: How many users and subreddits?"
- "Ranking: Hot, new, top, controversial?"
- "Moderation: Community-driven or centralized?"

Sample Dialog:
You: "Let me clarify:
- Subreddits: Topic-based communities?
- Posts: Text, links, images, videos?
- Comments: Threaded discussions?
- Voting: Upvote/downvote system?
- Scale: Reddit's scale (500M users, 3M subreddits)?"
```

### Step 2: Calculations (5 min)
```
Users:
- Registered: 500M
- DAU: 50M (10%)
- Subreddits: 3M

Content:
- Posts/day: 2M (23 TPS)
- Comments/day: 20M (231 TPS)
- Votes/day: 500M (5,787 TPS)

Storage (5 years):
- Posts: 2M × 365 × 5 × 1KB = 3.65TB
- Comments: 20M × 365 × 5 × 500B = 18.25TB
- Total: ~22TB

Traffic:
- Page views: 20B/month
- Read:Write: 100:1
```

### Step 3: High-Level Design (10-15 min)
```
Components:
- Post Service
- Comment Service
- Vote Service
- Ranking Service
- Subreddit Service
- Moderation Service
- PostgreSQL (sharded)
- Redis (caching)
- Elasticsearch (search)
```

### Step 4: Deep Dive (15-20 min)

#### Critical Decision 1: Voting System
```
Interviewer: "How do you implement voting?"

Strong Answer:
"I'd use eventual consistency:

1. Vote Registration:
   - Store vote in votes table
   - Publish event to Kafka
   - Return success immediately

2. Count Aggregation:
   - Batch process every 5 seconds
   - Aggregate votes per post/comment
   - Update score in database
   - Invalidate cache

3. Anti-Manipulation:
   - Rate limit: 1000 votes/hour
   - Vote fuzzing: Add random noise
   - ML detection: Identify bots
   - Shadow banning: Hide manipulated votes

This provides scalability while preventing manipulation."
```

#### Critical Decision 2: Hot Algorithm
```
Interviewer: "How do you rank posts?"

Strong Answer:
"I'd use Reddit's Hot algorithm:

Formula:
score = log10(max(|ups-downs|, 1)) × sign + age_seconds/45000

Components:
- Logarithmic: Diminishing returns for votes
- Time decay: Older posts rank lower
- 45000 seconds: ~12.5 hours per rank

Implementation:
- Pre-compute scores every 5 minutes
- Cache rankings in Redis (5 min TTL)
- Recompute on new votes

This balances popularity with recency."
```

#### Critical Decision 3: Comment Threading
```
Interviewer: "How do you implement threaded comments?"

Strong Answer:
"I'd use nested set model:

Schema:
- parent_comment_id: Link to parent
- depth: Nesting level (max 10)
- path: Hierarchical path (e.g., '1.2.5')

Query:
SELECT * FROM comments 
WHERE post_id = ? AND path LIKE '1.2.%'
ORDER BY path, score DESC;

Optimization:
- Cache entire comment trees in Redis
- Lazy load deeply nested comments
- Pagination for large threads

This provides efficient threaded discussions."
```

## Common Pitfalls

### Pitfall 1: Ignoring Vote Manipulation
❌ Wrong: "Just count votes in real-time"
✅ Right: "Batch updates, vote fuzzing, rate limiting"

### Pitfall 2: Not Considering Ranking
❌ Wrong: "Sort by timestamp"
✅ Right: "Hot algorithm balances popularity and recency"

### Pitfall 3: Forgetting Moderation
❌ Wrong: "No moderation tools"
✅ Right: "AutoModerator + human moderators"

### Pitfall 4: Ignoring Comment Threading
❌ Wrong: "Flat comment structure"
✅ Right: "Nested with parent_comment_id"

## Impressive Points

### Technical Depth
```
1. Hot Algorithm:
   "Reddit's Hot algorithm uses logarithmic scaling
   and time decay to balance popularity with recency"

2. Wilson Confidence Interval:
   "Best sorting uses Wilson score for statistical
   confidence in upvote ratio"

3. Vote Fuzzing:
   "Add random noise to vote counts to prevent
   manipulation detection"
```

## Time Management
```
0-5 min: Requirements
5-10 min: Calculations
10-25 min: High-level design
25-40 min: Deep dive (voting, ranking, threading)
40-45 min: Wrap-up
```

## Final Tips

### Do's ✅
- Discuss voting system
- Explain Hot algorithm
- Consider comment threading
- Mention moderation tools
- Think about vote manipulation

### Don'ts ❌
- Don't ignore ranking algorithms
- Don't forget moderation
- Don't overlook threading
- Don't skip vote manipulation

Remember: Show your understanding of Reddit's unique features (voting, ranking, threading) and how they scale!
