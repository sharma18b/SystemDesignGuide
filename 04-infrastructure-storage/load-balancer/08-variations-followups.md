# Load Balancer - Variations and Follow-ups

## Variations

### 1. Layer 4 (TCP) Load Balancer
- Operates at transport layer
- Faster (no HTTP parsing)
- Protocol-agnostic
- Lower latency

### 2. Layer 7 (HTTP) Load Balancer
- Operates at application layer
- Content-based routing
- SSL termination
- Request modification

### 3. Global Load Balancer
- Geographic routing
- Multi-region failover
- Latency-based routing
- Disaster recovery

## Follow-up Questions

### Q: How do you handle session persistence?
**Answer:**
- Cookie-based (insert cookie with server ID)
- IP-based (hash client IP)
- Header-based (custom header)
- TTL for session timeout

### Q: How do you detect unhealthy backends?
**Answer:**
- Active health checks (periodic probes)
- Passive health checks (monitor traffic)
- Mark unhealthy after N failures
- Remove from pool
- Re-add when healthy

### Q: How do you handle backend server updates?
**Answer:**
- Connection draining
- Stop new connections
- Wait for existing to complete
- Timeout after N minutes
- Graceful shutdown

### Q: How do you prevent overload?
**Answer:**
- Rate limiting per client
- Connection limits
- Queue requests
- Reject excess traffic
- Auto-scaling

This guide covers variations and deep-dive questions for load balancer interviews.
