# Facebook Messenger - Scaling Considerations

## WebSocket Connection Management at Scale

### Connection Distribution Strategy
- **Server Capacity**: 2,000-5,000 connections per server instance
- **Load Balancing**: Consistent hashing for sticky session management
- **Connection Pooling**: Reuse connections across multiple conversations
- **Geographic Distribution**: Route users to nearest data center
- **Failover Mechanism**: Automatic connection migration during server failures
- **Health Monitoring**: Real-time monitoring of connection health and server load

### WebSocket Server Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                WebSocket Gateway Cluster                    │
├─────────────────────────────────────────────────────────────┤
│  Region: US-East                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ WS Server 1 │  │ WS Server 2 │  │ WS Server N │        │
│  │ 2K Conns    │  │ 2K Conns    │  │ 2K Conns    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│         │                 │                 │              │
│         └─────────────────┼─────────────────┘              │
│                          │                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            Connection Registry                      │   │
│  │         (Redis Cluster)                            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Connection Lifecycle Management
- **Connection Establishment**: 2-second timeout for WebSocket handshake
- **Authentication**: JWT token validation within 500ms
- **Heartbeat Interval**: 30-second ping/pong for connection health
- **Idle Timeout**: 10-minute timeout for inactive connections
- **Graceful Shutdown**: 30-second grace period for connection migration
- **Reconnection Logic**: Exponential backoff with jitter (1s, 2s, 4s, 8s, max 30s)

### Scaling WebSocket Connections

#### Horizontal Scaling Approach
```javascript
// Connection distribution algorithm
const getServerForUser = (userId, serverList) => {
  const hash = consistentHash(userId);
  const serverIndex = hash % serverList.length;
  return serverList[serverIndex];
};

// Server capacity monitoring
const monitorServerCapacity = () => {
  const currentConnections = getActiveConnections();
  const maxCapacity = getMaxCapacity();
  const utilizationRate = currentConnections / maxCapacity;
  
  if (utilizationRate > 0.8) {
    triggerAutoScaling();
  }
};
```

#### Auto-scaling Policies
- **Scale-out Trigger**: >80% connection capacity utilization
- **Scale-in Trigger**: <40% connection capacity utilization
- **Scaling Cooldown**: 5-minute cooldown between scaling events
- **Maximum Instances**: 1,000 WebSocket servers per region
- **Minimum Instances**: 50 WebSocket servers per region for redundancy

## Message Queue Scaling with Apache Kafka

### Kafka Cluster Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Kafka Cluster                            │
├─────────────────────────────────────────────────────────────┤
│  Topic: messages                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Partition 0 │  │ Partition 1 │  │ Partition N │        │
│  │ Leader: B1  │  │ Leader: B2  │  │ Leader: B3  │        │
│  │ Replicas:   │  │ Replicas:   │  │ Replicas:   │        │
│  │ B2, B3      │  │ B1, B3      │  │ B1, B2      │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                            │
│  Topic: presence_updates                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Partition 0 │  │ Partition 1 │  │ Partition N │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Kafka Configuration for Scale
```properties
# Broker Configuration
num.network.threads=8
num.io.threads=16
socket.send.buffer.bytes=102400
socket.receive.buffer.bytes=102400
socket.request.max.bytes=104857600

# Topic Configuration
num.partitions=1000
default.replication.factor=3
min.insync.replicas=2
unclean.leader.election.enable=false

# Performance Tuning
log.segment.bytes=1073741824
log.retention.hours=168
log.retention.bytes=1073741824
log.cleanup.policy=delete
compression.type=lz4
```

### Message Partitioning Strategy
- **Partition Key**: conversation_id for message ordering
- **Partition Count**: 1,000+ partitions per topic for parallelism
- **Consumer Groups**: Separate consumer groups for different services
- **Rebalancing**: Automatic partition rebalancing on consumer failures
- **Ordering Guarantee**: Per-partition ordering maintained
- **Throughput**: 5M+ messages per second across all partitions

