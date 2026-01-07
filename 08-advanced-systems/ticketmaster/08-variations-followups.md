# Ticketmaster - Variations and Follow-up Questions

## Common Variations

### 1. Dynamic Pricing (Platinum Seats)
**Problem**: Adjust ticket prices based on real-time demand

**Implementation**:
```
Pricing Algorithm:
1. Monitor demand signals:
   - Page views per minute
   - Add-to-cart rate
   - Purchase velocity
   - Queue length

2. Calculate demand score:
   score = (views × 0.3) + (carts × 0.5) + (purchases × 0.2)

3. Adjust price:
   if score > threshold_high: price × 1.5
   if score > threshold_medium: price × 1.2
   if score < threshold_low: price × 0.9

4. Apply constraints:
   - Max 2x base price
   - Min 0.8x base price
   - Update every 5 minutes
   - Smooth transitions

5. Display to users:
   - Show price range
   - Explain dynamic pricing
   - Lock price at checkout
```

**Challenges**:
- User perception (fairness concerns)
- Price volatility
- Regulatory compliance
- Revenue optimization vs user satisfaction

### 2. Ticket Resale Marketplace
**Problem**: Official platform for fans to resell tickets

**Key Features**:
```
Seller Features:
- List tickets for resale
- Set price (with caps)
- Transfer ownership
- Receive payment

Buyer Features:
- Browse resale tickets
- Price comparison
- Verified authenticity
- Same checkout flow

Platform Features:
- Price caps (max 120% of face value)
- Seller verification
- Fraud prevention
- Commission (10-15%)
```

**Database Schema**:
```sql
CREATE TABLE resale_listings (
    listing_id UUID PRIMARY KEY,
    ticket_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    original_price DECIMAL(10,2),
    asking_price DECIMAL(10,2),
    status VARCHAR(20), -- ACTIVE, SOLD, CANCELLED
    listed_at TIMESTAMP,
    sold_at TIMESTAMP,
    INDEX idx_ticket (ticket_id),
    INDEX idx_status (status, listed_at)
);
```

**Challenges**:
- Prevent scalping
- Verify ticket authenticity
- Handle last-minute transfers
- Manage refunds

### 3. Season Tickets / Subscriptions
**Problem**: Sell packages of multiple events

**Implementation**:
```
Package Types:
- Season tickets (all home games)
- Mini plans (5-10 games)
- Flex passes (choose any 5 games)
- Subscriptions (monthly access)

Features:
- Bulk discount pricing
- Priority seat selection
- Flexible exchange
- Auto-renewal

Database Schema:
CREATE TABLE season_packages (
    package_id UUID PRIMARY KEY,
    user_id UUID,
    package_type VARCHAR(50),
    events UUID[],
    seats JSONB,
    total_price DECIMAL(10,2),
    payment_plan VARCHAR(20), -- FULL, MONTHLY
    status VARCHAR(20),
    renewal_date DATE
);
```

### 4. Group Sales
**Problem**: Handle bulk purchases for corporate/group events

**Requirements**:
- Minimum 10-20 tickets
- Discounted pricing
- Dedicated account manager
- Custom invoicing
- Flexible payment terms

**Workflow**:
```
1. Group inquiry submitted
2. Sales rep reviews request
3. Quote generated with discount
4. Seats reserved (longer hold time)
5. Contract signed
6. Payment processed (net 30 terms)
7. Tickets delivered
```

### 5. Accessible Seating
**Problem**: Manage wheelchair and companion seats

**Requirements**:
- ADA compliance
- Companion seat pairing
- Special pricing
- Verification process
- Multiple locations in venue

**Implementation**:
```sql
CREATE TABLE accessible_seats (
    seat_id UUID PRIMARY KEY,
    event_id UUID,
    accessibility_type VARCHAR(50),
    -- WHEELCHAIR, HEARING_IMPAIRED, VISUAL_IMPAIRED
    companion_seat_id UUID,
    requires_verification BOOLEAN,
    status VARCHAR(20)
);

-- Reservation Process
1. User indicates accessibility need
2. Show only accessible seats
3. Auto-pair with companion seat
4. Verify eligibility (optional)
5. Reserve both seats together
6. Special checkout flow
```

## Follow-up Questions

### Technical Deep Dives

