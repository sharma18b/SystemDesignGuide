# Distributed Messaging System - API Design

## Producer API

### Send Message (Async)
```java
// Java Producer API
Properties props = new Properties();
props.put("bootstrap.servers", "broker1:9092,broker2:9092");
props.put("key.serializer", "StringSerializer");
props.put("value.serializer", "JsonSerializer");
props.put("acks", "all");  // Wait for all replicas
props.put("retries", 3);
props.put("compression.type", "snappy");

Producer<String, Event> producer = new KafkaProducer<>(props);

// Async send with callback
ProducerRecord<String, Event> record = new ProducerRecord<>(
    "user-events",     // topic
    "user123",         // key (for partitioning)
    event              // value
);

producer.send(record, (metadata, exception) -> {
    if (exception == null) {
        System.out.println("Sent to partition " + metadata.partition() 
            + " at offset " + metadata.offset());
    } else {
        exception.printStackTrace();
    }
});
```

### Send Message (Sync)
```java
// Synchronous send (wait for acknowledgment)
try {
    RecordMetadata metadata = producer.send(record).get();
    System.out.println("Offset: " + metadata.offset());
} catch (Exception e) {
    e.printStackTrace();
}
```

### Batch Send
```java
// Configure batching
props.put("batch.size", 16384);      // 16KB batch
props.put("linger.ms", 10);          // Wait 10ms for batch
props.put("buffer.memory", 33554432); // 32MB buffer

// Send multiple messages (automatically batched)
for (Event event : events) {
    producer.send(new ProducerRecord<>("user-events", event));
}

producer.flush();  // Force send all batched messages
```

### Transactional Send
```java
// Configure transactions
props.put("transactional.id", "producer-1");
props.put("enable.idempotence", true);

Producer<String, Event> producer = new KafkaProducer<>(props);
producer.initTransactions();

try {
    producer.beginTransaction();
    
    // Send multiple messages atomically
    producer.send(new ProducerRecord<>("topic1", event1));
    producer.send(new ProducerRecord<>("topic2", event2));
    
    producer.commitTransaction();
} catch (Exception e) {
    producer.abortTransaction();
}
```

## Consumer API

### Subscribe and Consume
```java
// Java Consumer API
Properties props = new Properties();
props.put("bootstrap.servers", "broker1:9092");
props.put("group.id", "analytics-service");
props.put("key.deserializer", "StringDeserializer");
props.put("value.deserializer", "JsonDeserializer");
props.put("auto.offset.reset", "earliest");  // Start from beginning
props.put("enable.auto.commit", "false");    // Manual commit

Consumer<String, Event> consumer = new KafkaConsumer<>(props);
consumer.subscribe(Arrays.asList("user-events"));

while (true) {
    ConsumerRecords<String, Event> records = consumer.poll(Duration.ofMillis(100));
    
    for (ConsumerRecord<String, Event> record : records) {
        System.out.printf("Partition=%d, Offset=%d, Key=%s, Value=%s%n",
            record.partition(), record.offset(), record.key(), record.value());
        
        // Process message
        processEvent(record.value());
    }
    
    // Commit offsets after processing
    consumer.commitSync();
}
```

### Manual Partition Assignment
```java
// Assign specific partitions (no consumer group)
TopicPartition partition0 = new TopicPartition("user-events", 0);
TopicPartition partition1 = new TopicPartition("user-events", 1);

consumer.assign(Arrays.asList(partition0, partition1));

// Seek to specific offset
consumer.seek(partition0, 1000);

// Seek to beginning
consumer.seekToBeginning(Arrays.asList(partition0));

// Seek to end
consumer.seekToEnd(Arrays.asList(partition1));
```

### Seek to Timestamp
```java
// Seek to messages from specific time
long timestamp = System.currentTimeMillis() - 3600000; // 1 hour ago

Map<TopicPartition, Long> timestampsToSearch = new HashMap<>();
timestampsToSearch.put(partition0, timestamp);

Map<TopicPartition, OffsetAndTimestamp> offsets = 
    consumer.offsetsForTimes(timestampsToSearch);

for (Map.Entry<TopicPartition, OffsetAndTimestamp> entry : offsets.entrySet()) {
    consumer.seek(entry.getKey(), entry.getValue().offset());
}
```

## Admin API

### Create Topic
```java
// Admin API
Properties props = new Properties();
props.put("bootstrap.servers", "broker1:9092");

AdminClient admin = AdminClient.create(props);

// Create topic with configuration
NewTopic newTopic = new NewTopic("user-events", 10, (short) 3);
newTopic.configs(Map.of(
    "retention.ms", "604800000",      // 7 days
    "segment.bytes", "1073741824",    // 1GB
    "compression.type", "snappy",
    "cleanup.policy", "delete"
));

admin.createTopics(Collections.singleton(newTopic));
```

