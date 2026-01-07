# API Rate Limiter - System Architecture

## High-Level Architecture Overview

### System Architecture Principles
- **Distributed Design**: Rate limiting enforced across multiple servers
- **Low Latency**: <5ms overhead for rate limit decisions
- **High Availability**: 99.99% uptime with fault tolerance
- **Horizontal Scalability**: Linear scaling with traffic growth
- **Eventual Consistency**: Balance accuracy with performance
- **Fail-Safe Design**: Configurable fail-open or fail-closed behavior

### Core Architecture Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Clients   │    │   Web Apps      │    │   Mobile Apps   │
│                 │    │                 │    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │     Load Balancer         │
                    │   (Geographic Routing)    │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │   Rate Limiter Gateway    │
                    │  (Request Interception)   │
                    └─────────────┬─────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                       │                        │
┌───────┴────────┐    ┌─────────┴─────────┐    ┌────────┴────────┐
│  Rate Limit    │    │   Configuration   │    │   Metrics &     │
│  Engine        │    │   Service         │    │   Analytics     │
└───────┬────────┘    └─────────┬─────────┘    └────────┬────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   Data Layer        │
                    │ (Redis + Database)  │
                    └─────────────────────┘
```

## Rate Limiting Gateway

### Request Interception Flow
```
Client Request
      │
      ▼
┌─────────────────┐
│ Extract         │
│ Identifiers     │  ← User ID, IP, API Key, Endpoint
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Fetch Rate      │
│ Limit Rules     │  ← Configuration Service
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check Counter   │
│ (Redis)         │  ← Current usage
└────────┬────────┘
         │
         ├─── Within Limit ───→ Allow Request ───→ Increment Counter
         │
         └─── Exceeded Limit ──→ Reject Request ──→ Return 429
```

### Gateway Components
- **Request Parser**: Extract rate limiting identifiers from requests
- **Rule Matcher**: Match request to applicable rate limiting rules
- **Counter Manager**: Check and update rate limit counters
- **Response Handler**: Add rate limit headers, return 429 when exceeded
- **Metrics Collector**: Track rate limiting decisions and patterns
- **Cache Manager**: Local cache for hot rules and counters

## Rate Limiting Algorithms Implementation

### Token Bucket Algorithm
```
┌─────────────────────────────────────────────────────────┐
│                    Token Bucket                         │
├─────────────────────────────────────────────────────────┤
│  Capacity: 100 tokens                                   │
│  Refill Rate: 10 tokens/second                          │
│  Current Tokens: 75                                     │
│                                                         │
│  Algorithm:                                             │
│  1. Calculate tokens to add since last refill           │
│  2. Add tokens (up to capacity)                         │
│  3. Check if enough tokens for request                  │
│  4. If yes: consume tokens, allow request               │
│  5. If no: reject request with retry-after              │
└─────────────────────────────────────────────────────────┘

Redis Data Structure:
{
  "user:12345:tokens": 75,
  "user:12345:last_refill": 1704723600,
  "user:12345:capacity": 100,
  "user:12345:refill_rate": 10
}
```

### Sliding Window Counter Algorithm
```
┌─────────────────────────────────────────────────────────┐
│              Sliding Window Counter                     │
├─────────────────────────────────────────────────────────┤
│  Window Size: 1 hour                                    │
│  Limit: 1000 requests                                   │
│                                                         │
│  Previous Window (10:00-11:00): 800 requests            │
│  Current Window (11:00-12:00): 300 requests             │
│  Current Time: 11:30 (50% into current window)          │
│                                                         │
│  Weighted Count:                                        │
│  = (Previous × (1 - 0.5)) + Current                     │
│  = (800 × 0.5) + 300 = 700 requests                     │
│                                                         │
│  Decision: 700 < 1000 → Allow Request                   │
└─────────────────────────────────────────────────────────┘

