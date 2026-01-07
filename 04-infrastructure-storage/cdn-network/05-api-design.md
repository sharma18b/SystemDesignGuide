# CDN Network - API Design

## Content Delivery API

### GET Content
```
GET https://cdn.example.com/images/photo.jpg
Host: cdn.example.com

Response: 200 OK
X-Cache: HIT
X-Cache-Edge: us-east-1
Age: 3600
Cache-Control: public, max-age=86400
```

## Management API

### Purge Cache
```
POST /api/v1/purge
{
  "urls": [
    "https://cdn.example.com/images/photo.jpg"
  ]
}

Response: 200 OK
{
  "purged": 1,
  "edges_updated": 200
}
```

### Get Statistics
```
GET /api/v1/stats

Response: 200 OK
{
  "requests": 1000000000,
  "cache_hit_rate": 0.92,
  "bandwidth_gbps": 50000,
  "latency_p99_ms": 45
}
```

### Configure Origin
```
POST /api/v1/origins
{
  "hostname": "origin.example.com",
  "protocol": "HTTPS",
  "port": 443
}

Response: 201 Created
{
  "origin_id": "origin-123"
}
```

This API design provides comprehensive CDN management capabilities.
