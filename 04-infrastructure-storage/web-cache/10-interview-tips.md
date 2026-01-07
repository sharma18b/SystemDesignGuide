# Web Cache - Interview Tips

## Interview Approach

### Initial Questions (5 minutes)
1. **Scale**: How many requests per second?
2. **Content Types**: Static assets, HTML, API responses?
3. **Geographic Distribution**: Single region or global?
4. **Consistency**: How fresh must content be?
5. **Cache Hit Rate**: What's the target hit rate?

### Design Progression

**Step 1: High-Level Architecture (5 min)**
```
Clients → Load Balancer → Cache Nodes → Origin Servers
```

**Step 2: Cache Storage (5 min)**
- Multi-tier: Memory (L1) + SSD (L2)
- Eviction policy: LRU
- TTL-based expiration

**Step 3: Cache Key Generation (5 min)**
- URL + query parameters
- Vary headers (Accept-Encoding, Accept-Language)
- Custom cache keys

**Step 4: Cache Invalidation (5 min)**
- TTL expiration
- Explicit purge (URL, pattern, tag)
- Conditional requests (ETag, If-Modified-Since)

**Step 5: Scaling (5 min)**
- Horizontal scaling (add nodes)
- Geographic distribution
- Load balancing strategies

**Step 6: Failure Handling (5 min)**
- Serve stale on origin failure
- Circuit breaker
- Health checks and failover

## Key Topics to Cover

### Must Cover
- ✅ Cache storage (memory + disk)
- ✅ Cache key generation
- ✅ Eviction policies (LRU)
- ✅ TTL and expiration
- ✅ Cache invalidation

### Should Cover
- ✅ Cache stampede prevention
- ✅ Compression
- ✅ Vary header handling
- ✅ Monitoring and metrics

### Nice to Cover
- ✅ CDN integration
- ✅ Security (cache poisoning)
- ✅ Cost optimization

## Common Pitfalls

❌ **Not discussing cache stampede**
✅ Explain request coalescing and stale-while-revalidate

❌ **Ignoring cache invalidation**
✅ Discuss multiple invalidation strategies

❌ **Forgetting about Vary headers**
✅ Explain how to cache multiple versions

❌ **Not considering origin failures**
✅ Discuss serving stale content

## Talking Points

### Cache Hit Rate
"We target 90%+ hit rate for static content. This is achieved through:
- Appropriate TTLs (longer for static, shorter for dynamic)
- Large cache size (more content cached)
- Cache warming for popular content
- Request coalescing to prevent stampede"

### Cache Stampede
"When cache expires and many requests arrive simultaneously, we use:
- Request coalescing: First request fetches, others wait
- Stale-while-revalidate: Serve stale, refresh async
- Probabilistic early expiration: Refresh before TTL"

### Scaling
"We scale horizontally by adding cache nodes. Each node is stateless,
so no data migration needed. Load balancer distributes requests using
consistent hashing or geographic routing."

## Time Management

### 45-Minute Interview
- 0-5 min: Clarify requirements
- 5-15 min: High-level architecture
- 15-25 min: Deep dive (storage, invalidation)
- 25-35 min: Scaling and failure handling
- 35-40 min: Follow-up questions
- 40-45 min: Wrap-up

## Practice Recommendations

1. **Draw diagrams quickly**: Practice cache architecture diagrams
2. **Know real systems**: Study Varnish, Nginx, CloudFlare
3. **Understand HTTP caching**: Cache-Control, ETag, Vary headers
4. **Practice explaining trade-offs**: Memory vs disk, TTL vs invalidation

This guide helps you approach web cache design interviews with confidence and structure.
