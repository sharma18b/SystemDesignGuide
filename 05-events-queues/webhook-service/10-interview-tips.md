# Webhook Notification Service - Interview Tips

## Interview Approach (45-60 minutes)

### Time Management
```
1. Requirements (5-8 min)
   - Clarify event types and volume
   - Understand delivery guarantees
   - Define retry requirements

2. High-Level Design (10-15 min)
   - Draw system architecture
   - Explain event flow
   - Discuss components

3. Deep Dives (20-25 min)
   - Retry logic and backoff
   - Signature verification
   - Circuit breaker pattern
   - Failure handling

4. Trade-offs (5-10 min)
   - Delivery guarantees
   - Retry strategies
   - Ordering vs throughput

5. Follow-ups (5-10 min)
   - Scaling strategies
   - Security considerations
   - Monitoring and alerting
```

## Essential Questions to Ask

### Functional Requirements
```
Critical Questions:
1. "What events trigger webhooks?"
   - Payment events, user events, system events?
   
2. "What delivery guarantees are needed?"
   - At-least-once, exactly-once, at-most-once?
   
3. "How should we handle failures?"
   - Retry logic, max attempts, backoff strategy?
   
4. "Do we need ordered delivery?"
   - Per webhook, per event type, global?
   
5. "What about webhook authentication?"
   - HMAC signatures, bearer tokens, mTLS?

Good Follow-ups:
- "Should we support webhook batching?"
- "Do we need webhook filtering?"
- "What about rate limiting per endpoint?"
- "How to handle slow endpoints?"
```

### Scale Requirements
```
Key Metrics:
1. "How many webhooks per second?"
   - 10 → Simple queue
   - 1K → Distributed workers
   - 10K+ → Optimized architecture
   
2. "How many registered webhooks?"
   - 100 → Single database
   - 10K → Caching needed
   - 1M+ → Distributed storage
   
3. "What's the acceptable latency?"
   - <1s → Immediate delivery
   - <10s → Batching possible
   - <1m → Batch processing
   
4. "How many retries?"
   - 3 → Standard
   - 5 → Recommended
   - 10+ → Persistent issues
```

## Common Pitfalls to Avoid

### 1. Not Discussing Retry Logic
```
❌ Bad: "We'll send the webhook and that's it"

✅ Good: "We need robust retry logic with exponential backoff:

1. First attempt: Immediate
2. Retry 1: After 1 second
3. Retry 2: After 2 seconds
4. Retry 3: After 4 seconds
5. Retry 4: After 8 seconds
6. Retry 5: After 16 seconds

We'll add jitter (random 0-10%) to prevent thundering herd. 
After max retries, we'll move failed webhooks to a dead 
letter queue for manual intervention.

We'll only retry on:
- 5xx errors (server errors)
- Timeouts (>30 seconds)
- Network errors (connection refused, DNS failure)

We won't retry on:
- 4xx errors (except 429 rate limit)
- Invalid signatures
- Malformed responses

This balances reliability with efficiency."

Key Points:
- Specific retry schedule
- Explain jitter
- Discuss retry conditions
- Address DLQ
```

### 2. Ignoring Signature Verification
```
❌ Bad: "We'll just send the webhook"

✅ Good: "For security, we'll implement HMAC-SHA256 signatures:

1. Generate signature:
   signature = HMAC-SHA256(secret, payload)
   
2. Add to request header:
   X-Signature: sha256={signature}
   
3. Customer verifies:
   expected = HMAC-SHA256(their_secret, payload)
   valid = compare_digest(expected, received)

This ensures:
- Webhook authenticity (from our service)
- Payload integrity (not tampered)
- Replay attack prevention (with timestamp)

We'll also support:
- Bearer token authentication
- Basic auth
- mTLS for enterprise customers

The secret is generated during webhook registration and 
stored encrypted in our database."

Key Points:
- Explain signature algorithm
- Discuss verification process
- Address security benefits
- Mention alternatives
```

### 3. Not Addressing Slow Endpoints
```
❌ Bad: "We'll wait for the response"

✅ Good: "Slow endpoints can block workers and reduce 
throughput. Here's my approach:

1. Timeout Configuration:
   - Default: 30 seconds
   - Configurable: 5-300 seconds
   - Kill request after timeout

2. Circuit Breaker:
   - Monitor endpoint response times
   - If P95 > 10 seconds, open circuit
   - Stop sending for 5 minutes
   - Test with 10% traffic (half-open)
   - Resume if healthy (closed)

3. Dedicated Worker Pool:
   - Slow endpoints → Dedicated workers
   - Fast endpoints → Shared workers
   - Prevent blocking

4. Rate Limiting:
   - Limit deliveries per endpoint
   - Prevent overwhelming slow endpoints
   - Adaptive based on response time

This ensures slow endpoints don't impact overall system 
performance."

Key Points:
- Identify the problem
- Multiple solutions
- Circuit breaker pattern
- Resource isolation
```