### Kafka Consumer Scaling
```java
// Consumer configuration for high throughput
Properties props = new Properties();
props.put("bootstrap.servers", "kafka-cluster:9092");
props.put("group.id", "message-processor");
props.put("enable.auto.commit", "false");
props.put("max.poll.records", 1000);
props.put("fetch.min.bytes", 50000);
props.put("fetch.max.wait.ms", 500);

// Parallel message processing
@KafkaListener(topics = "messages", concurrency = "10")
public void processMessage(ConsumerRecord<String, String> record) {
    // Process message asynchronously
    CompletableFuture.runAsync(() -> {
        handleMessage(record.value());
    }, executorService);
}
```

## Database Sharding and Scaling

### Cassandra Cluster Scaling
```
┌─────────────────────────────────────────────────────────────┐
│                 Cassandra Ring Topology                     │
├─────────────────────────────────────────────────────────────┤
│     Node 1        Node 2        Node 3        Node 4       │
│   Token Range   Token Range   Token Range   Token Range    │
│   0 - 25%       25% - 50%     50% - 75%     75% - 100%     │
│                                                            │
│   Replication Factor: 3                                    │
│   Consistency Level: QUORUM (2 out of 3 replicas)         │
│                                                            │
│   Data Centers:                                            │
│   - US-East: 100 nodes                                    │
│   - US-West: 100 nodes                                    │
│   - EU-West: 50 nodes                                     │
│   - APAC: 50 nodes                                        │
└─────────────────────────────────────────────────────────────┘
```

### Cassandra Performance Tuning
```yaml
# cassandra.yaml configuration
concurrent_reads: 32
concurrent_writes: 32
concurrent_counter_writes: 32
memtable_allocation_type: heap_buffers
memtable_heap_space_in_mb: 2048
memtable_offheap_space_in_mb: 2048

# Compaction strategy for time-series data
compaction:
  class_name: TimeWindowCompactionStrategy
  compaction_window_unit: DAYS
  compaction_window_size: 1
  max_threshold: 32
  min_threshold: 4
```

### PostgreSQL Read Replica Scaling
```
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Master-Replica Setup                │
├─────────────────────────────────────────────────────────────┤
│  Master (Write)                                            │
│  ┌─────────────────┐                                       │
│  │ Primary DB      │                                       │
│  │ (Users, Convs)  │                                       │
│  └─────────┬───────┘                                       │
│           │                                               │
│           ▼                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Read Replica 1  │  │ Read Replica 2  │  │ Read Rep N  │ │
│  │ (Read Only)     │  │ (Read Only)     │  │ (Read Only) │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│                                                            │
│  Connection Pooling: PgBouncer                             │
│  Read/Write Split: 80% reads, 20% writes                  │
└─────────────────────────────────────────────────────────────┘
```

### Database Connection Pooling
```javascript
// PgBouncer configuration
const poolConfig = {
  host: 'pgbouncer-cluster',
  port: 5432,
  database: 'messenger',
  user: 'app_user',
  password: process.env.DB_PASSWORD,
  max: 100, // Maximum connections in pool
  min: 10,  // Minimum connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 5000,
  query_timeout: 10000
};

// Read/write splitting
const writePool = new Pool({...poolConfig, host: 'master-db'});
const readPool = new Pool({...poolConfig, host: 'replica-db'});

const executeQuery = (query, params, isWrite = false) => {
  const pool = isWrite ? writePool : readPool;
  return pool.query(query, params);
};
```

## Caching Strategy and Redis Scaling

### Redis Cluster Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Redis Cluster                            │
├─────────────────────────────────────────────────────────────┤
│  Master Nodes (16,384 hash slots distributed)              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Master 1    │  │ Master 2    │  │ Master N    │        │
│  │ Slots:      │  │ Slots:      │  │ Slots:      │        │
│  │ 0-5460      │  │ 5461-10922  │  │ 10923-16383 │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│         │                │                │               │
│         ▼                ▼                ▼               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Replica 1   │  │ Replica 2   │  │ Replica N   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Layer Caching Strategy
```javascript
// L1 Cache: Application-level (in-memory)
const L1Cache = new Map();
const L1_TTL = 60 * 1000; // 1 minute

// L2 Cache: Redis cluster
const redisCluster = new Redis.Cluster([
  { host: 'redis-1', port: 6379 },
  { host: 'redis-2', port: 6379 },
  { host: 'redis-3', port: 6379 }
]);

// L3 Cache: Database query cache
const queryCache = new Map();

const getCachedData = async (key) => {
  // Try L1 cache first
  if (L1Cache.has(key)) {
    return L1Cache.get(key);
  }
  
  // Try L2 cache (Redis)
  const redisData = await redisCluster.get(key);
  if (redisData) {
    L1Cache.set(key, redisData);
    setTimeout(() => L1Cache.delete(key), L1_TTL);
    return redisData;
  }
  
  // Fallback to database
  const dbData = await fetchFromDatabase(key);
  if (dbData) {
    // Cache in both L1 and L2
    L1Cache.set(key, dbData);
    await redisCluster.setex(key, 3600, dbData); // 1 hour TTL
    setTimeout(() => L1Cache.delete(key), L1_TTL);
  }
  
  return dbData;
};
```

