# Distributed Messaging System - Variations and Follow-ups

## Common Interview Variations

### 1. Design a Message Queue with Priority Support
**Question**: "How would you add priority queue functionality to the messaging system?"

**Solution**:
```
Approach 1: Multiple Topics
- Create separate topics per priority
- High-priority: user-events-high
- Medium-priority: user-events-medium
- Low-priority: user-events-low

Consumers:
- Poll high-priority topic first
- Fall back to medium, then low
- Weighted polling (80% high, 15% medium, 5% low)

Pros: Simple, leverages existing system
Cons: More topics, manual routing

Approach 2: Priority Headers + Consumer Filtering
- Single topic with priority header
- Consumer fetches all messages
- Processes by priority order
- Commits offsets selectively

Pros: Single topic, flexible
Cons: Consumer complexity, wasted bandwidth

Approach 3: Separate Partitions by Priority
- Partition 0-3: High priority
- Partition 4-7: Medium priority
- Partition 8-9: Low priority

Consumers:
- Assign partitions by priority
- More consumers on high-priority partitions

Pros: Balanced approach
Cons: Fixed priority distribution

Recommendation: Approach 1 for simplicity
```

### 2. Implement Exactly-Once Semantics
**Question**: "How would you guarantee exactly-once message delivery?"

**Solution**:
```
Components Needed:
1. Idempotent Producer
2. Transactional Producer
3. Transactional Consumer
4. Transaction Coordinator

Producer Side:
// Enable idempotence
props.put("enable.idempotence", true);
props.put("transactional.id", "producer-1");

producer.initTransactions();
producer.beginTransaction();
producer.send(record1);
producer.send(record2);
producer.commitTransaction();

Consumer Side:
props.put("isolation.level", "read_committed");

consumer.subscribe(topics);
while (true) {
    records = consumer.poll();
    processRecords(records);
    
    // Commit offsets transactionally
    producer.beginTransaction();
    producer.send(outputRecords);
    producer.sendOffsetsToTransaction(offsets, groupId);
    producer.commitTransaction();
}

Guarantees:
- Producer: Exactly-once to broker
- Consumer: Exactly-once processing
- End-to-end: Exactly-once semantics

Trade-offs:
- 30% throughput reduction
- 20-30ms latency increase
- More complex error handling
```

### 3. Handle Message Ordering Across Partitions
**Question**: "How would you maintain global ordering across all partitions?"

**Solution**:
```
Problem:
Topic with 10 partitions → No global ordering

Option 1: Single Partition (Simple)
- Create topic with 1 partition
- All messages ordered globally
- Throughput: ~100K msg/s max
- Use when: Strict ordering required, low volume

Option 2: Sequence Numbers (Complex)
- Add sequence number to each message
- Consumer buffers messages
- Reorders by sequence number
- Delivers in order

Implementation:
class OrderedConsumer {
    TreeMap<Long, Message> buffer = new TreeMap<>();
    long nextSequence = 0;
    
    void consume() {
        records = consumer.poll();
        for (record : records) {
            buffer.put(record.sequence, record);
        }
        
        // Deliver ordered messages
        while (buffer.containsKey(nextSequence)) {
            Message msg = buffer.remove(nextSequence);
            process(msg);
            nextSequence++;
        }
    }
}

Pros: Maintains throughput
Cons: Complex, buffering overhead, potential gaps

Option 3: Timestamp-Based Ordering
- Use message timestamps
- Consumer buffers for time window (e.g., 1 second)
- Delivers messages in timestamp order
- Handles clock skew

Recommendation: Single partition if possible, otherwise accept partition-level ordering
```

### 4. Implement Dead Letter Queue
**Question**: "How would you handle messages that fail processing repeatedly?"

**Solution**:
```
Architecture:
Main Topic: user-events
DLQ Topic: user-events-dlq
Retry Topic: user-events-retry

Flow:
1. Consumer processes message
2. If fails: Send to retry topic
3. Retry consumer processes with backoff
4. After N retries: Send to DLQ
5. Manual intervention for DLQ messages

Implementation:
class RetryableConsumer {
    int maxRetries = 3;
    
    void consume() {
        records = consumer.poll();
        for (record : records) {
            try {
                process(record);
                consumer.commitSync();
            } catch (Exception e) {
                int retryCount = getRetryCount(record);
                
                if (retryCount < maxRetries) {
                    // Send to retry topic with backoff
                    long delay = (long) Math.pow(2, retryCount) * 1000;
                    sendToRetry(record, retryCount + 1, delay);
                } else {
                    // Send to DLQ
                    sendToDLQ(record, e);
                }
            }
        }
    }
}

DLQ Message Format:
{
    "original_topic": "user-events",
    "original_partition": 0,
    "original_offset": 12345,
    "original_message": {...},
    "error": "NullPointerException",
    "retry_count": 3,
    "timestamp": 1704708000000
}

Monitoring:
- Alert on DLQ message count
- Dashboard for DLQ messages
- Replay capability from DLQ
```

### 5. Implement Message Filtering at Broker
**Question**: "How would you filter messages at the broker to reduce network traffic?"