### 4. Overlooking Idempotency
```
❌ Bad: "We'll retry until it succeeds"

✅ Good: "Retries can cause duplicate deliveries, so we 
need idempotency:

1. Idempotency Keys:
   - Include unique event_id in payload
   - Customer tracks processed event_ids
   - Skip duplicates

2. Delivery Attempt Header:
   X-Delivery-Attempt: 3
   - Customer knows it's a retry
   - Can handle accordingly

3. Customer Implementation:
   processed_events = set()
   
   if event_id in processed_events:
       return 200  # Already processed
   
   process_event(event)
   processed_events.add(event_id)
   return 200

4. Our Deduplication:
   - Track recent deliveries (last 24h)
   - Skip if already delivered successfully
   - Prevent unnecessary retries

This ensures at-least-once delivery without duplicate 
processing."

Key Points:
- Explain idempotency need
- Provide implementation
- Address both sides
- Practical solution
```

## Strong Talking Points

### 1. Exponential Backoff with Jitter
```
Strong Answer:
"For retry logic, I'll implement exponential backoff with jitter:

Formula:
delay = min(base * 2^attempt, max_delay) + random(0, delay * 0.1)

Example:
Attempt 1: 1000ms + jitter(0-100ms) = 1000-1100ms
Attempt 2: 2000ms + jitter(0-200ms) = 2000-2200ms
Attempt 3: 4000ms + jitter(0-400ms) = 4000-4400ms
Attempt 4: 8000ms + jitter(0-800ms) = 8000-8800ms
Attempt 5: 16000ms + jitter(0-1600ms) = 16000-17600ms

Benefits:
1. Fast recovery for transient errors (1s first retry)
2. Reduces load on failing endpoints (exponential increase)
3. Prevents thundering herd (jitter)
4. Industry best practice

We'll cap at 60 seconds max delay and 5 max retries. 
After that, move to dead letter queue for manual intervention.

Why This Works:
- Shows algorithm knowledge
- Explains benefits clearly
- Provides specific numbers
- Addresses edge cases
```

### 2. Circuit Breaker Pattern
```
Strong Answer:
"To protect failing endpoints, I'll implement circuit breaker:

States:
1. Closed (Normal):
   - All requests allowed
   - Monitor failure rate
   - Open if failures > 50%

2. Open (Failing):
   - Block all requests
   - Wait 5 minutes
   - Transition to half-open

3. Half-Open (Testing):
   - Allow 10% of requests
   - Test endpoint recovery
   - Close if success, open if failure

Implementation:
class CircuitBreaker {
    State state = CLOSED;
    int failures = 0;
    
    boolean allowRequest() {
        if (state == CLOSED) return true;
        if (state == OPEN) {
            if (now() - openedAt > 300000) {
                state = HALF_OPEN;
                return random() < 0.1;
            }
            return false;
        }
        return random() < 0.1;  // HALF_OPEN
    }
    
    void recordResult(boolean success) {
        if (success) {
            if (state == HALF_OPEN && ++successes >= 10) {
                state = CLOSED;
                failures = 0;
            }
        } else {
            if (++failures >= 50) {
                state = OPEN;
                openedAt = now();
            }
        }
    }
}

Benefits:
- Automatic failure detection
- Fast recovery
- Prevents wasted retries
- Protects system resources

Why This Works:
- Complete implementation
- Explains state machine
- Discusses thresholds
- Shows practical thinking
```

### 3. Webhook Signature Verification
```
Strong Answer:
"For security, I'll implement HMAC-SHA256 signatures:

Generation (Our Side):
1. Generate secret during webhook registration
2. For each delivery:
   signature = HMAC-SHA256(secret, payload)
3. Add to request header:
   X-Signature: sha256={signature}

Verification (Customer Side):
1. Retrieve secret (stored during registration)
2. Calculate expected signature:
   expected = HMAC-SHA256(secret, received_payload)
3. Compare using constant-time comparison:
   valid = compare_digest(expected, received_signature)
4. Reject if invalid

Security Benefits:
- Authenticity: Proves webhook is from us
- Integrity: Detects payload tampering
- Non-repudiation: Cannot deny sending

Additional Security:
- Include timestamp in signature (prevent replay)
- Rotate secrets every 90 days
- Support dual secrets during rotation
- Use strong secrets (32+ characters)

This is the industry standard approach used by Stripe, 
GitHub, and other major platforms.

Why This Works:
- Complete security solution
- Explains both sides
- Discusses benefits
- References industry standards
```

