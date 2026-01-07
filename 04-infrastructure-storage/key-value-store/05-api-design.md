# Key-Value Store - API Design

## API Overview

### Supported Protocols
- **Binary Protocol**: Custom binary protocol for high performance
- **REST API**: HTTP/JSON for ease of integration
- **gRPC**: Protocol Buffers for efficient RPC
- **Redis Protocol**: RESP (Redis Serialization Protocol) compatibility
- **Thrift**: Cross-language RPC framework
- **WebSocket**: Real-time pub/sub notifications

### API Design Principles
- **Idempotency**: All write operations are idempotent
- **Atomicity**: Single-key operations are atomic
- **Consistency**: Configurable consistency levels
- **Versioning**: API versioning for backward compatibility
- **Rate Limiting**: Per-client rate limits
- **Authentication**: Token-based authentication

## Core Operations API

### PUT Operation
```protobuf
// Store or update a key-value pair
message PutRequest {
  string key = 1;                    // Required: Key (max 1KB)
  bytes value = 2;                   // Required: Value (max 1MB)
  int32 ttl = 3;                     // Optional: TTL in seconds
  ConsistencyLevel consistency = 4;  // Optional: ONE|QUORUM|ALL
  int64 version = 5;                 // Optional: For CAS operations
  map<string, string> metadata = 6;  // Optional: Custom metadata
}

message PutResponse {
  bool success = 1;
  int64 version = 2;                 // New version number
  int64 timestamp = 3;               // Write timestamp
  string error = 4;                  // Error message if failed
}

// REST API
POST /api/v1/keys/{key}
Content-Type: application/json

{
  "value": "base64_encoded_value",
  "ttl": 3600,
  "consistency": "QUORUM",
  "version": 5
}

Response: 200 OK
{
  "success": true,
  "version": 6,
  "timestamp": 1704729600000
}
```

### GET Operation
```protobuf
// Retrieve value for a key
message GetRequest {
  string key = 1;                    // Required: Key
  ConsistencyLevel consistency = 2;  // Optional: ONE|QUORUM|ALL
  bool include_metadata = 3;         // Optional: Return metadata
}

message GetResponse {
  bool found = 1;
  bytes value = 2;                   // Value if found
  int64 version = 3;                 // Current version
  int64 timestamp = 4;               // Last update timestamp
  int32 ttl_remaining = 5;           // Seconds until expiration
  map<string, string> metadata = 6;  // Custom metadata
  string error = 7;
}

// REST API
GET /api/v1/keys/{key}?consistency=QUORUM&include_metadata=true

Response: 200 OK
{
  "found": true,
  "value": "base64_encoded_value",
  "version": 6,
  "timestamp": 1704729600000,
  "ttl_remaining": 3500,
  "metadata": {
    "content_type": "application/json"
  }
}

Response: 404 Not Found
{
  "found": false,
  "error": "Key not found"
}
```

### DELETE Operation
```protobuf
// Delete a key-value pair
message DeleteRequest {
  string key = 1;                    // Required: Key
  ConsistencyLevel consistency = 2;  // Optional: ONE|QUORUM|ALL
  int64 version = 3;                 // Optional: For CAS operations
}

message DeleteResponse {
  bool success = 1;
  bool existed = 2;                  // Whether key existed
  int64 timestamp = 3;               // Deletion timestamp
  string error = 4;
}

// REST API
DELETE /api/v1/keys/{key}?consistency=QUORUM

Response: 200 OK
{
  "success": true,
  "existed": true,
  "timestamp": 1704729600000
}
```

### UPDATE Operation
```protobuf
// Update existing key (fails if key doesn't exist)
message UpdateRequest {
  string key = 1;
  bytes value = 2;
  int32 ttl = 3;
  ConsistencyLevel consistency = 4;
  int64 expected_version = 5;        // For optimistic locking
}

message UpdateResponse {
  bool success = 1;
  int64 version = 2;
  int64 timestamp = 3;
  string error = 4;                  // "KEY_NOT_FOUND" or "VERSION_MISMATCH"
}

// REST API
PATCH /api/v1/keys/{key}
{
  "value": "new_value",
  "expected_version": 6
}

Response: 200 OK / 404 Not Found / 409 Conflict
```

## Batch Operations API

### Batch GET
```protobuf
message BatchGetRequest {
  repeated string keys = 1;          // List of keys (max 1000)
  ConsistencyLevel consistency = 2;
  bool include_metadata = 3;
}

message BatchGetResponse {
  map<string, GetResponse> results = 1;  // Key → GetResponse
  int32 found_count = 2;
  int32 not_found_count = 3;
}

// REST API
POST /api/v1/batch/get
{
  "keys": ["user:123", "user:456", "user:789"],
  "consistency": "QUORUM"
}

Response: 200 OK
{
  "results": {
    "user:123": {"found": true, "value": "..."},
    "user:456": {"found": true, "value": "..."},
    "user:789": {"found": false}
  },
  "found_count": 2,
  "not_found_count": 1
}
```

