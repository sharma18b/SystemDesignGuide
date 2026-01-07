# Design Twitter - Tradeoffs and Alternatives

## Core Architecture Decisions

### 1. Fan-out Strategy: Push vs Pull vs Hybrid

#### Push Model (Fan-out on Write)
**Approach**: Pre-compute timelines when tweet is posted

**Pros**:
- Fast timeline reads (pre-computed)
- Simple implementation
- Consistent user experience
- Low read latency (<100ms)

**Cons**:
- Slow writes for celebrity users
- Storage overhead (duplicate data)
- Fan-out delay for large follower counts
- Wasted computation for inactive users

**When to Use**: Regular users with <10K followers

#### Pull Model (Fan-out on Read)
**Approach**: Compute timeline on-demand when user requests it

**Pros**:
- Fast writes (no fan-out)
- No storage overhead
- Works well for celebrity users
- No wasted computation

**Cons**:
- Slow reads (compute on-demand)
- Complex merge logic
- High read latency (500ms-1s)
- Database load on timeline requests

**When to Use**: Celebrity users with >1M followers

#### Hybrid Model (Chosen Approach)
**Approach**: Push for regular users, pull for celebrities

**Pros**:
- Best of both worlds
- Optimized for different user types
- Scalable for all scenarios
- Balanced read/write performance

**Cons**:
- Complex implementation
- Two code paths to maintain
- Threshold tuning required
- Increased operational complexity

**Decision**: Use hybrid approach with thresholds:
- <10K followers: Pure push
- 10K-1M followers: Partial push (active followers only)
- >1M followers: Pure pull

### 2. Database Choice: SQL vs NoSQL

#### SQL (PostgreSQL)
**Use Cases**: User data, account information

**Pros**:
- ACID compliance
- Strong consistency
- Complex queries and joins
- Mature ecosystem
- Data integrity constraints

**Cons**:
- Vertical scaling limits
- Sharding complexity
- Lower write throughput
- Schema migrations difficult

**Decision**: Use for user data where consistency is critical

#### NoSQL (Cassandra)
**Use Cases**: Tweets, timelines, social graph

**Pros**:
- Horizontal scalability
- High write throughput
- Time-series data optimized
- No single point of failure
- Linear scalability

**Cons**:
- Eventual consistency
- Limited query flexibility
- No joins
- Denormalization required

**Decision**: Use for high-volume, time-series data

#### Polyglot Persistence (Chosen Approach)
**Approach**: Use multiple databases for different use cases

**Benefits**:
- Optimize for each data pattern
- Best tool for each job
- Independent scaling
- Flexibility

**Challenges**:
- Operational complexity
- Data consistency across databases
- Multiple technologies to maintain
- Increased learning curve

**Decision**: Use PostgreSQL for users, Cassandra for tweets/timelines, Redis for caching

### 3. Consistency Model: Strong vs Eventual

#### Strong Consistency
**Approach**: All reads see latest write immediately

**Pros**:
- Simple mental model
- No stale data
- Easier to reason about
- Better user experience

**Cons**:
- Higher latency
- Lower availability (CAP theorem)
- Reduced scalability
- More expensive

**Use Cases**: User authentication, account balance, follow/unfollow

#### Eventual Consistency
**Approach**: Reads may see stale data temporarily

**Pros**:
- Lower latency
- Higher availability
- Better scalability
- Cost-effective

**Cons**:
- Stale reads possible
- Complex conflict resolution
- Harder to reason about
- Potential user confusion

**Use Cases**: Timeline delivery, follower counts, like counts

#### Hybrid Consistency (Chosen Approach)
**Approach**: Strong consistency for critical data, eventual for rest

**Decision Matrix**:
```
Strong Consistency:
- User authentication
- Account settings
- Follow/unfollow operations
- Tweet deletion
- Payment transactions

Eventual Consistency:
- Timeline delivery (5-second lag acceptable)
- Follower/following counts
- Like and retweet counts
- Trending topics
- Search results
```

