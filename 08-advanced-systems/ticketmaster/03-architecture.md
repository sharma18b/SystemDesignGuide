# Ticketmaster - System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   Web    │  │  Mobile  │  │  Resale  │  │  Venue   │  │
│  │   App    │  │   Apps   │  │  Portal  │  │  Scanner │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼─────────────┼─────────────┼─────────────┼─────────┘
        │             │             │             │
        └─────────────┼─────────────┼─────────────┘
                      │             │
        ┌─────────────┴─────────────┴─────────────┐
        │         CDN + WAF                        │
        │    (DDoS Protection, Bot Filtering)      │
        └─────────────┬─────────────┬──────────────┘
                      │             │
        ┌─────────────┴─────────────┴──────────────┐
        │      Virtual Waiting Room                 │
        │   (Queue System for Traffic Control)      │
        └─────────────┬─────────────┬──────────────┘
                      │             │
        ┌─────────────┴─────────────┴──────────────┐
        │         API Gateway                       │
        │  (Auth, Rate Limit, Bot Detection)        │
        └─────────────┬─────────────┬──────────────┘
                      │             │
    ┌─────────────────┼─────────────┼─────────────────┐
    │                 │             │                 │
┌───┴────┐    ┌───────┴──────┐    ┌┴────────┐    ┌──┴──────┐
│ Event  │    │  Inventory   │    │ Payment │    │  Queue  │
│Service │    │   Service    │    │ Service │    │ Service │
└───┬────┘    └───────┬──────┘    └┬────────┘    └──┬──────┘
    │                 │             │                │
    └─────────────────┼─────────────┼────────────────┘
                      │             │
        ┌─────────────┴─────────────┴──────────────┐
        │      Message Queue (Kafka)                │
        └─────────────┬─────────────┬──────────────┘
                      │             │
    ┌─────────────────┼─────────────┼─────────────────┐
    │                 │             │                 │
┌───┴────┐    ┌───────┴──────┐    ┌┴────────┐    ┌──┴──────┐
│ Notif  │    │  Analytics   │    │  Fraud  │    │  Resale │
│Service │    │   Service    │    │ Service │    │ Service │
└────────┘    └──────────────┘    └─────────┘    └─────────┘
```

## Core Services

### 1. Virtual Waiting Room (Queue System)
**Purpose**: Manage traffic spikes and ensure fair access

**Components**:
```
Queue Manager:
- Assign queue position to each user
- Process queue in FIFO order
- Provide wait time estimates
- Handle queue abandonment

Session Manager:
- Track user sessions
- Detect duplicate sessions
- Enforce one session per user
- Handle session expiration

Rate Controller:
- Control flow into main site
- Adjust rate based on system load
- Prevent system overload
- Maintain fairness
```

**Queue Algorithm**:
```
1. User arrives → Assign queue position
2. Generate unique queue token
3. Calculate wait time: position / processing_rate
4. User polls for position updates (every 30s)
5. When position = 0 → Issue access token
6. Access token valid for 10 minutes
7. User proceeds to ticket purchase
```

**Implementation**:
```
Technology: Redis Sorted Sets
Data Structure: ZADD queue:event_id {timestamp} {user_id}

Operations:
- Enqueue: ZADD queue:123 {timestamp} {user_id}
- Get Position: ZRANK queue:123 {user_id}
- Dequeue: ZPOPMIN queue:123 100 (batch of 100)
- Queue Size: ZCARD queue:123

Scaling:
- Shard by event_id
- 1000 Redis nodes
- 10K users per node
- 10M total capacity
```

### 2. Inventory Service
**Purpose**: Manage seat availability and reservations

**Seat States**:
```
AVAILABLE → RESERVED → PURCHASED
         ↓
      RELEASED (if payment fails)

State Transitions:
- AVAILABLE: Seat can be purchased
- RESERVED: Held for 10 minutes during checkout
- PURCHASED: Payment completed, seat sold
- RELEASED: Reservation expired, back to available
```

**Concurrency Control**:
```
Optimistic Locking:
1. Read seat with version number
2. User selects seat
3. Update seat with version check:
   UPDATE seats 
   SET status='RESERVED', version=version+1
   WHERE seat_id=? AND version=? AND status='AVAILABLE'
4. If affected_rows = 0 → Conflict, retry
5. If affected_rows = 1 → Success

Retry Logic:
- Max 3 retries with exponential backoff
- If all retries fail → Show "seat taken" message
- Suggest alternative seats
```

**Reservation Expiry**:
```
Background Job:
- Run every 30 seconds
- Find reservations older than 10 minutes
- Release back to AVAILABLE
- Notify users in queue

Implementation:
SELECT seat_id FROM seats
WHERE status='RESERVED' 
AND reserved_at < NOW() - INTERVAL '10 minutes'

UPDATE seats SET status='AVAILABLE'
WHERE seat_id IN (...)
```

### 3. Payment Service
**Purpose**: Process ticket purchases securely

**Payment Flow**:
```
1. User completes checkout
2. Validate payment method
3. Calculate total (tickets + fees)
4. Authorize payment (hold funds)
5. If success → Capture payment
6. If failure → Release reservation
7. Generate ticket and receipt
8. Send confirmation email
```

**Async Processing**:
```
Synchronous:
- Payment authorization (must be immediate)
- Inventory update (prevent double-booking)

