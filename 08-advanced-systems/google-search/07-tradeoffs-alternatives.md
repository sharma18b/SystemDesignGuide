# Google Search - Tradeoffs and Alternatives

## Indexing Tradeoffs

### Full Crawl vs Incremental Crawl

**Chosen: Hybrid (Full + Incremental)**

**Full Crawl**:
```
Advantages:
- Complete coverage
- Detect all changes
- Simple implementation

Disadvantages:
- Expensive (100B pages)
- Slow (weeks to complete)
- Wasted bandwidth (90% unchanged)

Why not alone: Too expensive and slow
```

**Incremental Crawl**:
```
Advantages:
- Fast updates (hours)
- Efficient (10% of pages)
- Lower cost (90% savings)

Disadvantages:
- May miss changes
- Complex change detection
- Requires baseline

Why not alone: Needs initial full crawl
```

**Hybrid Approach**:
```
Implementation:
- Full crawl: Monthly
- Incremental: Daily
- Real-time: For news (5-minute cycle)

Benefits:
- Complete coverage from full crawl
- Fast updates from incremental
- Fresh news from real-time
- Cost-effective
```

### Inverted Index vs Forward Index

**Chosen: Both (Inverted for search, Forward for snippets)**

**Inverted Index**:
```
Structure: Term → [Documents]
Use: Fast term lookup
Advantages:
- O(1) term lookup
- Efficient for search
- Compact storage

Disadvantages:
- Can't reconstruct document
- No document-level operations
```

**Forward Index**:
```
Structure: Document → [Terms]
Use: Generate snippets, summaries
Advantages:
- Document reconstruction
- Snippet generation
- Content analysis

Disadvantages:
- Slower for search
- Larger storage
```

**Why Both**:
```
Inverted Index: Search queries
Forward Index: Result presentation
Combined: Fast search + rich results
Cost: 2x storage, worth it for UX
```

## Ranking Tradeoffs

### Simple vs ML-Based Ranking

**Chosen: Hybrid (Simple + ML)**

**Simple Ranking (BM25)**:
```
Advantages:
- Fast (<10ms)
- Interpretable
- No training needed
- Consistent results

Disadvantages:
- Limited signals
- No personalization
- Can't learn from data
```

**ML-Based Ranking**:
```
Advantages:
- 200+ signals
- Learns from clicks
- Personalization
- Better quality

Disadvantages:
- Slow (50-100ms)
- Black box
- Requires training data
- Can overfit
```

**Hybrid Approach**:
```
Pipeline:
1. BM25 initial ranking (10,000 docs)
2. ML re-ranking (top 100 docs)
3. Personalization (top 20 docs)

Benefits:
- Fast (BM25 for bulk)
- Quality (ML for top results)
- Best of both worlds
```

### Freshness vs Authority

**Chosen: Query-Dependent Balance**

**Freshness-First**:
```
Use Cases:
- News queries
- Trending topics
- Time-sensitive info

Advantages:
- Recent content
- Breaking news
- Current information

Disadvantages:
- May miss authoritative sources
- Spam vulnerability
- Quality concerns
```

**Authority-First**:
```
Use Cases:
- Evergreen content
- Educational queries
- Reference information

Advantages:
- High-quality sources
- Trusted information
- Spam resistant

Disadvantages:
- May be outdated
- Miss recent developments
- Favor established sites
```

**Adaptive Approach**:
```
Query Classification:
- News query → 70% freshness, 30% authority
- Evergreen query → 30% freshness, 70% authority
- Mixed query → 50% freshness, 50% authority

Implementation:
score = (freshness × fresh_weight) + 
        (authority × auth_weight)

Benefits: Optimal for each query type
```

## Caching Tradeoffs

### Cache Everything vs Selective Caching

**Chosen: Selective Caching**

**Cache Everything**:
```
Advantages:
- Maximum hit rate
- Simple logic
- Consistent performance

Disadvantages:
- Huge memory (100 PB)
- Stale results
- Wasted space (long-tail queries)

Why not: Cost prohibitive
```

**Selective Caching**:
```
Strategy:
- Cache top 1% queries (30% of traffic)
- Cache by popularity
- Short TTL (5 minutes)

Advantages:
- Cost-effective (1 TB vs 100 PB)
- Fresh results
- High hit rate for popular queries

Disadvantages:
- Cache misses for long-tail
- Complex eviction logic
```

## Crawling Tradeoffs

### Breadth-First vs Depth-First Crawling

**Chosen: Prioritized Breadth-First**

**Breadth-First**:
```
Advantages:
- Discover popular pages first
- Even coverage
- Natural priority

Disadvantages:
- May miss deep content
- Slow to reach specific pages
```