### Cache Invalidation Strategy
```javascript
// Event-driven cache invalidation
const invalidateCache = async (event) => {
  switch (event.type) {
    case 'message_sent':
      // Invalidate conversation cache
      await redisCluster.del(`conversation:${event.conversationId}`);
      await redisCluster.del(`messages:${event.conversationId}:recent`);
      break;
      
    case 'user_updated':
      // Invalidate user profile cache
      await redisCluster.del(`user:${event.userId}`);
      // Invalidate all conversations this user is part of
      const conversations = await getUserConversations(event.userId);
      for (const conv of conversations) {
        await redisCluster.del(`conversation:${conv.id}`);
      }
      break;
      
    case 'presence_changed':
      // Update presence cache
      await redisCluster.setex(
        `presence:${event.userId}`, 
        300, // 5 minutes TTL
        JSON.stringify(event.presence)
      );
      break;
  }
};
```

## CDN and Media File Scaling

### Global CDN Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Global CDN Network                       │
├─────────────────────────────────────────────────────────────┤
│  Edge Locations (200+ worldwide)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ US-East     │  │ EU-West     │  │ APAC        │        │
│  │ 50 POPs     │  │ 40 POPs     │  │ 30 POPs     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│         │                │                │               │
│         ▼                ▼                ▼               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            Origin Servers                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │ S3 Bucket   │  │ S3 Bucket   │  │ S3 Bucket   │  │   │
│  │  │ US-East     │  │ EU-West     │  │ APAC        │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Media Processing Pipeline
```javascript
// Media upload and processing workflow
const processMediaUpload = async (file, userId, conversationId) => {
  // 1. Upload to temporary storage
  const tempUrl = await uploadToTempStorage(file);
  
  // 2. Virus scanning
  const scanResult = await virusScan(tempUrl);
  if (!scanResult.clean) {
    throw new Error('File failed security scan');
  }
  
  // 3. Content moderation
  const moderationResult = await moderateContent(tempUrl, file.type);
  if (!moderationResult.approved) {
    throw new Error('Content violates community guidelines');
  }
  
  // 4. Generate thumbnails/previews
  const thumbnails = await generateThumbnails(tempUrl, file.type);
  
  // 5. Upload to permanent storage
  const permanentUrl = await uploadToPermanentStorage(tempUrl, {
    userId,
    conversationId,
    contentType: file.type
  });
  
  // 6. Update CDN cache
  await warmCDNCache(permanentUrl);
  
  // 7. Clean up temporary files
  await cleanupTempFile(tempUrl);
  
  return {
    fileUrl: permanentUrl,
    thumbnails,
    processingStatus: 'completed'
  };
};
```

### Media Storage Optimization
- **Image Compression**: WebP format with 80% quality for optimal size/quality
- **Video Transcoding**: Multiple bitrates (360p, 720p, 1080p) for adaptive streaming
- **Thumbnail Generation**: Multiple sizes (150x150, 300x300, 600x600)
- **Storage Tiering**: Hot (SSD), Warm (HDD), Cold (Glacier) based on access patterns
- **Deduplication**: Hash-based deduplication to save storage space
- **Compression**: Gzip compression for text-based media metadata

## Auto-scaling and Load Balancing

### Application Server Auto-scaling
```yaml
# Kubernetes HPA configuration
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: messenger-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: messenger-api
  minReplicas: 50
  maxReplicas: 1000
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: websocket_connections_per_pod
      target:
        type: AverageValue
        averageValue: "2000"
```

