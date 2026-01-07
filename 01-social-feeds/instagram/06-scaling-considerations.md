# Design Instagram - Scaling Considerations

## Horizontal Scaling Strategies

### Application Layer Scaling

#### Stateless Application Servers
```
Benefits:
- Easy to add/remove servers
- Load balancing across any server
- No session affinity required
- Auto-scaling based on metrics

Implementation:
- Store session data in Redis
- Use JWT tokens for authentication
- Externalize all state
- Deploy 100,000+ application servers globally

Auto-scaling Triggers:
- CPU > 70%: Scale up
- Memory > 80%: Scale up
- Request queue > 1000: Scale up
- Response time > 1s: Scale up
```

#### Microservices Scaling
```
Independent Scaling per Service:
- Upload Service: 15,000 instances (high upload load)
- Feed Service: 30,000 instances (high read load)
- Media Processing: 15,000 workers (CPU/GPU intensive)
- Story Service: 10,000 instances (high volume)
- Search Service: 5,000 instances (CPU intensive)
- Notification Service: 8,000 instances (high throughput)

Service-Specific Optimization:
- Upload: Optimize for network I/O
- Feed: Optimize for cache hits
- Media Processing: GPU acceleration
- Search: Memory-intensive indexing
```

### Database Scaling

#### Read Scaling with Replicas
```
Master-Replica Architecture:
- 1 Master (writes)
- 5 Read Replicas per master (reads)
- Async replication (eventual consistency)
- Read traffic: 98% to replicas, 2% to master

Benefits:
- 5x read capacity
- Geographic distribution
- Fault tolerance
- Load distribution

Challenges:
- Replication lag (100-500ms)
- Stale reads possible
- Failover complexity
```

#### Write Scaling with Sharding
```
Horizontal Partitioning:
- 2,000 database shards
- Partition by post_id or user_id
- Each shard: 1 master + 5 replicas
- Total: 12,000 database servers

Sharding Strategy:
- Hash-based: post_id % 2000
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

### Media Storage Scaling

#### Object Storage Strategy
```
S3 Storage Architecture:
- Multi-region replication
- Lifecycle policies for archival
- Intelligent tiering
- Transfer acceleration

Storage Tiers:
- Hot (0-30 days): S3 Standard
- Warm (30-365 days): S3 Infrequent Access
- Cold (>365 days): S3 Glacier

Benefits:
- Infinite scalability
- 11 9's durability
- Automatic replication
- Cost optimization

Optimization:
- Compress images (2MB → 200KB)
- Transcode videos (20MB → 5MB)
- Deduplication (20% savings)
- CDN caching (90% hit rate)
```

#### CDN Scaling
```
CDN Architecture:
- 200+ edge locations globally
- 90% cache hit rate
- Automatic cache warming
- Intelligent routing

Cache Strategy:
- Images: 7-day TTL
- Videos: 30-day TTL
- Thumbnails: 30-day TTL
- Profile images: 24-hour TTL

Benefits:
- Reduced origin load (10% of traffic)
- Lower latency (<50ms)
- Higher throughput
- Cost savings

Optimization:
- Pre-warm cache for trending content
- Stale-while-revalidate
- Adaptive image quality
- Video adaptive bitrate
```

### Caching Strategies

#### Multi-Level Caching
```
L1 Cache (Application Memory):
- Size: 2GB per server
- TTL: 1 minute
- Hit Rate: 40%
- Latency: <1ms
- Content: Recent posts, user sessions

L2 Cache (Redis Cluster):
- Size: 50TB total
- TTL: 5-60 minutes
- Hit Rate: 50%
- Latency: <5ms
- Content: Feeds, profiles, social graph

L3 Cache (CDN):
- Size: Unlimited (edge caching)
- TTL: 1-30 days
- Hit Rate: 90%
- Latency: <50ms
- Content: Media files

Total Cache Hit Rate: 95%+
```

#### Cache Warming Strategies
```
Proactive Cache Warming:
- Pre-compute feeds for active users
- Cache trending posts
- Warm cache during off-peak hours
- Predictive caching based on patterns

Lazy Loading:
- Cache-aside pattern
- Load on first request
- Update cache on writes

Cache Invalidation:
- Time-based expiration (TTL)
- Event-based invalidation (pub/sub)
- Manual invalidation for critical updates
- Graceful degradation on cache miss
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

Benefits:
- Lower latency
- Better user experience
- Regional compliance
- Disaster recovery
```

### Application Load Balancing
```
Layer 7 Load Balancing (ALB):
- HTTP/HTTPS traffic
- Path-based routing (/api/v1/posts → Post Service)
- Host-based routing (api.instagram.com → API Gateway)
- SSL termination
- Health checks
- Sticky sessions for WebSocket

Layer 4 Load Balancing (NLB):
- TCP/UDP traffic
- WebSocket connections
- High throughput (millions of connections)
- Low latency (<1ms)
- Static IP addresses
```

## Performance Optimization

### Media Delivery Optimization
```
Image Optimization:
- Multiple sizes (thumbnail, medium, large)
- WebP format for modern browsers (30% smaller)
- Progressive JPEG for faster rendering
- Lazy loading for images
- Responsive images (srcset)

