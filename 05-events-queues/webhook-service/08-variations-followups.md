# Webhook Notification Service - Variations and Follow-ups

## Common Interview Variations

### 1. Implement Webhook Replay
**Question**: "How would you allow customers to replay webhooks for a specific time period?"

**Solution**:
```
Requirements:
- Replay webhooks from last 7 days
- Filter by event type, date range
- Maintain original order
- Avoid duplicate processing

Implementation:
class WebhookReplay {
    void replayWebhooks(String webhookId, LocalDateTime start, LocalDateTime end) {
        // Query historical deliveries
        List<Delivery> deliveries = database.query(
            "SELECT * FROM webhook_deliveries " +
            "WHERE webhook_id = ? " +
            "AND created_at BETWEEN ? AND ? " +
            "ORDER BY created_at ASC",
            webhookId, start, end
        );
        
        // Replay each delivery
        for (Delivery delivery : deliveries) {
            // Add replay marker
            delivery.headers.put("X-Webhook-Replay", "true");
            delivery.headers.put("X-Original-Delivery-ID", delivery.id);
            
            // Queue for delivery
            queueDelivery(delivery);
        }
    }
}

Customer Handling:
@app.route('/webhooks', methods=['POST'])
def handle_webhook():
    is_replay = request.headers.get('X-Webhook-Replay') == 'true'
    
    if is_replay:
        original_id = request.headers.get('X-Original-Delivery-ID')
        if already_processed(original_id):
            return 'Already processed', 200
    
    process_webhook(request.json)
    return 'OK', 200

Benefits:
- Recover from customer outages
- Reprocess after bug fixes
- Audit and compliance
```

### 2. Handle Webhook Ordering
**Question**: "How would you guarantee webhooks are delivered in the order events occurred?"

**Solution**:
```
Challenge:
- Parallel workers deliver out of order
- Retries cause reordering
- Network delays vary

Solutions:

Option 1: Sequential Delivery per Webhook
- Single queue per webhook
- One worker per webhook
- Sequential processing
- Pros: Guaranteed order
- Cons: Lower throughput, head-of-line blocking

Option 2: Sequence Numbers
- Add sequence number to each event
- Customer reorders on their side
- Parallel delivery
- Pros: High throughput
- Cons: Customer complexity

Implementation:
{
  "event_id": "evt_123",
  "event_type": "payment.success",
  "sequence_number": 12345,
  "data": {...}
}

Customer Side:
class OrderedWebhookProcessor {
    TreeMap<Long, Event> buffer = new TreeMap<>();
    long nextSequence = 0;
    
    void handleWebhook(Event event) {
        buffer.put(event.sequenceNumber, event);
        
        // Process in order
        while (buffer.containsKey(nextSequence)) {
            Event e = buffer.remove(nextSequence);
            process(e);
            nextSequence++;
        }
    }
}

Option 3: Partition by Key
- Partition events by key (e.g., user_id)
- Same key → same partition → ordered
- Different keys → parallel
- Pros: Balanced approach
- Cons: Requires key selection

Recommendation: Option 2 (sequence numbers) for flexibility
```

### 3. Implement Webhook Filtering at Scale
**Question**: "How would you efficiently filter events before sending webhooks?"

**Solution**:
```
Filtering Strategies:

1. Subscription-Level Filtering:
{
  "webhook_id": "wh_123",
  "subscriptions": [
    {
      "event_type": "payment.success",
      "filters": {
        "amount": {"gt": 100},
        "currency": {"in": ["USD", "EUR"]},
        "user.tier": {"eq": "premium"}
      }
    }
  ]
}

2. Efficient Filter Evaluation:
class FilterEngine {
    boolean matches(Event event, Filter filter) {
        // Compile filters to bytecode for fast evaluation
        CompiledFilter compiled = compileFilter(filter);
        return compiled.evaluate(event);
    }
    
    CompiledFilter compileFilter(Filter filter) {
        // Convert JSON filter to executable code
        // Cache compiled filters
        return cache.computeIfAbsent(filter, f -> compile(f));
    }
}

3. Index-Based Filtering:
- Index events by common filter fields
- Query index instead of scanning all events
- Much faster for large event volumes

4. Bloom Filters for Negative Filtering:
- Quickly eliminate non-matching events
- Probabilistic but fast
- Reduce evaluation overhead

Performance:
- Simple filters: <1ms evaluation
- Complex filters: <10ms evaluation
- Indexed filters: <0.1ms evaluation

Recommendation: Compile filters + indexing for best performance
```

### 4. Handle Webhook Versioning
**Question**: "How would you handle webhook payload schema changes over time?"

**Solution**:
```
Versioning Strategies:

1. URL-Based Versioning:
- v1: https://customer.com/webhooks/v1
- v2: https://customer.com/webhooks/v2
- Customer maintains both endpoints
- Gradual migration

2. Header-Based Versioning:
X-Webhook-Version: 2.0

Customer checks version and processes accordingly

3. Payload Versioning:
{
  "version": "2.0",
  "event_type": "payment.success",
  "data": {...}
}

4. Backward Compatible Changes:
- Add optional fields only
- Never remove fields
- Deprecate instead of delete
- Maintain compatibility

Migration Process:
1. Announce new version (30 days notice)
2. Support both versions (90 days)
3. Deprecate old version
4. Remove old version (after 180 days)

Implementation:
class VersionedWebhook {
    void sendWebhook(Webhook webhook, Event event) {
        String version = webhook.version;
        
        if (version.equals("1.0")) {
            payload = transformToV1(event);
        } else if (version.equals("2.0")) {
            payload = transformToV2(event);
        }
        
        sendHTTP(webhook.url, payload, version);
    }
}

Best Practices:
- Semantic versioning (major.minor.patch)
- Changelog documentation
- Migration guides
- Deprecation warnings
```