## How to Handle Follow-ups

### "How would you handle webhook ordering?"
```
Strong Answer:
"Webhook ordering is challenging in distributed systems. 
Here are three approaches:

Option 1: Sequential Delivery
- Single queue per webhook
- One worker processes sequentially
- Guaranteed order
- Pros: Simple, ordered
- Cons: Lower throughput, head-of-line blocking

Option 2: Sequence Numbers (Recommended)
- Add sequence number to each event
- Parallel delivery
- Customer reorders on their side
- Pros: High throughput, flexible
- Cons: Customer complexity

Implementation:
{
  "event_id": "evt_123",
  "sequence_number": 12345,
  "event_type": "payment.success",
  "data": {...}
}

Customer buffers and reorders by sequence number.

Option 3: Partition by Key
- Partition events by key (e.g., user_id)
- Same key → same partition → ordered
- Different keys → parallel
- Pros: Balanced approach
- Cons: Requires key selection

Recommendation: Option 2 for flexibility and throughput. 
Most use cases don't require strict ordering, and those 
that do can implement it on their side with sequence numbers.

Why This Works:
- Multiple solutions
- Clear recommendation
- Explains trade-offs
- Practical approach
```

### "How would you prevent webhook replay attacks?"
```
Strong Answer:
"To prevent replay attacks, I'll include timestamps in 
the signature:

Implementation:
1. Add timestamp to payload:
   {
     "event_id": "evt_123",
     "timestamp": 1704708000,
     "data": {...}
   }

2. Sign payload with timestamp:
   signature = HMAC-SHA256(secret, payload_with_timestamp)

3. Customer verifies timestamp:
   if abs(now() - event_timestamp) > 300:  # 5 minutes
       return 'Expired webhook', 401

4. Track processed event IDs:
   if event_id in processed_events:
       return 'Duplicate', 200
   
   process_event()
   processed_events.add(event_id)

This prevents:
- Replay attacks (timestamp check)
- Duplicate processing (event ID tracking)
- Man-in-the-middle attacks (signature)

The 5-minute window balances security with clock skew 
tolerance.

Why This Works:
- Complete solution
- Addresses multiple threats
- Practical implementation
- Explains reasoning
```

## Red Flags to Avoid

### ❌ Don't Say:
```
1. "We'll just send HTTP POST requests"
   → Too simplistic, no retry logic

2. "Webhooks will always succeed"
   → Unrealistic, shows lack of experience

3. "We don't need signatures"
   → Security vulnerability

4. "We'll retry forever"
   → Resource exhaustion

5. "Order doesn't matter"
   → May matter for some use cases
```

### ✅ Do Say:
```
1. "Let me clarify the delivery guarantees needed"
   → Shows structured thinking

2. "We'll implement exponential backoff for retries"
   → Industry best practice

3. "HMAC signatures for security"
   → Standard approach

4. "Circuit breaker for failing endpoints"
   → Advanced pattern

5. "Dead letter queue after max retries"
   → Complete failure handling
```

## Closing Strong

### Good Summary
```
"To summarize, I've designed a webhook notification service that:

1. Uses event queue (Kafka) for reliable event capture
2. Implements exponential backoff retry with jitter
3. Provides HMAC-SHA256 signatures for security
4. Uses circuit breaker for failing endpoints
5. Supports at-least-once delivery with idempotency
6. Scales horizontally with worker pool

Key design decisions:
- Asynchronous delivery for throughput
- At-least-once with idempotency keys
- Exponential backoff (1s, 2s, 4s, 8s, 16s)
- Circuit breaker after 50% failure rate
- Dead letter queue after 5 retries

Trade-offs made:
- Eventual delivery for scalability
- Possible duplicates for reliability
- Complexity for robustness

Areas for future improvement:
- Webhook batching for high-volume
- ML-based failure prediction
- Advanced filtering capabilities

I'm happy to dive deeper into any specific area."

Why This Works:
- Concise summary
- Highlights key decisions
- Acknowledges trade-offs
- Shows forward thinking
```

## Practice Questions

### Warm-up:
1. "Design a simple webhook system for a single server"
2. "Implement retry logic with exponential backoff"
3. "How would you verify webhook signatures?"

### Standard:
1. "Design a distributed webhook delivery system"
2. "Handle webhook failures and retries"
3. "Implement circuit breaker for failing endpoints"

### Advanced:
1. "Design webhooks with ordering guarantees"
2. "Implement webhook batching for high volume"
3. "Handle webhook delivery across multiple regions"

Remember: Focus on demonstrating systematic thinking, understanding of distributed systems, and practical engineering judgment. Good luck!
