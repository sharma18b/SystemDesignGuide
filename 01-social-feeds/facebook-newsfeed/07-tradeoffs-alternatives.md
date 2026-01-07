# Design Facebook Newsfeed - Tradeoffs and Alternatives

## Core Decisions

### 1. Feed Ranking: Chronological vs Algorithmic

#### Chronological (Simple)
**Pros**: Simple, transparent, real-time
**Cons**: Miss important content, spam visible, poor engagement

#### Algorithmic (Chosen)
**Pros**: Personalized, higher engagement, better content quality
**Cons**: Complex, ML infrastructure needed, less transparent

**Decision**: Algorithmic ranking with ML models
- Higher user engagement
- Better content discovery
- Spam filtering
- Personalization

### 2. Fan-out: Push vs Pull vs Hybrid

#### Push Model
**Pros**: Fast reads, simple
**Cons**: Slow writes for celebrities, storage overhead

#### Pull Model
**Pros**: Fast writes, no storage overhead
**Cons**: Slow reads, complex merge

#### Hybrid (Chosen)
**Pros**: Optimized for different user types
**Cons**: Complex implementation

**Decision**: Hybrid approach
- <1K friends: Push
- 1K-100K: Partial push
- >100K: Pull

### 3. Database: SQL vs NoSQL

#### MySQL (Chosen for Users)
**Pros**: ACID, strong consistency, complex queries
**Cons**: Vertical scaling limits, sharding complex

#### Cassandra (Chosen for Posts/Feeds)
**Pros**: Horizontal scalability, high write throughput
**Cons**: Eventual consistency, limited queries

**Decision**: Polyglot persistence
- MySQL for users (consistency critical)
- Cassandra for posts/feeds (high volume)
- TAO for social graph (graph queries)

### 4. Caching: Aggressive vs Conservative

#### Aggressive (Chosen)
**Pros**: Lower database load, faster response, better UX
**Cons**: Higher cache cost, stale data, complex invalidation

**Decision**: Aggressive caching (95%+ hit rate)
- 100TB Memcached cluster
- Multi-level caching
- Read-heavy workload (200:1)

### 5. Real-time Updates: WebSocket vs Polling

#### WebSocket (Chosen)
**Pros**: Real-time, efficient, bidirectional
**Cons**: Complex scaling, connection management

#### Long Polling
**Pros**: Simple, works everywhere
**Cons**: High latency, resource intensive

**Decision**: WebSocket with polling fallback
- Real-time feed updates
- Live reactions and comments
- Fallback for restricted networks

## Alternative Architectures

### Monolith vs Microservices

#### Microservices (Chosen)
**Pros**: Independent scaling, technology flexibility, fault isolation
**Cons**: Operational complexity, network latency, distributed debugging

**Decision**: Microservices (200+ services)
- Independent scaling
- Team autonomy
- Better fault isolation

### Self-Hosted vs Cloud

#### Self-Hosted (Chosen)
**Pros**: Full control, lower cost at scale, custom optimizations
**Cons**: High capex, operational complexity

**Decision**: Self-hosted data centers
- Cost-effective at Facebook's scale
- Custom hardware optimizations
- Full control over infrastructure

## Performance vs Cost

### Replication Factor

#### High (5 replicas - Chosen)
**Pros**: High availability, better read performance
**Cons**: 5x storage cost, higher write latency

**Decision**: 5 replicas for balance
- 1 master + 5 read replicas
- High availability (99.99%)
- Read scaling

### Data Retention

#### Long (5 years - Chosen)
**Pros**: Complete history, better analytics
**Cons**: High storage cost, slower queries

**Decision**: Tiered storage
- Hot: 0-30 days (NVMe SSD)
- Warm: 30-365 days (SATA SSD)
- Cold: >365 days (S3 Glacier)

## Consistency vs Availability

### CP vs AP (CAP Theorem)

#### Strong Consistency (User data)
- User authentication
- Privacy settings
- Friend relationships

#### Eventual Consistency (Feed data)
- Feed delivery (5-10s lag acceptable)
- Reaction counts
- Comment counts

**Decision**: Hybrid based on criticality
- Strong for critical operations
- Eventual for feeds and metrics

This analysis provides the foundation for making informed architectural decisions for Facebook's newsfeed system.
