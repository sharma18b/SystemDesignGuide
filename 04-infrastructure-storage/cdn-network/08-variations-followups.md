# CDN Network - Variations and Follow-ups

## Variations

### 1. Video Streaming CDN
- Adaptive bitrate streaming
- HLS/DASH protocols
- Live streaming support
- DVR functionality
- Multi-CDN for redundancy

### 2. API Acceleration CDN
- Cache API responses
- Edge computing for logic
- Request/response transformation
- Rate limiting at edge
- Authentication at edge

### 3. Security-Focused CDN
- WAF at edge
- DDoS mitigation
- Bot protection
- SSL/TLS optimization
- Certificate management

## Follow-up Questions

### Q: How do you handle cache invalidation?
**Answer:**
- Purge API for immediate invalidation
- TTL-based expiration
- Version-based URLs
- Cache tags for grouped invalidation
- Propagation to all edges (<1s)

### Q: How do you protect against DDoS?
**Answer:**
- Massive distributed capacity
- Anycast routing spreads traffic
- Rate limiting per IP
- Traffic filtering
- Automatic mitigation

### Q: How do you optimize for mobile?
**Answer:**
- Image optimization (resize, compress)
- Adaptive compression
- HTTP/3 for better mobile performance
- Edge computing for personalization
- Reduced payload sizes

### Q: How do you handle origin failures?
**Answer:**
- Serve stale content
- Failover to backup origin
- Origin shield for protection
- Health checks
- Circuit breaker

This guide covers variations and deep-dive questions for CDN interviews.
