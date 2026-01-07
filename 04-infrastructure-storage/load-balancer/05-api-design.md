# Load Balancer - API Design

## Management API

### Register Backend
```
POST /api/v1/backends
{
  "hostname": "backend1.example.com",
  "port": 8080,
  "weight": 100,
  "health_check_path": "/health"
}

Response: 201 Created
{
  "server_id": "backend-123"
}
```

### Remove Backend
```
DELETE /api/v1/backends/{server_id}?drain=true

Response: 204 No Content
```

### Get Backend Status
```
GET /api/v1/backends

Response: 200 OK
{
  "backends": [
    {
      "server_id": "backend-123",
      "status": "HEALTHY",
      "connections": 1000,
      "response_time_ms": 50
    }
  ]
}
```

### Get Statistics
```
GET /api/v1/stats

Response: 200 OK
{
  "requests_per_second": 10000,
  "active_connections": 50000,
  "backend_count": 100,
  "healthy_backends": 98
}
```

### Configure Health Check
```
PUT /api/v1/health-check
{
  "interval_seconds": 5,
  "timeout_seconds": 2,
  "unhealthy_threshold": 3,
  "healthy_threshold": 2
}

Response: 200 OK
```

This API design provides comprehensive load balancer management capabilities.
