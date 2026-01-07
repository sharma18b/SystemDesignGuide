# Top-K Analysis System - API Design

## Query API

### Get Top-K
```http
GET /api/v1/topk?dimension=url&window=1hour&k=100

Response:
{
  "dimension": "url",
  "window": "1hour",
  "timestamp": "2026-01-08T10:30:00Z",
  "items": [
    {"rank": 1, "item": "/home", "count": 15234},
    {"rank": 2, "item": "/products", "count": 12341},
    {"rank": 3, "item": "/about", "count": 9876}
  ]
}
```

### Get Trending Items
```http
GET /api/v1/trending?dimension=hashtag&window=1hour&threshold=2.0

Response:
{
  "trending": [
    {
      "item": "#AI",
      "current_count": 5234,
      "previous_count": 1523,
      "growth_rate": 3.43
    }
  ]
}
```

### Track Event
```http
POST /api/v1/track
{
  "dimension": "url",
  "item": "/home",
  "timestamp": 1704729600000
}

Response: 200 OK
```

This API design provides comprehensive top-K query capabilities.
