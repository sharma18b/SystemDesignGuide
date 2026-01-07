# Distributed Counter - Variations and Follow-ups

## Common Interview Variations

### 1. Design a Real-Time Analytics Dashboard
**Question**: "How would you design counters for a real-time analytics dashboard showing metrics updated every second?"

**Solution**:
```
Requirements:
- Update frequency: 1 second
- Multiple metrics: 100+ counters
- Historical data: Last 24 hours
- Aggregations: Sum, average, percentiles

Architecture:
1. Time-Series Counter Storage
   - 1-second buckets
   - Rolling window (86,400 buckets for 24h)
   - Automatic expiration

2. Real-Time Aggregation
   - Pre-aggregate every second
   - Store in Redis sorted set
   - Fast range queries

3. WebSocket Updates
   - Push updates to dashboard
   - Batch multiple metrics
   - Reduce network overhead

Implementation:
class RealtimeDashboard {
    void recordMetric(String metric, long value) {
        long timestamp = now();
        long bucket = timestamp / 1000 * 1000;
        
        // Store in time-series
        redis.zadd("metrics:" + metric, bucket, value);
        
        // Remove old data (>24h)
        redis.zremrangebyscore("metrics:" + metric, 
            0, timestamp - 86400000);
        
        // Publish update
        pubsub.publish("dashboard:updates", {
            metric: metric,
            value: value,
            timestamp: timestamp
        });
    }
    
    List<DataPoint> getMetrics(String metric, long start, long end) {
        return redis.zrangebyscore("metrics:" + metric, start, end);
    }
}

Optimizations:
- Pre-aggregate at multiple granularities (1s, 1m, 1h)
- Cache recent data in memory
- Compress historical data
- Use approximate algorithms for high-cardinality metrics
```

### 2. Implement Distributed Rate Limiting
**Question**: "How would you use distributed counters for rate limiting API requests?"

**Solution**:
```
Requirements:
- Limit: 1000 requests per hour per user
- Distributed: Multiple servers
- Accurate: 99%+ accuracy
- Low latency: <1ms overhead

Sliding Window Implementation:
class RateLimiter {
    boolean allowRequest(String userId) {
        long now = System.currentTimeMillis();
        long windowStart = now - 3600000;  // 1 hour ago
        String key = "rate_limit:" + userId;
        
        // Remove old entries
        redis.zremrangebyscore(key, 0, windowStart);
        
        // Count requests in window
        long count = redis.zcard(key);
        
        if (count < 1000) {
            // Add current request
            redis.zadd(key, now, UUID.randomUUID().toString());
            redis.expire(key, 3600);
            return true;
        }
        
        return false;
    }
}

Optimized with Counter:
class OptimizedRateLimiter {
    boolean allowRequest(String userId) {
        long now = System.currentTimeMillis();
        long currentMinute = now / 60000 * 60000;
        String key = "rate_limit:" + userId + ":" + currentMinute;
        
        long count = redis.incr(key);
        redis.expire(key, 3600);
        
        // Get total from last 60 minutes
        long total = 0;
        for (int i = 0; i < 60; i++) {
            long minute = currentMinute - (i * 60000);
            String minuteKey = "rate_limit:" + userId + ":" + minute;
            total += redis.get(minuteKey) ?: 0;
        }
        
        return total <= 1000;
    }
}

Benefits:
- Low latency (<1ms)
- Accurate sliding window
- Automatic cleanup
- Scalable
```

### 3. Count Unique Visitors at Scale
**Question**: "How would you count unique visitors to a website with billions of users?"

