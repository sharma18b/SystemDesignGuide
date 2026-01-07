# Ticketmaster - Interview Tips

## Interview Approach

### Time Management (45-60 minutes)
```
Phase 1: Requirements (5-10 min)
- Clarify functional requirements
- Understand scale (10M concurrent users)
- Identify critical features (queue, inventory, payments)
- Discuss fairness and bot prevention

Phase 2: High-Level Design (10-15 min)
- Draw architecture diagram
- Virtual queue system
- Inventory management
- Payment processing
- Bot detection

Phase 3: Deep Dive (15-20 min)
- Focus on 2-3 components:
  * Queue system implementation
  * Optimistic locking for seats
  * Bot detection strategies

Phase 4: Tradeoffs (5-10 min)
- Queue vs no queue
- Optimistic vs pessimistic locking
- Sync vs async payments
- CAPTCHA strategies

Phase 5: Wrap-up (5 min)
- Monitoring and operations
- Security considerations
- Scalability improvements
```

## Key Topics to Emphasize

### 1. Virtual Queue System

**What to Say**:
```
✓ "I'll implement a virtual waiting room using Redis sorted sets"
✓ "Queue users by timestamp for FIFO fairness"
✓ "Process 10K users/second in controlled batches"
✓ "Provide transparent wait time estimates"
✗ Avoid: "Let everyone access the site simultaneously" (crashes)

Sample Answer:
"For the queue system, I'll use Redis sorted sets:

1. User arrives → ZADD queue:event_id {timestamp} {user_id}
2. Assign queue position → ZRANK queue:event_id {user_id}
3. Calculate wait time: position / processing_rate
4. User polls every 30 seconds for updates
5. When position = 0 → Issue access token (10-min validity)
6. User proceeds to purchase

This prevents system overload while ensuring fairness. I'll shard
by event_id to handle 10M concurrent users across 1000 Redis nodes."
```

### 2. Inventory Management

**What to Say**:
```
✓ "Use optimistic locking with version numbers to prevent double-booking"
✓ "Each seat has a version field that increments on update"
✓ "Retry logic with exponential backoff for conflicts"
✗ Avoid: "Use pessimistic locking" (doesn't scale)

Sample Answer:
"For inventory management, I'll use optimistic locking:

1. Read seat: SELECT * FROM seats WHERE seat_id=? AND status='AVAILABLE'
2. User selects seat
3. Reserve with version check:
   UPDATE seats 
   SET status='RESERVED', version=version+1, reserved_at=NOW()
   WHERE seat_id=? AND version=? AND status='AVAILABLE'
4. Check affected_rows:
   - If 1: Success, seat reserved
   - If 0: Conflict, retry with backoff
5. Max 3 retries, then suggest alternative seats

This handles 50K concurrent attempts without distributed locks.
Reservations expire after 10 minutes if payment not completed."
```

### 3. Bot Detection

**What to Say**:
```
✓ "Multi-layer defense: CDN, queue, CAPTCHA, ML models"
✓ "Device fingerprinting and behavioral analysis"
✓ "Selective CAPTCHA based on risk score"
✗ Avoid: "Show CAPTCHA to everyone" (poor UX)

Sample Answer:
"I'll implement multi-layer bot detection:

Layer 1 - CDN/WAF:
- Rate limit by IP (100 req/min)
- Block known bot IPs
- Geographic filtering

Layer 2 - Queue System:
- Device fingerprinting
- One session per user
- Behavioral analysis (mouse movement, typing speed)

Layer 3 - CAPTCHA:
- reCAPTCHA v3 (invisible, score-based)
- Challenge only low-score users (20%)
- Fallback to v2 if needed

Layer 4 - ML Models:
- Real-time fraud scoring
- 150+ features
- <50ms inference time
- Block high-risk users

This blocks >99% of bots while maintaining good UX for real users."
```

### 4. Payment Processing

**What to Say**:
```
✓ "Authorize payment synchronously, capture asynchronously"
✓ "Multiple payment gateways with failover"
✓ "PCI DSS compliance through tokenization"
✗ Avoid: "Store credit card numbers" (PCI violation)

Sample Answer:
"For payments, I'll use a hybrid approach:

Synchronous:
1. Authorize payment (hold funds)
2. Reserve seats
3. Return order confirmation

Asynchronous:
4. Capture payment
5. Generate tickets
6. Send confirmation email

This ensures fast checkout while maintaining reliability.

For high availability, I'll use multiple gateways:
- Primary: Stripe (70%)
- Secondary: Braintree (20%)
- Tertiary: Adyen (10%)

Circuit breaker for automatic failover if error rate > 5%.

Security: Never store cards, use Stripe tokens, PCI DSS Level 1 compliant."
```

## Common Pitfalls to Avoid

### 1. Ignoring Fairness
```
❌ Bad: "First to click gets the ticket"
✓ Good: "Virtual queue ensures fair FIFO access"

❌ Bad: "No purchase limits"
✓ Good: "Max 8 tickets per transaction to prevent bulk buying"

Key Point: Fairness is as important as performance
```

