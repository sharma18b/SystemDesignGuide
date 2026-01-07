# Ad Click Aggregation - API Design

## Click Tracking API

### Track Click
```http
GET /track/click?ad_id=123&campaign_id=456&user_id=abc&timestamp=1704729600000

Response: 200 OK
{
  "status": "ok",
  "click_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Analytics API

### Get Click Stats
```http
GET /api/v1/stats/clicks?advertiser_id=123&start_date=2026-01-01&end_date=2026-01-07&group_by=campaign

Response:
{
  "data": [
    {
      "campaign_id": 456,
      "clicks": 1523000,
      "unique_users": 892000,
      "cost": 15230.00,
      "fraud_clicks": 1200
    }
  ],
  "total_clicks": 1523000,
  "period": "2026-01-01 to 2026-01-07"
}
```

### Real-time Dashboard
```http
GET /api/v1/realtime/clicks?advertiser_id=123

Response:
{
  "timestamp": "2026-01-08T10:30:00Z",
  "clicks_last_minute": 15234,
  "clicks_last_hour": 892341,
  "top_campaigns": [
    {"campaign_id": 456, "clicks": 5234}
  ]
}
```

## Billing API

### Get Billing Report
```http
GET /api/v1/billing/report?advertiser_id=123&month=2026-01

Response:
{
  "advertiser_id": 123,
  "period": "2026-01",
  "total_clicks": 45230000,
  "billable_clicks": 45100000,
  "fraud_clicks": 130000,
  "total_cost": 451000.00,
  "breakdown_by_campaign": [...]
}
```

This API design provides comprehensive click tracking and analytics capabilities.
