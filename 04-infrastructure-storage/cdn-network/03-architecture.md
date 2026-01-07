# CDN Network - Architecture

## Global Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Users (Global)                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              GeoDNS / Anycast Routing                   │
│  - Route to nearest edge location                       │
│  - Health-based routing                                 │
│  - Load balancing                                       │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┬────────────┐
        ▼            ▼            ▼            ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  Edge    │  │  Edge    │  │  Edge    │  │  Edge    │
│  US-East │  │  EU-West │  │  Asia-   │  │  Other   │
│          │  │          │  │  Pacific │  │  Regions │
│  Cache   │  │  Cache   │  │  Cache   │  │  Cache   │
│  + WAF   │  │  + WAF   │  │  + WAF   │  │  + WAF   │
└────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │             │
     └─────────────┴─────────────┴─────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              Origin Shield (Optional)                   │
│  - Collapse requests to origin                          │
│  - Additional caching layer                             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Origin Servers                             │
│  - Web servers, application servers, storage            │
└─────────────────────────────────────────────────────────┘
```

## Edge Location Components
- **Load Balancer**: Distribute traffic across edge servers
- **Cache Servers**: Store and serve cached content
- **WAF**: Web Application Firewall for security
- **DDoS Protection**: Mitigate attacks at edge
- **SSL/TLS Termination**: Handle HTTPS at edge
- **Edge Computing**: Run serverless functions

## Request Flow
1. User requests content
2. GeoDNS routes to nearest edge
3. Edge checks cache (hit → serve, miss → fetch from origin)
4. Edge caches response
5. Edge serves content to user

## Caching Hierarchy
- **L1 (Edge)**: Memory cache, <1ms latency
- **L2 (Regional)**: SSD cache, <10ms latency
- **L3 (Origin Shield)**: Protect origin, <50ms latency
- **Origin**: Source of truth, <100ms latency

## Intelligent Routing
- **GeoDNS**: Route based on user location
- **Anycast**: Single IP, multiple locations
- **Health Checks**: Route around failures
- **Performance-Based**: Route to fastest edge
- **Cost-Based**: Optimize for cost

This architecture provides global content delivery with low latency and high availability.
