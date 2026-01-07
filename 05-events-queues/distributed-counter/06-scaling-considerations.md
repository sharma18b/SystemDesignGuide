# Distributed Counter - Scaling Considerations

## Horizontal Scaling

### Adding Servers
```
Initial: 10 servers, 10M counters each
After scaling: 20 servers, 5M counters each

Rebalancing Process:
1. Add new servers to cluster
2. Calculate new hash ring positions
3. Migrate counters to new servers
4. Update routing tables
5. Remove old data after migration

Migration Strategy:
- Gradual migration (10% at a time)
- Dual-write during migration
- Verify consistency before cutover
- Rollback capability

Downtime: Zero (online rebalancing)
Duration: ~30 minutes for 10M counters
```

### Sharding Strategies
```
Counter-Based Sharding:
- hash(counter_id) % num_servers
- Even distribution
- Simple routing
- Consistent hashing for rebalancing

Geographic Sharding:
- US counters → US servers
- EU counters → EU servers
- Asia counters → Asia servers
- Reduces cross-region latency

Hybrid Sharding:
- Hot counters → Dedicated servers
- Warm counters → Shared servers
- Cold counters → Archived storage
- Optimizes resource usage
```

## Performance Optimization

### Caching Strategy
```
Multi-Level Cache:

L1 (Application Memory):
- Hot counters (top 1%)
- Size: 100 MB per server
- TTL: 10 seconds
- Hit rate: 80%
- Latency: <0.1ms

L2 (Redis):
- Warm counters (top 10%)
- Size: 10 GB per cluster
- TTL: 60 seconds
- Hit rate: 95%
- Latency: <1ms

L3 (Database):
- All counters
- Size: 100 GB
- No TTL
- Hit rate: 100%
- Latency: <10ms

Cache Warming:
- Pre-load hot counters on startup
- Predictive caching based on patterns
- Background refresh before expiration
```

### Batching Optimization
```
Write Batching:
- Buffer increments for 100ms
- Batch size: 1000 operations
- Reduce database writes by 100x
- Trade-off: 100ms delay

Example:
Time 0ms: increment(counter1, 1)
Time 10ms: increment(counter1, 1)
Time 20ms: increment(counter2, 1)
...
Time 100ms: Flush batch
  - counter1: +10
  - counter2: +5
  - counter3: +8

Benefits:
- Reduce network calls
- Reduce database load
- Higher throughput
- Lower cost

Read Batching:
- Batch multiple counter reads
- Single database query
- Parallel processing
- Reduce latency
```

### Compression
```
Counter ID Compression:
- Original: "page_views:article_123" (24 bytes)
- Compressed: hash → 8 bytes
- Savings: 67%

Value Compression:
- Use variable-length encoding
- Small values: 1-2 bytes
- Large values: 4-8 bytes
- Average savings: 50%

Network Compression:
- Gzip for API responses
- 3:1 compression ratio
- Reduce bandwidth by 67%
```

## Sharded Counter Optimization

### Dynamic Shard Count
```
Low Traffic Counter:
- 1 shard
- <100 ops/second
- Simple, no overhead

Medium Traffic Counter:
- 4 shards
- 100-1000 ops/second
- Good balance

High Traffic Counter:
- 16 shards
- >1000 ops/second
- Maximum throughput

Auto-Scaling Shards:
if ops_per_second > 1000:
    increase_shards(counter_id, current_shards * 2)
elif ops_per_second < 100:
    decrease_shards(counter_id, current_shards / 2)

Shard Migration:
- Create new shards
- Redistribute values
- Update routing
- Remove old shards
```

### Shard Aggregation Optimization
```
Naive Approach:
total = sum(shard[0..N-1])
Time: O(N), N database queries

Optimized Approach:
1. Cache shard values
2. Update cache on increment
3. Aggregate from cache
Time: O(1), no database queries

Incremental Aggregation:
cached_total = 1000
shard[0] += 10
cached_total += 10  # Update incrementally
return cached_total

Periodic Reconciliation:
- Every 60 seconds
- Recalculate from shards
- Update cached total
- Detect drift
```

## Geographic Distribution

