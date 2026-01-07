# Uber Backend - API Design

## API Architecture

### API Gateway Pattern
- **Technology**: Kong / AWS API Gateway / Custom Envoy-based gateway
- **Responsibilities**: Authentication, rate limiting, routing, transformation
- **Protocol**: REST (HTTP/1.1, HTTP/2), WebSocket for real-time
- **Format**: JSON for request/response bodies
- **Versioning**: URL-based versioning (/v1/, /v2/)

### API Design Principles
- **RESTful**: Resource-based URLs, HTTP methods for operations
- **Idempotent**: POST/PUT/DELETE operations use idempotency keys
- **Paginated**: Large result sets use cursor-based pagination
- **Filtered**: Support query parameters for filtering and sorting
- **Documented**: OpenAPI 3.0 specification for all endpoints
- **Versioned**: Backward compatibility with deprecation notices

## Authentication and Authorization

### Authentication Flow
```
1. User Login:
   POST /v1/auth/login
   {
     "phone_number": "+1234567890",
     "verification_code": "123456"
   }
   
   Response:
   {
     "access_token": "eyJhbGc...",
     "refresh_token": "eyJhbGc...",
     "expires_in": 3600,
     "user_id": "uuid",
     "user_type": "RIDER"
   }

2. Token Refresh:
   POST /v1/auth/refresh
   {
     "refresh_token": "eyJhbGc..."
   }
   
   Response:
   {
     "access_token": "eyJhbGc...",
     "expires_in": 3600
   }

3. Logout:
   POST /v1/auth/logout
   Authorization: Bearer {access_token}
```

### Authorization Headers
```
Authorization: Bearer {JWT_TOKEN}
X-User-Type: RIDER | DRIVER
X-Device-ID: {unique_device_identifier}
X-App-Version: 5.123.0
X-Platform: iOS | Android | Web
```

## Rider APIs

### 1. Request Ride
```
POST /v1/rides/request
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "pickup": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "address": "123 Market St, San Francisco, CA"
  },
  "dropoff": {
    "latitude": 37.7849,
    "longitude": -122.4094,
    "address": "456 Mission St, San Francisco, CA"
  },
  "ride_type": "UBER_X",
  "payment_method_id": "uuid",
  "scheduled_time": null,
  "passengers": 1,
  "notes": "Please call when you arrive"
}

Response: 201 Created
{
  "trip_id": "uuid",
  "status": "REQUESTED",
  "estimated_fare": {
    "min": 12.50,
    "max": 15.00,
    "currency": "USD",
    "surge_multiplier": 1.2
  },
  "estimated_pickup_time": "2026-01-08T10:05:00Z",
  "estimated_duration_minutes": 18,
  "estimated_distance_miles": 4.2,
  "requested_at": "2026-01-08T10:00:00Z"
}

Error Responses:
400 Bad Request - Invalid pickup/dropoff coordinates
402 Payment Required - Invalid payment method
409 Conflict - Active trip already exists
503 Service Unavailable - No drivers available
```

### 2. Get Trip Status
```
GET /v1/rides/{trip_id}
Authorization: Bearer {token}

Response: 200 OK
{
  "trip_id": "uuid",
  "status": "ARRIVING",
  "rider": {
    "rider_id": "uuid",
    "name": "John Doe",
    "phone": "+1234567890",
    "rating": 4.85
  },
  "driver": {
    "driver_id": "uuid",
    "name": "Jane Smith",
    "phone": "+1987654321",
    "rating": 4.92,
    "photo_url": "https://cdn.uber.com/drivers/...",
    "vehicle": {
      "make": "Toyota",
      "model": "Camry",
      "year": 2022,
      "color": "Silver",
      "license_plate": "ABC1234"
    },
    "location": {
      "latitude": 37.7739,
      "longitude": -122.4184,
      "heading": 45,
      "updated_at": "2026-01-08T10:03:00Z"
    }
  },
  "pickup": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "address": "123 Market St, San Francisco, CA",
    "eta_minutes": 2
  },
  "dropoff": {
    "latitude": 37.7849,
    "longitude": -122.4094,
    "address": "456 Mission St, San Francisco, CA"
  },
  "fare": {
    "estimated_total": 13.75,
    "currency": "USD"
  },
  "requested_at": "2026-01-08T10:00:00Z",
  "matched_at": "2026-01-08T10:00:15Z",
  "accepted_at": "2026-01-08T10:00:20Z"
}
```

