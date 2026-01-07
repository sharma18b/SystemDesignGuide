# API Rate Limiter - API Design

## Rate Limiting Headers

### Standard HTTP Headers
```http
# Request headers
X-API-Key: abc123def456
X-Client-ID: user_12345
X-Forwarded-For: 203.0.113.42

# Response headers (on success)
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 742
X-RateLimit-Reset: 1704726000
X-RateLimit-Reset-After: 3600

# Response headers (on rate limit exceeded)
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704726000
Retry-After: 3600
Content-Type: application/json

{
  "error": "rate_limit_exceeded",
  "message": "You have exceeded your rate limit of 1000 requests per hour",
  "limit": 1000,
  "remaining": 0,
  "reset_at": "2024-01-08T12:00:00Z",
  "retry_after": 3600
}
```

## Configuration API

### Create Rate Limit Rule
```http
POST /api/v1/rate-limits/rules
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "rule_name": "premium_user_limit",
  "priority": 800,
  "conditions": {
    "user_tier": "premium",
    "endpoint_pattern": "/api/v1/*"
  },
  "limits": {
    "requests_per_second": 100,
    "requests_per_hour": 10000,
    "burst_size": 200
  },
  "algorithm": "token_bucket",
  "action": "throttle",
  "response": {
    "status": 429,
    "message": "Rate limit exceeded for premium tier"
  }
}

Response 201 Created:
{
  "rule_id": "rl_abc123",
  "rule_name": "premium_user_limit",
  "status": "active",
  "created_at": "2024-01-08T10:00:00Z"
}
```

### Update Rate Limit Rule
```http
PATCH /api/v1/rate-limits/rules/{rule_id}
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "limits": {
    "requests_per_hour": 15000
  },
  "enabled": true
}

Response 200 OK:
{
  "rule_id": "rl_abc123",
  "updated_fields": ["limits.requests_per_hour"],
  "updated_at": "2024-01-08T11:00:00Z"
}
```

### Get Rate Limit Rules
```http
GET /api/v1/rate-limits/rules?user_tier=premium&enabled=true
Authorization: Bearer <admin_token>

Response 200 OK:
{
  "rules": [
    {
      "rule_id": "rl_abc123",
      "rule_name": "premium_user_limit",
      "priority": 800,
      "conditions": {...},
      "limits": {...},
      "enabled": true
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

### Delete Rate Limit Rule
```http
DELETE /api/v1/rate-limits/rules/{rule_id}
Authorization: Bearer <admin_token>

Response 204 No Content
```

## User Quota Management API

### Get User Quota
```http
GET /api/v1/rate-limits/users/{user_id}/quota
Authorization: Bearer <token>

Response 200 OK:
{
  "user_id": 12345,
  "tier": "premium",
  "limits": {
    "requests_per_hour": 10000,
    "requests_per_day": 100000,
    "burst_size": 200
  },
  "current_usage": {
    "requests_this_hour": 3456,
    "requests_today": 45678,
    "remaining_hour": 6544,
    "remaining_day": 54322
  },
  "reset_times": {
    "hourly_reset": "2024-01-08T12:00:00Z",
    "daily_reset": "2024-01-09T00:00:00Z"
  }
}
```

### Update User Quota
```http
PUT /api/v1/rate-limits/users/{user_id}/quota
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "tier": "enterprise",
  "custom_limits": {
    "requests_per_hour": 50000,
    "requests_per_day": 500000
  }
}

Response 200 OK:
{
  "user_id": 12345,
  "tier": "enterprise",
  "limits": {...},
  "updated_at": "2024-01-08T10:30:00Z"
}
```

### Reset User Quota
```http
POST /api/v1/rate-limits/users/{user_id}/reset
Authorization: Bearer <admin_token>

Response 200 OK:
{
  "user_id": 12345,
  "reset_at": "2024-01-08T10:35:00Z",
  "new_usage": {
    "requests_this_hour": 0,
    "requests_today": 0
  }
}
```

## API Key Management

### Create API Key
```http
POST /api/v1/rate-limits/api-keys
Authorization: Bearer <token>
Content-Type: application/json

{
  "key_name": "Production API Key",
  "tier": "premium",
  "limits": {
    "requests_per_second": 100,
    "requests_per_hour": 10000
  },
  "expires_in_days": 365
}

Response 201 Created:
{
  "api_key_id": "key_abc123",
  "api_key": "sk_live_abc123def456...",  // Only shown once
  "key_name": "Production API Key",
  "tier": "premium",
  "limits": {...},
  "created_at": "2024-01-08T10:00:00Z",
  "expires_at": "2025-01-08T10:00:00Z"
}
```

### List API Keys
```http
GET /api/v1/rate-limits/api-keys
Authorization: Bearer <token>

Response 200 OK:
{
  "api_keys": [
    {
      "api_key_id": "key_abc123",
      "key_name": "Production API Key",
      "tier": "premium",
      "is_active": true,
      "last_used_at": "2024-01-08T09:45:00Z",
      "total_requests": 1234567,
      "created_at": "2024-01-08T10:00:00Z"
    }
  ],
  "total": 1
}
```

### Revoke API Key
```http
DELETE /api/v1/rate-limits/api-keys/{api_key_id}
Authorization: Bearer <token>

