# Distributed Unique ID Generator - API Design

## API Overview

### API Design Principles
- **Simplicity**: Minimal API surface for ease of use
- **Performance**: Low-latency, high-throughput operations
- **Idempotency**: Safe retry mechanisms for failed requests
- **Versioning**: Support for API evolution without breaking changes
- **Multi-Protocol**: REST, gRPC, and native client libraries
- **Observability**: Built-in metrics and tracing support

### Supported Protocols
```
┌─────────────────────────────────────────────────────────────┐
│                    API Protocol Stack                        │
├─────────────────────────────────────────────────────────────┤
│  REST API (HTTP/JSON)  │  gRPC (Protocol Buffers)           │
│  - Simple integration  │  - High performance                │
│  - Wide compatibility  │  - Type safety                     │
│  - Easy debugging      │  - Streaming support               │
├─────────────────────────────────────────────────────────────┤
│  Client Libraries: Java, Python, Go, Node.js, Ruby, PHP     │
└─────────────────────────────────────────────────────────────┘
```

## REST API Specification

### Base URL Structure
```
Production: https://id-generator.example.com/api/v1
Staging: https://id-generator-staging.example.com/api/v1
Development: http://localhost:8080/api/v1
```

### Authentication
```http
# API Key Authentication
GET /api/v1/id
Authorization: Bearer <api_key>
X-API-Key: <api_key>

# OAuth 2.0 (for enterprise)
GET /api/v1/id
Authorization: Bearer <oauth_token>
```


### Core Endpoints

#### Generate Single ID
```http
GET /api/v1/id
```

**Response**:
```json
{
  "id": 1234567890123456789,
  "timestamp": "2024-01-03T19:30:00.123Z",
  "datacenter_id": 0,
  "worker_id": 5
}
```

**Status Codes**:
- `200 OK`: ID generated successfully
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Generation failed
- `503 Service Unavailable`: Service temporarily unavailable

#### Generate Multiple IDs (Batch)
```http
GET /api/v1/ids?count=100
POST /api/v1/ids/batch
Content-Type: application/json

{
  "count": 100
}
```

**Response**:
```json
{
  "ids": [
    1234567890123456789,
    1234567890123456790,
    1234567890123456791
  ],
  "count": 100,
  "generation_time_ms": 2.5
}
```

**Constraints**:
- Minimum count: 1
- Maximum count: 10,000 per request
- Batch requests are atomic (all or nothing)

#### Parse ID
```http
GET /api/v1/parse?id=1234567890123456789
POST /api/v1/parse
Content-Type: application/json

{
  "id": 1234567890123456789
}
```

**Response**:
```json
{
  "id": 1234567890123456789,
  "components": {
    "timestamp_ms": 1704310200123,
    "timestamp_iso": "2024-01-03T19:30:00.123Z",
    "datacenter_id": 0,
    "datacenter_name": "us-east-1",
    "worker_id": 5,
    "sequence": 42
  },
  "age_ms": 1500,
  "valid": true
}
```

#### Health Check
```http
GET /api/v1/health
```

**Response**:
```json
{
  "status": "healthy",
  "datacenter_id": 0,
  "worker_id": 5,
  "uptime_seconds": 86400,
  "ids_generated": 1000000,
  "ids_per_second": 11.57,
  "clock_drift_ms": 5,
  "ntp_synchronized": true,
  "last_id": 1234567890123456789,
  "sequence_overflows": 0
}
```

#### Metrics (Prometheus Format)
```http
GET /api/v1/metrics
```

**Response**:
```
# HELP id_generation_total Total number of IDs generated
# TYPE id_generation_total counter
id_generation_total{datacenter="0",worker="5"} 1000000

# HELP id_generation_latency_seconds ID generation latency
# TYPE id_generation_latency_seconds histogram
id_generation_latency_seconds_bucket{le="0.001"} 950000
id_generation_latency_seconds_bucket{le="0.005"} 990000
id_generation_latency_seconds_bucket{le="0.01"} 999000
id_generation_latency_seconds_bucket{le="+Inf"} 1000000
id_generation_latency_seconds_sum 450.5
id_generation_latency_seconds_count 1000000

# HELP clock_drift_milliseconds Current clock drift in milliseconds
# TYPE clock_drift_milliseconds gauge
clock_drift_milliseconds{datacenter="0",worker="5"} 5
```

## gRPC API Specification