### Multi-Region Deployment
```
Regions:
- US-East: 40% traffic
- US-West: 20% traffic
- EU-West: 25% traffic
- Asia-Pacific: 15% traffic

Counter Placement:
- Global counters: Replicated in all regions
- Regional counters: Single region only
- User counters: User's home region

Cross-Region Sync:
- Async replication
- 100-500ms lag
- Eventual consistency
- CRDT for conflict resolution

Latency:
- Same region: <5ms
- Cross-region: <100ms
- Global aggregation: <500ms
```

### Edge Caching
```
CDN Edge Locations:
- Cache counter reads
- TTL: 10 seconds
- Reduce origin load by 90%
- <10ms latency globally

Edge Increments:
- Buffer at edge
- Batch to origin every 1 second
- Reduce origin load
- Trade-off: 1 second delay

Example:
User in Tokyo → Edge in Tokyo
- Increment cached locally
- Batch to US-West every 1s
- User sees immediate update
- Origin sees batched update
```

## Load Balancing

### Request Distribution
```
Round Robin:
- Simple, even distribution
- No state required
- May cause hot spots

Least Connections:
- Route to least busy server
- Better load distribution
- Requires connection tracking

Consistent Hashing:
- Route by counter_id
- Same counter → same server
- Better cache hit rate
- Recommended approach

Weighted Distribution:
- Larger servers get more traffic
- Proportional to capacity
- Flexible scaling
```

### Hot Counter Handling
```
Detection:
- Monitor ops/second per counter
- Alert if >10K ops/second
- Automatic mitigation

Mitigation Strategies:
1. Increase shard count
   - Split into more shards
   - Distribute load

2. Dedicated server
   - Move to dedicated instance
   - Isolate from other counters

3. Approximate counting
   - Use HyperLogLog
   - Trade accuracy for performance

4. Rate limiting
   - Limit increments per second
   - Prevent abuse
```

## Capacity Planning

### Growth Projections
```
Current (Year 1):
- 100M counters
- 10M ops/second
- 100 servers
- $10K/month

Year 2 (2x growth):
- 200M counters
- 20M ops/second
- 200 servers
- $20K/month

Year 3 (3x growth):
- 300M counters
- 30M ops/second
- 300 servers
- $30K/month

Linear scaling with traffic
```

### Resource Allocation
```
Per 1M ops/second:
- Servers: 10
- Memory: 10 GB
- Storage: 10 GB
- Network: 100 Mbps
- Cost: $1K/month

Breakdown:
- Compute: 60% ($600)
- Storage: 20% ($200)
- Network: 15% ($150)
- Other: 5% ($50)
```

## Monitoring and Auto-Scaling

### Key Metrics
```
Performance:
- Ops/second (increment, read)
- Latency (P50, P95, P99)
- Cache hit rate
- Error rate

Resource:
- CPU utilization
- Memory usage
- Network bandwidth
- Disk I/O

Business:
- Active counters
- Hot counters
- Cost per operation
```

### Auto-Scaling Rules
```
Scale Up:
- CPU > 70% for 5 minutes
- Memory > 80% for 5 minutes
- Latency P99 > 10ms
- Error rate > 1%

Scale Down:
- CPU < 30% for 15 minutes
- Memory < 50% for 15 minutes
- Latency P99 < 2ms
- No errors

Cooldown:
- Scale up: 60 seconds
- Scale down: 300 seconds
```

## Cost Optimization

### Right-Sizing
```
Over-Provisioned:
- 200 servers × $100 = $20K
- 40% utilization
- Wasted: $12K

Right-Sized:
- 120 servers × $100 = $12K
- 70% utilization
- Savings: $8K (40%)

Strategies:
- Monitor actual usage
- Scale down off-peak
- Use spot instances (70% savings)
- Reserved instances (40% savings)
```

### Storage Optimization
```
Hot/Warm/Cold Tiering:
- Hot (Redis): 1M counters, $500/month
- Warm (SSD): 10M counters, $1K/month
- Cold (HDD): 89M counters, $500/month
- Total: $2K/month

Without Tiering:
- All in Redis: 100M counters, $50K/month
- Savings: $48K/month (96%)

Retention Optimization:
- Delete inactive counters (>90 days)
- Archive old time-series data
- Compress historical data
- Reduce storage by 80%
```

This comprehensive scaling strategy ensures the counter system can handle massive growth while maintaining performance and controlling costs.