### Batch PUT
```protobuf
message BatchPutRequest {
  repeated PutRequest puts = 1;      // List of puts (max 1000)
  bool atomic = 2;                   // All-or-nothing semantics
  ConsistencyLevel consistency = 3;
}

message BatchPutResponse {
  bool success = 1;
  repeated PutResponse results = 2;
  int32 success_count = 3;
  int32 failure_count = 4;
  string error = 5;                  // If atomic=true and failed
}

// REST API
POST /api/v1/batch/put
{
  "puts": [
    {"key": "user:123", "value": "..."},
    {"key": "user:456", "value": "..."}
  ],
  "atomic": true,
  "consistency": "QUORUM"
}
```

## Advanced Operations API

### Compare-And-Swap (CAS)
```protobuf
message CompareAndSwapRequest {
  string key = 1;
  bytes expected_value = 2;          // Expected current value
  bytes new_value = 3;               // New value to set
  int64 expected_version = 4;        // Expected version
  ConsistencyLevel consistency = 5;
}

message CompareAndSwapResponse {
  bool success = 1;
  bool matched = 2;                  // Whether comparison matched
  int64 current_version = 3;         // Current version if mismatch
  bytes current_value = 4;           // Current value if mismatch
  string error = 5;
}

// REST API
POST /api/v1/keys/{key}/cas
{
  "expected_value": "old_value",
  "new_value": "new_value",
  "expected_version": 5
}
```

### Increment/Decrement
```protobuf
message IncrementRequest {
  string key = 1;
  int64 delta = 2;                   // Amount to increment (negative to decrement)
  int64 initial_value = 3;           // Value if key doesn't exist
  int32 ttl = 4;
  ConsistencyLevel consistency = 5;
}

message IncrementResponse {
  bool success = 1;
  int64 new_value = 2;               // Value after increment
  int64 version = 3;
  string error = 4;
}

// REST API
POST /api/v1/keys/{key}/increment
{
  "delta": 1,
  "initial_value": 0
}

Response: 200 OK
{
  "success": true,
  "new_value": 42,
  "version": 7
}
```

### Scan/Range Query
```protobuf
message ScanRequest {
  string start_key = 1;              // Inclusive start key
  string end_key = 2;                // Exclusive end key
  string prefix = 3;                 // Alternative: scan by prefix
  int32 limit = 4;                   // Max results (default 100, max 10000)
  string cursor = 5;                 // Pagination cursor
  ConsistencyLevel consistency = 6;
}

message ScanResponse {
  repeated KeyValue results = 1;
  string next_cursor = 2;            // For pagination
  bool has_more = 3;
  int32 count = 4;
}

message KeyValue {
  string key = 1;
  bytes value = 2;
  int64 version = 3;
  int64 timestamp = 4;
}

// REST API
GET /api/v1/scan?prefix=user:&limit=100&cursor=abc123

Response: 200 OK
{
  "results": [
    {"key": "user:123", "value": "...", "version": 5},
    {"key": "user:456", "value": "...", "version": 3}
  ],
  "next_cursor": "def456",
  "has_more": true,
  "count": 100
}
```

## Data Structure Operations

### List Operations
```protobuf
// Push to list
message ListPushRequest {
  string key = 1;
  repeated bytes values = 2;
  bool push_left = 3;                // true=LPUSH, false=RPUSH
  int32 ttl = 4;
}

// Pop from list
message ListPopRequest {
  string key = 1;
  bool pop_left = 2;                 // true=LPOP, false=RPOP
  int32 count = 3;                   // Number of elements to pop
}

// Get list range
message ListRangeRequest {
  string key = 1;
  int32 start = 2;                   // Start index (0-based)
  int32 stop = 3;                    // Stop index (-1 for end)
}

// REST API
POST /api/v1/lists/{key}/push
{
  "values": ["value1", "value2"],
  "push_left": true
}

GET /api/v1/lists/{key}/range?start=0&stop=10
```

### Set Operations
```protobuf
// Add to set
message SetAddRequest {
  string key = 1;
  repeated bytes members = 2;
  int32 ttl = 3;
}

// Remove from set
message SetRemoveRequest {
  string key = 1;
  repeated bytes members = 2;
}

// Check membership
message SetIsMemberRequest {
  string key = 1;
  bytes member = 2;
}

// Set operations
message SetOperationRequest {
  enum Operation {
    UNION = 0;
    INTERSECTION = 1;
    DIFFERENCE = 2;
  }
  Operation operation = 1;
  repeated string keys = 2;          // Sets to operate on
}

// REST API
POST /api/v1/sets/{key}/add
{
  "members": ["member1", "member2"]
}

POST /api/v1/sets/union
{
  "keys": ["set1", "set2", "set3"]
}
```

