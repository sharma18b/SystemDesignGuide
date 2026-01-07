# Distributed Counter - API Design

## REST API

### Increment Counter
```http
POST /api/v1/counters/{counter_id}/increment
Content-Type: application/json

{
  "delta": 1,
  "metadata": {
    "user_id": "user_123",
    "source": "web"
  }
}

Response 200 OK:
{
  "counter_id": "page_views:article_123",
  "value": 1234568,
  "delta": 1,
  "timestamp": "2024-01-08T10:00:00Z"
}

Response 429 Too Many Requests:
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests",
  "retry_after": 60
}
```

### Decrement Counter
```http
POST /api/v1/counters/{counter_id}/decrement
Content-Type: application/json

{
  "delta": 1
}

Response 200 OK:
{
  "counter_id": "likes:post_456",
  "value": 999,
  "delta": -1,
  "timestamp": "2024-01-08T10:00:00Z"
}
```

### Get Counter Value
```http
GET /api/v1/counters/{counter_id}

Response 200 OK:
{
  "counter_id": "page_views:article_123",
  "value": 1234567,
  "type": "simple",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-08T10:00:00Z"
}

# Get with metadata
GET /api/v1/counters/{counter_id}?include_metadata=true

Response 200 OK:
{
  "counter_id": "page_views:article_123",
  "value": 1234567,
  "type": "sharded",
  "shards": 4,
  "config": {
    "num_shards": 4,
    "sync_interval": 1000
  },
  "metadata": {
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-08T10:00:00Z",
    "last_sync_at": "2024-01-08T09:59:59Z"
  }
}
```

### Batch Operations
```http
POST /api/v1/counters/batch/increment
Content-Type: application/json

{
  "operations": [
    {"counter_id": "page_views:article_123", "delta": 1},
    {"counter_id": "page_views:article_456", "delta": 1},
    {"counter_id": "page_views:article_789", "delta": 1}
  ]
}

Response 200 OK:
{
  "results": [
    {"counter_id": "page_views:article_123", "value": 1234568, "status": "success"},
    {"counter_id": "page_views:article_456", "value": 567891, "status": "success"},
    {"counter_id": "page_views:article_789", "value": 234567, "status": "success"}
  ],
  "total_operations": 3,
  "successful": 3,
  "failed": 0
}
```

### Reset Counter
```http
POST /api/v1/counters/{counter_id}/reset
Content-Type: application/json

{
  "value": 0  # Optional, defaults to 0
}

Response 200 OK:
{
  "counter_id": "page_views:article_123",
  "old_value": 1234567,
  "new_value": 0,
  "timestamp": "2024-01-08T10:00:00Z"
}
```

### Create Counter
```http
POST /api/v1/counters
Content-Type: application/json

{
  "counter_id": "page_views:article_123",
  "type": "sharded",
  "initial_value": 0,
  "config": {
    "num_shards": 4,
    "sync_interval": 1000
  }
}

Response 201 Created:
{
  "counter_id": "page_views:article_123",
  "type": "sharded",
  "value": 0,
  "created_at": "2024-01-08T10:00:00Z"
}
```

### Delete Counter
```http
DELETE /api/v1/counters/{counter_id}

Response 204 No Content
```

## Time-Windowed Counter API

### Increment with Time Window
```http
POST /api/v1/counters/{counter_id}/increment/windowed
Content-Type: application/json

{
  "delta": 1,
  "window_size": 3600  # 1 hour in seconds
}

Response 200 OK:
{
  "counter_id": "api_requests:user_123",
  "current_window_value": 150,
  "window_size": 3600,
  "window_start": "2024-01-08T10:00:00Z",
  "window_end": "2024-01-08T11:00:00Z"
}
```

### Get Time-Windowed Count
```http
GET /api/v1/counters/{counter_id}/windowed?window_size=3600

Response 200 OK:
{
  "counter_id": "api_requests:user_123",
  "value": 150,
  "window_size": 3600,
  "window_start": "2024-01-08T10:00:00Z",
  "window_end": "2024-01-08T11:00:00Z",
  "buckets": [
    {"timestamp": "2024-01-08T10:00:00Z", "count": 50},
    {"timestamp": "2024-01-08T10:30:00Z", "count": 100}
  ]
}
```

## Aggregation API

### Get Multiple Counters
```http
POST /api/v1/counters/query
Content-Type: application/json

{
  "counter_ids": [
    "page_views:article_123",
    "page_views:article_456",
    "page_views:article_789"
  ]
}

Response 200 OK:
{
  "counters": [
    {"counter_id": "page_views:article_123", "value": 1234567},
    {"counter_id": "page_views:article_456", "value": 567891},
    {"counter_id": "page_views:article_789", "value": 234567}
  ],
  "total": 2036025
}
```

### Pattern-Based Query
```http
GET /api/v1/counters?pattern=page_views:article_*&limit=10

Response 200 OK:
{
  "counters": [
    {"counter_id": "page_views:article_123", "value": 1234567},
    {"counter_id": "page_views:article_456", "value": 567891}
  ],
  "total_matched": 2,
  "limit": 10
}
```