Response 204 No Content
```

## Monitoring and Analytics API

### Get Rate Limit Metrics
```http
GET /api/v1/rate-limits/metrics?start_time=2024-01-08T00:00:00Z&end_time=2024-01-08T23:59:59Z&granularity=hour
Authorization: Bearer <admin_token>

Response 200 OK:
{
  "metrics": [
    {
      "timestamp": "2024-01-08T10:00:00Z",
      "total_requests": 1000000,
      "allowed_requests": 950000,
      "throttled_requests": 45000,
      "blocked_requests": 5000,
      "latency_p50_ms": 2,
      "latency_p99_ms": 8,
      "cache_hit_rate": 0.96
    }
  ],
  "summary": {
    "total_requests": 24000000,
    "throttle_rate": 0.045,
    "average_latency_ms": 3
  }
}
```

### Get User Activity
```http
GET /api/v1/rate-limits/users/{user_id}/activity?days=7
Authorization: Bearer <token>

Response 200 OK:
{
  "user_id": 12345,
  "period": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-08T00:00:00Z"
  },
  "daily_usage": [
    {
      "date": "2024-01-08",
      "requests": 45678,
      "throttled": 234,
      "endpoints": {
        "/api/v1/users": 20000,
        "/api/v1/posts": 15000,
        "/api/v1/comments": 10678
      }
    }
  ],
  "top_endpoints": [...]
}
```

### Get Audit Logs
```http
GET /api/v1/rate-limits/audit-logs?user_id=12345&decision=throttled&limit=100
Authorization: Bearer <admin_token>

Response 200 OK:
{
  "logs": [
    {
      "log_id": 123456789,
      "timestamp": "2024-01-08T10:15:30Z",
      "user_id": 12345,
      "ip_address": "203.0.113.42",
      "endpoint": "/api/v1/users",
      "decision": "throttled",
      "rule_id": "rl_abc123",
      "current_count": 1001,
      "limit": 1000,
      "response_status": 429
    }
  ],
  "total": 234,
  "page": 1
}
```

## Allowlist/Blocklist API

### Add to Allowlist
```http
POST /api/v1/rate-limits/allowlist
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "type": "ip",  // ip, user_id, api_key
  "value": "203.0.113.0/24",
  "reason": "Internal monitoring service",
  "expires_at": "2025-01-08T00:00:00Z"
}

Response 201 Created:
{
  "allowlist_id": "al_abc123",
  "type": "ip",
  "value": "203.0.113.0/24",
  "created_at": "2024-01-08T10:00:00Z"
}
```

### Add to Blocklist
```http
POST /api/v1/rate-limits/blocklist
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "type": "ip",
  "value": "198.51.100.42",
  "reason": "Malicious activity detected",
  "duration_hours": 24
}

Response 201 Created:
{
  "blocklist_id": "bl_abc123",
  "type": "ip",
  "value": "198.51.100.42",
  "blocked_until": "2024-01-09T10:00:00Z"
}
```

## Webhook Notifications

### Configure Webhook
```http
POST /api/v1/rate-limits/webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://example.com/webhooks/rate-limit",
  "events": ["quota_exceeded", "quota_warning"],
  "threshold": 0.9,  // Notify at 90% usage
  "secret": "webhook_secret_key"
}

Response 201 Created:
{
  "webhook_id": "wh_abc123",
  "url": "https://example.com/webhooks/rate-limit",
  "events": ["quota_exceeded", "quota_warning"],
  "created_at": "2024-01-08T10:00:00Z"
}
```

### Webhook Payload
```json
POST https://example.com/webhooks/rate-limit
X-Webhook-Signature: sha256=abc123...
Content-Type: application/json

{
  "event": "quota_warning",
  "timestamp": "2024-01-08T10:30:00Z",
  "user_id": 12345,
  "quota": {
    "limit": 10000,
    "current": 9100,
    "remaining": 900,
    "usage_percent": 0.91
  },
  "reset_at": "2024-01-08T12:00:00Z"
}
```

## Client SDK Examples

### Python SDK
```python
from rate_limiter_sdk import RateLimiter

# Initialize client
client = RateLimiter(api_key="sk_live_abc123...")

# Check rate limit before making request
try:
    if client.check_limit(user_id=12345, endpoint="/api/v1/users"):
        # Make API request
        response = make_api_request()
    else:
        # Handle rate limit
        retry_after = client.get_retry_after(user_id=12345)
        print(f"Rate limited. Retry after {retry_after} seconds")
except RateLimitExceeded as e:
    print(f"Rate limit exceeded: {e.message}")
    print(f"Retry after: {e.retry_after}")
```

### JavaScript SDK
```javascript
import { RateLimiter } from 'rate-limiter-sdk';

const client = new RateLimiter({ apiKey: 'sk_live_abc123...' });

// Automatic retry with exponential backoff
const response = await client.request({
  userId: 12345,
  endpoint: '/api/v1/users',
  retryOnRateLimit: true,
  maxRetries: 3
});

// Get current quota
const quota = await client.getQuota(12345);
console.log(`Remaining: ${quota.remaining}/${quota.limit}`);
```

This API design provides comprehensive control over rate limiting configuration, monitoring, and management while maintaining simplicity for end users.
