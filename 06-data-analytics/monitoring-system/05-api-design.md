# Metrics Monitoring System - API Design

## Query API

### Instant Query
```http
GET /api/v1/query?query=http_requests_total&time=1704729600

Response:
{
  "status": "success",
  "data": {
    "resultType": "vector",
    "result": [
      {
        "metric": {"__name__": "http_requests_total", "job": "api"},
        "value": [1704729600, "1523"]
      }
    ]
  }
}
```

### Range Query
```http
GET /api/v1/query_range?query=rate(http_requests_total[5m])&start=1704729600&end=1704733200&step=15

Response:
{
  "status": "success",
  "data": {
    "resultType": "matrix",
    "result": [
      {
        "metric": {"job": "api"},
        "values": [
          [1704729600, "10.5"],
          [1704729615, "11.2"]
        ]
      }
    ]
  }
}
```

## Alert API

### Create Alert Rule
```http
POST /api/v1/alerts/rules
{
  "name": "HighErrorRate",
  "query": "rate(http_errors_total[5m]) > 0.05",
  "duration": "5m",
  "severity": "critical",
  "annotations": {
    "summary": "High error rate detected"
  }
}
```

### List Alerts
```http
GET /api/v1/alerts

Response:
{
  "alerts": [
    {
      "labels": {"alertname": "HighErrorRate"},
      "state": "firing",
      "value": "0.08",
      "activeAt": "2026-01-08T10:30:00Z"
    }
  ]
}
```

## Push API

### Push Metrics
```http
POST /api/v1/push
Content-Type: text/plain

http_requests_total{method="GET"} 1523 1704729600
cpu_usage{host="server1"} 45.2 1704729600
```

This API design provides comprehensive access to monitoring functionality.