### Top-K Counters
```http
GET /api/v1/counters/top?k=10&pattern=page_views:*

Response 200 OK:
{
  "top_counters": [
    {"counter_id": "page_views:article_123", "value": 1234567, "rank": 1},
    {"counter_id": "page_views:article_456", "value": 567891, "rank": 2},
    {"counter_id": "page_views:article_789", "value": 234567, "rank": 3}
  ],
  "k": 10,
  "total_counters": 1000
}
```

## Unique Counter API (HyperLogLog)

### Add to Unique Counter
```http
POST /api/v1/counters/{counter_id}/unique/add
Content-Type: application/json

{
  "items": ["user_123", "user_456", "user_789"]
}

Response 200 OK:
{
  "counter_id": "unique_visitors:article_123",
  "estimated_count": 1523,
  "items_added": 3
}
```

### Get Unique Count
```http
GET /api/v1/counters/{counter_id}/unique

Response 200 OK:
{
  "counter_id": "unique_visitors:article_123",
  "estimated_count": 1523,
  "error_rate": 0.0081,  # 0.81%
  "type": "hyperloglog"
}
```

## Monitoring API

### Get Counter Statistics
```http
GET /api/v1/counters/{counter_id}/stats

Response 200 OK:
{
  "counter_id": "page_views:article_123",
  "value": 1234567,
  "stats": {
    "increment_rate": 100,  # ops/second
    "read_rate": 50,  # ops/second
    "last_increment": "2024-01-08T10:00:00Z",
    "cache_hit_rate": 0.95,
    "sync_lag": 0.5  # seconds
  }
}
```

### Get System Metrics
```http
GET /api/v1/metrics

Response 200 OK:
{
  "total_counters": 100000000,
  "active_counters": 1000000,
  "increment_rate": 10000000,  # ops/second
  "read_rate": 1000000,  # ops/second
  "cache_hit_rate": 0.95,
  "average_latency_ms": 0.8,
  "p99_latency_ms": 2.5
}
```

## Client SDKs

### Python SDK
```python
from counter_client import CounterClient

# Initialize client
client = CounterClient(
    base_url="https://api.example.com",
    api_key="your_api_key"
)

# Increment counter
result = client.increment("page_views:article_123", delta=1)
print(f"New value: {result.value}")

# Get counter value
value = client.get("page_views:article_123")
print(f"Current value: {value}")

# Batch increment
results = client.batch_increment([
    ("page_views:article_123", 1),
    ("page_views:article_456", 1),
    ("page_views:article_789", 1)
])

# Time-windowed counter
result = client.increment_windowed(
    "api_requests:user_123",
    delta=1,
    window_size=3600
)
print(f"Requests in last hour: {result.current_window_value}")

# Unique counter
client.add_unique("unique_visitors:article_123", ["user_123", "user_456"])
count = client.get_unique("unique_visitors:article_123")
print(f"Unique visitors: {count}")
```

### JavaScript SDK
```javascript
import { CounterClient } from 'counter-client';

// Initialize client
const client = new CounterClient({
  baseUrl: 'https://api.example.com',
  apiKey: 'your_api_key'
});

// Increment counter
const result = await client.increment('page_views:article_123', 1);
console.log(`New value: ${result.value}`);

// Get counter value
const value = await client.get('page_views:article_123');
console.log(`Current value: ${value}`);

// Batch operations
const results = await client.batchIncrement([
  { counterId: 'page_views:article_123', delta: 1 },
  { counterId: 'page_views:article_456', delta: 1 }
]);

// Time-windowed counter
const windowedResult = await client.incrementWindowed(
  'api_requests:user_123',
  1,
  3600
);
console.log(`Requests in last hour: ${windowedResult.currentWindowValue}`);

// Subscribe to counter updates (WebSocket)
client.subscribe('page_views:article_123', (update) => {
  console.log(`Counter updated: ${update.value}`);
});
```

### Java SDK
```java
import com.example.CounterClient;

// Initialize client
CounterClient client = new CounterClient.Builder()
    .baseUrl("https://api.example.com")
    .apiKey("your_api_key")
    .build();

// Increment counter
CounterResult result = client.increment("page_views:article_123", 1);
System.out.println("New value: " + result.getValue());

// Get counter value
long value = client.get("page_views:article_123");
System.out.println("Current value: " + value);

// Batch operations
List<CounterOperation> operations = Arrays.asList(
    new CounterOperation("page_views:article_123", 1),
    new CounterOperation("page_views:article_456", 1)
);
List<CounterResult> results = client.batchIncrement(operations);

// Time-windowed counter
WindowedCounterResult windowedResult = client.incrementWindowed(
    "api_requests:user_123",
    1,
    3600
);
System.out.println("Requests in last hour: " + windowedResult.getCurrentWindowValue());
```

## Configuration API

### Update Counter Configuration
```http
PATCH /api/v1/counters/{counter_id}/config
Content-Type: application/json

{
  "num_shards": 8,
  "sync_interval": 500
}

Response 200 OK:
{
  "counter_id": "page_views:article_123",
  "config": {
    "num_shards": 8,
    "sync_interval": 500
  },
  "updated_at": "2024-01-08T10:00:00Z"
}
```

This comprehensive API design provides flexible, efficient, and developer-friendly interfaces for distributed counting operations.