### Hash Operations
```protobuf
// Set hash field
message HashSetRequest {
  string key = 1;
  map<string, bytes> fields = 2;     // Field → Value
  int32 ttl = 3;
}

// Get hash field
message HashGetRequest {
  string key = 1;
  repeated string fields = 2;        // Fields to retrieve
}

// Get all hash fields
message HashGetAllRequest {
  string key = 1;
}

// REST API
POST /api/v1/hashes/{key}/set
{
  "fields": {
    "name": "John",
    "age": "30",
    "email": "john@example.com"
  }
}

GET /api/v1/hashes/{key}/get?fields=name,age
```

## Pub/Sub API

### Publish Message
```protobuf
message PublishRequest {
  string channel = 1;
  bytes message = 2;
  map<string, string> attributes = 3;
}

message PublishResponse {
  bool success = 1;
  int32 subscriber_count = 2;        // Number of subscribers notified
  string message_id = 3;
}

// REST API
POST /api/v1/pubsub/publish
{
  "channel": "notifications",
  "message": "New order received",
  "attributes": {
    "priority": "high"
  }
}
```

### Subscribe to Channel
```protobuf
message SubscribeRequest {
  repeated string channels = 1;
  repeated string patterns = 2;      // Pattern matching (e.g., "user:*")
}

message SubscribeResponse {
  string subscription_id = 1;
}

// WebSocket API
WS /api/v1/pubsub/subscribe
{
  "channels": ["notifications", "alerts"],
  "patterns": ["user:*"]
}

// Receive messages
{
  "channel": "notifications",
  "message": "New order received",
  "timestamp": 1704729600000
}
```

## Admin and Monitoring API

### Cluster Status
```protobuf
message ClusterStatusRequest {}

message ClusterStatusResponse {
  int32 node_count = 1;
  int32 healthy_nodes = 2;
  int32 unhealthy_nodes = 3;
  int64 total_keys = 4;
  int64 total_size_bytes = 5;
  float avg_load = 6;
  repeated NodeStatus nodes = 7;
}

message NodeStatus {
  string node_id = 1;
  string hostname = 2;
  string status = 3;                 // NORMAL|DOWN|JOINING|LEAVING
  int64 key_count = 4;
  int64 size_bytes = 5;
  float cpu_usage = 6;
  float memory_usage = 7;
  int64 last_heartbeat = 8;
}

// REST API
GET /api/v1/admin/cluster/status
```

### Node Operations
```protobuf
// Add node
POST /api/v1/admin/nodes/add
{
  "hostname": "node4.example.com",
  "datacenter": "us-east-1"
}

// Remove node
DELETE /api/v1/admin/nodes/{node_id}?force=false

// Repair node
POST /api/v1/admin/nodes/{node_id}/repair
{
  "keyspace": "default",
  "full_repair": false
}
```

### Metrics API
```protobuf
GET /api/v1/metrics

Response:
{
  "operations_per_second": {
    "reads": 50000,
    "writes": 20000,
    "deletes": 1000
  },
  "latency_ms": {
    "read_p50": 0.5,
    "read_p99": 2.0,
    "write_p50": 2.0,
    "write_p99": 10.0
  },
  "cache_hit_rate": 0.95,
  "replication_lag_ms": 50,
  "disk_usage_percent": 65,
  "memory_usage_percent": 80
}
```

## Error Handling

### Error Codes
```protobuf
enum ErrorCode {
  OK = 0;
  KEY_NOT_FOUND = 1;
  KEY_ALREADY_EXISTS = 2;
  VERSION_MISMATCH = 3;
  TIMEOUT = 4;
  UNAVAILABLE = 5;
  INVALID_REQUEST = 6;
  QUOTA_EXCEEDED = 7;
  INTERNAL_ERROR = 8;
  UNAUTHORIZED = 9;
  FORBIDDEN = 10;
}

message Error {
  ErrorCode code = 1;
  string message = 2;
  map<string, string> details = 3;
  bool retryable = 4;
}
```

### HTTP Status Codes
- **200 OK**: Successful operation
- **201 Created**: Key created successfully
- **204 No Content**: Successful deletion
- **400 Bad Request**: Invalid request parameters
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Key not found
- **409 Conflict**: Version mismatch or CAS failure
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error
- **503 Service Unavailable**: Cluster unavailable
- **504 Gateway Timeout**: Operation timeout

## Authentication and Authorization

### API Key Authentication
```
GET /api/v1/keys/user:123
Authorization: Bearer <api_key>
X-Client-ID: <client_id>
```

### OAuth 2.0
```
POST /oauth/token
{
  "grant_type": "client_credentials",
  "client_id": "...",
  "client_secret": "..."
}

Response:
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Rate Limiting Headers
```
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9500
X-RateLimit-Reset: 1704729600
```

This comprehensive API design provides a complete interface for interacting with the distributed key-value store, supporting various use cases from simple key-value operations to advanced data structures and pub/sub messaging.
