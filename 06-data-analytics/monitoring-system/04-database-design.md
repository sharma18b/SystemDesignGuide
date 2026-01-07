# Metrics Monitoring System - Database Design

## Time-Series Database Schema

### Metric Storage (VictoriaMetrics/Prometheus)
```
Time Series Format:
metric_name{label1="value1", label2="value2"} value timestamp

Example:
http_requests_total{method="GET", status="200", service="api"} 1523 1704729600

Storage Structure:
- Metric Name: http_requests_total
- Labels: {method="GET", status="200", service="api"}
- Value: 1523
- Timestamp: 1704729600 (Unix timestamp)
```

### Time-Series Index
```
Inverted Index:
label_name -> label_value -> [series_ids]

Example:
method -> GET -> [series_1, series_3, series_5]
method -> POST -> [series_2, series_4]
status -> 200 -> [series_1, series_2]
status -> 500 -> [series_3]
```

### Data Blocks
```
Block Structure:
- Time Range: 2 hours per block
- Compression: Delta-of-delta + XOR encoding
- Index: Per-block inverted index
- Metadata: Min/max timestamps, series count
```

## Metadata Store (PostgreSQL)

### Alert Rules
```sql
CREATE TABLE alert_rules (
    rule_id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    query TEXT NOT NULL,
    duration INTERVAL DEFAULT '5 minutes',
    severity VARCHAR(20),
    labels JSONB,
    annotations JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Alert Instances
```sql
CREATE TABLE alert_instances (
    instance_id UUID PRIMARY KEY,
    rule_id UUID REFERENCES alert_rules(rule_id),
    labels JSONB,
    state VARCHAR(20),
    fired_at TIMESTAMP,
    resolved_at TIMESTAMP,
    value DOUBLE PRECISION
);
```

### Dashboards
```sql
CREATE TABLE dashboards (
    dashboard_id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    panels JSONB,
    variables JSONB,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Cache Layer (Redis)

### Query Result Cache
```
Key: query:{hash}
Value: JSON result
TTL: 60 seconds
```

### Metric Metadata Cache
```
Key: series:{series_id}
Value: {labels, last_seen}
TTL: 3600 seconds
```

This database design efficiently stores and queries time-series metric data at scale.
