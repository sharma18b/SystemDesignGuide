# Webhook Notification Service - API Design

## Webhook Management API

### Create Webhook
```http
POST /api/v1/webhooks
Content-Type: application/json
Authorization: Bearer <token>

{
  "url": "https://customer.example.com/webhooks",
  "description": "Payment notifications",
  "events": ["payment.success", "payment.failed"],
  "secret": "whsec_abc123def456",  // Optional, auto-generated if not provided
  "config": {
    "timeout_seconds": 30,
    "max_retries": 5,
    "retry_strategy": "exponential"
  },
  "filters": {
    "payment.success": {
      "amount": {"gt": 100}
    }
  },
  "auth": {
    "type": "bearer",
    "token": "bearer_token_xyz"
  }
}

Response 201 Created:
{
  "webhook_id": "wh_abc123",
  "url": "https://customer.example.com/webhooks",
  "secret": "whsec_abc123def456",
  "events": ["payment.success", "payment.failed"],
  "status": "active",
  "created_at": "2024-01-08T10:00:00Z"
}
```

### Get Webhook
```http
GET /api/v1/webhooks/{webhook_id}

Response 200 OK:
{
  "webhook_id": "wh_abc123",
  "url": "https://customer.example.com/webhooks",
  "description": "Payment notifications",
  "events": ["payment.success", "payment.failed"],
  "secret": "whsec_***456",  // Masked
  "config": {
    "timeout_seconds": 30,
    "max_retries": 5,
    "retry_strategy": "exponential"
  },
  "status": "active",
  "stats": {
    "total_deliveries": 10000,
    "successful_deliveries": 9950,
    "failed_deliveries": 50,
    "success_rate": 0.995,
    "average_response_time_ms": 250
  },
  "created_at": "2024-01-08T10:00:00Z",
  "updated_at": "2024-01-08T10:00:00Z"
}
```

### List Webhooks
```http
GET /api/v1/webhooks?status=active&limit=20

Response 200 OK:
{
  "webhooks": [
    {
      "webhook_id": "wh_abc123",
      "url": "https://customer.example.com/webhooks",
      "events": ["payment.success"],
      "status": "active"
    }
  ],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

### Update Webhook
```http
PATCH /api/v1/webhooks/{webhook_id}
Content-Type: application/json

{
  "events": ["payment.success", "payment.failed", "payment.refunded"],
  "config": {
    "max_retries": 10
  }
}

Response 200 OK:
{
  "webhook_id": "wh_abc123",
  "updated_fields": ["events", "config.max_retries"],
  "updated_at": "2024-01-08T11:00:00Z"
}
```

### Delete Webhook
```http
DELETE /api/v1/webhooks/{webhook_id}

Response 204 No Content
```

### Test Webhook
```http
POST /api/v1/webhooks/{webhook_id}/test
Content-Type: application/json

{
  "event_type": "payment.success",
  "test_data": {
    "payment_id": "test_123",
    "amount": 100.00
  }
}

Response 200 OK:
{
  "test_id": "test_xyz789",
  "status": "success",
  "response_status": 200,
  "response_time_ms": 245,
  "response_body": "OK"
}
```

## Delivery API

### Get Deliveries
```http
GET /api/v1/webhooks/{webhook_id}/deliveries?status=failed&limit=10

Response 200 OK:
{
  "deliveries": [
    {
      "delivery_id": "del_abc123",
      "webhook_id": "wh_abc123",
      "event_id": "evt_xyz789",
      "event_type": "payment.success",
      "status": "failed",
      "attempt_number": 5,
      "response_status": 500,
      "error_message": "Internal Server Error",
      "created_at": "2024-01-08T10:00:00Z",
      "next_retry_at": null
    }
  ],
  "total": 50
}
```

### Get Delivery Details
```http
GET /api/v1/deliveries/{delivery_id}

Response 200 OK:
{
  "delivery_id": "del_abc123",
  "webhook_id": "wh_abc123",
  "event_id": "evt_xyz789",
  "event_type": "payment.success",
  "status": "success",
  "attempt_number": 2,
  "request": {
    "url": "https://customer.example.com/webhooks",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json",
      "X-Webhook-ID": "wh_abc123",
      "X-Signature": "sha256=..."
    },
    "body": {...},
    "sent_at": "2024-01-08T10:00:01Z"
  },
  "response": {
    "status": 200,
    "headers": {...},
    "body": "OK",
    "received_at": "2024-01-08T10:00:01.250Z",
    "time_ms": 250
  }
}
```

### Retry Delivery
```http
POST /api/v1/deliveries/{delivery_id}/retry

Response 202 Accepted:
{
  "delivery_id": "del_abc123",
  "status": "retrying",
  "scheduled_at": "2024-01-08T10:05:00Z"
}
```

### Bulk Retry
```http
POST /api/v1/webhooks/{webhook_id}/retry-failed
Content-Type: application/json

