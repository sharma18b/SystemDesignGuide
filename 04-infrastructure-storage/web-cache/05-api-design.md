# Web Cache - API Design

## HTTP Caching API

### Cache Request Headers
```
GET /api/resource HTTP/1.1
Host: example.com
Cache-Control: no-cache              # Bypass cache
If-Modified-Since: Wed, 21 Oct 2024 07:28:00 GMT
If-None-Match: "686897696a7c876b7e"  # ETag validation
Accept-Encoding: gzip, br             # Compression support
```

### Cache Response Headers
```
HTTP/1.1 200 OK
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
ETag: "686897696a7c876b7e"
Last-Modified: Wed, 21 Oct 2024 07:28:00 GMT
Age: 120                              # Time in cache
X-Cache: HIT                          # Cache status
X-Cache-Node: cache-node-1
Vary: Accept-Encoding, Accept-Language
Content-Encoding: gzip
```

## Cache Management API

### Purge Cache Entry
```
DELETE /cache/purge
Content-Type: application/json

{
  "urls": [
    "https://example.com/page.html",
    "https://example.com/api/data"
  ]
}

Response: 200 OK
{
  "purged": 2,
  "failed": 0,
  "nodes_updated": 100
}
```

### Purge by Pattern
```
DELETE /cache/purge/pattern
{
  "pattern": "/api/users/*",
  "method": "GET"
}

Response: 200 OK
{
  "purged": 1523,
  "pattern": "/api/users/*"
}
```

### Purge by Tag
```
DELETE /cache/purge/tag
{
  "tags": ["product:123", "category:electronics"]
}

Response: 200 OK
{
  "purged": 45,
  "tags": ["product:123", "category:electronics"]
}
```

### Purge All
```
DELETE /cache/purge/all

Response: 200 OK
{
  "purged": 1000000,
  "message": "All cache entries purged"
}
```

## Cache Statistics API

### Get Cache Stats
```
GET /cache/stats

Response: 200 OK
{
  "total_requests": 1000000000,
  "cache_hits": 900000000,
  "cache_misses": 100000000,
  "hit_rate": 0.90,
  "total_size_bytes": 1099511627776,
  "entry_count": 5000000,
  "eviction_count": 500000,
  "avg_latency_ms": 1.5,
  "p99_latency_ms": 5.0
}
```

### Get Node Stats
```
GET /cache/nodes/{node_id}/stats

Response: 200 OK
{
  "node_id": "cache-node-1",
  "status": "healthy",
  "cpu_usage": 0.45,
  "memory_usage": 0.80,
  "disk_usage": 0.65,
  "requests_per_sec": 10000,
  "hit_rate": 0.92,
  "connections": 50000
}
```

## Cache Warming API

### Warm Cache
```
POST /cache/warm
{
  "urls": [
    "https://example.com/popular-page.html",
    "https://example.com/api/trending"
  ],
  "priority": "high"
}

Response: 202 Accepted
{
  "job_id": "warm-job-123",
  "status": "in_progress",
  "urls_queued": 2
}
```

### Check Warming Status
```
GET /cache/warm/{job_id}

Response: 200 OK
{
  "job_id": "warm-job-123",
  "status": "completed",
  "urls_processed": 2,
  "urls_failed": 0,
  "duration_ms": 1500
}
```

## Cache Configuration API

### Update Cache Config
```
PUT /cache/config
{
  "max_size_bytes": 137438953472,
  "default_ttl": 3600,
  "eviction_policy": "LRU",
  "compression_enabled": true,
  "compression_algorithm": "brotli"
}

Response: 200 OK
{
  "message": "Configuration updated",
  "restart_required": false
}
```

### Get Cache Config
```
GET /cache/config

Response: 200 OK
{
  "max_size_bytes": 137438953472,
  "default_ttl": 3600,
  "eviction_policy": "LRU",
  "compression_enabled": true,
  "compression_algorithm": "brotli",
  "max_entry_size": 10485760
}
```

## Health Check API

### Health Check
```
GET /health

Response: 200 OK
{
  "status": "healthy",
  "cache_available": true,
  "origin_reachable": true,
  "disk_space_available": true,
  "memory_available": true
}
```

### Readiness Check
```
GET /ready

Response: 200 OK
{
  "ready": true,
  "cache_loaded": true,
  "connections_available": true
}
```

This API design provides comprehensive control and monitoring capabilities for the distributed web caching system.
