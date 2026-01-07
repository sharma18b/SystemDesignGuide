# CDN Network - Database Design

## Cache Entry Schema
```
CacheEntry:
  url: string
  content: bytes
  headers: map<string, string>
  ttl: int32
  expires_at: timestamp
  size: int64
  hit_count: int64
  last_accessed: timestamp
```

## Edge Configuration
```
EdgeConfig:
  edge_id: string
  location: string
  capacity: int64
  status: ACTIVE|MAINTENANCE|OFFLINE
  cache_rules: []CacheRule
```

## Origin Configuration
```
Origin:
  origin_id: string
  hostname: string
  protocol: HTTP|HTTPS
  port: int
  health_check_url: string
  timeout_ms: int32
```

## Routing Table
```
Route:
  domain: string
  path_pattern: string
  origin_id: string
  cache_behavior: CacheBehavior
  edge_functions: []Function
```

This database design efficiently manages CDN configuration and cached content.