{
  "start_date": "2024-01-08T00:00:00Z",
  "end_date": "2024-01-08T23:59:59Z"
}

Response 202 Accepted:
{
  "webhook_id": "wh_abc123",
  "deliveries_queued": 50,
  "estimated_completion": "2024-01-08T10:10:00Z"
}
```

## Event Publishing API

### Publish Event
```http
POST /api/v1/events
Content-Type: application/json
Authorization: Bearer <token>

{
  "event_type": "payment.success",
  "data": {
    "payment_id": "pay_123",
    "amount": 100.00,
    "currency": "USD",
    "user_id": 12345
  },
  "idempotency_key": "pay_123_success"  // Prevent duplicates
}

Response 202 Accepted:
{
  "event_id": "evt_xyz789",
  "event_type": "payment.success",
  "webhooks_triggered": 25,
  "created_at": "2024-01-08T10:00:00Z"
}
```

### Batch Publish Events
```http
POST /api/v1/events/batch
Content-Type: application/json

{
  "events": [
    {
      "event_type": "payment.success",
      "data": {...},
      "idempotency_key": "pay_123"
    },
    {
      "event_type": "order.created",
      "data": {...},
      "idempotency_key": "order_456"
    }
  ]
}

Response 202 Accepted:
{
  "events_accepted": 2,
  "event_ids": ["evt_xyz789", "evt_abc456"],
  "total_webhooks_triggered": 50
}
```

## Monitoring API

### Get Webhook Statistics
```http
GET /api/v1/webhooks/{webhook_id}/stats?period=7d

Response 200 OK:
{
  "webhook_id": "wh_abc123",
  "period": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-08T00:00:00Z"
  },
  "stats": {
    "total_deliveries": 10000,
    "successful_deliveries": 9950,
    "failed_deliveries": 50,
    "success_rate": 0.995,
    "average_response_time_ms": 250,
    "p50_response_time_ms": 200,
    "p95_response_time_ms": 500,
    "p99_response_time_ms": 1000
  },
  "daily_breakdown": [
    {
      "date": "2024-01-08",
      "deliveries": 1500,
      "success_rate": 0.997
    }
  ]
}
```

### Get System Status
```http
GET /api/v1/status

Response 200 OK:
{
  "status": "healthy",
  "queue": {
    "pending": 1000,
    "retrying": 500,
    "processing_rate": 10000
  },
  "workers": {
    "total": 100,
    "active": 98,
    "idle": 2
  },
  "deliveries": {
    "last_minute": 10000,
    "success_rate": 0.995
  }
}
```

## Client SDKs

### Python SDK
```python
from webhook_service import WebhookClient

# Initialize client
client = WebhookClient(
    base_url="https://api.example.com",
    api_key="your_api_key"
)

# Create webhook
webhook = client.create_webhook(
    url="https://customer.example.com/webhooks",
    events=["payment.success", "payment.failed"],
    secret="whsec_abc123"
)
print(f"Webhook created: {webhook.webhook_id}")

# Publish event
event = client.publish_event(
    event_type="payment.success",
    data={"payment_id": "pay_123", "amount": 100.00}
)
print(f"Event published: {event.event_id}")

# Get deliveries
deliveries = client.get_deliveries(webhook.webhook_id, status="failed")
for delivery in deliveries:
    print(f"Delivery {delivery.delivery_id}: {delivery.status}")

# Retry failed delivery
client.retry_delivery(delivery.delivery_id)
```

### JavaScript SDK
```javascript
import { WebhookClient } from 'webhook-service-sdk';

const client = new WebhookClient({
  baseUrl: 'https://api.example.com',
  apiKey: 'your_api_key'
});

// Create webhook
const webhook = await client.createWebhook({
  url: 'https://customer.example.com/webhooks',
  events: ['payment.success', 'payment.failed'],
  secret: 'whsec_abc123'
});

// Publish event
const event = await client.publishEvent({
  eventType: 'payment.success',
  data: { paymentId: 'pay_123', amount: 100.00 }
});

// Get deliveries
const deliveries = await client.getDeliveries(webhook.webhookId, {
  status: 'failed'
});
```

## Webhook Receiver SDK (Customer Side)

### Verify Webhook Signature
```python
import hmac
import hashlib

def verify_webhook_signature(payload, signature, secret):
    """Verify webhook signature"""
    expected_signature = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(
        f"sha256={expected_signature}",
        signature
    )

# Flask example
@app.route('/webhooks', methods=['POST'])
def handle_webhook():
    payload = request.get_data(as_text=True)
    signature = request.headers.get('X-Signature')
    secret = 'whsec_abc123'
    
    if not verify_webhook_signature(payload, signature, secret):
        return 'Invalid signature', 401
    
    event = request.get_json()
    process_event(event)
    
    return 'OK', 200
```

This comprehensive API design provides flexible, secure, and developer-friendly interfaces for webhook management and delivery.
