# API Rate Limiter - Trade-offs and Alternatives

## Algorithm Trade-offs

### Token Bucket vs Leaky Bucket
```
Token Bucket:
Pros:
✓ Allows bursts (good UX)
✓ Simple implementation
✓ Low memory usage
✓ Fast decision making

Cons:
✗ Can allow sudden spikes
✗ Harder to predict output rate
✗ May overwhelm downstream

Use Cases:
- API rate limiting
- User-facing applications
- Bursty workloads

Leaky Bucket:
Pros:
✓ Smooth output rate
✓ Predictable traffic
✓ Protects downstream
✓ Good for traffic shaping

Cons:
✗ No burst allowance
✗ Poor user experience
✗ Requests queued/delayed
✗ Higher latency

Use Cases:
- Network traffic shaping
- Background job processing
- Downstream protection

Recommendation: Token Bucket for APIs
```

### Fixed Window vs Sliding Window
```
Fixed Window:
Pros:
✓ Simple implementation
✓ Low memory (single counter)
✓ Fast performance
✓ Easy to understand

Cons:
✗ Boundary problem (2x burst)
✗ Less accurate
✗ Unfair at boundaries

Example Boundary Issue:
Window: 10:00:00 - 10:00:59
Limit: 100 requests

10:00:59 → 100 requests (allowed)
10:01:00 → 100 requests (new window, allowed)
Total: 200 requests in 2 seconds!

Sliding Window:
Pros:
✓ No boundary issues
✓ More accurate
✓ Fair distribution
✓ Better user experience

Cons:
✗ More complex
✗ Higher memory usage
✗ Slightly slower

Sliding Window Log:
✓ Most accurate
✗ Highest memory (store all timestamps)
✗ O(n) time complexity

Sliding Window Counter:
✓ Good accuracy (99%)
✓ Low memory (2 counters)
✓ O(1) time complexity

Recommendation: Sliding Window Counter
```

## Distributed vs Centralized

### Centralized Counter (Redis)
```
Architecture:
All servers → Single Redis cluster

Pros:
✓ Accurate counting (100%)
✓ Strong consistency
✓ Simple implementation
✓ Easy to reason about

Cons:
✗ Single point of failure
✗ Network latency (2-5ms)
✗ Redis becomes bottleneck
✗ Cross-region latency high

Performance:
- Latency: 2-5ms per request
- Throughput: 100K ops/sec per Redis node
- Accuracy: 100%

Cost:
- Redis cluster: $5K/month
- Network: $2K/month
- Total: $7K/month

Best For:
- Small to medium scale (<100K req/s)
- Strong consistency required
- Single region deployment
```

### Distributed Counter (Local + Sync)
```
Architecture:
Each server maintains local counters
Background sync to global store

Pros:
✓ Low latency (<1ms)
✓ High throughput (millions/sec)
✓ No single point of failure
✓ Scales horizontally

Cons:
✗ Eventually consistent
✗ Less accurate (95-99%)
✗ Complex implementation
✗ Race conditions possible

Performance:
- Latency: <1ms per request
- Throughput: Unlimited (local)
- Accuracy: 95-99%

Cost:
- No central bottleneck
- Lower network costs
- Total: $3K/month

Best For:
- Large scale (>1M req/s)
- Eventual consistency acceptable
- Multi-region deployment
```

### Hybrid Approach (Recommended)
```
Strategy:
- Local cache for hot paths (95% of requests)
- Redis for accuracy checks (5% of requests)
- Background sync every 1 second

Algorithm:
1. Check local counter (fast path)
2. If < 80% of limit → Allow (local only)
3. If 80-100% of limit → Check Redis (accurate)
4. If > 100% → Deny
5. Sync local to Redis every 1s

Benefits:
✓ Low latency (1ms for 95% of requests)
✓ High accuracy (99%+)
✓ Scales well
✓ Cost effective

Trade-offs:
- 1-5% over-limit requests possible
- More complex implementation
- Requires careful tuning
```

## Consistency Models

### Strong Consistency
```
Implementation:
- All requests check central Redis
- Distributed locks for updates
- Synchronous replication

Pros:
✓ 100% accurate
✓ No over-limit requests
✓ Predictable behavior

Cons:
✗ High latency (5-10ms)
✗ Lower throughput
✗ Single point of failure
✗ Expensive

Use Cases:
- Financial transactions
- Critical rate limits
- Compliance requirements

Cost: 2x infrastructure
```

### Eventual Consistency
```
Implementation:
- Local counters per server
- Async sync to global store
- Periodic reconciliation

Pros:
✓ Low latency (<1ms)
✓ High throughput
✓ Scales horizontally
✓ Cost effective

Cons:
✗ 1-5% over-limit possible
✗ Harder to debug
✗ Complex reconciliation

Use Cases:
- High-scale APIs
- Non-critical limits
- User-facing applications

Cost: 0.5x infrastructure
```

### Causal Consistency (Middle Ground)
```
Implementation:
- Track causality with vector clocks
- Ensure related requests ordered
- Allow concurrent unrelated requests

Pros:
✓ Better than eventual
✓ Preserves causality
✓ Good performance

Cons:
✗ Complex implementation
✗ Higher overhead
✗ Still not 100% accurate

Use Cases:
- Multi-user scenarios
- Collaborative applications
- Session-based limits
```