### 4. Caching Strategy: Write-Through vs Cache-Aside

#### Write-Through Cache
**Approach**: Write to cache and database simultaneously

**Pros**:
- Cache always consistent with database
- Simple implementation
- No cache misses on reads
- Predictable performance

**Cons**:
- Higher write latency
- Wasted cache space (unused data)
- Cache pollution
- More complex writes

**Use Cases**: User profiles, tweet details

#### Cache-Aside (Lazy Loading)
**Approach**: Load cache on first read miss

**Pros**:
- Only cache requested data
- Lower write latency
- Efficient cache usage
- Simple writes

**Cons**:
- Cache misses on first read
- Stale data possible
- Cache stampede risk
- More complex reads

**Use Cases**: Timelines, search results

#### Hybrid Caching (Chosen Approach)
**Approach**: Write-through for hot data, cache-aside for cold data

**Decision**:
- Write-through: User profiles, recent tweets
- Cache-aside: Timelines, search results, trending topics

### 5. Media Storage: Self-Hosted vs Cloud Storage

#### Self-Hosted Storage
**Approach**: Own data centers with custom storage

**Pros**:
- Full control
- Potentially lower cost at scale
- Custom optimizations
- No vendor lock-in

**Cons**:
- High upfront cost
- Operational complexity
- Scaling challenges
- Disaster recovery difficult

#### Cloud Storage (S3)
**Approach**: Use managed object storage

**Pros**:
- Infinite scalability
- 11 9's durability
- Pay-as-you-go pricing
- Built-in CDN integration
- Automatic replication

**Cons**:
- Vendor lock-in
- Egress costs
- Less control
- Potential latency

**Decision**: Use S3 for media storage with CloudFront CDN
- Cost-effective at scale
- Proven reliability
- Easy integration
- Focus on core product

## Alternative Architectures

### 1. Monolith vs Microservices

#### Monolithic Architecture
**Pros**:
- Simple deployment
- Easy to develop initially
- No network overhead
- Easier debugging

**Cons**:
- Scaling entire app (not individual components)
- Technology lock-in
- Deployment risk (all-or-nothing)
- Team coordination difficult

#### Microservices Architecture (Chosen)
**Pros**:
- Independent scaling
- Technology flexibility
- Isolated failures
- Team autonomy
- Faster deployments

**Cons**:
- Operational complexity
- Network latency
- Distributed debugging
- Data consistency challenges

**Decision**: Microservices for scalability and team autonomy

### 2. Synchronous vs Asynchronous Communication

#### Synchronous (REST/gRPC)
**Pros**:
- Simple request-response
- Immediate feedback
- Easy error handling
- Familiar pattern

**Cons**:
- Tight coupling
- Cascading failures
- Lower throughput
- Blocking operations

**Use Cases**: User-facing APIs, critical operations

#### Asynchronous (Message Queue)
**Pros**:
- Loose coupling
- High throughput
- Fault tolerance
- Buffering capability

**Cons**:
- Complex error handling
- Eventual consistency
- Debugging difficult
- Message ordering challenges

**Use Cases**: Fan-out, notifications, analytics

**Decision**: Hybrid approach
- Synchronous: User-facing APIs
- Asynchronous: Background processing, fan-out, notifications

### 3. Real-time Updates: WebSocket vs Server-Sent Events vs Long Polling

#### WebSocket
**Pros**:
- Full-duplex communication
- Low latency
- Efficient (persistent connection)
- Real-time bidirectional

**Cons**:
- Complex implementation
- Scaling challenges
- Firewall issues
- Connection management

#### Server-Sent Events (SSE)
**Pros**:
- Simple implementation
- Automatic reconnection
- HTTP-based (firewall-friendly)
- One-way server-to-client

**Cons**:
- No client-to-server real-time
- Limited browser support
- HTTP overhead
- Connection limits

#### Long Polling
**Pros**:
- Works everywhere
- Simple fallback
- No special infrastructure
- Firewall-friendly

**Cons**:
- High latency
- Resource intensive
- Inefficient
- Scalability issues