### Service Definition
```protobuf
syntax = "proto3";

package idgenerator.v1;

service IDGeneratorService {
  // Generate a single unique ID
  rpc GenerateID(GenerateIDRequest) returns (GenerateIDResponse);
  
  // Generate multiple IDs in batch
  rpc GenerateBatch(GenerateBatchRequest) returns (GenerateBatchResponse);
  
  // Generate IDs as a stream
  rpc GenerateStream(GenerateStreamRequest) returns (stream GenerateIDResponse);
  
  // Parse ID components
  rpc ParseID(ParseIDRequest) returns (ParseIDResponse);
  
  // Health check
  rpc HealthCheck(HealthCheckRequest) returns (HealthCheckResponse);
  
  // Get service metrics
  rpc GetMetrics(GetMetricsRequest) returns (GetMetricsResponse);
}

message GenerateIDRequest {
  // Optional request ID for idempotency
  string request_id = 1;
  
  // Optional metadata
  map<string, string> metadata = 2;
}

message GenerateIDResponse {
  int64 id = 1;
  int64 timestamp_ms = 2;
  int32 datacenter_id = 3;
  int32 worker_id = 4;
  int32 sequence = 5;
}

message GenerateBatchRequest {
  int32 count = 1;  // Number of IDs to generate (1-10000)
  string request_id = 2;
  map<string, string> metadata = 3;
}

message GenerateBatchResponse {
  repeated int64 ids = 1;
  int32 count = 2;
  double generation_time_ms = 3;
}

message GenerateStreamRequest {
  int32 count = 1;  // Total IDs to generate
  int32 batch_size = 2;  // IDs per stream message
}

message ParseIDRequest {
  int64 id = 1;
}

message ParseIDResponse {
  int64 id = 1;
  IDComponents components = 2;
  int64 age_ms = 3;
  bool valid = 4;
}

message IDComponents {
  int64 timestamp_ms = 1;
  string timestamp_iso = 2;
  int32 datacenter_id = 3;
  string datacenter_name = 4;
  int32 worker_id = 5;
  int32 sequence = 6;
}

message HealthCheckRequest {}

message HealthCheckResponse {
  enum Status {
    UNKNOWN = 0;
    HEALTHY = 1;
    DEGRADED = 2;
    UNHEALTHY = 3;
  }
  
  Status status = 1;
  int32 datacenter_id = 2;
  int32 worker_id = 3;
  int64 uptime_seconds = 4;
  int64 ids_generated = 5;
  double ids_per_second = 6;
  int32 clock_drift_ms = 7;
  bool ntp_synchronized = 8;
}

message GetMetricsRequest {}

message GetMetricsResponse {
  map<string, double> metrics = 1;
}
```

## Client Library Examples

### Java Client
```java
import com.example.idgenerator.IDGeneratorClient;

public class Example {
    public static void main(String[] args) {
        // Initialize client
        IDGeneratorClient client = IDGeneratorClient.builder()
            .endpoint("https://id-generator.example.com")
            .apiKey("your-api-key")
            .timeout(Duration.ofSeconds(5))
            .build();
        
        // Generate single ID
        long id = client.generateID();
        System.out.println("Generated ID: " + id);
        
        // Generate batch
        List<Long> ids = client.generateBatch(100);
        System.out.println("Generated " + ids.size() + " IDs");
        
        // Parse ID
        IDComponents components = client.parseID(id);
        System.out.println("Timestamp: " + components.getTimestamp());
        System.out.println("Datacenter: " + components.getDatacenterId());
        System.out.println("Worker: " + components.getWorkerId());
        
        // Close client
        client.close();
    }
}
```

### Python Client
```python
from idgenerator import IDGeneratorClient

# Initialize client
client = IDGeneratorClient(
    endpoint='https://id-generator.example.com',
    api_key='your-api-key',
    timeout=5.0
)

# Generate single ID
id = client.generate_id()
print(f"Generated ID: {id}")

# Generate batch
ids = client.generate_batch(count=100)
print(f"Generated {len(ids)} IDs")

# Parse ID
components = client.parse_id(id)
print(f"Timestamp: {components.timestamp}")
print(f"Datacenter: {components.datacenter_id}")
print(f"Worker: {components.worker_id}")

# Async support
async def generate_async():
    async with IDGeneratorClient.async_client(
        endpoint='https://id-generator.example.com',
        api_key='your-api-key'
    ) as client:
        id = await client.generate_id()
        return id
```