Video Optimization:
- Adaptive bitrate streaming (HLS/DASH)
- Multiple quality levels (360p, 720p, 1080p)
- Thumbnail generation
- Video transcoding pipeline
- Preloading first few seconds

CDN Strategy:
- 90% cache hit rate
- Edge caching in 200+ locations
- Automatic image optimization
- Video streaming optimization
```

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

## Handling Celebrity Users (Hot User Problem)

### Fan-out Challenges
```
Problem:
- Celebrity with 600M followers posts photo
- Fan-out on write: 600M feed writes
- Takes hours to complete
- Overwhelms database

Impact:
- Slow post delivery to followers
- Database write bottleneck
- Increased latency for all users
- Resource exhaustion
```

### Solutions

#### Hybrid Fan-out Approach
```
Regular Users (<10K followers):
- Fan-out on write (push model)
- Pre-compute feeds
- Fast reads, slower writes
- Store in feed table

Medium Users (10K-1M followers):
- Partial fan-out to active followers
- Pull for inactive followers
- Hybrid approach

Celebrity Users (>1M followers):
- Fan-out on read (pull model)
- No pre-computed feeds
- Fetch posts on-demand
- Cache aggressively
```

#### Celebrity Post Handling
```
1. Detect celebrity user (follower count >1M)
2. Skip fan-out process
3. Store post in celebrity_posts table
4. When follower requests feed:
   a. Fetch pre-computed feed (regular users)
   b. Merge with celebrity posts (pull on-demand)
   c. Sort by timestamp
   d. Cache result (TTL: 5 minutes)
```

#### Rate Limiting for Fan-out
```
Fan-out Rate Limits:
- Max 20,000 fan-outs per second per post
- Batch writes: 1,000 feeds per batch
- Parallel workers: 200 workers
- Total time: 600M / (20K * 200) = 150 seconds

Priority Queue:
- High priority: Active users (last 24 hours)
- Medium priority: Recent users (last 7 days)
- Low priority: Inactive users (>7 days)
```

## Handling Viral Content

### Viral Post Detection
```
Indicators:
- Rapid increase in engagement (>10K likes/min)
- High share velocity (>5K shares/min)
- Trending hashtags
- Celebrity engagement

Actions:
- Increase cache TTL (5 min → 1 hour)
- Pre-warm CDN cache globally
- Scale up read replicas
- Enable aggressive caching
- Add circuit breakers
```

### Cache Stampede Prevention
```
Problem:
- Viral post cache expires
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
   - No user-facing latency
```

## Geographic Distribution

### Multi-Region Architecture
```
Regions:
- US West (Oregon)
- US East (Virginia)
- EU West (Ireland)
- EU Central (Frankfurt)
- Asia Pacific (Singapore)
- Asia Pacific (Tokyo)
- South America (São Paulo)

Data Replication:
- Async replication between regions
- Eventual consistency (5-10 second lag)
- Conflict resolution with last-write-wins

Benefits:
- Low latency for global users
- Disaster recovery
- Compliance with data residency laws
- Regional failover
```

### Cross-Region Challenges
```
Challenges:
1. Data Consistency:
   - Eventual consistency across regions
   - Conflict resolution needed
   - User may see different data

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
- Regional routing with GeoDNS
```

## Auto-Scaling

### Scaling Triggers
```
Scale Up When:
- CPU utilization > 70%
- Memory utilization > 80%
- Request queue depth > 1000
- Response time p95 > 1s
- Error rate > 1%
- Upload queue depth > 5000

Scale Down When:
- CPU utilization < 30% for 10 minutes
- Memory utilization < 40% for 10 minutes
- Request queue depth < 100
- Response time p95 < 500ms
```

### Scaling Policies
```
Target Tracking:
- Maintain CPU at 60%
- Automatically adjust capacity

Step Scaling:
- Add 20 instances if CPU > 70%
- Add 100 instances if CPU > 90%
- Remove 10 instances if CPU < 30%

Scheduled Scaling:
- Scale up before peak hours (6 AM - 10 PM)
- Scale down during off-peak (10 PM - 6 AM)
- Scale up for major events (holidays, celebrity posts)

Predictive Scaling:
- ML-based prediction of future load
- Proactive scaling before traffic spike
- Based on historical patterns
```

## Monitoring and Alerting

### Key Metrics to Monitor
```
Application Metrics:
- Request rate (requests/second)
- Response time (p50, p95, p99)
- Error rate (%)
- Upload throughput (photos/videos per second)

Infrastructure Metrics:
- CPU utilization (%)
- Memory utilization (%)
- Disk I/O (IOPS)
- Network bandwidth (Gbps)

Business Metrics:
- Daily active users
- Photos/videos uploaded per day
- Feed requests per day
- Engagement rate (likes, comments)
```

### Alerting Thresholds
```
Critical Alerts (Page immediately):
- Error rate > 5%
- Response time p95 > 3 seconds
- Database connection pool exhausted
- Service down for >5 minutes
- CDN hit rate < 70%

Warning Alerts (Notify team):
- Error rate > 1%
- Response time p95 > 1 second
- CPU utilization > 80%
- Cache hit rate < 85%
- Upload queue depth > 10000
```

This comprehensive scaling strategy ensures Instagram can handle massive scale while maintaining performance, reliability, and cost-effectiveness.
