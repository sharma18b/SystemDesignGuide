# Resource Allocation Service - API Design

## REST API

### Allocate Resources
```http
POST /api/v1/allocations
Content-Type: application/json

{
  "tenant_id": "tenant1",
  "resource_type": "cpu",
  "amount": 100,
  "priority": 5,
  "duration_seconds": 3600
}

Response 201:
{
  "allocation_id": "alloc_abc123",
  "status": "allocated",
  "expires_at": "2024-01-03T20:00:00Z"
}
```

### Release Resources
```http
DELETE /api/v1/allocations/{allocation_id}

Response 200:
{
  "released": true,
  "amount_returned": 100
}
```

### Query Availability
```http
GET /api/v1/resources/{type}/availability

Response 200:
{
  "resource_type": "cpu",
  "total": 10000,
  "available": 7500,
  "utilization": 0.25
}
```

## Client Library (Python)
```python
from resource_allocator import Client

client = Client(endpoint='https://allocator.example.com')

# Allocate resources
allocation = client.allocate(
    resource_type='cpu',
    amount=100,
    priority=5,
    duration=3600
)

# Use resources
process_workload()

# Release resources
client.release(allocation.id)
```

This API provides simple, intuitive resource allocation operations.
