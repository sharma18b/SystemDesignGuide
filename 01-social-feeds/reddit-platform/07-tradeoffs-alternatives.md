# Design Reddit - Tradeoffs and Alternatives

## Core Decisions

### 1. Voting System: Real-time vs Eventual Consistency

#### Real-time (Immediate Updates)
**Pros**: Accurate counts, better UX
**Cons**: High database load, scaling challenges

#### Eventual Consistency (Chosen)
**Pros**: Better scalability, reduced load
**Cons**: Slight delay in counts (5-10s)

**Decision**: Eventual consistency with 5-second batch updates
- Acceptable delay for vote counts
- Significantly better scalability
- Cache invalidation on vote

### 2. Comment Storage: Nested vs Flat

#### Nested (Chosen)
**Pros**: Natural hierarchy, easier queries
**Cons**: Complex updates, depth limits

#### Flat with Path
**Pros**: Simpler updates, no depth limit
**Cons**: Complex queries, path maintenance

**Decision**: Nested with parent_comment_id
- Natural representation
- Efficient queries with indexes
- 10-level depth limit acceptable

### 3. Ranking: Pre-computed vs On-demand

#### Pre-computed (Chosen)
**Pros**: Fast reads, consistent results
**Cons**: Storage overhead, update lag

#### On-demand
**Pros**: Always fresh, no storage
**Cons**: Slow reads, high CPU

**Decision**: Pre-computed with 5-minute cache
- Fast feed generation
- Acceptable staleness
- Batch recomputation

### 4. Database: SQL vs NoSQL

#### PostgreSQL (Chosen)
**Pros**: ACID, complex queries, mature
**Cons**: Vertical scaling limits

#### NoSQL (Cassandra)
**Pros**: Horizontal scaling, high writes
**Cons**: Limited queries, eventual consistency

**Decision**: PostgreSQL with sharding
- Complex queries needed (threaded comments)
- ACID for vote integrity
- Sharding provides horizontal scaling

### 5. Moderation: Automated vs Manual

#### Hybrid (Chosen)
**Pros**: Scalable + accurate
**Cons**: Complex implementation

**Decision**: AutoModerator + human moderators
- Automated rules for common cases
- Human review for edge cases
- Community-driven moderation

## Alternative Architectures

### Monolith vs Microservices

#### Microservices (Chosen)
**Pros**: Independent scaling, fault isolation
**Cons**: Operational complexity

**Decision**: Microservices for scalability
- Post, Comment, Vote, Subreddit services
- Independent scaling per service

### Caching: Aggressive vs Conservative

#### Aggressive (Chosen)
**Pros**: Better performance, lower database load
**Cons**: Higher cache cost, stale data

**Decision**: Aggressive caching (90%+ hit rate)
- 5TB Redis cluster
- Multi-level caching
- Read-heavy workload (100:1)

This analysis provides the foundation for Reddit's architecture decisions.
