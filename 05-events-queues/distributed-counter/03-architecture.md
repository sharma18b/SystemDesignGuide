# Distributed Counter - System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Clients                              │
│  (Applications incrementing/reading counters)           │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│              Load Balancer / API Gateway                │
│  (Route requests, rate limiting)                        │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│              Counter Service Cluster                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Server 1 │  │ Server 2 │  │ Server 3 │  ...         │
│  │ Shard 0  │  │ Shard 1  │  │ Shard 2  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│                  Storage Layer                          │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │ Redis Cache  │  │  PostgreSQL  │                    │
│  │ (Hot data)   │  │  (Persistent)│                    │
│  └──────────────┘  └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

## Counter Sharding Strategy

### Consistent Hashing
```
Hash Ring: 0 to 2^32-1

Servers:
- Server 1: hash("server1") = 1000000000
- Server 2: hash("server2") = 2000000000
- Server 3: hash("server3") = 3000000000

Counter Routing:
counter_id = "page_views_article_123"
hash(counter_id) = 1500000000 → Server 2

Benefits:
- Even distribution
- Minimal rebalancing (add/remove servers)
- Virtual nodes for better distribution

Virtual Nodes:
- Each server has 100 virtual nodes
- Better load distribution
- Smoother rebalancing
```

### Sharding Strategies Comparison
```
1. Hash-Based (Recommended):
   ✓ Even distribution
   ✓ Simple implementation
   ✓ Predictable routing
   ✗ No range queries

2. Range-Based:
   ✓ Range queries possible
   ✓ Sequential access
   ✗ Hot spots (recent counters)
   ✗ Uneven distribution

3. Directory-Based:
   ✓ Flexible assignment
   ✓ Easy rebalancing
   ✗ Lookup overhead
   ✗ Directory becomes bottleneck
```

## Counter Storage Models

### 1. Simple Counter (Exact)
```
Data Structure:
{
  "counter_id": "page_views_article_123",
  "value": 1234567,
  "version": 42,
  "updated_at": 1704708000
}

Operations:
INCREMENT:
  value = value + delta
  version = version + 1
  updated_at = now()

GET:
  return value

Pros: Simple, exact, easy to understand
Cons: Contention on hot counters, slower
```

### 2. Sharded Counter (Scalable)
```
Split counter into N shards:

Counter: page_views_article_123
├── Shard 0: 123456
├── Shard 1: 234567
├── Shard 2: 345678
└── Shard 3: 456789

Total: 1,160,490

INCREMENT:
  shard = random(0, N-1)
  shards[shard] += delta

GET:
  total = sum(shards[0..N-1])
  return total

Pros: High throughput, no contention
Cons: Read requires aggregation, eventual consistency
```

### 3. CRDT Counter (Distributed)
```
G-Counter (Grow-only):
{
  "server1": 1000,
  "server2": 2000,
  "server3": 3000
}
Total: 6000

PN-Counter (Positive-Negative):
{
  "positive": {"server1": 1000, "server2": 2000},
  "negative": {"server1": 100, "server2": 200}
}
Total: (1000 + 2000) - (100 + 200) = 2700

Operations:
INCREMENT (server1):
  positive[server1] += delta

DECREMENT (server1):
  negative[server1] += delta

GET:
  return sum(positive) - sum(negative)

MERGE (conflict resolution):
  for each server:
    result[server] = max(local[server], remote[server])

Pros: Eventual consistency, no coordination, partition-tolerant
Cons: Monotonic (G-Counter), memory grows with servers
```

### 4. HyperLogLog (Approximate)
```
For counting unique items (e.g., unique visitors):

Data Structure:
- 16KB memory
- 0.81% standard error
- Billions of unique items

Operations:
ADD(item):
  hash = hash(item)
  register = hash & 0xFFFF
  value = leading_zeros(hash >> 16)
  registers[register] = max(registers[register], value)

COUNT():
  return 2^(average(registers)) × correction_factor

Pros: Constant memory, very fast
Cons: Approximate (±1%), cannot decrement, cannot get exact items
```

## Increment Flow

### Local Increment (Same Server)
```
1. Client sends increment request
   POST /counters/page_views_article_123/increment
   Body: {"delta": 1}

2. Server receives request
   - Hash counter_id to determine shard
   - Check if local server owns shard
   - If yes: proceed locally
   - If no: forward to correct server

3. Update counter in memory (Redis)
   INCRBY page_views_article_123 1

4. Async write to database (batched)
   Buffer updates for 1 second
   Batch write to PostgreSQL

5. Return success to client
   Response: {"value": 1234568, "status": "ok"}

Latency: <1ms
```