### 3. Cancel Ride
```
DELETE /v1/rides/{trip_id}
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "reason": "CHANGE_OF_PLANS",
  "details": "Found alternative transportation"
}

Response: 200 OK
{
  "trip_id": "uuid",
  "status": "CANCELLED",
  "cancelled_by": "RIDER",
  "cancellation_fee": 5.00,
  "currency": "USD",
  "cancelled_at": "2026-01-08T10:02:00Z"
}

Error Responses:
400 Bad Request - Trip cannot be cancelled (already started)
404 Not Found - Trip not found
409 Conflict - Trip already completed/cancelled
```

### 4. Get Ride History
```
GET /v1/rides/history?limit=20&cursor={cursor}
Authorization: Bearer {token}

Response: 200 OK
{
  "trips": [
    {
      "trip_id": "uuid",
      "status": "COMPLETED",
      "pickup_address": "123 Market St, SF",
      "dropoff_address": "456 Mission St, SF",
      "driver_name": "Jane Smith",
      "driver_rating": 4.92,
      "vehicle": "Silver Toyota Camry",
      "distance_miles": 4.2,
      "duration_minutes": 18,
      "total_fare": 13.75,
      "currency": "USD",
      "completed_at": "2026-01-08T10:20:00Z"
    }
  ],
  "pagination": {
    "next_cursor": "eyJsYXN0X2lkIjoi...",
    "has_more": true
  }
}
```

### 5. Rate Driver
```
POST /v1/rides/{trip_id}/rating
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "rating": 5,
  "feedback": "Great driver, very friendly!",
  "tags": ["Friendly", "Clean Car", "Safe Driving"],
  "tip_amount": 5.00
}

Response: 200 OK
{
  "rating_id": "uuid",
  "trip_id": "uuid",
  "rating": 5,
  "submitted_at": "2026-01-08T10:25:00Z"
}
```

## Driver APIs

### 1. Update Driver Status
```
PUT /v1/drivers/status
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "status": "AVAILABLE",
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "accuracy": 10,
    "heading": 90,
    "speed": 25
  }
}

Response: 200 OK
{
  "driver_id": "uuid",
  "status": "AVAILABLE",
  "updated_at": "2026-01-08T10:00:00Z"
}

Status Values:
- OFFLINE: Driver not accepting rides
- AVAILABLE: Driver online and accepting rides
- ON_TRIP: Driver currently on a trip
- BREAK: Driver on break
```

### 2. Update Location (Batch)
```
POST /v1/drivers/location/batch
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "locations": [
    {
      "latitude": 37.7749,
      "longitude": -122.4194,
      "accuracy": 10,
      "heading": 90,
      "speed": 25,
      "timestamp": "2026-01-08T10:00:00Z"
    },
    {
      "latitude": 37.7750,
      "longitude": -122.4195,
      "accuracy": 10,
      "heading": 92,
      "speed": 27,
      "timestamp": "2026-01-08T10:00:04Z"
    }
  ]
}

Response: 202 Accepted
{
  "accepted": 2,
  "rejected": 0
}
```