**Decision**: WebSocket for real-time updates with SSE/Long Polling fallback

## Performance vs Cost Tradeoffs

### 1. Caching Aggressiveness

#### Aggressive Caching (High Cache Hit Rate)
**Pros**:
- Lower database load
- Faster response times
- Better user experience
- Lower infrastructure cost

**Cons**:
- Higher cache infrastructure cost
- Stale data more likely
- Cache invalidation complexity
- Memory overhead

#### Conservative Caching (Low Cache Hit Rate)
**Pros**:
- Fresher data
- Lower cache cost
- Simpler invalidation
- Less memory usage

**Cons**:
- Higher database load
- Slower response times
- Higher infrastructure cost
- Scalability challenges

**Decision**: Aggressive caching (90%+ hit rate) for read-heavy workload

### 2. Replication Factor

#### High Replication (5 replicas)
**Pros**:
- High availability
- Better read performance
- Fault tolerance
- Geographic distribution

**Cons**:
- 5x storage cost
- Higher write latency
- Replication lag
- Operational complexity

#### Low Replication (2 replicas)
**Pros**:
- Lower storage cost
- Faster writes
- Simpler operations
- Less replication lag

**Cons**:
- Lower availability
- Limited read scaling
- Higher failure risk
- Less fault tolerance

**Decision**: 3 replicas for balance (1 master + 2 replicas)

### 3. Data Retention

#### Long Retention (Unlimited)
**Pros**:
- Complete history
- Better analytics
- User satisfaction
- Compliance

**Cons**:
- High storage cost
- Slower queries
- Backup complexity
- Privacy concerns

#### Short Retention (1 year)
**Pros**:
- Lower storage cost
- Faster queries
- Simpler backups
- Privacy-friendly

**Cons**:
- Lost historical data
- Limited analytics
- User dissatisfaction
- Compliance issues

**Decision**: Tiered storage
- Hot: 30 days (NVMe SSD)
- Warm: 1 year (SATA SSD)
- Cold: 5 years (S3 Glacier)

## Availability vs Consistency Tradeoffs (CAP Theorem)

### CP System (Consistency + Partition Tolerance)
**Approach**: Sacrifice availability for consistency

**Pros**:
- Strong consistency
- No stale data
- Simpler reasoning
- Better for financial data

**Cons**:
- Lower availability
- Higher latency
- Reduced scalability
- Poor user experience during partitions

**Use Cases**: User authentication, account settings

### AP System (Availability + Partition Tolerance)
**Approach**: Sacrifice consistency for availability

**Pros**:
- High availability
- Low latency
- Better scalability
- Good user experience

**Cons**:
- Eventual consistency
- Stale reads possible
- Conflict resolution needed
- Complex reasoning

**Use Cases**: Timelines, social graph, engagement metrics

**Decision**: Hybrid approach based on data criticality

## Technology Stack Alternatives

### Programming Language

#### Java (Chosen for most services)
**Pros**: Mature ecosystem, high performance, strong typing, excellent tooling
**Cons**: Verbose, slower development, higher memory usage

#### Go (Chosen for high-performance services)
**Pros**: Fast, concurrent, low memory, simple deployment
**Cons**: Smaller ecosystem, less mature, limited generics

#### Python (Considered but not chosen)
**Pros**: Fast development, great for ML, large ecosystem
**Cons**: Slower runtime, GIL limitations, scaling challenges

### Message Queue

#### Kafka (Chosen)
**Pros**: High throughput, durability, replay capability, partitioning
**Cons**: Complex setup, higher latency, operational overhead

#### RabbitMQ (Alternative)
**Pros**: Simple, flexible routing, lower latency, mature
**Cons**: Lower throughput, no replay, scaling challenges

#### AWS SQS (Alternative)
**Pros**: Managed, scalable, pay-per-use, no operations
**Cons**: Vendor lock-in, higher cost, limited features

This comprehensive analysis of tradeoffs and alternatives provides the foundation for making informed architectural decisions when building a Twitter-like platform.