**Q1: How do you prevent double-booking with distributed systems?**
```
Solution: Optimistic Locking with Version Control

Implementation:
1. Each seat has version number
2. Read seat: SELECT * FROM seats WHERE seat_id=? AND status='AVAILABLE'
3. Reserve seat: 
   UPDATE seats 
   SET status='RESERVED', version=version+1
   WHERE seat_id=? AND version=? AND status='AVAILABLE'
4. Check affected_rows:
   - If 1: Success
   - If 0: Conflict, retry or fail

Why it works:
- Database guarantees atomicity
- Version check prevents race conditions
- No distributed locks needed
- Scales horizontally

Retry Strategy:
- Max 3 retries
- Exponential backoff (100ms, 200ms, 400ms)
- If all fail: Suggest alternative seats
```

**Q2: How do you handle the thundering herd problem when tickets go on sale?**
```
Problem: 10M users hit site simultaneously

Solutions:

1. Virtual Queue:
   - Users enter queue before sale
   - Process in controlled batches
   - Prevent system overload

2. CDN Caching:
   - Cache event pages
   - Cache seat maps
   - 95% cache hit rate
   - Reduce origin load

3. Rate Limiting:
   - Limit requests per user
   - Limit requests per IP
   - Gradual admission

4. Load Shedding:
   - Reject excess traffic
   - Return 503 with retry-after
   - Preserve system stability

5. Pre-Scaling:
   - Scale infrastructure 24 hours before
   - 500 → 50,000 servers
   - Pre-warm caches
   - Load test
```

**Q3: How do you detect and prevent bot purchases?**
```
Multi-Layer Detection:

Layer 1 - Network Level:
- IP reputation checking
- Rate limiting by IP
- Geographic filtering
- Known bot signatures

Layer 2 - Application Level:
- Device fingerprinting
- Behavioral analysis
- Mouse movement patterns
- Typing speed
- Time between actions

Layer 3 - CAPTCHA:
- reCAPTCHA v3 (invisible)
- Challenge low-score users
- Adaptive difficulty

Layer 4 - ML Models:
- Real-time fraud scoring
- Features: 100+ signals
- Model: Gradient Boosting
- Inference: <50ms

Layer 5 - Post-Purchase:
- Transaction analysis
- Account linking
- Resale monitoring
- Pattern detection

Actions:
- Block suspicious IPs
- Challenge with CAPTCHA
- Require phone verification
- Limit purchase quantity
- Flag for manual review
- Cancel fraudulent orders
```

**Q4: How do you handle payment failures after seat reservation?**
```
Scenario: User reserves seats but payment fails

Handling:

1. Immediate Retry:
   - Retry payment 3 times
   - Exponential backoff
   - Try alternative payment methods

2. Hold Reservation:
   - Extend reservation by 5 minutes
   - Allow user to update payment method
   - Show clear error message

3. Release Seats:
   - After 3 failed attempts
   - Release seats back to inventory
   - Notify user
   - Offer to try again

4. Fraud Check:
   - Analyze failure reason
   - Check for stolen cards
   - Flag suspicious accounts
   - Prevent future attempts

5. User Communication:
   - Clear error messages
   - Suggest solutions
   - Offer customer support
   - Email confirmation of cancellation
```

**Q5: How do you ensure fair access during high-demand sales?**
```
Fairness Mechanisms:

1. Virtual Queue (FIFO):
   - First-come-first-served
   - Transparent wait times
   - No queue jumping
   - One session per user

2. Purchase Limits:
   - Max 4-8 tickets per transaction
   - One transaction per event per user
   - Prevent bulk buying

3. Verified Fan:
   - Pre-registration required
   - Identity verification
   - Phone number verification
   - Credit card verification

4. Bot Detection:
   - Block automated purchases
   - CAPTCHA challenges
   - Behavioral analysis

5. Random Selection (Optional):
   - Lottery for high-demand events
   - Equal chance for all
   - Reduces gaming

6. Presale Access:
   - Fan club members
   - Credit card holders
   - Venue members
   - Staggered access times
```

### Scalability Questions