### Remote Increment (Different Server)
```
1. Client sends increment to Server 1
2. Server 1 hashes counter_id → Server 2
3. Server 1 forwards request to Server 2
4. Server 2 processes increment
5. Server 2 returns result to Server 1
6. Server 1 returns result to client

Latency: ~2ms (includes network hop)

Optimization: Client-side routing
- Client caches shard mapping
- Sends directly to correct server
- Reduces latency to <1ms
```

## Read Flow

### Point Read
```
GET /counters/page_views_article_123

1. Hash counter_id to find server
2. Read from Redis cache
   GET page_views_article_123

3. If cache miss:
   - Read from database
   - Populate cache
   - Set TTL (60 seconds)

4. Return value to client

Latency: <1ms (cache hit), <10ms (cache miss)
```

### Aggregation Read
```
GET /counters/page_views_article_*/aggregate

1. Fan-out to all servers
2. Each server:
   - Find matching counters
   - Sum values locally
   - Return partial result

3. Coordinator aggregates results
4. Return total to client

Latency: ~10ms (parallel fan-out)
```

## Synchronization Architecture

### Eventual Consistency Model
```
Write Path:
1. Client increments counter on Server 1
2. Server 1 updates local state immediately
3. Server 1 broadcasts update to replicas (async)
4. Replicas apply update when received
5. System converges within 1 second

Conflict Resolution (CRDT):
- Each server maintains vector clock
- Merge function: max(local, remote)
- Commutative and associative
- Guaranteed convergence

Example:
Server 1: counter = 100, vector = {s1: 5, s2: 3}
Server 2: counter = 105, vector = {s1: 4, s2: 4}

Merge:
counter = max(100, 105) = 105
vector = {s1: max(5,4)=5, s2: max(3,4)=4}
```

### Gossip Protocol
```
Every 100ms:
1. Each server picks random peer
2. Exchange counter updates
3. Merge using CRDT rules
4. Update local state

Gossip Message:
{
  "counters": [
    {"id": "counter1", "value": 100, "version": 5},
    {"id": "counter2", "value": 200, "version": 3}
  ],
  "vector_clock": {"s1": 10, "s2": 8, "s3": 12}
}

Convergence:
- O(log N) rounds to reach all servers
- <1 second for 100 servers
```

## Time-Windowed Counters

### Sliding Window Implementation
```
Counter: api_requests_user_123_last_hour

Data Structure:
{
  "buckets": [
    {"timestamp": 1704708000, "count": 100},  // 10:00
    {"timestamp": 1704708060, "count": 150},  // 10:01
    {"timestamp": 1704708120, "count": 200},  // 10:02
    ...
  ],
  "window_size": 3600  // 1 hour
}

INCREMENT:
  current_bucket = floor(now() / 60) * 60
  buckets[current_bucket] += delta
  remove_old_buckets(now() - window_size)

GET:
  cutoff = now() - window_size
  return sum(bucket.count for bucket in buckets if bucket.timestamp >= cutoff)

Storage:
- 60 buckets per hour (1-minute granularity)
- 24 bytes per bucket
- 1.4 KB per counter per hour
```

### Fixed Window Implementation
```
Counter: api_requests_user_123_2024_01_08_10

Simpler but has boundary issues:
- Window: 10:00:00 - 10:59:59
- At 10:59:59: 1000 requests (allowed)
- At 11:00:00: 1000 requests (new window, allowed)
- Total: 2000 requests in 1 second!

Use sliding window for accurate rate limiting
```

## Monitoring and Observability

### Key Metrics
```
Counter Metrics:
- Total counters: 100M
- Hot counters (>1K ops/s): 1M
- Increment rate: 10M ops/s
- Read rate: 1M ops/s
- Cache hit rate: 95%

Performance Metrics:
- Increment latency P50: 0.5ms
- Increment latency P99: 2ms
- Read latency P50: 0.8ms
- Read latency P99: 5ms

Accuracy Metrics:
- Convergence time: 500ms
- Accuracy rate: 99.5%
- Conflict rate: 0.01%
```

This architecture provides a scalable, accurate, and efficient foundation for distributed counting at massive scale.