**Solution**:
```
Challenge:
- Billions of unique users
- Cannot store all user IDs
- Need approximate count
- Memory constrained

HyperLogLog Solution:
class UniqueVisitorCounter {
    void recordVisit(String pageId, String userId) {
        String key = "unique_visitors:" + pageId;
        redis.pfadd(key, userId);
    }
    
    long getUniqueCount(String pageId) {
        String key = "unique_visitors:" + pageId;
        return redis.pfcount(key);
    }
    
    long getUniqueCountMultiple(List<String> pageIds) {
        List<String> keys = pageIds.stream()
            .map(id -> "unique_visitors:" + id)
            .collect(Collectors.toList());
        return redis.pfcount(keys.toArray(new String[0]));
    }
}

Properties:
- Memory: 12KB per counter (constant)
- Accuracy: 0.81% standard error
- Capacity: Billions of unique items
- Operations: Add, count, merge

Alternative: Bloom Filter
- Check if user already counted
- Probabilistic (false positives possible)
- Very memory efficient
- Cannot get exact count

Use Cases:
- Unique page visitors
- Unique video viewers
- Unique API callers
- DAU/MAU metrics
```

### 4. Implement Leaderboard with Counters
**Question**: "How would you design a real-time leaderboard showing top players by score?"

**Solution**:
```
Requirements:
- Real-time updates
- Top 100 players
- Millions of players
- Player rank lookup

Redis Sorted Set Solution:
class Leaderboard {
    void updateScore(String playerId, long score) {
        redis.zadd("leaderboard", score, playerId);
    }
    
    void incrementScore(String playerId, long delta) {
        redis.zincrby("leaderboard", delta, playerId);
    }
    
    List<Player> getTopPlayers(int count) {
        Set<Tuple> top = redis.zrevrangeWithScores("leaderboard", 0, count - 1);
        return top.stream()
            .map(t -> new Player(t.getElement(), t.getScore()))
            .collect(Collectors.toList());
    }
    
    long getPlayerRank(String playerId) {
        return redis.zrevrank("leaderboard", playerId) + 1;
    }
    
    long getPlayerScore(String playerId) {
        return redis.zscore("leaderboard", playerId);
    }
}

Optimizations:
1. Sharded Leaderboards:
   - Shard by region/category
   - Merge for global leaderboard
   - Reduce contention

2. Cached Top-K:
   - Cache top 100 in memory
   - Update every 1 second
   - Reduce Redis load

3. Approximate Leaderboard:
   - Use sampling for large datasets
   - Trade accuracy for performance
   - Good enough for most use cases
```

### 5. Handle Counter Overflow
**Question**: "How would you handle counter overflow for very large counts?"

**Solution**:
```
Problem:
- 64-bit integer max: 9,223,372,036,854,775,807
- At 1M increments/second: 292,471 years to overflow
- But: What if we need arbitrary precision?

Solutions:

1. BigInteger (Arbitrary Precision):
class BigCounter {
    void increment(String counterId, BigInteger delta) {
        String key = "counter:" + counterId;
        String current = redis.get(key);
        BigInteger value = current != null ? 
            new BigInteger(current) : BigInteger.ZERO;
        BigInteger newValue = value.add(delta);
        redis.set(key, newValue.toString());
    }
}

Pros: No overflow
Cons: Slower, more memory

2. Hierarchical Counters:
counter_low: 0 to 2^32-1
counter_high: overflow count

total = counter_high * 2^32 + counter_low

3. Scientific Notation:
Store as: mantissa × 10^exponent
Example: 1.23 × 10^15

4. Sharded with Aggregation:
Split into multiple counters
Aggregate when reading
Each counter can be smaller

Recommendation: 64-bit is sufficient for most use cases
```

### 6. Implement Counter with TTL
**Question**: "How would you implement counters that automatically expire after a certain time?"

