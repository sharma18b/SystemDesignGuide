# Web Analytics Tool - API Design

## API Overview

### API Categories
```
1. Tracking API: Event ingestion from clients
2. Reporting API: Query analytics data
3. Management API: Configure websites and settings
4. Real-time API: WebSocket for live updates
5. Data Export API: Bulk data export
```

## 1. Tracking API

### Track Event (Measurement Protocol)
```http
POST /collect
Content-Type: application/json

{
  "v": "1",
  "tid": "UA-XXXXX-Y",
  "cid": "555",
  "t": "pageview",
  "dh": "example.com",
  "dp": "/home",
  "dt": "Homepage",
  "dr": "https://google.com"
}

Response: 200 OK
{
  "status": "ok",
  "received": 1
}
```

### Batch Track Events
```http
POST /batch
Content-Type: application/json

{
  "tracking_id": "UA-XXXXX-Y",
  "events": [
    {
      "type": "pageview",
      "page": "/home",
      "timestamp": 1704729600000
    },
    {
      "type": "event",
      "category": "button",
      "action": "click",
      "label": "signup",
      "timestamp": 1704729605000
    }
  ]
}

Response: 200 OK
{
  "status": "ok",
  "received": 2,
  "failed": 0
}
```

## 2. Reporting API

### Get Real-time Metrics
```http
GET /api/v1/websites/{website_id}/realtime
Authorization: Bearer {token}

Response: 200 OK
{
  "website_id": "123e4567-e89b-12d3-a456-426614174000",
  "timestamp": "2026-01-08T10:30:00Z",
  "active_users": 1523,
  "pageviews_per_minute": 245,
  "top_pages": [
    {"page": "/home", "active_users": 423},
    {"page": "/products", "active_users": 312}
  ],
  "top_countries": [
    {"country": "US", "active_users": 645},
    {"country": "UK", "active_users": 234}
  ]
}
```

### Query Page Views
```http
POST /api/v1/websites/{website_id}/query
Authorization: Bearer {token}
Content-Type: application/json

{
  "date_range": {
    "start_date": "2026-01-01",
    "end_date": "2026-01-07"
  },
  "metrics": ["pageviews", "unique_users", "bounce_rate"],
  "dimensions": ["page", "country"],
  "filters": [
    {"dimension": "device_type", "operator": "equals", "value": "mobile"}
  ],
  "order_by": [{"metric": "pageviews", "direction": "desc"}],
  "limit": 100
}

Response: 200 OK
{
  "query_id": "q_abc123",
  "rows": [
    {
      "page": "/home",
      "country": "US",
      "pageviews": 15234,
      "unique_users": 8932,
      "bounce_rate": 0.42
    }
  ],
  "total_rows": 1523,
  "sampled": false,
  "query_time_ms": 234
}
```

## 3. Management API

### Create Website
```http
POST /api/v1/websites
Authorization: Bearer {token}
Content-Type: application/json

{
  "domain": "example.com",
  "name": "Example Website",
  "timezone": "America/New_York",
  "currency": "USD",
  "industry": "E-commerce"
}

Response: 201 Created
{
  "website_id": "123e4567-e89b-12d3-a456-426614174000",
  "tracking_id": "UA-XXXXX-Y",
  "domain": "example.com",
  "created_at": "2026-01-08T10:30:00Z"
}
```

### Create Goal
```http
POST /api/v1/websites/{website_id}/goals
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Purchase Complete",
  "type": "destination",
  "match_type": "equals",
  "value": "/thank-you",
  "value_numeric": 50.00
}

Response: 201 Created
{
  "goal_id": "goal_abc123",
  "name": "Purchase Complete",
  "created_at": "2026-01-08T10:30:00Z"
}
```

## 4. Real-time API (WebSocket)

### Connect to Real-time Stream
```javascript
const ws = new WebSocket('wss://analytics.example.com/realtime');

ws.onopen = () => {
  ws.send(JSON.stringify({
    action: 'subscribe',
    website_id: '123e4567-e89b-12d3-a456-426614174000',
    token: 'bearer_token'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Real-time update:', data);
};

// Server sends updates
{
  "type": "metrics_update",
  "timestamp": "2026-01-08T10:30:00Z",
  "active_users": 1523,
  "pageviews_last_minute": 245
}
```

## 5. Data Export API

### Export Raw Data
```http
POST /api/v1/websites/{website_id}/export
Authorization: Bearer {token}
Content-Type: application/json

{
  "date_range": {
    "start_date": "2026-01-01",
    "end_date": "2026-01-07"
  },
  "format": "csv",
  "fields": ["timestamp", "page", "user_id", "country"],
  "filters": []
}

Response: 202 Accepted
{
  "export_id": "exp_abc123",
  "status": "processing",
  "estimated_completion": "2026-01-08T10:35:00Z"
}
```

This API design provides comprehensive access to analytics functionality while maintaining performance and security.