Asynchronous:
- Payment capture (can be delayed)
- Ticket generation
- Email notifications
- Analytics updates
```

### 4. Event Service
**Purpose**: Manage event catalog and details

**Event Data Model**:
```json
{
  "event_id": "uuid",
  "name": "Taylor Swift - Eras Tour",
  "venue_id": "uuid",
  "date": "2026-08-15T19:00:00Z",
  "category": "Concert",
  "artist": "Taylor Swift",
  "description": "...",
  "images": ["url1", "url2"],
  "pricing_tiers": [
    {"section": "Floor", "price": 500, "available": 1000},
    {"section": "Lower Bowl", "price": 300, "available": 5000},
    {"section": "Upper Bowl", "price": 150, "available": 10000}
  ],
  "sale_dates": {
    "presale": "2026-06-01T10:00:00Z",
    "general": "2026-06-03T10:00:00Z"
  },
  "status": "ON_SALE"
}
```

## Database Design

### Sharding Strategy
```
Shard by event_id:
- Each event on separate shard
- Prevents cross-event contention
- Easy to scale hot events

Shard Distribution:
- Popular events: Dedicated shards
- Regular events: 10-20 events per shard
- Total: 10,000 shards

Benefits:
- Isolated blast radius
- Independent scaling
- No cross-shard transactions
```

### Key Tables
```sql
-- Events (Sharded by event_id)
CREATE TABLE events (
    event_id UUID PRIMARY KEY,
    name VARCHAR(255),
    venue_id UUID,
    event_date TIMESTAMP,
    on_sale_date TIMESTAMP,
    status VARCHAR(20),
    INDEX idx_on_sale (on_sale_date, status)
);

-- Seats (Sharded by event_id)
CREATE TABLE seats (
    seat_id UUID PRIMARY KEY,
    event_id UUID,
    section VARCHAR(50),
    row VARCHAR(10),
    seat_number VARCHAR(10),
    price DECIMAL(10,2),
    status VARCHAR(20), -- AVAILABLE, RESERVED, PURCHASED
    version INTEGER DEFAULT 0,
    reserved_at TIMESTAMP,
    reserved_by UUID,
    INDEX idx_event_status (event_id, status),
    INDEX idx_reserved_at (reserved_at) WHERE status='RESERVED'
);

-- Orders
CREATE TABLE orders (
    order_id UUID PRIMARY KEY,
    user_id UUID,
    event_id UUID,
    seats JSONB,
    total_amount DECIMAL(10,2),
    status VARCHAR(20),
    created_at TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_event (event_id)
);
```

## Caching Strategy

### Multi-Layer Cache
```
L1 (CDN): Static content, event images
- TTL: 24 hours
- Hit rate: 95%

L2 (Redis): Event details, seat availability
- TTL: 30 seconds (during sale), 5 minutes (normal)
- Hit rate: 80%

L3 (Application): Hot data in memory
- TTL: 10 seconds
- Hit rate: 60%
```

### Cache Invalidation
```
Event Updates:
- Invalidate on event modification
- Broadcast to all app servers
- Use cache versioning

Seat Availability:
- Short TTL (30 seconds)
- Accept eventual consistency
- Refresh on user action
```

## Bot Detection and Prevention

### Multi-Layer Defense
```
Layer 1 - CDN/WAF:
- Rate limiting by IP
- Geographic filtering
- Known bot signatures

Layer 2 - Queue System:
- One session per user
- Device fingerprinting
- Behavioral analysis

Layer 3 - Application:
- CAPTCHA challenges
- Proof of work
- Purchase velocity checks

Layer 4 - ML Models:
- Real-time fraud scoring
- Pattern detection
- Account reputation
```

### CAPTCHA Strategy
```
When to Show:
- High-risk users (new accounts, VPN)
- Rapid actions (clicking too fast)
- Failed attempts (wrong password)
- Random sampling (10% of users)

Types:
- reCAPTCHA v3 (invisible, score-based)
- reCAPTCHA v2 (checkbox)
- Image challenges (fallback)
```

## Monitoring and Observability

### Key Metrics
```
Business Metrics:
- Tickets sold per minute
- Checkout success rate
- Average wait time
- Bot detection rate

Technical Metrics:
- API latency (p50, p95, p99)
- Database query time
- Cache hit rate
- Error rate

Queue Metrics:
- Queue length
- Processing rate
- Wait time accuracy
- Abandonment rate
```

### Alerting
```
Critical Alerts:
- System overload (CPU > 80%)
- Database errors (error rate > 1%)
- Payment failures (failure rate > 5%)
- Double-booking detected

Warning Alerts:
- High latency (p95 > 2s)
- Cache miss rate high (< 70%)
- Queue growing rapidly
```

This architecture handles extreme traffic spikes while ensuring fairness, preventing bots, and maintaining inventory consistency through distributed queuing, optimistic locking, and multi-layer caching.