### 3. Accept/Reject Ride
```
POST /v1/rides/{trip_id}/accept
Authorization: Bearer {token}

Response: 200 OK
{
  "trip_id": "uuid",
  "status": "ACCEPTED",
  "rider": {
    "name": "John Doe",
    "phone": "+1234567890",
    "rating": 4.85,
    "photo_url": "https://cdn.uber.com/riders/..."
  },
  "pickup": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "address": "123 Market St, San Francisco, CA"
  },
  "dropoff": {
    "latitude": 37.7849,
    "longitude": -122.4094,
    "address": "456 Mission St, San Francisco, CA"
  },
  "estimated_fare": 13.75,
  "estimated_distance_miles": 4.2,
  "accepted_at": "2026-01-08T10:00:20Z"
}

---

POST /v1/rides/{trip_id}/reject
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "reason": "TOO_FAR"
}

Response: 200 OK
{
  "trip_id": "uuid",
  "status": "REJECTED",
  "rejected_at": "2026-01-08T10:00:25Z"
}
```

### 4. Update Trip Status
```
PUT /v1/rides/{trip_id}/status
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "status": "ARRIVED",
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194
  }
}

Response: 200 OK
{
  "trip_id": "uuid",
  "status": "ARRIVED",
  "updated_at": "2026-01-08T10:05:00Z"
}

Status Transitions:
ACCEPTED → ARRIVING → ARRIVED → STARTED → IN_PROGRESS → COMPLETED
```

### 5. Complete Trip
```
POST /v1/rides/{trip_id}/complete
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "dropoff_location": {
    "latitude": 37.7849,
    "longitude": -122.4094
  },
  "actual_distance_miles": 4.3,
  "actual_duration_minutes": 19
}

Response: 200 OK
{
  "trip_id": "uuid",
  "status": "COMPLETED",
  "fare": {
    "base_fare": 2.50,
    "distance_fare": 8.60,
    "time_fare": 3.80,
    "surge_multiplier": 1.2,
    "subtotal": 18.00,
    "tax": 1.44,
    "total": 19.44,
    "currency": "USD"
  },
  "driver_earnings": 15.55,
  "completed_at": "2026-01-08T10:20:00Z"
}
```

### 6. Get Earnings
```
GET /v1/drivers/earnings?start_date=2026-01-01&end_date=2026-01-08
Authorization: Bearer {token}

Response: 200 OK
{
  "period": {
    "start_date": "2026-01-01",
    "end_date": "2026-01-08"
  },
  "summary": {
    "total_earnings": 1250.00,
    "total_trips": 85,
    "total_hours": 42.5,
    "average_per_trip": 14.71,
    "average_per_hour": 29.41,
    "bonuses": 150.00,
    "tips": 85.00,
    "currency": "USD"
  },
  "daily_breakdown": [
    {
      "date": "2026-01-08",
      "earnings": 180.00,
      "trips": 12,
      "hours": 6.0
    }
  ]
}
```

## Real-time WebSocket APIs

### WebSocket Connection
```
ws://api.uber.com/v1/realtime?token={JWT_TOKEN}

Connection Headers:
Authorization: Bearer {JWT_TOKEN}
X-User-Type: RIDER | DRIVER
X-Device-ID: {device_id}

Connection Established:
{
  "type": "connection_ack",
  "session_id": "uuid",
  "timestamp": "2026-01-08T10:00:00Z"
}
```

### Real-time Events (Rider)
```
# Driver Location Update
{
  "type": "driver_location_update",
  "trip_id": "uuid",
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "heading": 90,
    "speed": 25
  },
  "eta_minutes": 3,
  "timestamp": "2026-01-08T10:03:00Z"
}

# Trip Status Update
{
  "type": "trip_status_update",
  "trip_id": "uuid",
  "status": "ARRIVED",
  "message": "Your driver has arrived",
  "timestamp": "2026-01-08T10:05:00Z"
}

# Driver Matched
{
  "type": "driver_matched",
  "trip_id": "uuid",
  "driver": {
    "driver_id": "uuid",
    "name": "Jane Smith",
    "rating": 4.92,
    "photo_url": "https://...",
    "vehicle": {...}
  },
  "eta_minutes": 5,
  "timestamp": "2026-01-08T10:00:15Z"
}
```

