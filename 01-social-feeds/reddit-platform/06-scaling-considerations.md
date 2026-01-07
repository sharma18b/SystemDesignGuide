# Design Reddit - Scaling Considerations

## Horizontal Scaling
- **Application Servers**: 5,000 stateless servers
- **Database Sharding**: 500 shards by subreddit_id
- **Read Replicas**: 5 replicas per shard
- **Auto-scaling**: Based on CPU/memory

## Caching Strategy
- **Hot Posts**: Redis (1 hour TTL, 90% hit rate)
- **Comment Trees**: Redis (30 min TTL)
- **Vote Counts**: Redis (5 min TTL)
- **Subreddit Info**: Redis (1 day TTL)

## Ranking Algorithms

### Hot Algorithm
```python
def hot(ups, downs, date):
    score = ups - downs
    order = log10(max(abs(score), 1))
    sign = 1 if score > 0 else -1 if score < 0 else 0
    seconds = date - 1134028003
    return round(sign * order + seconds / 45000, 7)
```

### Best Algorithm (Wilson Score)
```python
def confidence(ups, downs):
    n = ups + downs
    if n == 0:
        return 0
    z = 1.96  # 95% confidence
    phat = ups / n
    return (phat + z*z/(2*n) - z * sqrt((phat*(1-phat)+z*z/(4*n))/n))/(1+z*z/n)
```

## Vote Counting
- **Eventual Consistency**: Vote counts updated asynchronously
- **Batch Updates**: Aggregate votes every 5 seconds
- **Cache Invalidation**: Invalidate on vote
- **Anti-Cheating**: Rate limiting, vote fuzzing

## Comment Threading
- **Nested Storage**: parent_comment_id for hierarchy
- **Depth Limit**: Max 10 levels deep
- **Load More**: Pagination for large threads
- **Caching**: Cache entire comment trees

## Performance Optimization
- **Database Indexes**: Composite indexes on (subreddit_id, score)
- **Query Optimization**: Limit result sets, use covering indexes
- **CDN**: Serve static content from CDN
- **Lazy Loading**: Load comments on demand

## Auto-Scaling
- **Triggers**: CPU >70%, Memory >80%, Queue depth >1000
- **Policies**: Target tracking at 60% CPU
- **Scheduled**: Scale for peak hours (6-11 PM)

## Monitoring
- **Metrics**: Response time, error rate, cache hit rate
- **Alerting**: Critical >5% error rate, Warning >1%
- **Dashboards**: Real-time system health

This scaling strategy ensures Reddit can handle millions of communities and billions of votes.
