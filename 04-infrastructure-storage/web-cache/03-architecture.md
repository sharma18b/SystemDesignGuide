# Web Cache - System Architecture

## High-Level Architecture

### System Components
```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Browser  │  │  Mobile  │  │   API    │  │   CDN    │       │
│  │ Clients  │  │   Apps   │  │ Clients  │  │  Edge    │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Load Balancer Layer                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Global Load Balancer (GeoDNS, Anycast)                  │  │
│  │  - Geographic routing                                     │  │
│  │  - Health checking                                        │  │
│  │  - DDoS protection                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Cache Layer (L1)                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Cache   │  │  Cache   │  │  Cache   │  │  Cache   │       │
│  │  Node 1  │  │  Node 2  │  │  Node 3  │  │  Node N  │       │
│  │          │  │          │  │          │  │          │       │
│  │ Memory   │  │ Memory   │  │ Memory   │  │ Memory   │       │
│  │  + SSD   │  │  + SSD   │  │  + SSD   │  │  + SSD   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (Cache Miss)
┌─────────────────────────────────────────────────────────────────┐
│                      Origin Layer                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Origin Servers (Web Servers, App Servers, Storage)      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Cache Node Architecture

### Internal Components
```
┌─────────────────────────────────────────────────────────────────┐
│                      Cache Node                                 │
├─────────────────────────────────────────────────────────────────┤
│  Request Handler                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ - HTTP/HTTPS termination                                  │  │
│  │ - Request parsing                                         │  │
│  │ - Cache key generation                                    │  │
│  │ - Header processing                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Cache Lookup Engine                                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ L1: Memory Cache (128GB)                                  │  │
│  │  - Hash table for O(1) lookup                             │  │
│  │  - LRU eviction policy                                    │  │
│  │  - <1ms latency                                           │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ L2: SSD Cache (10TB)                                      │  │
│  │  - B-tree index for fast lookup                           │  │
│  │  - LRU eviction policy                                    │  │
│  │  - <5ms latency                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Origin Fetcher                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ - Connection pooling                                      │  │
│  │ - Request coalescing                                      │  │
│  │ - Circuit breaker                                         │  │
│  │ - Retry logic                                             │  │
│  └──────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Cache Manager                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ - Eviction policy enforcement                             │  │
│  │ - TTL management                                          │  │
│  │ - Invalidation handling                                   │  │
│  │ - Statistics collection                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Request Flow

### Cache Hit Flow
```
1. Client Request
   ↓
2. Load Balancer → Route to nearest cache node
   ↓
3. Cache Node → Parse request, generate cache key
   ↓
4. L1 Memory Cache → Lookup (hit!)
   ↓
5. Validate freshness (TTL, ETag)
   ↓
6. Return cached response to client
   
Total Time: <1ms
```

### Cache Miss Flow
```
1. Client Request
   ↓
2. Load Balancer → Route to nearest cache node
   ↓
3. Cache Node → Parse request, generate cache key
   ↓
4. L1 Memory Cache → Lookup (miss)
   ↓
5. L2 SSD Cache → Lookup (miss)
   ↓
6. Origin Fetcher → Request coalescing check
   ↓
7. Fetch from origin server
   ↓
8. Store in L2 SSD Cache
   ↓
9. Store in L1 Memory Cache
   ↓
10. Return response to client
   
Total Time: <100ms
```

### Conditional Request Flow
```
1. Client Request with If-Modified-Since header
   ↓
2. Cache Lookup → Found cached content
   ↓
3. Compare timestamps
   ↓
4. If not modified:
   - Return 304 Not Modified
   - No body transfer
   ↓
5. If modified:
   - Fetch fresh content from origin
   - Update cache
   - Return 200 OK with new content
```

## Cache Key Generation

### Cache Key Components
```
Cache Key = hash(
  scheme +          // http or https
  host +            // www.example.com
  port +            // 80, 443
  path +            // /api/users
  query_string +    // ?id=123&sort=name
  vary_headers      // Accept-Encoding, Accept-Language
)

Examples:
1. Simple: "GET:example.com:/index.html"
2. With query: "GET:example.com:/api/users?id=123"
3. With vary: "GET:example.com:/page.html:gzip:en-US"
4. Custom: "GET:example.com:/api/data:user_id=456"
```