Redis Data Structure:
{
  "user:12345:window:current": 300,
  "user:12345:window:previous": 800,
  "user:12345:window:start": 1704722400
}
```

### Fixed Window Counter Algorithm
```
┌─────────────────────────────────────────────────────────┐
│               Fixed Window Counter                      │
├─────────────────────────────────────────────────────────┤
│  Window: 11:00:00 - 11:00:59 (1 minute)                 │
│  Limit: 100 requests                                    │
│  Current Count: 87 requests                             │
│                                                         │
│  Algorithm:                                             │
│  1. Calculate current window (truncate timestamp)       │
│  2. Increment counter for current window                │
│  3. Check if count exceeds limit                        │
│  4. If yes: reject, if no: allow                        │
│                                                         │
│  Boundary Issue: Burst at window edges                  │
│  11:00:59 → 60 requests                                 │
│  11:01:00 → 60 requests (new window)                    │
│  Total: 120 requests in 2 seconds (exceeds limit)       │
└─────────────────────────────────────────────────────────┘

Redis Data Structure:
{
  "user:12345:window:1704722400": 87,
  "TTL": 120  // Auto-expire after 2 windows
}
```

### Sliding Window Log Algorithm
```
┌─────────────────────────────────────────────────────────┐
│              Sliding Window Log                         │
├─────────────────────────────────────────────────────────┤
│  Window Size: 1 hour                                    │
│  Limit: 1000 requests                                   │
│                                                         │
│  Request Log (timestamps):                              │
│  [1704720000, 1704720015, 1704720030, ...]              │
│                                                         │
│  Algorithm:                                             │
│  1. Remove timestamps older than window                 │
│  2. Count remaining timestamps                          │
│  3. Check if count < limit                              │
│  4. If yes: add new timestamp, allow                    │
│  5. If no: reject request                               │
│                                                         │
│  Pros: Most accurate, no boundary issues                │
│  Cons: High memory usage (store all timestamps)         │
└─────────────────────────────────────────────────────────┘

Redis Data Structure (Sorted Set):
ZADD user:12345:requests 1704720000 "req1"
ZADD user:12345:requests 1704720015 "req2"
ZREMRANGEBYSCORE user:12345:requests 0 (now - 3600)
ZCARD user:12345:requests  // Get count
```

## Distributed Rate Limiting Architecture

### Centralized Counter Approach
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Rate Limiter   │    │  Rate Limiter   │    │  Rate Limiter   │
│   Server 1      │    │   Server 2      │    │   Server 3      │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   Redis Cluster     │
                    │  (Centralized       │
                    │   Counters)         │
                    └─────────────────────┘

Pros:
- Accurate counting across all servers
- Simple implementation
- Strong consistency

Cons:
- Single point of failure (mitigated by Redis cluster)
- Network latency for every request
- Redis becomes bottleneck at high scale
```

### Local Counter with Synchronization
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Rate Limiter 1 │    │  Rate Limiter 2 │    │  Rate Limiter 3 │
│  Local Counter  │    │  Local Counter  │    │  Local Counter  │
│  Quota: 333/s   │    │  Quota: 333/s   │    │  Quota: 334/s   │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   Sync Service      │
                    │  (Periodic Sync)    │
                    └─────────────────────┘

Pros:
- Low latency (local checks)
- No single point of failure
- Scales horizontally

Cons:
- Less accurate (eventual consistency)
- Complex quota distribution
- Potential for over-limit requests during sync
```

### Hybrid Approach (Recommended)
```
┌─────────────────────────────────────────────────────────┐
│                  Rate Limiter Server                    │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐         ┌──────────────┐             │
│  │ Local Cache  │         │ Rate Limit   │             │
│  │ (Hot Rules)  │◄────────┤ Engine       │             │
│  └──────────────┘         └──────┬───────┘             │
│                                  │                     │
│  ┌──────────────┐                │                     │
│  │ Local Counter│◄───────────────┘                     │
│  │ (Fast Path)  │                                      │
│  └──────┬───────┘                                      │
│         │                                              │
│         ▼                                              │
│  ┌──────────────┐                                      │
│  │ Sync Manager │──────────────────────┐               │
│  │ (Background) │                      │               │
│  └──────────────┘                      │               │
└─────────────────────────────────────────┼───────────────┘
                                         │
                              ┌──────────┴──────────┐
                              │   Redis Cluster     │
                              │  (Global Counters)  │
                              └─────────────────────┘

