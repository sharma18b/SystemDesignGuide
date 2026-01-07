# Ticketmaster - API Design

## API Overview

### Base URL
```
Production: https://api.ticketmaster.com/v1
Staging: https://api-staging.ticketmaster.com/v1
```

### Authentication
```
Authorization: Bearer {JWT_TOKEN}
X-API-Key: {api_key}
X-Device-ID: {device_fingerprint}
X-Session-ID: {session_id}
```

## Queue APIs

### 1. Join Queue
```
POST /queue/join
Content-Type: application/json

Request:
{
  "event_id": "uuid",
  "user_id": "uuid",
  "device_fingerprint": "hash"
}

Response: 200 OK
{
  "queue_token": "jwt_token",
  "queue_position": 15234,
  "estimated_wait_minutes": 25,
  "queue_size": 50000,
  "status": "QUEUED",
  "poll_interval_seconds": 30
}

Errors:
400 - Invalid event_id
409 - User already in queue
503 - Queue full
```

### 2. Check Queue Status
```
GET /queue/status?queue_token={token}

Response: 200 OK
{
  "queue_position": 12450,
  "estimated_wait_minutes": 20,
  "status": "QUEUED",
  "access_granted": false
}

When Ready:
{
  "queue_position": 0,
  "status": "READY",
  "access_granted": true,
  "access_token": "jwt_token",
  "expires_at": "2026-01-08T10:10:00Z"
}
```

### 3. Leave Queue
```
DELETE /queue/leave
Authorization: Bearer {queue_token}

Response: 204 No Content
```

## Event APIs

### 1. Search Events
```
GET /events/search?query=taylor+swift&city=new+york&date_from=2026-06-01

Response: 200 OK
{
  "events": [
    {
      "event_id": "uuid",
      "name": "Taylor Swift - Eras Tour",
      "artist": "Taylor Swift",
      "venue": {
        "name": "Madison Square Garden",
        "city": "New York",
        "state": "NY"
      },
      "date": "2026-08-15T19:00:00Z",
      "on_sale_date": "2026-06-03T10:00:00Z",
      "price_range": {
        "min": 150.00,
        "max": 500.00
      },
      "availability": "ON_SALE",
      "image_url": "https://cdn.ticketmaster.com/..."
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 45
  }
}
```

### 2. Get Event Details
```
GET /events/{event_id}

Response: 200 OK
{
  "event_id": "uuid",
  "name": "Taylor Swift - Eras Tour",
  "description": "...",
  "artist_id": "uuid",
  "venue_id": "uuid",
  "date": "2026-08-15T19:00:00Z",
  "doors_open": "2026-08-15T18:00:00Z",
  "category": "Concert",
  "pricing_tiers": [
    {
      "tier_id": "uuid",
      "name": "Floor",
      "price": 500.00,
      "fees": 75.00,
      "total": 575.00,
      "available_seats": 234
    }
  ],
  "sale_info": {
    "presale_start": "2026-06-01T10:00:00Z",
    "general_sale_start": "2026-06-03T10:00:00Z",
    "status": "ON_SALE"
  },
  "total_capacity": 20000,
  "available_seats": 5432
}
```

## Inventory APIs

### 1. Get Seat Map
```
GET /events/{event_id}/seats

Response: 200 OK
{
  "event_id": "uuid",
  "sections": [
    {
      "section_id": "uuid",
      "name": "Floor",
      "rows": [
        {
          "row": "A",
          "seats": [
            {
              "seat_id": "uuid",
              "number": "1",
              "status": "AVAILABLE",
              "price": 500.00
            },
            {
              "seat_id": "uuid",
              "number": "2",
              "status": "RESERVED",
              "price": 500.00
            }
          ]
        }
      ]
    }
  ],
  "last_updated": "2026-01-08T10:00:00Z"
}
```

### 2. Reserve Seats
```
POST /seats/reserve
Authorization: Bearer {access_token}
Content-Type: application/json

Request:
{
  "event_id": "uuid",
  "seat_ids": ["uuid1", "uuid2", "uuid3"],
  "user_id": "uuid"
}

Response: 201 Created
{
  "reservation_id": "uuid",
  "seat_ids": ["uuid1", "uuid2", "uuid3"],
  "expires_at": "2026-01-08T10:10:00Z",
  "total_price": 1500.00,
  "fees": 225.00,
  "total": 1725.00
}

Errors:
409 - Seats already taken
410 - Seats no longer available
422 - Exceeds purchase limit (max 8 tickets)
```

### 3. Release Reservation
```
DELETE /reservations/{reservation_id}
Authorization: Bearer {access_token}

Response: 204 No Content
```

## Order APIs

### 1. Create Order
```
POST /orders
Authorization: Bearer {access_token}
Content-Type: application/json

Request:
{
  "reservation_id": "uuid",
  "payment_method_id": "uuid",
  "billing_address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country": "US"
  },
  "delivery_method": "MOBILE"
}

Response: 201 Created
{
  "order_id": "uuid",
  "status": "PENDING",
  "seats": [
    {
      "section": "Floor",
      "row": "A",
      "seat": "1"
    }
  ],
  "subtotal": 1500.00,
  "fees": 225.00,
  "taxes": 135.00,
  "total": 1860.00,
  "payment_status": "AUTHORIZED",
  "created_at": "2026-01-08T10:05:00Z"
}

Errors:
400 - Invalid payment method
402 - Payment declined
410 - Reservation expired
```

