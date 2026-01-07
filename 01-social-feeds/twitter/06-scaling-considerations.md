# Design Twitter - Scaling Considerations

## Horizontal Scaling Strategies

### Application Layer Scaling

#### Stateless Application Servers
```
Benefits:
- Easy to add/remove servers
- Load balancing across any server
- No session affinity required
- Auto-scaling based on CPU/memory

Implementation:
- Store session data in Redis
- Use JWT tokens for authentication
- Externalize all state to databases/caches
- Deploy 50,000+ application servers globally
```

#### Microservices Scaling
```
Independent Scaling per Service:
- Tweet Service: 10,000 instances (high write load)
- Timeline Service: 20,000 instances (high read load)
- User Service: 5,000 instances (moderate load)
- Media Service: 8,000 instances (high bandwidth)
- Search Service: 3,000 instances (CPU intensive)

Auto-scaling Triggers:
- CPU > 70%: Scale up
- Memory > 80%: Scale up
- Request queue depth > 1000: Scale up
- Response time > 500ms: Scale up
```

### Database Scaling

#### Read Scaling with Replicas
```
Master-Replica Architecture:
- 1 Master (writes)
- 5 Read Replicas per master (reads)
- Async replication (eventual consistency)
- Read traffic: 95% to replicas, 5% to master

Benefits:
- 5x read capacity
- Geographic distribution
- Fault tolerance

Challenges:
- Replication lag (100-500ms)
- Stale reads possible
- Failover complexity
```

#### Write Scaling with Sharding
```
Horizontal Partitioning:
- 1,000 database shards
- Partition by tweet_id or user_id
- Each shard: 1 master + 5 replicas
- Total: 6,000 database servers

Sharding Strategy:
- Hash-based: tweet_id % 1000
- Range-based: user_id ranges
- Geographic: shard by region

Benefits:
- Linear write scalability
- Parallel query execution
- Isolated failures

Challenges:
- Cross-shard queries expensive
- Rebalancing shards difficult
- Increased operational complexity
```

### Caching Strategies

#### Multi-Level Caching
```
L1 Cache (Application Memory):
- Size: 1GB per server
- TTL: 1 minute
- Hit Rate: 30%
- Latency: <1ms

L2 Cache (Redis Cluster):
- Size: 10TB total
- TTL: 5-60 minutes
- Hit Rate: 60%
- Latency: <5ms

L3 Cache (CDN):
- Size: Unlimited (edge caching)
- TTL: 1-24 hours
- Hit Rate: 85% for media
- Latency: <50ms

Total Cache Hit Rate: 90%+
```

#### Cache Warming Strategies
```
Proactive Cache Warming:
- Pre-compute timelines for active users
- Cache popular tweets and trending topics
- Warm cache during off-peak hours
- Predictive caching based on user behavior

Lazy Loading:
- Cache-aside pattern
- Load on first request
- Update cache on writes

Cache Invalidation:
- Time-based expiration (TTL)
- Event-based invalidation (pub/sub)
- Manual invalidation for critical updates
```

## Load Balancing

### Global Load Balancing
```
GeoDNS Routing:
- Route users to nearest data center
- Latency-based routing
- Health check-based failover
- Weighted routing for gradual rollouts

Example:
User in US → us-west-2 data center
User in EU → eu-west-1 data center
User in Asia → ap-southeast-1 data center
```

### Application Load Balancing
```
Layer 7 Load Balancing (ALB):
- HTTP/HTTPS traffic
- Path-based routing (/api/v1/tweets → Tweet Service)
- Host-based routing (api.twitter.com → API Gateway)
- SSL termination
- Health checks

Layer 4 Load Balancing (NLB):
- TCP/UDP traffic
- WebSocket connections
- High throughput (millions of connections)
- Low latency (<1ms)
```

### Load Balancing Algorithms
```
Round Robin:
- Simple, even distribution
- No consideration of server load
- Good for homogeneous servers

Least Connections:
- Route to server with fewest connections
- Better for long-lived connections
- Good for WebSocket traffic

Weighted Round Robin:
- Assign weights based on server capacity
- Route more traffic to powerful servers
- Good for heterogeneous infrastructure

Consistent Hashing:
- Sticky sessions for stateful services
- Minimize cache misses
- Good for caching layers
```

## Performance Optimization

### Database Query Optimization
```
Indexing:
- Composite indexes on (user_id, created_at)
- Covering indexes to avoid table lookups
- Partial indexes for active data only

Query Optimization:
- Use EXPLAIN to analyze query plans
- Avoid N+1 queries (use joins or batch queries)
- Limit result sets (pagination)
- Use database connection pooling

Denormalization:
- Store computed values (follower counts)
- Duplicate data for faster reads
- Trade storage for query performance
```

### API Response Optimization
```
Response Compression:
- Gzip compression (70% size reduction)
- Brotli for modern browsers (80% reduction)
- Compress responses >1KB

Payload Optimization:
- Return only requested fields (GraphQL)
- Paginate large result sets
- Use ETags for conditional requests
- Implement HTTP caching headers

Connection Optimization:
- HTTP/2 for multiplexing
- Keep-alive connections
- Connection pooling
- Reduce TLS handshake overhead
```

### Media Delivery Optimization
```
CDN Strategy:
- 85% cache hit rate
- Edge caching in 200+ locations
- Automatic image optimization
- Adaptive bitrate for videos

Image Optimization:
- Multiple sizes (thumbnail, medium, large)
- WebP format for modern browsers
- Lazy loading for images
- Progressive JPEG for faster rendering

Video Optimization:
- Adaptive bitrate streaming (HLS/DASH)
- Multiple quality levels (360p, 720p, 1080p)
- Thumbnail generation
- Video transcoding pipeline
```

