# Load Balancer - Trade-offs and Alternatives

## Layer 4 vs Layer 7
**Layer 4 (TCP):**
✅ Faster (no HTTP parsing)
✅ Protocol-agnostic
✅ Lower latency
❌ No content-based routing
❌ No SSL termination

**Layer 7 (HTTP):**
✅ Content-based routing
✅ SSL termination
✅ Request modification
❌ Slower (HTTP parsing)
❌ HTTP-only

## Hardware vs Software
**Hardware LB:**
✅ High performance
✅ Dedicated hardware
❌ Expensive
❌ Vendor lock-in
❌ Limited flexibility

**Software LB:**
✅ Cost-effective
✅ Flexible
✅ Easy to scale
❌ Lower performance
❌ More complex

## DNS vs Anycast
**DNS Round-Robin:**
✅ Simple
✅ No special infrastructure
❌ DNS caching issues
❌ No health checking
❌ Uneven distribution

**Anycast:**
✅ Automatic routing
✅ DDoS protection
✅ Low latency
❌ Complex setup
❌ Limited control

## Alternatives
- **Nginx**: Popular open-source LB
- **HAProxy**: High-performance LB
- **AWS ELB**: Managed service
- **Envoy**: Modern proxy/LB

This analysis helps choose the right load balancing approach.
