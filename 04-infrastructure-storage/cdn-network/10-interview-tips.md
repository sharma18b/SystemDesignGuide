# CDN Network - Interview Tips

## Interview Approach

### Initial Questions (5 min)
1. **Content Types**: Static, dynamic, video?
2. **Geographic Coverage**: Global or regional?
3. **Scale**: How many requests per second?
4. **Latency**: What's acceptable latency?
5. **Security**: DDoS protection needed?

### Design Progression

**Step 1: High-Level (5 min)**
```
Users → GeoDNS → Edge Locations → Origin
```

**Step 2: Edge Architecture (5 min)**
- Cache servers at edge
- GeoDNS routing
- Anycast for single IP
- Multi-tier caching

**Step 3: Caching Strategy (5 min)**
- Cache-Control headers
- TTL-based expiration
- Purge API
- Cache warming

**Step 4: Routing (5 min)**
- GeoDNS for geographic routing
- Health-based routing
- Performance-based routing
- Failover logic

**Step 5: Security (5 min)**
- DDoS protection at edge
- WAF for application security
- SSL/TLS termination
- Rate limiting

**Step 6: Scaling (5 min)**
- Add edge locations
- Increase capacity per edge
- Origin shield
- Auto-scaling

## Key Topics

### Must Cover
- ✅ Edge locations and POPs
- ✅ GeoDNS routing
- ✅ Caching strategy
- ✅ Origin protection
- ✅ Failover

### Should Cover
- ✅ DDoS protection
- ✅ SSL/TLS termination
- ✅ Cache invalidation
- ✅ Performance optimization

## Talking Points

### GeoDNS Routing
"We use GeoDNS to route users to the nearest edge location based on their IP address. This minimizes latency by serving content from geographically close servers."

### Caching Strategy
"We cache static content with long TTLs (hours to days) and dynamic content with short TTLs (seconds to minutes). Cache-Control headers from origin determine caching behavior."

### DDoS Protection
"We absorb DDoS attacks at the edge using our massive distributed capacity. Anycast routing distributes attack traffic across all edge locations, making it difficult to overwhelm any single location."

### Origin Shield
"Origin shield is an additional caching layer between edge and origin. It collapses multiple edge requests into single origin requests, protecting origin from traffic spikes."

## Time Management
- 0-5 min: Requirements
- 5-15 min: Architecture
- 15-25 min: Deep dive
- 25-35 min: Scaling/security
- 35-45 min: Follow-ups

This guide helps you approach CDN design interviews with confidence.