**Solution**:
```
Approach 1: Topic-Level Filtering
- Create separate topics per filter
- user-events-login
- user-events-purchase
- user-events-profile

Pros: Simple, efficient
Cons: Topic explosion, producer complexity

Approach 2: Consumer-Side Filtering
- Consumer fetches all messages
- Filters in application code
- Discards unwanted messages

Pros: Flexible, no broker changes
Cons: Wasted bandwidth, higher latency

Approach 3: Broker-Side Filtering (Custom)
- Add filtering capability to broker
- Consumer specifies filter in fetch request
- Broker applies filter before sending

Implementation:
// Consumer specifies filter
consumer.subscribe("user-events", 
    filter: "event_type = 'login'");

// Broker applies filter
for (message : partition) {
    if (matchesFilter(message, filter)) {
        send(message);
    }
}

Pros: Efficient, reduces bandwidth
Cons: Broker complexity, CPU overhead

Approach 4: Kafka Streams Filtering
- Use Kafka Streams for filtering
- Create filtered topics
- Consumers read filtered topics

KStream<String, Event> events = builder.stream("user-events");
events.filter((key, value) -> value.type.equals("login"))
      .to("user-login-events");

Pros: Leverages existing framework
Cons: Additional component, latency

Recommendation: Approach 1 for known filters, Approach 4 for dynamic filtering
```

### 6. Handle Schema Evolution
**Question**: "How would you handle message schema changes over time?"

**Solution**:
```
Schema Registry:
- Central repository for schemas
- Version management
- Compatibility checking
- Schema validation

Schema Evolution Strategies:
1. Backward Compatible:
   - Add optional fields
   - Remove fields (with defaults)
   - Old consumers can read new messages

2. Forward Compatible:
   - Add fields (with defaults)
   - Old producers, new consumers
   - New consumers can read old messages

3. Full Compatible:
   - Both backward and forward
   - Safest approach
   - Most restrictive

Implementation:
// Producer
Schema schema = schemaRegistry.getLatestSchema("user-events");
byte[] serialized = avroSerializer.serialize(event, schema);
producer.send(new ProducerRecord<>("user-events", serialized));

// Consumer
Schema schema = schemaRegistry.getSchema("user-events", version);
Event event = avroDeserializer.deserialize(bytes, schema);

Schema Versioning:
v1: {name, email}
v2: {name, email, phone}  // Added phone (optional)
v3: {name, email, phone, address}  // Added address (optional)

Compatibility Check:
- Prevent breaking changes
- Enforce compatibility rules
- Reject incompatible schemas
```

### 7. Implement Multi-Tenancy
**Question**: "How would you support multiple tenants in the same cluster?"

**Solution**:
```
Approach 1: Topic-Based Isolation
- Separate topics per tenant
- tenant1-user-events
- tenant2-user-events

Pros: Simple, strong isolation
Cons: Topic explosion, management overhead

Approach 2: Partition-Based Isolation
- Single topic, partitions per tenant
- Partition 0-9: Tenant 1
- Partition 10-19: Tenant 2

Pros: Fewer topics, easier management
Cons: Weaker isolation, shared resources

Approach 3: Cluster-Based Isolation
- Separate clusters per tenant
- Complete isolation
- Independent scaling

Pros: Strongest isolation, independent SLAs
Cons: Highest cost, management complexity

Approach 4: Namespace-Based (Pulsar-style)
- Hierarchical namespaces
- tenant1/namespace1/topic1
- tenant2/namespace1/topic1

Pros: Clean organization, flexible
Cons: Requires custom implementation

Resource Quotas:
- Produce rate: 1000 msg/s per tenant
- Consume rate: 5000 msg/s per tenant
- Storage: 100 GB per tenant
- Partitions: 100 per tenant

Monitoring:
- Per-tenant metrics
- Per-tenant alerting
- Per-tenant billing

Recommendation: Approach 1 for strong isolation, Approach 2 for cost efficiency
```

### 8. Implement Message Deduplication
**Question**: "How would you detect and remove duplicate messages?"

**Solution**:
```
Producer-Side Deduplication:
// Enable idempotent producer
props.put("enable.idempotence", true);

// Kafka automatically deduplicates
// Based on producer ID and sequence number

Consumer-Side Deduplication:
class DeduplicatingConsumer {
    Set<String> seenIds = new HashSet<>();
    
    void consume() {
        records = consumer.poll();
        for (record : records) {
            String messageId = record.key();
            
            if (!seenIds.contains(messageId)) {
                process(record);
                seenIds.add(messageId);
            }
        }
        consumer.commitSync();
    }
}

Challenges:
- Memory usage (store all IDs)
- Persistence (survive restarts)
- Expiration (remove old IDs)

Optimized Approach:
- Use Bloom filter (probabilistic)
- Store in Redis (distributed)
- TTL-based expiration
- 99.9% accuracy, 1% false positives

class BloomFilterDeduplicator {
    BloomFilter<String> filter = BloomFilter.create(
        Funnels.stringFunnel(),
        1000000,  // Expected insertions
        0.01      // False positive rate
    );
    
    boolean isDuplicate(String messageId) {
        if (filter.mightContain(messageId)) {
            return true;  // Probably duplicate
        }
        filter.put(messageId);
        return false;
    }
}
```

These variations demonstrate deep understanding of messaging system challenges and practical solutions for real-world scenarios.