### 2. Get Order Details
```
GET /orders/{order_id}
Authorization: Bearer {access_token}

Response: 200 OK
{
  "order_id": "uuid",
  "event": {
    "name": "Taylor Swift - Eras Tour",
    "date": "2026-08-15T19:00:00Z",
    "venue": "Madison Square Garden"
  },
  "seats": [...],
  "total": 1860.00,
  "status": "CONFIRMED",
  "payment_status": "CAPTURED",
  "tickets": [
    {
      "ticket_id": "uuid",
      "qr_code": "base64_encoded_image",
      "download_url": "https://tickets.ticketmaster.com/..."
    }
  ],
  "confirmed_at": "2026-01-08T10:05:30Z"
}
```

### 3. Cancel Order
```
POST /orders/{order_id}/cancel
Authorization: Bearer {access_token}

Response: 200 OK
{
  "order_id": "uuid",
  "status": "CANCELLED",
  "refund_amount": 1860.00,
  "refund_status": "PROCESSING",
  "cancelled_at": "2026-01-08T10:15:00Z"
}

Errors:
400 - Order cannot be cancelled (event started)
409 - Order already cancelled
```

## Payment APIs

### 1. Add Payment Method
```
POST /payment-methods
Authorization: Bearer {access_token}
Content-Type: application/json

Request:
{
  "type": "CARD",
  "card_token": "tok_visa_4242", // From Stripe
  "billing_address": {...}
}

Response: 201 Created
{
  "payment_method_id": "uuid",
  "type": "CARD",
  "card_last_four": "4242",
  "card_brand": "Visa",
  "expiry": "12/2028",
  "is_default": true
}
```

## Ticket APIs

### 1. Get Tickets
```
GET /tickets?order_id={order_id}
Authorization: Bearer {access_token}

Response: 200 OK
{
  "tickets": [
    {
      "ticket_id": "uuid",
      "event_name": "Taylor Swift - Eras Tour",
      "event_date": "2026-08-15T19:00:00Z",
      "venue": "Madison Square Garden",
      "section": "Floor",
      "row": "A",
      "seat": "1",
      "qr_code": "base64_image",
      "barcode": "123456789012",
      "status": "ACTIVE",
      "transferable": true
    }
  ]
}
```

### 2. Transfer Ticket
```
POST /tickets/{ticket_id}/transfer
Authorization: Bearer {access_token}
Content-Type: application/json

Request:
{
  "recipient_email": "friend@example.com",
  "recipient_name": "John Doe"
}

Response: 200 OK
{
  "transfer_id": "uuid",
  "status": "PENDING",
  "recipient_email": "friend@example.com",
  "expires_at": "2026-01-15T10:00:00Z"
}
```

## WebSocket APIs

### Real-time Updates
```
ws://api.ticketmaster.com/v1/realtime?token={access_token}

Connection:
{
  "type": "subscribe",
  "event_id": "uuid"
}

Events:
{
  "type": "availability_update",
  "event_id": "uuid",
  "section": "Floor",
  "available_seats": 234,
  "timestamp": "2026-01-08T10:00:00Z"
}

{
  "type": "queue_update",
  "queue_position": 12000,
  "estimated_wait": 18,
  "timestamp": "2026-01-08T10:00:30Z"
}

{
  "type": "reservation_expiring",
  "reservation_id": "uuid",
  "expires_in_seconds": 60
}
```

## Rate Limiting

### Rate Limits
```
Normal Users:
- Search: 100 requests/minute
- Event details: 200 requests/minute
- Seat map: 50 requests/minute
- Reserve seats: 10 requests/minute

Queue Users:
- Status check: 2 requests/minute
- No other API access until granted

Authenticated:
- 1000 requests/hour across all endpoints

Headers:
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704715200
```

## Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "SEATS_UNAVAILABLE",
    "message": "The selected seats are no longer available",
    "details": {
      "seat_ids": ["uuid1", "uuid2"],
      "reason": "Already purchased by another user"
    },
    "request_id": "uuid",
    "timestamp": "2026-01-08T10:00:00Z"
  }
}
```

### HTTP Status Codes
```
200 OK - Success
201 Created - Resource created
204 No Content - Success with no body
400 Bad Request - Invalid input
401 Unauthorized - Missing/invalid auth
403 Forbidden - Access denied
404 Not Found - Resource not found
409 Conflict - Resource conflict (seat taken)
410 Gone - Resource expired (reservation)
422 Unprocessable Entity - Validation error
429 Too Many Requests - Rate limit exceeded
500 Internal Server Error - Server error
503 Service Unavailable - System overloaded
```

This API design provides comprehensive ticket purchasing functionality while handling extreme traffic through queuing, rate limiting, and real-time updates.
