# Ticketmaster - Scale and Constraints

## Traffic Analysis

### Normal Operations
```
Daily Active Users: 500K DAU
Concurrent Users: 100K average
Events Browsed: 5M page views/day
Tickets Sold: 50K tickets/day
Peak Hours: 6-9 PM local time (3x normal traffic)
```

### Major Event Sales (Taylor Swift, Super Bowl)
```
Concurrent Users: 10M users simultaneously
Queue Entries: 10M users in virtual queue
Tickets Available: 50K tickets
Sale Duration: 2-3 hours
Purchase Rate: 50K tickets/minute peak
Success Rate: 0.5% (50K tickets / 10M users)
```

### Traffic Spike Pattern
```
T-60 min: 100K users (normal)
T-30 min: 500K users (5x - pre-sale anticipation)
T-10 min: 2M users (20x - queue opens)
T-0 min: 10M users (100x - sale starts)
T+30 min: 5M users (50x - still trying)
T+60 min: 2M users (20x - sold out)
T+120 min: 500K users (5x - back to normal)
```

## Request Volume

### API Requests
```
Normal: 10K requests/second
Major Sale Peak: 1M requests/second (100x spike)

Breakdown:
- Event page loads: 500K req/s
- Seat availability checks: 300K req/s
- Add to cart: 100K req/s
- Checkout attempts: 50K req/s
- Payment processing: 10K req/s
```

### Database Operations
```
Reads: 800K reads/second (availability checks)
Writes: 50K writes/second (reservations, purchases)
Transactions: 10K transactions/second (payment processing)
```

## Data Storage

### Event Data
```
Active Events: 100K events
Event Details: 100K × 50KB = 5 GB
Seat Maps: 100K × 500KB = 50 GB
Total Event Data: 55 GB
```

### Ticket Inventory
```
Total Seats: 100K events × 5K seats avg = 500M seats
Seat Status: 500M × 100 bytes = 50 GB
Reservation Data: 10M active reservations × 1KB = 10 GB
Total Inventory: 60 GB
```

### User and Transaction Data
```
Users: 100M × 5KB = 500 GB
Order History: 500M orders × 2KB = 1 TB
Payment Data: 500M transactions × 1KB = 500 GB
Total User Data: 2 TB
```

### Total Storage: 2.1 TB active data, 10 TB with history

## Network Bandwidth

### Inbound Traffic
```
Normal: 100 MB/s
Peak: 10 GB/s (100x spike)

Breakdown:
- API requests: 8 GB/s
- Image uploads: 1 GB/s
- WebSocket connections: 1 GB/s
```

### Outbound Traffic
```
Normal: 500 MB/s
Peak: 50 GB/s (100x spike)

Breakdown:
- Event pages: 30 GB/s
- Seat maps: 10 GB/s
- API responses: 5 GB/s
- Ticket PDFs: 5 GB/s
```

## Compute Requirements

### Application Servers
```
Normal: 500 instances (16 vCPU, 32GB RAM each)
Peak: 50,000 instances (100x scale-up)
Auto-scaling: Scale from 500 to 50K in 10 minutes
Total Compute: 800K vCPUs, 1.6 PB RAM at peak
```

### Database Capacity
```
Primary Databases: 100 shards (64 vCPU, 256GB RAM)
Read Replicas: 500 replicas (32 vCPU, 128GB RAM)
Cache Clusters: 1,000 Redis nodes (16 vCPU, 128GB RAM)
Total: 100K vCPUs, 200 TB RAM
```

## Queue System Scale

### Virtual Waiting Room
```
Queue Capacity: 10M concurrent users
Queue Processing Rate: 10K users/second
Average Wait Time: 15-30 minutes
Queue Data: 10M × 1KB = 10 GB
```

### Queue Operations
```
Enqueue: 100K users/second
Dequeue: 10K users/second
Position Updates: 10M updates/minute
Heartbeat Checks: 10M checks/minute
```

## Cost Estimates

### Infrastructure Costs (Major Sale Day)
```
Compute (50K instances × 8 hours): $400K
Database (peak load): $50K
Cache (1K nodes × 8 hours): $20K
CDN (50 TB transfer): $10K
Queue System: $10K
Total: $490K per major sale

Annual (50 major sales): $24.5M
Normal operations: $5M/year
Total Annual: $29.5M
```

### Cost per Ticket
```
Infrastructure: $0.06 per ticket
Payment Processing: $0.50 per ticket (2% + $0.30)
Total: $0.56 per ticket
Revenue: $15 per ticket (10% commission on $150 avg)
Margin: $14.44 per ticket (96% margin)
```

## Bottlenecks

### Critical Bottlenecks
1. **Inventory Locking**: 50K concurrent attempts for same seats
2. **Database Writes**: 50K writes/second for reservations
3. **Payment Processing**: 10K transactions/second
4. **Queue Management**: 10M concurrent connections
5. **CDN Cache**: Serving 30 GB/s of event pages

### Mitigation Strategies
- **Inventory**: Optimistic locking with retry logic
- **Database**: Aggressive sharding and caching
- **Payments**: Async processing with queue
- **Queue**: Distributed queue system with Redis
- **CDN**: Pre-warm cache before major sales

This scale analysis shows the extreme infrastructure required to handle 100x traffic spikes while maintaining fairness and preventing double-booking.
