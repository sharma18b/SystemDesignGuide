# Log Analysis System - Database Design

## Elasticsearch Index Design

### Log Index Template
```json
{
  "index_patterns": ["logs-*"],
  "settings": {
    "number_of_shards": 10,
    "number_of_replicas": 2,
    "refresh_interval": "5s",
    "codec": "best_compression"
  },
  "mappings": {
    "properties": {
      "@timestamp": {"type": "date"},
      "message": {"type": "text"},
      "level": {"type": "keyword"},
      "service": {"type": "keyword"},
      "host": {"type": "keyword"},
      "trace_id": {"type": "keyword"},
      "user_id": {"type": "keyword"},
      "fields": {"type": "object"}
    }
  }
}
```

### Index Lifecycle Policy
```json
{
  "policy": {
    "phases": {
      "hot": {
        "actions": {
          "rollover": {
            "max_size": "50GB",
            "max_age": "1d"
          }
        }
      },
      "warm": {
        "min_age": "90d",
        "actions": {
          "shrink": {"number_of_shards": 1},
          "forcemerge": {"max_num_segments": 1}
        }
      },
      "cold": {
        "min_age": "365d",
        "actions": {
          "freeze": {}
        }
      },
      "delete": {
        "min_age": "2555d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

## Metadata Store

### Saved Searches
```sql
CREATE TABLE saved_searches (
    search_id UUID PRIMARY KEY,
    name VARCHAR(255),
    query TEXT,
    filters JSONB,
    created_by UUID,
    created_at TIMESTAMP
);
```

### Dashboards
```sql
CREATE TABLE dashboards (
    dashboard_id UUID PRIMARY KEY,
    name VARCHAR(255),
    panels JSONB,
    created_at TIMESTAMP
);
```

This database design efficiently stores and queries log data at scale.