Strategy:
1. Check local counter first (fast path)
2. If approaching limit, check Redis (accurate)
3. Sync local counters to Redis every 1 second
4. Use Redis for cross-server coordination
5. Fail to Redis on local cache miss
```

## Configuration Service Architecture

### Rule Management System
```
┌─────────────────────────────────────────────────────────┐
│              Configuration Service                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │ Rule Engine  │    │ Rule Store   │    │ Rule     │  │
│  │              │◄───┤ (Database)   │◄───┤ Validator│  │
│  └──────┬───────┘    └──────────────┘    └──────────┘  │
│         │                                               │
│         ▼                                               │
│  ┌──────────────┐    ┌──────────────┐                  │
│  │ Rule Cache   │    │ Change       │                  │
│  │ (Redis)      │◄───┤ Propagation  │                  │
│  └──────────────┘    └──────────────┘                  │
│                                                         │
└─────────────────────────────────────────────────────────┘

Rule Structure:
{
  "rule_id": "rl_user_api_v1",
  "priority": 100,
  "conditions": {
    "user_tier": "free",
    "endpoint_pattern": "/api/v1/*"
  },
  "limits": {
    "requests_per_second": 10,
    "requests_per_hour": 1000,
    "burst_size": 20
  },
  "algorithm": "token_bucket",
  "action": "throttle",
  "response": {
    "status": 429,
    "message": "Rate limit exceeded",
    "retry_after": 60
  }
}
```

### Rule Matching and Priority
```
Request: GET /api/v1/users?user_id=12345&api_key=abc123

Rule Matching Process:
1. Extract identifiers: user_id, api_key, endpoint, IP
2. Fetch applicable rules (cached):
   - Global rule: 10000 req/s
   - Endpoint rule: 1000 req/s for /api/v1/*
   - User tier rule: 100 req/s for free tier
   - API key rule: 50 req/s for api_key=abc123
3. Sort by priority (highest first)
4. Apply most restrictive limit
5. Check counter against limit
6. Return decision

Rule Priority:
1. Blocklist (priority 1000) → Immediate reject
2. Allowlist (priority 900) → Bypass rate limiting
3. API Key specific (priority 800)
4. User specific (priority 700)
5. Endpoint specific (priority 600)
6. IP specific (priority 500)
7. Global limits (priority 100)
```

## Metrics and Analytics Architecture

### Real-time Metrics Pipeline
```
┌─────────────────┐
│ Rate Limiter    │
│ Decisions       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Metrics         │    │ Stream          │    │ Time-Series     │
│ Collector       │───→│ Processor       │───→│ Database        │
│                 │    │ (Kafka)         │    │ (InfluxDB)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │ Analytics       │
                                              │ Dashboard       │
                                              │ (Grafana)       │
                                              └─────────────────┘

Metrics Collected:
- Requests per second (by user, endpoint, region)
- Throttled requests (by reason, rule)
- Latency (P50, P95, P99)
- Cache hit rate
- Counter accuracy
- Rule evaluation time
```

### Alerting and Monitoring
```
Alerts:
1. High throttle rate (>10% of requests)
2. Latency spike (P99 >10ms)
3. Cache miss rate (>5%)
4. Redis connection failures
5. Configuration sync delays
6. Unusual traffic patterns (potential attack)

Monitoring Dashboards:
1. Real-time traffic overview
2. Per-user quota utilization
3. Per-endpoint throttle rates
4. System health metrics
5. Cost and capacity planning
```

## Security and Abuse Prevention

### Multi-Layer Defense
```
┌─────────────────────────────────────────────────────────┐
│                  Security Layers                        │
├─────────────────────────────────────────────────────────┤
│  Layer 1: IP Blocklist (DDoS protection)                │
│  Layer 2: API Key Validation                            │
│  Layer 3: Rate Limiting (this system)                   │
│  Layer 4: WAF Rules (SQL injection, XSS)                │
│  Layer 5: Behavioral Analysis (ML-based)                │
└─────────────────────────────────────────────────────────┘

Abuse Detection:
- Rapid requests from single IP
- Distributed attack patterns
- Credential stuffing attempts
- API key sharing detection
- Unusual geographic patterns
```

This architecture provides a robust, scalable, and accurate rate limiting system that can handle massive traffic while maintaining low latency and high availability.