## Handling Celebrity Users (Hot User Problem)

### Fan-out Challenges
```
Problem:
- Celebrity with 150M followers posts tweet
- Fan-out on write: 150M timeline writes
- Takes hours to complete
- Overwhelms database

Impact:
- Slow tweet delivery to followers
- Database write bottleneck
- Increased latency for all users
```

### Solutions

#### Hybrid Fan-out Approach
```
Regular Users (<10K followers):
- Fan-out on write (push model)
- Pre-compute timelines
- Fast reads, slow writes

Medium Users (10K-1M followers):
- Partial fan-out on write
- Fan-out to active followers only
- Pull for inactive followers

Celebrity Users (>1M followers):
- Fan-out on read (pull model)
- No pre-computed timelines
- Fetch tweets on-demand
- Cache aggressively
```

#### Celebrity Tweet Handling
```
1. Detect celebrity user (follower count >1M)
2. Skip fan-out process
3. Store tweet in celebrity_tweets table
4. When follower requests timeline:
   a. Fetch pre-computed timeline (regular users)
   b. Merge with celebrity tweets (pull on-demand)
   c. Sort by timestamp
   d. Cache result
```

#### Rate Limiting for Fan-out
```
Fan-out Rate Limits:
- Max 10,000 fan-outs per second per tweet
- Batch writes: 1,000 timelines per batch
- Parallel workers: 100 workers
- Total time: 150M / (10K * 100) = 150 seconds

Priority Queue:
- High priority: Active users (last 24 hours)
- Medium priority: Recent users (last 7 days)
- Low priority: Inactive users (>7 days)
```

## Handling Viral Content

### Viral Tweet Detection
```
Indicators:
- Rapid increase in engagement (>1000 likes/min)
- High retweet velocity (>500 retweets/min)
- Trending hashtags
- Celebrity engagement

Actions:
- Increase cache TTL
- Pre-warm CDN cache
- Scale up read replicas
- Enable aggressive caching
```

### Cache Stampede Prevention
```
Problem:
- Viral tweet cache expires
- Thousands of requests hit database simultaneously
- Database overload

Solutions:
1. Probabilistic Early Expiration:
   - Refresh cache before expiration
   - Random jitter to spread load

2. Request Coalescing:
   - Deduplicate concurrent requests
   - Single database query for multiple requests

3. Stale-While-Revalidate:
   - Serve stale cache while refreshing
   - Async cache refresh
```

## Geographic Distribution

### Multi-Region Architecture
```
Regions:
- US West (Oregon)
- US East (Virginia)
- EU West (Ireland)
- Asia Pacific (Singapore)
- South America (São Paulo)

Data Replication:
- Async replication between regions
- Eventual consistency (5-10 second lag)
- Conflict resolution with last-write-wins

Benefits:
- Low latency for global users
- Disaster recovery
- Compliance with data residency laws
```

### Cross-Region Challenges
```
Challenges:
1. Data Consistency:
   - Eventual consistency across regions
   - Conflict resolution needed
   - User may see different data in different regions

2. Network Latency:
   - Cross-region latency: 100-300ms
   - Affects real-time features
   - Requires regional caching

3. Operational Complexity:
   - Multiple deployments
   - Monitoring across regions
   - Incident response coordination

Solutions:
- Regional data centers with local caches
- Conflict-free replicated data types (CRDTs)
- Multi-master replication with conflict resolution
```

## Auto-Scaling

### Scaling Triggers
```
Scale Up When:
- CPU utilization > 70%
- Memory utilization > 80%
- Request queue depth > 1000
- Response time p95 > 500ms
- Error rate > 1%

Scale Down When:
- CPU utilization < 30% for 10 minutes
- Memory utilization < 40% for 10 minutes
- Request queue depth < 100
- Response time p95 < 200ms
```

### Scaling Policies
```
Target Tracking:
- Maintain CPU at 60%
- Automatically adjust capacity

Step Scaling:
- Add 10 instances if CPU > 70%
- Add 50 instances if CPU > 90%
- Remove 5 instances if CPU < 30%

Scheduled Scaling:
- Scale up before peak hours (6 AM - 10 PM)
- Scale down during off-peak (10 PM - 6 AM)
- Scale up for major events (Super Bowl, Elections)
```

## Monitoring and Alerting

### Key Metrics to Monitor
```
Application Metrics:
- Request rate (requests/second)
- Response time (p50, p95, p99)
- Error rate (%)
- Throughput (tweets/second)

Infrastructure Metrics:
- CPU utilization (%)
- Memory utilization (%)
- Disk I/O (IOPS)
- Network bandwidth (Gbps)

Business Metrics:
- Daily active users
- Tweets per day
- Timeline requests per day
- Engagement rate (likes, retweets)
```

### Alerting Thresholds
```
Critical Alerts (Page immediately):
- Error rate > 5%
- Response time p95 > 2 seconds
- Database connection pool exhausted
- Service down for >5 minutes

Warning Alerts (Notify team):
- Error rate > 1%
- Response time p95 > 1 second
- CPU utilization > 80%
- Cache hit rate < 80%
```

This comprehensive scaling strategy ensures Twitter can handle massive scale while maintaining performance, reliability, and cost-effectiveness.