### 2. Weak Concurrency Control
```
❌ Bad: "Check if seat available, then reserve it"
✓ Good: "Atomic update with version check"

❌ Bad: "Use distributed locks"
✓ Good: "Optimistic locking scales better"

Key Point: Race conditions will cause double-booking
```

### 3. Poor Bot Prevention
```
❌ Bad: "Just use CAPTCHA"
✓ Good: "Multi-layer defense with ML models"

❌ Bad: "Block all VPN users"
✓ Good: "Risk-based approach with multiple signals"

Key Point: Bots are sophisticated, need defense in depth
```

### 4. Neglecting Scale
```
❌ Bad: "Single database server"
✓ Good: "10,000 shards, event-based sharding"

❌ Bad: "No queue system"
✓ Good: "Virtual queue handles 10M concurrent users"

Key Point: 100x traffic spike requires pre-planning
```

## Strong Talking Points

### Demonstrate Trade-off Thinking
```
"For the queue system, I considered three approaches:

1. No Queue (Direct Access):
   Pros: Simple, no wait time
   Cons: System crashes, unfair
   
2. Random Selection (Lottery):
   Pros: Completely fair, can't be gamed
   Cons: Unpredictable, frustrating
   
3. FIFO Queue (My Choice):
   Pros: Fair, transparent, prevents overload
   Cons: Wait time, additional complexity
   
I chose FIFO queue because it balances fairness, transparency,
and system stability. Users understand and accept waiting in line."
```

### Show Scalability Awareness
```
"At Ticketmaster's scale (10M concurrent users), we need:

1. Queue System: 1000 Redis nodes, 10K users per node
2. Application Servers: 50K instances during major sales
3. Database: 10K shards, event-based sharding
4. CDN: Pre-warm cache, 95% hit rate
5. Cost: $400K per major sale, $20M annually

Every design decision must consider 100x traffic spikes.
Pre-scaling 24 hours before major sales is critical."
```

### Mention Real-World Considerations
```
"Beyond technical design, we need to consider:

1. Regulatory: Ticket resale laws vary by state/country
2. Fairness: Prevent scalpers, ensure real fans get tickets
3. Accessibility: ADA compliance for accessible seating
4. User Experience: Clear communication during high traffic
5. Business: Dynamic pricing, season tickets, group sales

These aren't just technical problems, they're business problems."
```

## Follow-up Question Strategies

### When Asked "How would you prevent double-booking?"
```
Structure:
1. Explain the problem
2. Describe solution
3. Show implementation
4. Discuss tradeoffs

Answer:
"Double-booking happens when two users reserve the same seat
simultaneously. This is a classic race condition.

Solution: Optimistic Locking
1. Each seat has a version number
2. Read seat with version
3. Update with version check:
   UPDATE seats SET status='RESERVED', version=version+1
   WHERE seat_id=? AND version=? AND status='AVAILABLE'
4. If affected_rows=0, conflict occurred, retry

Tradeoff: Requires retry logic, but scales horizontally.
Alternative pessimistic locking doesn't scale to 50K concurrent attempts.

At scale: Shard by event_id, each shard handles 5K attempts independently."
```

### When Asked "How would you handle bots?"
```
Answer:
"Bots are sophisticated and constantly evolving, so I need
multiple layers of defense:

Layer 1 - Network: Block known bot IPs, rate limit
Layer 2 - Queue: Device fingerprinting, one session per user
Layer 3 - CAPTCHA: Selective challenges based on risk
Layer 4 - ML: Real-time fraud scoring with 150+ features

Key insight: Don't rely on single method. Bots will bypass
any single defense, but multi-layer approach blocks >99%.

Post-purchase: Monitor resale activity, cancel fraudulent orders,
ban repeat offenders."
```

## Red Flags to Avoid

### Don't Say:
```
❌ "Just use a single database"
✓ "Shard by event_id across 10K shards"

❌ "Let everyone access the site"
✓ "Use virtual queue to control traffic"

❌ "Store credit card numbers"
✓ "Use tokenization, never store cards"

❌ "CAPTCHA solves bot problem"
✓ "Multi-layer defense with ML models"

❌ "First-come-first-served is unfair"
✓ "FIFO queue is transparent and fair"
```

## Closing Strong

### Summarize Your Design
```
"To summarize my Ticketmaster design:

1. Queue: Virtual waiting room with Redis (10M capacity)
2. Inventory: Optimistic locking prevents double-booking
3. Payments: Hybrid sync/async with multiple gateways
4. Bots: Multi-layer defense blocks >99% of bots
5. Scale: 50K servers, 10K shards, pre-scaling 24h before

Key strengths:
- Handles 10M concurrent users
- Fair FIFO access
- No double-booking
- 99.99% uptime

Areas for improvement:
- Dynamic pricing for revenue optimization
- Better bot detection with advanced ML
- Improved user experience during high traffic

I'm happy to dive deeper into any component."
```

This interview guide provides the structure and talking points needed to excel in a Ticketmaster system design interview, demonstrating understanding of extreme scale, fairness, and fraud prevention.