### Vary Header Handling
```
Response Headers:
  Vary: Accept-Encoding, Accept-Language

Cache Keys Generated:
  - "GET:example.com:/page:gzip:en-US"
  - "GET:example.com:/page:gzip:es-ES"
  - "GET:example.com:/page:identity:en-US"
  - "GET:example.com:/page:identity:es-ES"

Each combination cached separately
```

## Eviction Policies

### LRU (Least Recently Used)
```
Implementation:
- Hash table for O(1) lookup
- Doubly linked list for O(1) eviction
- Move to head on access
- Evict from tail when full

Pros: Simple, effective for most workloads
Cons: One-time access can evict useful data
```

### LFU (Least Frequently Used)
```
Implementation:
- Track access frequency per item
- Min-heap for O(log n) eviction
- Evict least frequently accessed

Pros: Better for skewed access patterns
Cons: Higher overhead, slow to adapt
```

### TTL-Based Eviction
```
Implementation:
- Store expiration timestamp
- Background thread scans for expired items
- Lazy eviction on access

Pros: Respects cache-control headers
Cons: May keep stale data longer
```

## Cache Invalidation

### Invalidation Methods
```
1. TTL Expiration:
   - Automatic expiration after TTL
   - Lazy deletion on access
   - Background cleanup

2. Explicit Purge:
   - Purge specific URL
   - Purge by pattern/wildcard
   - Purge by tag
   - Purge all

3. Conditional Invalidation:
   - If-Modified-Since validation
   - ETag validation
   - Stale-while-revalidate

4. Event-Based:
   - Webhook triggers
   - Message queue events
   - Database change streams
```

### Invalidation Propagation
```
┌─────────────┐
│ Invalidation│
│   Request   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Invalidation   │
│   Coordinator   │
└──────┬──────────┘
       │
       ├──────────────┬──────────────┬──────────────┐
       ▼              ▼              ▼              ▼
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Cache    │   │ Cache    │   │ Cache    │   │ Cache    │
│ Node 1   │   │ Node 2   │   │ Node 3   │   │ Node N   │
└──────────┘   └──────────┘   └──────────┘   └──────────┘

Propagation Time: <1 second
```

## Cache Stampede Prevention

### Request Coalescing
```
Scenario: 1000 concurrent requests for same uncached URL

Without Coalescing:
- 1000 requests to origin
- Origin overload
- High latency

With Coalescing:
1. First request → Fetch from origin
2. Subsequent 999 requests → Wait for first
3. All 1000 requests served from single origin fetch

Implementation:
- Lock on cache key
- First request fetches
- Others wait on lock
- Broadcast result to all waiters
```

### Stale-While-Revalidate
```
Cache-Control: max-age=3600, stale-while-revalidate=86400

Behavior:
- Content fresh for 1 hour
- After 1 hour, serve stale content
- Async refresh in background
- Next request gets fresh content

Benefits:
- No user-facing latency
- Origin load spread over time
- Always serve fast responses
```

## Compression and Content Encoding

### Compression Support
```
Supported Algorithms:
- Gzip: Good compression, wide support
- Brotli: Better compression, modern browsers
- Deflate: Legacy support

Compression Strategy:
1. Check Accept-Encoding header
2. Serve pre-compressed if available
3. Compress on-the-fly if needed
4. Cache both compressed and uncompressed

Storage:
- Store compressed version
- Decompress if client doesn't support
- Trade-off: CPU vs storage
```

## Monitoring and Observability

### Key Metrics
```
Performance:
- Cache hit rate (%)
- P50, P95, P99 latency
- Requests per second
- Bandwidth (in/out)

Resource:
- CPU utilization
- Memory usage
- Disk usage
- Network bandwidth

Cache:
- Cache size (items, bytes)
- Eviction rate
- Invalidation rate
- Miss rate by reason

Origin:
- Origin requests
- Origin latency
- Origin errors
- Origin bandwidth
```

This architecture provides a comprehensive foundation for building a high-performance, scalable distributed web caching system.