## Fail-Open vs Fail-Closed

### Fail-Open (Allow on Failure)
```
Behavior:
If rate limiter fails → Allow all requests

Pros:
✓ Better availability
✓ No false positives
✓ Better user experience
✓ Prevents cascading failures

Cons:
✗ Potential abuse during outage
✗ Backend overload risk
✗ Security concerns

Configuration:
rate_limiter:
  fail_mode: "open"
  fallback_limit: 10000  # Emergency limit

Use Cases:
- User-facing APIs
- High availability requirements
- Trusted user base
```

### Fail-Closed (Deny on Failure)
```
Behavior:
If rate limiter fails → Deny all requests

Pros:
✓ Protects backend
✓ Prevents abuse
✓ Better security
✓ Predictable behavior

Cons:
✗ Poor availability
✗ False positives
✗ Bad user experience
✗ Revenue loss

Configuration:
rate_limiter:
  fail_mode: "closed"
  error_message: "Service temporarily unavailable"

Use Cases:
- Critical infrastructure
- Security-sensitive APIs
- Untrusted user base
```

### Hybrid Approach (Recommended)
```
Strategy:
- Fail-open for trusted users
- Fail-closed for untrusted users
- Degraded mode with higher limits

Implementation:
if rate_limiter_unavailable:
    if user.tier in ['premium', 'enterprise']:
        return allow_with_degraded_limit(10000)
    elif user.trust_score > 0.8:
        return allow_with_degraded_limit(1000)
    else:
        return deny_with_retry_after(60)

Benefits:
✓ Balanced approach
✓ Protects revenue
✓ Maintains security
✓ Better UX for good users
```

## Storage Technology Choices

### Redis vs Memcached
```
Redis:
Pros:
✓ Rich data structures (sorted sets, hashes)
✓ Persistence (RDB, AOF)
✓ Replication and clustering
✓ Lua scripting (atomic operations)
✓ Pub/sub support

Cons:
✗ Higher memory usage
✗ More complex
✗ Slightly slower for simple ops

Memcached:
Pros:
✓ Faster for simple key-value
✓ Lower memory overhead
✓ Simpler architecture
✓ Multi-threaded

Cons:
✗ No persistence
✗ Limited data structures
✗ No scripting
✗ Basic replication

Recommendation: Redis
- Lua scripts for atomic operations
- Persistence for reliability
- Rich data structures for algorithms
```

### SQL vs NoSQL for Configuration
```
PostgreSQL (SQL):
Pros:
✓ ACID transactions
✓ Complex queries
✓ Strong consistency
✓ Mature ecosystem

Cons:
✗ Harder to scale horizontally
✗ Schema migrations
✗ Higher latency for reads

Use For:
- Rate limit rules
- User quotas
- Audit logs

MongoDB (NoSQL):
Pros:
✓ Flexible schema
✓ Horizontal scaling
✓ Fast reads
✓ JSON-native

Cons:
✗ Weaker consistency
✗ Complex transactions
✗ Higher storage overhead

Use For:
- Metrics and analytics
- Event logs
- Unstructured data

Recommendation: PostgreSQL for config, InfluxDB for metrics
```

## Rate Limiting Placement

### API Gateway vs Application Level
```
API Gateway:
Pros:
✓ Centralized enforcement
✓ Consistent across services
✓ Offload from applications
✓ Easy to update

Cons:
✗ Single point of failure
✗ Limited context
✗ Higher latency
✗ Coarse-grained

Application Level:
Pros:
✓ Fine-grained control
✓ Business logic aware
✓ Lower latency
✓ Flexible rules

Cons:
✗ Duplicate implementation
✗ Inconsistent enforcement
✗ Harder to update
✗ More complexity

Recommendation: Both
- Gateway: Coarse limits (DDoS protection)
- Application: Fine-grained limits (business logic)
```

### Edge vs Origin
```
Edge (CDN):
Pros:
✓ Lowest latency
✓ Offload origin
✓ Global distribution
✓ DDoS protection

Cons:
✗ Limited context
✗ Eventual consistency
✗ Higher cost
✗ Less flexible

Origin (Application):
Pros:
✓ Full context
✓ Accurate counting
✓ Flexible rules
✓ Lower cost

Cons:
✗ Higher latency
✗ More load on origin
✗ Single region

Recommendation: Multi-layer
- Edge: Basic limits (IP-based)
- Origin: Advanced limits (user/API key)
```

## Cost vs Accuracy Trade-offs

### High Accuracy (99.9%+)
```
Implementation:
- Centralized Redis
- Strong consistency
- Synchronous updates

Cost: $15K/month
Latency: 5ms
Throughput: 100K req/s

Use When:
- Financial APIs
- Compliance requirements
- Critical limits
```

### Balanced (99%+)
```
Implementation:
- Hybrid (local + Redis)
- Eventual consistency
- Async sync

Cost: $7K/month
Latency: 2ms
Throughput: 1M req/s

Use When:
- Most production APIs
- Good balance
- Recommended default
```

### High Performance (95%+)
```
Implementation:
- Local counters only
- Periodic sync
- Best effort

Cost: $3K/month
Latency: <1ms
Throughput: 10M req/s

Use When:
- High-scale APIs
- Non-critical limits
- Cost-sensitive
```

This analysis helps make informed decisions based on specific requirements, constraints, and priorities.
