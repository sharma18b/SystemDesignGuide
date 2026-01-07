# Load Balancer - Architecture

## High-Level Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Clients                              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              DNS / Anycast Routing                      │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│   LB 1   │  │   LB 2   │  │   LB N   │
│ (Active) │  │ (Active) │  │ (Active) │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │
     └─────────────┴─────────────┘
                   │
        ┌──────────┼──────────┬──────────┐
        ▼          ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Backend  │ │ Backend  │ │ Backend  │ │ Backend  │
│ Server 1 │ │ Server 2 │ │ Server 3 │ │ Server N │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

## Load Balancer Components
- **Connection Handler**: Accept client connections
- **Request Parser**: Parse HTTP/TCP requests
- **Algorithm Engine**: Select backend server
- **Health Checker**: Monitor backend health
- **Connection Pool**: Maintain backend connections
- **Metrics Collector**: Track performance metrics

## Load Balancing Algorithms

### Round-Robin
- Distribute requests evenly
- Simple, no state needed
- Good for homogeneous backends

### Least Connections
- Route to server with fewest connections
- Better for long-lived connections
- Requires connection tracking

### Weighted Round-Robin
- Assign weights to servers
- More powerful servers get more traffic
- Flexible capacity management

### IP Hash
- Hash client IP to select server
- Session persistence
- Consistent routing per client

### Least Response Time
- Route to fastest server
- Requires latency tracking
- Optimal performance

## Health Checking
```
Health Check Process:
1. Send probe to backend (every 5s)
2. Wait for response (timeout: 2s)
3. Mark healthy if success
4. Mark unhealthy after 3 failures
5. Remove from pool if unhealthy
6. Re-add when healthy again
```

## Session Persistence
- **Cookie-Based**: Insert cookie with server ID
- **IP-Based**: Hash client IP
- **Header-Based**: Use custom header
- **TTL**: Session timeout (default: 1 hour)

## Connection Draining
```
Graceful Shutdown:
1. Mark server as draining
2. Stop sending new connections
3. Wait for existing connections to complete
4. Timeout after 5 minutes
5. Force close remaining connections
6. Remove server from pool
```

This architecture provides high-performance, reliable load balancing for distributed systems.