**Depth-First**:
```
Advantages:
- Complete site coverage
- Find deep content
- Good for small sites

Disadvantages:
- May get stuck in deep sites
- Miss other important pages
- Uneven coverage
```

**Prioritized Breadth-First**:
```
Implementation:
1. Assign priority to each URL
2. Crawl high-priority URLs first
3. Breadth-first within priority level

Priority Factors:
- PageRank (40%)
- Freshness need (30%)
- Link count (20%)
- User interest (10%)

Benefits: Best of both approaches
```

### Politeness vs Speed

**Chosen: Adaptive Politeness**

**Aggressive Crawling**:
```
Advantages:
- Fast crawl completion
- Fresh index
- Complete coverage

Disadvantages:
- Overload sites
- Get blocked
- Ethical concerns

Why not: Damages relationships
```

**Conservative Crawling**:
```
Advantages:
- Respectful
- No blocking
- Good relationships

Disadvantages:
- Slow crawl
- Stale index
- Incomplete coverage

Why not: Too slow for scale
```

**Adaptive Politeness**:
```
Strategy:
- Popular sites: 1-second delay
- Medium sites: 5-second delay
- Small sites: 10-second delay
- Adjust based on server response

Benefits:
- Fast for capable sites
- Respectful to small sites
- Optimal balance
```

## Storage Tradeoffs

### Replication vs Erasure Coding

**Chosen: Hybrid (Replication for hot, Erasure for cold)**

**Replication (3x)**:
```
Advantages:
- Fast reads (any replica)
- Simple recovery
- High availability

Disadvantages:
- 3x storage cost
- Expensive at scale

Use: Hot data (20% of index)
```

**Erasure Coding (1.5x)**:
```
Advantages:
- 50% storage savings
- Same durability
- Cost-effective

Disadvantages:
- Slower reads (reconstruct)
- Complex recovery
- Higher CPU

Use: Cold data (80% of index)
```

**Hybrid Approach**:
```
Hot Tier: 3x replication (20 PB × 3 = 60 PB)
Cold Tier: 1.5x erasure coding (80 PB × 1.5 = 120 PB)
Total: 180 PB vs 300 PB (40% savings)

Benefits: Performance + cost optimization
```

## Query Processing Tradeoffs

### Exact vs Approximate Results

**Chosen: Exact for top results, Approximate for counts**

**Exact Results**:
```
Advantages:
- Accurate
- Reproducible
- Trustworthy

Disadvantages:
- Slow (query all shards)
- Expensive
- May timeout

Use: Top 100 results
```

**Approximate Results**:
```
Advantages:
- Fast (sample shards)
- Scalable
- Good enough

Disadvantages:
- Inaccurate
- Varies per query
- May miss results

Use: Result counts, "About 45,000,000 results"
```

**Hybrid Approach**:
```
Top Results: Exact (query all shards)
Result Count: Approximate (sample 10% of shards, extrapolate)
Deep Pages: Approximate (beyond page 10)

Benefits: Accuracy where it matters, speed elsewhere
```

### Synchronous vs Asynchronous Indexing

**Chosen: Asynchronous with Real-time for News**

**Synchronous**:
```
Advantages:
- Immediate visibility
- Consistent state
- Simple logic

Disadvantages:
- Slow crawling
- Blocks on index updates
- Poor throughput

Why not: Can't scale to 40K pages/second
```

**Asynchronous**:
```
Advantages:
- Fast crawling
- High throughput
- Decoupled systems

Disadvantages:
- Delayed visibility (hours)
- Eventual consistency
- Complex coordination

Use: Regular content (24-hour delay OK)
```

**Real-time for News**:
```
Implementation:
- Separate fast-crawl pipeline
- 5-minute crawl cycle
- Incremental index updates
- Visible in <10 minutes

Use: News sites, trending topics

Benefits: Fresh news + scalable regular crawling
```

## Personalization Tradeoffs

### Heavy vs Light Personalization

**Chosen: Light Personalization**

**Heavy Personalization**:
```
Advantages:
- Highly relevant
- User-specific
- Better engagement

Disadvantages:
- Filter bubble
- Privacy concerns
- Can't cache results
- Slower queries

Why not: Privacy and performance concerns
```

**Light Personalization**:
```
Implementation:
- Location-based (city-level)
- Language preference
- Safe search setting
- No search history

Advantages:
- Privacy-friendly
- Cacheable
- Fast
- Transparent

Disadvantages:
- Less personalized
- Generic results

Benefits: Balance relevance and privacy
```

This comprehensive tradeoff analysis demonstrates the complex decision-making required to build a global search engine that balances quality, performance, cost, and user privacy.