**Q6: How would you scale to 100M concurrent users?**
```
Current: 10M concurrent users
Target: 100M concurrent users (10x)

Scaling Strategy:

1. Queue System:
   - 1,000 → 10,000 Redis nodes
   - 10M → 100M queue capacity
   - Distributed queue sharding

2. Application Servers:
   - 50K → 500K instances
   - Auto-scaling in 10 minutes
   - Kubernetes for orchestration

3. Database:
   - 10K → 100K shards
   - More aggressive caching
   - Read replica scaling

4. CDN:
   - More edge locations
   - Larger cache capacity
   - Better cache hit rates

5. Network:
   - 50 GB/s → 500 GB/s bandwidth
   - More load balancers
   - Geographic distribution

Cost: $5M per major sale (10x current)
```

**Q7: How do you handle database hotspots for popular events?**
```
Problem: Taylor Swift event gets 10M requests, other events get 100

Solutions:

1. Dedicated Shards:
   - Popular events get dedicated shards
   - Isolate from other events
   - Scale independently

2. Read Replicas:
   - 10 → 100 read replicas for hot events
   - Route reads to replicas
   - Reduce primary load

3. Aggressive Caching:
   - Cache seat availability
   - 10-second TTL
   - Accept eventual consistency

4. Load Shedding:
   - Reject excess traffic
   - Queue overflow to waiting room
   - Preserve system stability

5. Pre-Computation:
   - Pre-compute seat availability
   - Cache seat maps
   - Reduce query complexity
```

### Business Logic Questions

**Q8: How do you handle ticket transfers between users?**
```
Transfer Flow:

1. Sender initiates transfer:
   - Select tickets to transfer
   - Enter recipient email
   - Optional message

2. System validates:
   - Ticket is transferable
   - Event hasn't started
   - Sender owns ticket

3. Generate transfer link:
   - Unique transfer token
   - Expires in 7 days
   - Email to recipient

4. Recipient accepts:
   - Click link
   - Login/create account
   - Accept transfer

5. Complete transfer:
   - Update ticket ownership
   - Invalidate old ticket
   - Generate new ticket
   - Notify both parties

Database:
CREATE TABLE ticket_transfers (
    transfer_id UUID PRIMARY KEY,
    ticket_id UUID,
    from_user_id UUID,
    to_user_id UUID,
    status VARCHAR(20), -- PENDING, ACCEPTED, EXPIRED
    transfer_token VARCHAR(255),
    expires_at TIMESTAMP,
    accepted_at TIMESTAMP
);
```

**Q9: How do you handle refunds and cancellations?**
```
Refund Policy:

1. Event Cancelled:
   - Full refund automatically
   - Process within 7-10 days
   - Email notification

2. Event Postponed:
   - Tickets valid for new date
   - Option to request refund
   - 30-day window

3. User Cancellation:
   - Depends on event policy
   - Usually no refund
   - May allow resale

Implementation:

1. Refund Request:
   - User submits request
   - System validates eligibility
   - Calculate refund amount

2. Process Refund:
   - Reverse payment transaction
   - Update ticket status
   - Release seat to inventory

3. Notification:
   - Email confirmation
   - Refund timeline
   - Transaction details

Database:
CREATE TABLE refunds (
    refund_id UUID PRIMARY KEY,
    order_id UUID,
    reason VARCHAR(255),
    refund_amount DECIMAL(10,2),
    status VARCHAR(20),
    requested_at TIMESTAMP,
    processed_at TIMESTAMP
);
```

**Q10: How do you prevent scalpers from reselling tickets at inflated prices?**
```
Anti-Scalping Measures:

1. Purchase Limits:
   - Max 4-8 tickets per transaction
   - One transaction per event per user
   - Enforce with device fingerprinting

2. Verified Fan:
   - Pre-registration required
   - Identity verification
   - Reduces anonymous purchases

3. Non-Transferable Tickets:
   - Tickets tied to buyer
   - ID check at venue
   - Reduces resale value

4. Official Resale Platform:
   - Price caps (max 120% face value)
   - Verified authenticity
   - Platform takes commission

5. Dynamic Pricing:
   - Capture demand in primary sale
   - Reduce arbitrage opportunity
   - Platinum seats at market price

6. Delayed Delivery:
   - Tickets released 24-48 hours before event
   - Reduces time for resale
   - Prevents early scalping

7. Monitoring:
   - Track resale listings
   - Identify scalper accounts
   - Cancel fraudulent orders
   - Ban repeat offenders
```

These variations and follow-up questions demonstrate the complexity of building a fair, scalable, and fraud-resistant ticket sales platform.
