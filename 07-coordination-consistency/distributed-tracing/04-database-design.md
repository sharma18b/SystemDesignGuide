# Distributed Tracing System - Database Design

## Cassandra Schema

### Spans Table
```cql
CREATE TABLE spans (
    trace_id UUID,
    span_id UUID,
    parent_span_id UUID,
    service_name TEXT,
    operation_name TEXT,
    start_time TIMESTAMP,
    duration BIGINT,
    tags MAP<TEXT, TEXT>,
    logs LIST<FROZEN<log_entry>>,
    PRIMARY KEY (trace_id, start_time, span_id)
) WITH CLUSTERING ORDER BY (start_time DESC, span_id ASC);

CREATE TYPE log_entry (
    timestamp TIMESTAMP,
    fields MAP<TEXT, TEXT>
);
```

### Trace Index
```cql
CREATE TABLE trace_index (
    service_name TEXT,
    operation_name TEXT,
    date TEXT,
    trace_id UUID,
    duration BIGINT,
    error BOOLEAN,
    PRIMARY KEY ((service_name, date), duration, trace_id)
) WITH CLUSTERING ORDER BY (duration DESC);
```

## Elasticsearch Schema

### Span Document
```json
{
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "span_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "parent_span_id": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
  "service_name": "api-gateway",
  "operation_name": "GET /users",
  "start_time": "2024-01-03T19:30:00.000Z",
  "duration_ms": 150,
  "tags": {
    "http.method": "GET",
    "http.status_code": 200,
    "error": false
  }
}
```

### Index Mapping
```json
{
  "mappings": {
    "properties": {
      "trace_id": {"type": "keyword"},
      "service_name": {"type": "keyword"},
      "operation_name": {"type": "keyword"},
      "start_time": {"type": "date"},
      "duration_ms": {"type": "long"},
      "tags": {"type": "object"}
    }
  }
}
```

This database design enables efficient trace storage and fast queries.
