# Distributed Tracing System - API Design

## Trace Collection API

### Submit Spans (Jaeger Format)
```http
POST /api/traces
Content-Type: application/json

{
  "spans": [
    {
      "traceId": "550e8400e29b41d4a716446655440000",
      "spanId": "6ba7b8109dad11d1",
      "operationName": "GET /users",
      "startTime": 1704310200000000,
      "duration": 150000,
      "tags": [
        {"key": "http.method", "value": "GET"},
        {"key": "http.status_code", "value": 200}
      ]
    }
  ]
}
```

## Query API

### Get Trace
```http
GET /api/traces/{trace_id}

Response 200:
{
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "spans": [...],
  "services": ["api-gateway", "user-service"],
  "duration_ms": 250
}
```

### Search Traces
```http
GET /api/traces?service=api-gateway&operation=GET%20/users&minDuration=100ms

Response 200:
{
  "traces": [
    {
      "trace_id": "...",
      "start_time": "2024-01-03T19:30:00Z",
      "duration_ms": 150,
      "spans": 5
    }
  ]
}
```

## Client Library (Python)
```python
from opentelemetry import trace
from opentelemetry.exporter.jaeger import JaegerExporter

tracer = trace.get_tracer(__name__)

with tracer.start_as_current_span("process_request"):
    # Your code here
    result = process_data()
```

This API provides standard OpenTelemetry-compatible tracing interfaces.