### Load Balancer Configuration
```nginx
# NGINX load balancer configuration
upstream messenger_api {
    least_conn;
    server api-1.messenger.com:8080 max_fails=3 fail_timeout=30s;
    server api-2.messenger.com:8080 max_fails=3 fail_timeout=30s;
    server api-3.messenger.com:8080 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

upstream messenger_websocket {
    ip_hash; # Sticky sessions for WebSocket
    server ws-1.messenger.com:8080 max_fails=3 fail_timeout=30s;
    server ws-2.messenger.com:8080 max_fails=3 fail_timeout=30s;
    server ws-3.messenger.com:8080 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl http2;
    server_name api.messenger.com;
    
    location /api/ {
        proxy_pass http://messenger_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /ws/ {
        proxy_pass http://messenger_websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_connect_timeout 5s;
        proxy_send_timeout 3600s;
        proxy_read_timeout 3600s;
    }
}
```

## Performance Monitoring and Optimization

### Key Performance Metrics
```javascript
// Application metrics collection
const metrics = {
  // WebSocket metrics
  websocket_connections_total: new Gauge({
    name: 'websocket_connections_total',
    help: 'Total number of active WebSocket connections'
  }),
  
  websocket_connection_duration: new Histogram({
    name: 'websocket_connection_duration_seconds',
    help: 'Duration of WebSocket connections',
    buckets: [1, 5, 10, 30, 60, 300, 600, 1800, 3600]
  }),
  
  // Message processing metrics
  message_processing_duration: new Histogram({
    name: 'message_processing_duration_ms',
    help: 'Time taken to process messages',
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000]
  }),
  
  message_delivery_success_rate: new Counter({
    name: 'message_delivery_success_total',
    help: 'Total number of successful message deliveries'
  }),
  
  // Database metrics
  database_query_duration: new Histogram({
    name: 'database_query_duration_ms',
    help: 'Database query execution time',
    labelNames: ['query_type', 'table'],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2000]
  }),
  
  // Cache metrics
  cache_hit_rate: new Gauge({
    name: 'cache_hit_rate',
    help: 'Cache hit rate percentage',
    labelNames: ['cache_layer']
  })
};
```

### Alerting and SLA Monitoring
```yaml
# Prometheus alerting rules
groups:
- name: messenger.rules
  rules:
  - alert: HighMessageLatency
    expr: histogram_quantile(0.95, message_processing_duration_ms) > 500
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High message processing latency"
      description: "95th percentile message latency is {{ $value }}ms"
      
  - alert: WebSocketConnectionDrop
    expr: rate(websocket_connections_total[5m]) < -100
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "Rapid WebSocket connection drops"
      description: "WebSocket connections dropping at {{ $value }} per second"
      
  - alert: DatabaseSlowQueries
    expr: histogram_quantile(0.95, database_query_duration_ms) > 1000
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Slow database queries detected"
      description: "95th percentile query time is {{ $value }}ms"
```

### Capacity Planning and Forecasting
```python
# Capacity planning model
import numpy as np
from sklearn.linear_model import LinearRegression

def forecast_capacity_needs(historical_data, days_ahead=30):
    # Prepare time series data
    X = np.array(range(len(historical_data))).reshape(-1, 1)
    y = np.array(historical_data)
    
    # Train linear regression model
    model = LinearRegression()
    model.fit(X, y)
    
    # Forecast future capacity needs
    future_X = np.array(range(len(historical_data), 
                             len(historical_data) + days_ahead)).reshape(-1, 1)
    forecast = model.predict(future_X)
    
    # Add 20% buffer for safety
    return forecast * 1.2

# Usage example
daily_active_users = [1.2e9, 1.21e9, 1.22e9, ...]  # Historical DAU data
forecasted_dau = forecast_capacity_needs(daily_active_users, 90)

# Calculate infrastructure needs
messages_per_user_per_day = 80
peak_multiplier = 3
forecasted_peak_messages = forecasted_dau * messages_per_user_per_day * peak_multiplier

# Determine required server capacity
messages_per_server_per_second = 1000
required_servers = forecasted_peak_messages / (24 * 3600 * messages_per_server_per_second)
```

This comprehensive scaling guide provides the foundation for building and operating a messaging platform that can handle billions of users and messages while maintaining high performance and reliability.