### 5. Implement Webhook Batching
**Question**: "How would you batch multiple events into a single webhook call?"

**Solution**:
```
Batching Strategy:

Configuration:
{
  "webhook_id": "wh_123",
  "batching": {
    "enabled": true,
    "max_batch_size": 100,
    "max_wait_time_ms": 1000
  }
}

Implementation:
class WebhookBatcher {
    Map<String, List<Event>> batches = new ConcurrentHashMap<>();
    
    void addEvent(String webhookId, Event event) {
        List<Event> batch = batches.computeIfAbsent(
            webhookId, 
            k -> new ArrayList<>()
        );
        
        synchronized (batch) {
            batch.add(event);
            
            // Send if batch full
            if (batch.size() >= maxBatchSize) {
                sendBatch(webhookId, new ArrayList<>(batch));
                batch.clear();
            }
        }
    }
    
    void flushBatches() {
        // Run every 1 second
        for (Map.Entry<String, List<Event>> entry : batches.entrySet()) {
            List<Event> batch = entry.getValue();
            
            synchronized (batch) {
                if (!batch.isEmpty()) {
                    sendBatch(entry.getKey(), new ArrayList<>(batch));
                    batch.clear();
                }
            }
        }
    }
}

Batch Payload:
{
  "batch_id": "batch_abc123",
  "events": [
    {
      "event_id": "evt_1",
      "event_type": "payment.success",
      "data": {...}
    },
    {
      "event_id": "evt_2",
      "event_type": "payment.success",
      "data": {...}
    }
  ],
  "batch_size": 2
}

Benefits:
- Reduce HTTP overhead
- Higher throughput (10x)
- Lower cost
- Better efficiency

Trade-offs:
- Increased latency (up to 1 second)
- Larger payloads
- Customer must handle batches
```

### 6. Implement Webhook Rate Limiting
**Question**: "How would you rate limit webhook deliveries to prevent overwhelming customer endpoints?"

**Solution**:
```
Rate Limiting Strategies:

1. Per-Endpoint Rate Limiting:
class EndpointRateLimiter {
    boolean allowDelivery(String webhookId) {
        String key = "rate_limit:" + webhookId;
        long count = redis.incr(key);
        
        if (count == 1) {
            redis.expire(key, 60);  // 1 minute window
        }
        
        return count <= 100;  // 100 deliveries per minute
    }
}

2. Token Bucket:
- Refill rate: 10 tokens/second
- Bucket capacity: 100 tokens
- Allows bursts
- Smooth rate limiting

3. Adaptive Rate Limiting:
- Monitor endpoint response times
- Reduce rate if slow (>5s)
- Increase rate if fast (<1s)
- Self-adjusting

Implementation:
class AdaptiveRateLimiter {
    void adjustRate(String webhookId, long responseTime) {
        RateLimit limit = getRateLimit(webhookId);
        
        if (responseTime > 5000) {
            limit.rate *= 0.8;  // Reduce by 20%
        } else if (responseTime < 1000) {
            limit.rate *= 1.1;  // Increase by 10%
        }
        
        limit.rate = Math.max(10, Math.min(1000, limit.rate));
        updateRateLimit(webhookId, limit);
    }
}

4. Respect Retry-After Header:
- Endpoint returns 429 with Retry-After
- Honor the delay
- Don't retry before specified time

Benefits:
- Protect customer endpoints
- Better reliability
- Fewer failures
- Improved relationships
```

### 7. Handle Webhook Failures with Escalation
**Question**: "How would you escalate webhook failures to notify the webhook owner?"

**Solution**:
```
Escalation Levels:

Level 1: First Failure
- Log failure
- Retry automatically
- No notification

Level 2: Multiple Failures (3+)
- Send email notification
- Include error details
- Suggest fixes

Level 3: Persistent Failures (10+)
- Urgent email/SMS
- Disable webhook temporarily
- Require manual intervention

Level 4: Complete Failure (Max retries)
- Move to dead letter queue
- Alert on-call engineer
- Create support ticket

Implementation:
class FailureEscalation {
    void handleFailure(Delivery delivery) {
        int failures = getConsecutiveFailures(delivery.webhookId);
        
        if (failures == 3) {
            sendEmail(delivery.userId, 
                "Webhook failing", 
                "Your webhook has failed 3 times");
        } else if (failures == 10) {
            sendUrgentAlert(delivery.userId);
            disableWebhook(delivery.webhookId);
        } else if (delivery.attemptNumber >= maxRetries) {
            moveToDLQ(delivery);
            createSupportTicket(delivery);
        }
    }
}

Notification Templates:
Subject: Webhook Delivery Failures
Body:
Your webhook {webhook_id} has failed {failure_count} times.

Last error: {error_message}
Endpoint: {webhook_url}
Event type: {event_type}

Suggested actions:
1. Check endpoint availability
2. Review error logs
3. Test webhook endpoint
4. Contact support if issue persists

Benefits:
- Proactive problem detection
- Faster resolution
- Better customer experience
```

These variations demonstrate deep understanding of webhook delivery challenges and practical solutions for real-world scenarios.
