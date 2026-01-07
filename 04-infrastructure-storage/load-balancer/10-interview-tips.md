# Load Balancer - Interview Tips

## Interview Approach

### Initial Questions (5 min)
1. **Traffic**: How many requests per second?
2. **Protocol**: HTTP, TCP, or both?
3. **Backends**: How many backend servers?
4. **Session**: Stateful or stateless?
5. **Geographic**: Single region or global?

### Design Progression

**Step 1: High-Level (5 min)**
```
Clients → Load Balancers → Backend Servers
```

**Step 2: Algorithm (5 min)**
- Round-robin for simple cases
- Least connections for long-lived
- Weighted for heterogeneous backends
- IP hash for session persistence

**Step 3: Health Checking (5 min)**
- Active probes every 5s
- Mark unhealthy after 3 failures
- Remove from pool
- Re-add when healthy

**Step 4: High Availability (5 min)**
- Multiple LB instances
- DNS/Anycast routing
- Automatic failover
- No single point of failure

**Step 5: Scaling (5 min)**
- Add LB instances
- Add backend servers
- Auto-scaling integration
- Connection draining

**Step 6: Advanced Features (5 min)**
- SSL/TLS termination
- Rate limiting
- Request routing
- Metrics and monitoring

## Key Topics

### Must Cover
- ✅ Load balancing algorithms
- ✅ Health checking
- ✅ High availability
- ✅ Session persistence
- ✅ Failover

### Should Cover
- ✅ SSL/TLS termination
- ✅ Connection draining
- ✅ Auto-scaling
- ✅ Monitoring

## Talking Points

### Round-Robin
"Round-robin distributes requests evenly across backends. It's simple and works well for stateless applications with homogeneous servers."

### Health Checking
"We send periodic probes to backends. After 3 consecutive failures, we mark the server unhealthy and remove it from the pool. When it recovers, we automatically re-add it."

### Session Persistence
"For stateful applications, we use sticky sessions. We can use cookie-based (insert cookie with server ID) or IP-based (hash client IP) persistence."

### High Availability
"We deploy multiple load balancer instances behind DNS or Anycast. If one fails, traffic automatically routes to healthy instances. No single point of failure."

## Time Management
- 0-5 min: Requirements
- 5-15 min: Architecture
- 15-25 min: Deep dive
- 25-35 min: Scaling/HA
- 35-45 min: Follow-ups

This guide helps you approach load balancer design interviews with confidence.
