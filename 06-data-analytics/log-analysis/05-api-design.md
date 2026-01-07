# Log Analysis System - API Design

## Search API

### Search Logs
```http
POST /api/logs/_search
{
  "query": {
    "bool": {
      "must": [
        {"match": {"message": "error"}},
        {"term": {"level": "ERROR"}}
      ],
      "filter": [
        {"range": {"@timestamp": {"gte": "now-1h"}}}
      ]
    }
  },
  "size": 100,
  "sort": [{"@timestamp": "desc"}]
}

Response:
{
  "hits": {
    "total": 1523,
    "hits": [
      {
        "_source": {
          "@timestamp": "2026-01-08T10:30:00Z",
          "message": "Database connection error",
          "level": "ERROR",
          "service": "api"
        }
      }
    ]
  }
}
```

### Aggregation Query
```http
POST /api/logs/_search
{
  "size": 0,
  "aggs": {
    "errors_by_service": {
      "terms": {"field": "service"},
      "aggs": {
        "error_count": {
          "filter": {"term": {"level": "ERROR"}}
        }
      }
    }
  }
}
```

## Ingestion API

### Bulk Index
```http
POST /api/_bulk
{"index": {"_index": "logs-2026.01.08"}}
{"@timestamp": "2026-01-08T10:30:00Z", "message": "Request processed", "level": "INFO"}
{"index": {"_index": "logs-2026.01.08"}}
{"@timestamp": "2026-01-08T10:30:01Z", "message": "Error occurred", "level": "ERROR"}
```

This API design provides comprehensive log search and ingestion capabilities.
