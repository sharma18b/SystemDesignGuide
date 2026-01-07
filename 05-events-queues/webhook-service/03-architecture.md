# Webhook Notification Service - System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Application Services                       │
│  (Generate events: payments, orders, users)             │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│              Event Publisher                            │
│  (Publish events to message queue)                      │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│              Event Queue (Kafka)                        │
│  (Durable event storage and distribution)               │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│           Webhook Dispatcher Service                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │Dispatch 1│  │Dispatch 2│  │Dispatch 3│  ...         │
│  └──────────┘  └──────────┘  └──────────┘              │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│           Delivery Queue (Redis)                        │
│  (Pending webhook deliveries)                           │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│              Delivery Workers                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Worker 1 │  │ Worker 2 │  │ Worker 3 │  ...         │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
└───────┼────────────┼────────────┼────────────────────────┘
        │            │            │
        ▼            ▼            ▼
┌─────────────────────────────────────────────────────────┐
│           External Webhook Endpoints                    │
│  (Customer servers receiving webhooks)                  │
└─────────────────────────────────────────────────────────┘
```

## Event Flow

### Event to Webhook Flow
```
1. Event Generated
   ├── Event type: payment.success
   ├── Event data: {amount: 100, user_id: 123}
   └── Event ID: uuid

2. Event Published
   ├── Publish to Kafka topic
   ├── Partition by event type
   └── Replicate for durability

3. Dispatcher Consumes Event
   ├── Read from Kafka
   ├── Find matching webhooks
   ├── Fan-out to all subscribers
   └── Queue for delivery

4. Worker Delivers Webhook
   ├── Pick from delivery queue
   ├── Build HTTP request
   ├── Add signature
   ├── Send to endpoint
   └── Handle response

5. Record Result
   ├── Update delivery status
   ├── Schedule retry if failed
   ├── Update metrics
   └── Trigger alerts if needed
```

## Webhook Dispatcher Architecture

### Dispatcher Components
```
┌─────────────────────────────────────────────────────────┐
│              Webhook Dispatcher                         │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Event        │  │ Webhook      │  │ Fan-out      │  │
│  │ Consumer     │  │ Matcher      │  │ Engine       │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                  │                  │         │
│         ▼                  ▼                  ▼         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Event        │  │ Subscription │  │ Delivery     │  │
│  │ Validator    │  │ Cache        │  │ Queue        │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Webhook Matching
```
Event: payment.success

Matching Process:
1. Query subscriptions for event type
   SELECT webhook_id FROM subscriptions 
   WHERE event_type = 'payment.success' 
   AND enabled = TRUE

2. Apply filters (if configured)
   - Amount > $100
   - User tier = 'premium'
   - Region = 'US'

3. Fan-out to matched webhooks
   - Create delivery record for each
   - Add to delivery queue
   - Track fan-out count

Optimization:
- Cache subscriptions in Redis
- Index by event type
- Batch database queries
- Parallel fan-out
```

## Delivery Worker Architecture

### Worker Components
```
┌─────────────────────────────────────────────────────────┐
│              Delivery Worker                            │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Queue        │  │ HTTP Client  │  │ Retry        │  │
│  │ Consumer     │  │              │  │ Manager      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                  │                  │         │
│         ▼                  ▼                  ▼         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Signature    │  │ Circuit      │  │ Result       │  │
│  │ Generator    │  │ Breaker      │  │ Recorder     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### HTTP Request Building
```
Webhook Request:
POST https://customer.example.com/webhooks
Content-Type: application/json
X-Webhook-ID: webhook_abc123
X-Event-ID: event_xyz789
X-Event-Type: payment.success
X-Signature: sha256=abc123def456...
X-Delivery-Attempt: 1
User-Agent: WebhookService/1.0

{
  "event_id": "event_xyz789",
  "event_type": "payment.success",
  "timestamp": "2024-01-08T10:00:00Z",
  "data": {
    "payment_id": "pay_123",
    "amount": 100.00,
    "currency": "USD",
    "status": "success"
  }
}

Signature Calculation:
signature = HMAC-SHA256(secret, payload)
X-Signature: sha256={signature}
```

### Response Handling
```
Success (2xx):
- Record successful delivery
- Update metrics
- Complete delivery