### List Topics
```java
// List all topics
ListTopicsResult topics = admin.listTopics();
Set<String> topicNames = topics.names().get();

// List topics with details
Map<String, TopicDescription> descriptions = 
    admin.describeTopics(topicNames).all().get();

for (TopicDescription desc : descriptions.values()) {
    System.out.println("Topic: " + desc.name());
    System.out.println("Partitions: " + desc.partitions().size());
    for (TopicPartitionInfo partition : desc.partitions()) {
        System.out.println("  Partition " + partition.partition() 
            + ": Leader=" + partition.leader().id()
            + ", Replicas=" + partition.replicas().size());
    }
}
```

### Delete Topic
```java
// Delete topic
admin.deleteTopics(Collections.singleton("user-events"));
```

### Alter Topic Configuration
```java
// Update topic configuration
ConfigResource resource = new ConfigResource(
    ConfigResource.Type.TOPIC, "user-events");

ConfigEntry retentionConfig = new ConfigEntry(
    "retention.ms", "1209600000");  // 14 days

Map<ConfigResource, Config> configs = new HashMap<>();
configs.put(resource, new Config(Collections.singleton(retentionConfig)));

admin.alterConfigs(configs);
```

## REST API (Kafka REST Proxy)

### Produce Message
```http
POST /topics/user-events
Content-Type: application/vnd.kafka.json.v2+json

{
  "records": [
    {
      "key": "user123",
      "value": {
        "event_type": "login",
        "timestamp": "2024-01-08T10:00:00Z",
        "user_id": "user123"
      }
    }
  ]
}

Response 200 OK:
{
  "offsets": [
    {
      "partition": 0,
      "offset": 12345,
      "error_code": null,
      "error": null
    }
  ]
}
```

### Create Consumer
```http
POST /consumers/analytics-service
Content-Type: application/vnd.kafka.v2+json

{
  "name": "consumer-1",
  "format": "json",
  "auto.offset.reset": "earliest",
  "auto.commit.enable": "false"
}

Response 200 OK:
{
  "instance_id": "consumer-1",
  "base_uri": "http://proxy:8082/consumers/analytics-service/instances/consumer-1"
}
```

### Subscribe to Topic
```http
POST /consumers/analytics-service/instances/consumer-1/subscription
Content-Type: application/vnd.kafka.v2+json

{
  "topics": ["user-events"]
}

Response 204 No Content
```

### Consume Messages
```http
GET /consumers/analytics-service/instances/consumer-1/records
Accept: application/vnd.kafka.json.v2+json

Response 200 OK:
[
  {
    "topic": "user-events",
    "key": "user123",
    "value": {"event_type": "login", ...},
    "partition": 0,
    "offset": 12345,
    "timestamp": 1704708000000
  }
]
```

### Commit Offsets
```http
POST /consumers/analytics-service/instances/consumer-1/offsets
Content-Type: application/vnd.kafka.v2+json

{
  "offsets": [
    {
      "topic": "user-events",
      "partition": 0,
      "offset": 12346
    }
  ]
}

Response 204 No Content
```

## Monitoring API

### Get Broker Metrics
```http
GET /metrics/brokers/1

Response 200 OK:
{
  "broker_id": 1,
  "messages_in_per_sec": 10000,
  "bytes_in_per_sec": 10485760,
  "bytes_out_per_sec": 104857600,
  "request_latency_ms": {
    "p50": 2,
    "p95": 8,
    "p99": 15
  },
  "under_replicated_partitions": 0,
  "offline_partitions": 0
}
```

### Get Consumer Lag
```http
GET /consumers/analytics-service/lag

Response 200 OK:
{
  "group": "analytics-service",
  "partitions": [
    {
      "topic": "user-events",
      "partition": 0,
      "current_offset": 12345,
      "log_end_offset": 12350,
      "lag": 5
    }
  ],
  "total_lag": 50
}
```

## Client Configuration Best Practices

### Producer Configuration
```properties
# Reliability
acks=all                    # Wait for all replicas
retries=3                   # Retry failed sends
max.in.flight.requests.per.connection=5
enable.idempotence=true     # Exactly-once semantics

# Performance
batch.size=16384            # 16KB batches
linger.ms=10                # Wait 10ms for batching
compression.type=snappy     # Fast compression
buffer.memory=33554432      # 32MB buffer

# Timeouts
request.timeout.ms=30000    # 30s request timeout
delivery.timeout.ms=120000  # 2min total timeout
```

### Consumer Configuration
```properties
# Consumer Group
group.id=analytics-service
auto.offset.reset=earliest  # Start from beginning

# Offset Management
enable.auto.commit=false    # Manual commit
auto.commit.interval.ms=5000

# Performance
fetch.min.bytes=1024        # Min 1KB per fetch
fetch.max.wait.ms=500       # Max 500ms wait
max.poll.records=500        # Max 500 records per poll
max.partition.fetch.bytes=1048576  # 1MB per partition

# Session Management
session.timeout.ms=10000    # 10s session timeout
heartbeat.interval.ms=3000  # 3s heartbeat
max.poll.interval.ms=300000 # 5min max poll interval
```

This API design provides comprehensive interfaces for producing, consuming, and managing messages in the distributed messaging system.