**Solution**:
```
Use Cases:
- Session counters
- Temporary metrics
- Rate limiting windows
- Cache statistics

Implementation:
class TTLCounter {
    void increment(String counterId, long ttlSeconds) {
        String key = "counter:" + counterId;
        redis.incr(key);
        redis.expire(key, ttlSeconds);
    }
    
    void incrementWithRefresh(String counterId, long ttlSeconds) {
        String key = "counter:" + counterId;
        long value = redis.incr(key);
        
        // Refresh TTL on every increment
        redis.expire(key, ttlSeconds);
    }
    
    Long getWithTTL(String counterId) {
        String key = "counter:" + counterId;
        Long value = redis.get(key);
        Long ttl = redis.ttl(key);
        
        return new CounterWithTTL(value, ttl);
    }
}

Time-Windowed with Auto-Expiry:
class WindowedCounter {
    void increment(String counterId) {
        long now = System.currentTimeMillis();
        long bucket = now / 60000 * 60000;  // 1-minute buckets
        String key = "counter:" + counterId + ":" + bucket;
        
        redis.incr(key);
        redis.expire(key, 3600);  // Expire after 1 hour
    }
    
    long getLastHour(String counterId) {
        long now = System.currentTimeMillis();
        long total = 0;
        
        for (int i = 0; i < 60; i++) {
            long bucket = (now / 60000 - i) * 60000;
            String key = "counter:" + counterId + ":" + bucket;
            total += redis.get(key) ?: 0;
        }
        
        return total;
    }
}

Benefits:
- Automatic cleanup
- No manual deletion needed
- Memory efficient
- Simple implementation
```

### 7. Implement Counter Snapshots
**Question**: "How would you implement point-in-time snapshots of counters for auditing?"

**Solution**:
```
Requirements:
- Periodic snapshots (daily)
- Historical queries
- Minimal storage
- Fast restoration

Implementation:
class CounterSnapshot {
    void createSnapshot() {
        String timestamp = LocalDate.now().toString();
        String snapshotKey = "snapshot:" + timestamp;
        
        // Get all counters
        Set<String> counterKeys = redis.keys("counter:*");
        
        // Create snapshot
        Map<String, Long> snapshot = new HashMap<>();
        for (String key : counterKeys) {
            Long value = redis.get(key);
            snapshot.put(key, value);
        }
        
        // Store snapshot
        redis.hmset(snapshotKey, snapshot);
        redis.expire(snapshotKey, 365 * 86400);  // 1 year
    }
    
    Map<String, Long> getSnapshot(String date) {
        String snapshotKey = "snapshot:" + date;
        return redis.hgetall(snapshotKey);
    }
    
    void restoreFromSnapshot(String date) {
        Map<String, Long> snapshot = getSnapshot(date);
        
        for (Map.Entry<String, Long> entry : snapshot.entrySet()) {
            redis.set(entry.getKey(), entry.getValue());
        }
    }
}

Incremental Snapshots:
- Store only changes since last snapshot
- Reduce storage by 90%
- Faster snapshot creation
- Slower restoration (need to apply deltas)

Compression:
- Compress snapshot data
- 10:1 compression ratio
- Reduce storage cost
- Slight CPU overhead
```

### 8. Handle Clock Skew in Distributed Counters
**Question**: "How would you handle clock skew across distributed servers?"

**Solution**:
```
Problem:
- Server 1 time: 10:00:00
- Server 2 time: 10:00:05 (5 seconds ahead)
- Time-windowed counters affected

Solutions:

1. Logical Clocks (Lamport Timestamps):
class LogicalCounter {
    long logicalClock = 0;
    
    void increment(String counterId) {
        logicalClock++;
        redis.zadd("counter:" + counterId, logicalClock, 
            UUID.randomUUID().toString());
    }
}

2. Vector Clocks:
{
    "server1": 10,
    "server2": 15,
    "server3": 12
}

3. NTP Synchronization:
- Sync all servers with NTP
- Acceptable drift: <100ms
- Monitor clock skew
- Alert on large drift

4. Hybrid Logical Clocks:
- Combine physical and logical time
- Monotonic even with clock skew
- Used in CockroachDB, Spanner

5. Tolerance Windows:
- Accept events within ±5 seconds
- Reject events outside window
- Log anomalies

Recommendation: NTP sync + tolerance windows
```

These variations demonstrate deep understanding of distributed counter challenges and practical solutions for real-world scenarios.