Retry (5xx, timeout, network error):
- Calculate retry delay
- Schedule retry
- Increment attempt count
- Update status

Permanent Failure (4xx except 429):
- Record failure
- Move to dead letter queue
- Alert webhook owner
- Don't retry

Rate Limited (429):
- Respect Retry-After header
- Schedule retry accordingly
- Implement backoff
```

## Retry Architecture

### Retry Queue Management
```
Priority Queues by Attempt:

Attempt 1 (Immediate):
- Priority: Highest
- Delay: 0 seconds
- Queue: retry_queue_0

Attempt 2:
- Priority: High
- Delay: 1 second
- Queue: retry_queue_1

Attempt 3:
- Priority: Medium
- Delay: 2 seconds
- Queue: retry_queue_2

Attempt 4:
- Priority: Low
- Delay: 4 seconds
- Queue: retry_queue_4

Attempt 5:
- Priority: Lowest
- Delay: 8 seconds
- Queue: retry_queue_8

Dead Letter Queue:
- After max retries
- Manual intervention
- Replay capability
```

### Exponential Backoff with Jitter
```
Retry Delay Calculation:
base_delay = 1000ms
max_delay = 60000ms
attempt = retry_count

delay = min(base_delay * 2^attempt, max_delay)
jitter = random(0, delay * 0.1)
final_delay = delay + jitter

Example:
Attempt 1: 1000ms + jitter(0-100ms) = 1000-1100ms
Attempt 2: 2000ms + jitter(0-200ms) = 2000-2200ms
Attempt 3: 4000ms + jitter(0-400ms) = 4000-4400ms
Attempt 4: 8000ms + jitter(0-800ms) = 8000-8800ms
Attempt 5: 16000ms + jitter(0-1600ms) = 16000-17600ms

Jitter Benefits:
- Prevents thundering herd
- Distributes retry load
- Reduces endpoint pressure
```

## Circuit Breaker Pattern

### Circuit Breaker States
```
Closed (Normal):
- All requests allowed
- Monitor failure rate
- Transition to Open if failures > 50%

Open (Failing):
- All requests blocked
- Wait for timeout (60 seconds)
- Transition to Half-Open

Half-Open (Testing):
- Allow limited requests (10%)
- Test endpoint recovery
- Transition to Closed if success
- Transition to Open if failure

Implementation:
class CircuitBreaker {
    State state = CLOSED;
    int failureCount = 0;
    int successCount = 0;
    long openedAt = 0;
    
    boolean allowRequest(String webhookId) {
        if (state == CLOSED) {
            return true;
        } else if (state == OPEN) {
            if (now() - openedAt > 60000) {
                state = HALF_OPEN;
                return true;
            }
            return false;
        } else {  // HALF_OPEN
            return random() < 0.1;  // 10% of requests
        }
    }
    
    void recordSuccess() {
        if (state == HALF_OPEN) {
            successCount++;
            if (successCount >= 10) {
                state = CLOSED;
                failureCount = 0;
            }
        }
    }
    
    void recordFailure() {
        failureCount++;
        
        if (state == CLOSED && failureCount >= 50) {
            state = OPEN;
            openedAt = now();
        } else if (state == HALF_OPEN) {
            state = OPEN;
            openedAt = now();
        }
    }
}
```

## Monitoring and Observability

### Key Metrics
```
Delivery Metrics:
- Webhooks delivered/second
- Delivery success rate
- Delivery latency (P50, P95, P99)
- Retry rate
- Dead letter queue size

Endpoint Metrics:
- Response time per endpoint
- Success rate per endpoint
- Error rate per endpoint
- Circuit breaker state

System Metrics:
- Queue depth
- Worker utilization
- Dispatcher lag
- Database performance
```

### Distributed Tracing
```
Trace webhook delivery:

Span 1: Event Published
- Duration: 10ms
- Tags: event_id, event_type

Span 2: Webhook Matched
- Duration: 5ms
- Tags: webhook_count

Span 3: Delivery Queued
- Duration: 2ms
- Tags: queue_name

Span 4: HTTP Request
- Duration: 200ms
- Tags: endpoint_url, status_code

Span 5: Result Recorded
- Duration: 20ms
- Tags: delivery_status

Total: 237ms
Identify bottlenecks and optimize
```

This architecture provides a robust, scalable foundation for reliable webhook delivery at massive scale.
