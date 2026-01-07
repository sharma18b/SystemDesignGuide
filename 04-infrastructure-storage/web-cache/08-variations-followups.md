# Web Cache - Variations and Follow-up Questions

## Common Variations

### 1. CDN (Content Delivery Network)
**Key Differences:**
- Global edge locations (100+ POPs)
- GeoDNS routing to nearest edge
- Origin shield for protection
- DDoS mitigation
- SSL/TLS termination at edge

**Additional Features:**
- Image optimization
- Video streaming
- Real-time purging
- Analytics and reporting
- WAF (Web Application Firewall)

### 2. API Gateway Cache
**Key Differences:**
- Cache API responses (JSON/XML)
- Shorter TTLs (seconds to minutes)
- Cache key includes auth tokens
- Rate limiting integration
- Request/response transformation

**Challenges:**
- Personalized responses
- Authentication handling
- Cache invalidation on data changes
- Versioning support

### 3. Browser Cache
**Key Differences:**
- Client-side caching
- Limited storage (50-100MB)
- Cache-Control headers
- Service Workers for offline
- IndexedDB for structured data

**Considerations:**
- Privacy (no sensitive data)
- Storage limits
- Cache eviction by browser
- HTTPS requirement for Service Workers

### 4. Database Query Cache
**Key Differences:**
- Cache query results
- Invalidate on data changes
- Cache key = query + parameters
- Shorter TTLs (seconds)
- Integration with ORM

**Challenges:**
- Complex invalidation logic
- Join query caching
- Transaction handling
- Consistency guarantees

## Interview Follow-up Questions

### Q: How do you handle cache stampede?
**Answer:**
1. Request coalescing (single origin fetch)
2. Stale-while-revalidate (serve stale, refresh async)
3. Probabilistic early expiration
4. Cache locking mechanism

### Q: How do you invalidate cache across multiple nodes?
**Answer:**
1. Pub/sub for invalidation events
2. Broadcast to all nodes
3. Eventual consistency (<1s)
4. Retry failed invalidations
5. Audit log for tracking

### Q: How do you handle personalized content?
**Answer:**
1. Include user ID in cache key
2. Cache common parts, personalize on edge
3. ESI (Edge Side Includes) for fragments
4. Vary header for different versions
5. Short TTL for personalized content

### Q: What happens when origin is down?
**Answer:**
1. Serve stale content (stale-if-error)
2. Extended TTL during outage
3. Circuit breaker to stop origin requests
4. Fallback to backup origin
5. Error page if no stale content

### Q: How do you measure cache effectiveness?
**Answer:**
1. Hit rate (hits / total requests)
2. Byte hit rate (bytes served from cache)
3. Origin offload percentage
4. Latency improvement
5. Cost savings

### Q: How do you handle cache poisoning?
**Answer:**
1. Validate origin responses
2. Sanitize cache keys
3. Limit cache key length
4. Ignore suspicious headers
5. Rate limit cache writes
6. Monitor for anomalies

### Q: How do you optimize for mobile clients?
**Answer:**
1. Adaptive compression (lower quality)
2. Image resizing and optimization
3. Smaller cache entries
4. Longer TTLs (limited bandwidth)
5. Service Workers for offline

### Q: How do you handle large files (videos)?
**Answer:**
1. Range request support
2. Chunked transfer encoding
3. Progressive caching
4. Separate storage tier
5. Streaming optimization

This guide covers common variations and helps prepare for deep-dive questions in interviews.