### Real-time Events (Driver)
```
# Ride Request
{
  "type": "ride_request",
  "trip_id": "uuid",
  "rider": {
    "name": "John Doe",
    "rating": 4.85,
    "pickup_address": "123 Market St"
  },
  "pickup": {
    "latitude": 37.7749,
    "longitude": -122.4194
  },
  "dropoff": {
    "latitude": 37.7849,
    "longitude": -122.4094
  },
  "estimated_fare": 13.75,
  "distance_to_pickup_miles": 0.8,
  "expires_at": "2026-01-08T10:00:30Z"
}

# Ride Cancelled
{
  "type": "ride_cancelled",
  "trip_id": "uuid",
  "cancelled_by": "RIDER",
  "reason": "CHANGE_OF_PLANS",
  "cancellation_fee": 5.00,
  "timestamp": "2026-01-08T10:02:00Z"
}
```

## Payment APIs

### 1. Add Payment Method
```
POST /v1/payment-methods
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "method_type": "CARD",
  "card_token": "tok_visa_4242", // From Stripe/Braintree
  "is_default": true
}

Response: 201 Created
{
  "payment_method_id": "uuid",
  "method_type": "CARD",
  "card_last_four": "4242",
  "card_brand": "Visa",
  "card_expiry": "12/2028",
  "is_default": true,
  "created_at": "2026-01-08T10:00:00Z"
}
```

### 2. Get Receipt
```
GET /v1/rides/{trip_id}/receipt
Authorization: Bearer {token}

Response: 200 OK
{
  "trip_id": "uuid",
  "receipt_url": "https://receipts.uber.com/...",
  "fare_breakdown": {
    "base_fare": 2.50,
    "distance_fare": 8.60,
    "time_fare": 3.80,
    "surge_multiplier": 1.2,
    "subtotal": 18.00,
    "tax": 1.44,
    "tip": 2.00,
    "total": 21.44,
    "currency": "USD"
  },
  "payment_method": {
    "method_type": "CARD",
    "card_last_four": "4242"
  },
  "trip_details": {
    "pickup_address": "123 Market St, SF",
    "dropoff_address": "456 Mission St, SF",
    "distance_miles": 4.3,
    "duration_minutes": 19,
    "completed_at": "2026-01-08T10:20:00Z"
  }
}
```

## Rate Limiting

### Rate Limit Headers
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1704715200

429 Too Many Requests Response:
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Try again in 60 seconds.",
  "retry_after": 60
}
```

### Rate Limits by Endpoint
```
Authentication:
- POST /v1/auth/login: 5 requests/minute per IP
- POST /v1/auth/refresh: 10 requests/minute per user

Ride Operations:
- POST /v1/rides/request: 10 requests/minute per user
- GET /v1/rides/{id}: 100 requests/minute per user
- DELETE /v1/rides/{id}: 5 requests/minute per user

Driver Operations:
- POST /v1/drivers/location/batch: 20 requests/minute per driver
- PUT /v1/drivers/status: 10 requests/minute per driver

General APIs:
- All other endpoints: 1000 requests/hour per user
```

## Error Handling

### Standard Error Response
```json
{
  "error": {
    "code": "INVALID_PICKUP_LOCATION",
    "message": "Pickup location is outside service area",
    "details": {
      "field": "pickup.latitude",
      "reason": "Location not within city boundaries"
    },
    "request_id": "uuid",
    "timestamp": "2026-01-08T10:00:00Z"
  }
}
```

### HTTP Status Codes
```
200 OK - Successful request
201 Created - Resource created successfully
202 Accepted - Request accepted for async processing
400 Bad Request - Invalid request parameters
401 Unauthorized - Missing or invalid authentication
403 Forbidden - Insufficient permissions
404 Not Found - Resource not found
409 Conflict - Resource conflict (e.g., active trip exists)
422 Unprocessable Entity - Validation error
429 Too Many Requests - Rate limit exceeded
500 Internal Server Error - Server error
503 Service Unavailable - Service temporarily unavailable
```

This API design provides a comprehensive interface for riders and drivers to interact with the Uber platform, supporting real-time communication, payment processing, and trip management at scale.
