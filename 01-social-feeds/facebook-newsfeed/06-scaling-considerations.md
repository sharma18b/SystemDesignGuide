# Design Facebook Newsfeed - Scaling Considerations

## Horizontal Scaling

### Application Layer
- 200,000+ stateless application servers
- Auto-scaling based on CPU/memory
- Independent scaling per service
- Geographic distribution

### Database Scaling
- 5,000 database shards
- 5 read replicas per shard
- Async replication
- Cross-region replication

### Caching Strategy
- L1: Application memory (1 min TTL)
- L2: Memcached 100TB (5-60 min TTL)
- L3: CDN (24 hours - 7 days TTL)
- 95%+ cache hit rate target

## ML-Based Feed Ranking

### Ranking Model
```
Score = f(
  affinity (user-author relationship),
  weight (post type),
  time_decay (recency),
  engagement (likes, comments),
  content_quality,
  diversity
)

Model: Gradient Boosted Decision Trees
Training: Offline on historical data
Serving: Real-time feature computation
Update: Daily retraining
```

### Feature Engineering
- User features: demographics, interests, behavior
- Post features: type, length, media, engagement
- Context features: time, device, location
- Interaction features: past engagement with author

## Handling Celebrity Users

### Fan-out Strategy
```
Regular (<1K friends): Fan-out on write
Power (1K-100K): Partial fan-out
Celebrity (>100K): Fan-out on read

Celebrity Post Handling:
1. Skip fan-out
2. Store in celebrity_posts table
3. Fetch on-demand when user requests feed
4. Cache aggressively (1 hour TTL)
```

## Performance Optimization

### Feed Generation
- Pre-compute feeds for active users
- Pull model for celebrity content
- ML ranking in real-time
- Cache results (5 min TTL)

### Media Delivery
- CDN with 90% hit rate
- Multiple image sizes
- Video adaptive bitrate
- Lazy loading

## Auto-Scaling

### Triggers
- CPU > 70%: Scale up
- Memory > 80%: Scale up
- Request queue > 1000: Scale up
- Response time > 1s: Scale up

### Policies
- Target tracking: Maintain CPU at 60%
- Step scaling: Add servers based on load
- Scheduled: Scale for peak hours
- Predictive: ML-based prediction

## Monitoring

### Key Metrics
- Feed load time (p95 <1s)
- Post creation latency (p95 <500ms)
- Reaction latency (p95 <100ms)
- Cache hit rate (>95%)
- Error rate (<0.1%)

### Alerting
- Critical: Error rate >5%, page immediately
- Warning: Error rate >1%, notify team
- Info: Performance degradation

This scaling strategy ensures Facebook can handle billions of users with sophisticated ML-based ranking.