### Go Client
```go
package main

import (
    "context"
    "fmt"
    "time"
    
    "github.com/example/idgenerator-go"
)

func main() {
    // Initialize client
    client, err := idgenerator.NewClient(
        idgenerator.WithEndpoint("https://id-generator.example.com"),
        idgenerator.WithAPIKey("your-api-key"),
        idgenerator.WithTimeout(5*time.Second),
    )
    if err != nil {
        panic(err)
    }
    defer client.Close()
    
    ctx := context.Background()
    
    // Generate single ID
    id, err := client.GenerateID(ctx)
    if err != nil {
        panic(err)
    }
    fmt.Printf("Generated ID: %d\n", id)
    
    // Generate batch
    ids, err := client.GenerateBatch(ctx, 100)
    if err != nil {
        panic(err)
    }
    fmt.Printf("Generated %d IDs\n", len(ids))
    
    // Parse ID
    components, err := client.ParseID(ctx, id)
    if err != nil {
        panic(err)
    }
    fmt.Printf("Timestamp: %v\n", components.Timestamp)
    fmt.Printf("Datacenter: %d\n", components.DatacenterID)
    fmt.Printf("Worker: %d\n", components.WorkerID)
}
```

### Node.js Client
```javascript
const { IDGeneratorClient } = require('@example/idgenerator');

// Initialize client
const client = new IDGeneratorClient({
  endpoint: 'https://id-generator.example.com',
  apiKey: 'your-api-key',
  timeout: 5000
});

// Generate single ID
const id = await client.generateID();
console.log(`Generated ID: ${id}`);

// Generate batch
const ids = await client.generateBatch(100);
console.log(`Generated ${ids.length} IDs`);

// Parse ID
const components = await client.parseID(id);
console.log(`Timestamp: ${components.timestamp}`);
console.log(`Datacenter: ${components.datacenterId}`);
console.log(`Worker: ${components.workerId}`);

// Stream generation
const stream = client.generateStream(1000, 100);
stream.on('data', (id) => {
  console.log(`Received ID: ${id}`);
});
stream.on('end', () => {
  console.log('Stream completed');
});
```

## Rate Limiting

### Rate Limit Headers
```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9500
X-RateLimit-Reset: 1704310800
X-RateLimit-Window: 60
```

### Rate Limit Tiers
```
Free Tier:
- 1,000 IDs per minute
- 100,000 IDs per day
- Burst: 100 IDs per second

Standard Tier:
- 10,000 IDs per minute
- 1,000,000 IDs per day
- Burst: 1,000 IDs per second

Enterprise Tier:
- Unlimited IDs per minute
- Unlimited IDs per day
- Burst: 10,000 IDs per second
- Dedicated workers
```

### Rate Limit Exceeded Response
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please retry after 30 seconds.",
    "retry_after": 30,
    "limit": 10000,
    "window": 60
  }
}
```

## Error Handling

### Error Response Format
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    },
    "request_id": "req-123456",
    "timestamp": "2024-01-03T19:30:00Z"
  }
}
```

### Error Codes
```
CLIENT_ERRORS (4xx):
- INVALID_REQUEST: Malformed request
- UNAUTHORIZED: Missing or invalid authentication
- FORBIDDEN: Insufficient permissions
- RATE_LIMIT_EXCEEDED: Too many requests
- INVALID_PARAMETER: Invalid parameter value

SERVER_ERRORS (5xx):
- INTERNAL_ERROR: Unexpected server error
- SERVICE_UNAVAILABLE: Service temporarily unavailable
- CLOCK_REGRESSION: Clock moved backwards
- SEQUENCE_OVERFLOW: Too many IDs requested
- WORKER_UNAVAILABLE: Worker node unavailable
```

## Idempotency

### Idempotent Requests
```http
POST /api/v1/ids/batch
Content-Type: application/json
Idempotency-Key: unique-request-id-123

{
  "count": 100
}
```

**Behavior**:
- Same `Idempotency-Key` returns cached response
- Cache TTL: 24 hours
- Prevents duplicate ID generation on retry

## Versioning Strategy

### API Versioning
```
URL Versioning (Current):
- /api/v1/id
- /api/v2/id (future)

Header Versioning (Alternative):
- API-Version: 2024-01-01
- Accept: application/vnd.idgenerator.v1+json

Deprecation Notice:
- X-API-Deprecated: true
- X-API-Sunset: 2025-01-01
- Link: <https://docs.example.com/migration>; rel="deprecation"
```

This comprehensive API design provides multiple integration options with clear documentation, error handling, and client library support for seamless adoption.
