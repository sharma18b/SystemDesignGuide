# Digital Wallet - API Design

**Reading Time**: 20 minutes

## RESTful API Endpoints

### Base URL
```
Production: https://api.wallet.example.com/v1
Sandbox: https://sandbox-api.wallet.example.com/v1
```

### Authentication
```
Authorization: Bearer <JWT_TOKEN>
X-Device-ID: <DEVICE_UUID>
X-API-Version: 1.0
X-Request-ID: <UUID> (for idempotency)
```

## User Management APIs

### 1. Register User
```http
POST /users/register
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "phone": "+1234567890",
  "password": "hashed_password",
  "first_name": "John",
  "last_name": "Doe",
  "date_of_birth": "1990-01-01",
  "country_code": "US"
}

Response: 201 Created
{
  "user_id": "123456",
  "email": "user@example.com",
  "phone": "+1234567890",
  "kyc_status": "pending",
  "verification_required": ["email", "phone"],
  "created_at": "2026-01-08T00:00:00Z"
}
```

### 2. Verify Email/Phone
```http
POST /users/verify
Content-Type: application/json

Request:
{
  "type": "email", // or "phone"
  "code": "123456"
}

Response: 200 OK
{
  "verified": true,
  "message": "Email verified successfully"
}
```

### 3. Login
```http
POST /auth/login
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "password": "hashed_password",
  "device_id": "device-uuid",
  "device_type": "ios"
}

Response: 200 OK
{
  "access_token": "eyJhbGc...",
  "refresh_token": "refresh_token_here",
  "expires_in": 3600,
  "user": {
    "user_id": "123456",
    "email": "user@example.com",
    "kyc_status": "verified"
  }
}
```

### 4. Enable Biometric
```http
POST /users/biometric/enable
Authorization: Bearer <token>

Request:
{
  "device_id": "device-uuid",
  "biometric_type": "fingerprint", // or "face_id"
  "public_key": "base64_encoded_public_key"
}

Response: 200 OK
{
  "enabled": true,
  "biometric_id": "bio-123"
}
```

## Payment Method APIs

### 5. Add Payment Method
```http
POST /payment-methods
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "type": "card",
  "card_number": "4111111111111111",
  "expiry_month": 12,
  "expiry_year": 2028,
  "cvv": "123",
  "cardholder_name": "John Doe",
  "billing_address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "country": "US"
  }
}

Response: 201 Created
{
  "payment_method_id": "pm_123",
  "type": "card",
  "card_network": "visa",
  "last4": "1111",
  "expiry_month": 12,
  "expiry_year": 2028,
  "token_id": "tok_abc123",
  "is_default": false,
  "status": "active",
  "created_at": "2026-01-08T00:00:00Z"
}
```

### 6. List Payment Methods
```http
GET /payment-methods
Authorization: Bearer <token>

Response: 200 OK
{
  "payment_methods": [
    {
      "payment_method_id": "pm_123",
      "type": "card",
      "card_network": "visa",
      "last4": "1111",
      "expiry_month": 12,
      "expiry_year": 2028,
      "is_default": true,
      "status": "active"
    }
  ],
  "total": 1
}
```

### 7. Set Default Payment Method
```http
PUT /payment-methods/{payment_method_id}/default
Authorization: Bearer <token>

Response: 200 OK
{
  "payment_method_id": "pm_123",
  "is_default": true
}
```

### 8. Delete Payment Method
```http
DELETE /payment-methods/{payment_method_id}
Authorization: Bearer <token>

Response: 204 No Content
```

## Transaction APIs

### 9. Initiate Payment
```http
POST /transactions/payment
Authorization: Bearer <token>
X-Idempotency-Key: <uuid>
Content-Type: application/json

Request:
{
  "payment_method_id": "pm_123",
  "amount": 50.00,
  "currency": "USD",
  "merchant_id": "merchant_123",
  "merchant_name": "Coffee Shop",
  "description": "Coffee purchase",
  "metadata": {
    "location": "New York",
    "category": "food_and_drink"
  }
}

Response: 201 Created
{
  "transaction_id": "txn_abc123",
  "status": "completed",
  "amount": 50.00,
  "currency": "USD",
  "merchant_name": "Coffee Shop",
  "reference_id": "ref_xyz789",
  "created_at": "2026-01-08T00:00:00Z",
  "completed_at": "2026-01-08T00:00:02Z"
}
```

### 10. NFC Payment (Contactless)
```http
POST /transactions/nfc
Authorization: Bearer <token>
X-Device-ID: <device_uuid>
Content-Type: application/json

Request:
{
  "payment_method_id": "pm_123",
  "amount": 25.00,
  "currency": "USD",
  "cryptogram": "base64_encoded_cryptogram",
  "terminal_id": "terminal_456"
}

Response: 200 OK
{
  "transaction_id": "txn_nfc123",
  "status": "completed",
  "amount": 25.00,
  "authorization_code": "AUTH123",
  "completed_at": "2026-01-08T00:00:00Z"
}
```

### 11. Get Transaction History
```http
GET /transactions?limit=20&offset=0&status=completed
Authorization: Bearer <token>

Query Parameters:
- limit: int (default 20, max 100)
- offset: int (default 0)
- status: string (pending, completed, failed)
- start_date: ISO 8601 date
- end_date: ISO 8601 date
- merchant_name: string
- min_amount: decimal
- max_amount: decimal

Response: 200 OK
{
  "transactions": [
    {
      "transaction_id": "txn_123",
      "type": "payment",
      "amount": 50.00,
      "currency": "USD",
      "status": "completed",
      "merchant_name": "Coffee Shop",
      "merchant_category": "food_and_drink",
      "payment_method": {
        "type": "card",
        "last4": "1111"
      },
      "created_at": "2026-01-08T00:00:00Z"
    }
  ],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

### 12. Get Transaction Details
```http
GET /transactions/{transaction_id}
Authorization: Bearer <token>

Response: 200 OK
{
  "transaction_id": "txn_123",
  "type": "payment",
  "amount": 50.00,
  "currency": "USD",
  "status": "completed",
  "merchant_id": "merchant_123",
  "merchant_name": "Coffee Shop",
  "merchant_category": "food_and_drink",
  "description": "Coffee purchase",
  "payment_method": {
    "payment_method_id": "pm_123",
    "type": "card",
    "card_network": "visa",
    "last4": "1111"
  },
  "location": {
    "city": "New York",
    "country": "US",
    "lat": 40.7128,
    "lon": -74.0060
  },
  "receipt_url": "https://receipts.example.com/txn_123.pdf",
  "created_at": "2026-01-08T00:00:00Z",
  "completed_at": "2026-01-08T00:00:02Z"
}
```

### 13. Request Refund
```http
POST /transactions/{transaction_id}/refund
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "amount": 50.00, // Optional, defaults to full amount
  "reason": "Product defective"
}

Response: 201 Created
{
  "refund_id": "ref_123",
  "transaction_id": "txn_123",
  "amount": 50.00,
  "status": "pending",
  "created_at": "2026-01-08T00:00:00Z"
}
```

## P2P Transfer APIs

### 14. Initiate P2P Transfer
```http
POST /transfers/p2p
Authorization: Bearer <token>
X-Idempotency-Key: <uuid>
Content-Type: application/json

Request:
{
  "receiver_email": "receiver@example.com",
  "amount": 100.00,
  "currency": "USD",
  "message": "Dinner split",
  "payment_method_id": "pm_123"
}

Response: 201 Created
{
  "transfer_id": "p2p_123",
  "sender_id": "123456",
  "receiver_id": "789012",
  "amount": 100.00,
  "currency": "USD",
  "fee": 0.00,
  "status": "completed",
  "message": "Dinner split",
  "created_at": "2026-01-08T00:00:00Z",
  "completed_at": "2026-01-08T00:00:03Z"
}
```

### 15. Get Transfer History
```http
GET /transfers/p2p?type=sent&limit=20
Authorization: Bearer <token>

Query Parameters:
- type: string (sent, received, all)
- limit: int (default 20)
- offset: int (default 0)

Response: 200 OK
{
  "transfers": [
    {
      "transfer_id": "p2p_123",
      "type": "sent",
      "amount": 100.00,
      "currency": "USD",
      "receiver": {
        "name": "Jane Doe",
        "email": "jane@example.com"
      },
      "status": "completed",
      "created_at": "2026-01-08T00:00:00Z"
    }
  ],
  "total": 50,
  "limit": 20,
  "offset": 0
}
```

### 16. Get Transfer Limits
```http
GET /transfers/limits
Authorization: Bearer <token>

Response: 200 OK
{
  "daily_limit": 5000.00,
  "per_transaction_limit": 1000.00,
  "daily_used": 100.00,
  "daily_remaining": 4900.00,
  "last_reset_date": "2026-01-08"
}
```

## Balance APIs

### 17. Get Balance
```http
GET /balance
Authorization: Bearer <token>

Response: 200 OK
{
  "available_balance": 1500.00,
  "pending_balance": 50.00,
  "currency": "USD",
  "last_updated_at": "2026-01-08T00:00:00Z"
}
```

### 18. Add Funds
```http
POST /balance/add
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "payment_method_id": "pm_123",
  "amount": 500.00,
  "currency": "USD"
}

Response: 200 OK
{
  "transaction_id": "txn_add123",
  "amount": 500.00,
  "new_balance": 2000.00,
  "status": "completed"
}
```

## Notification APIs

### 19. Get Notifications
```http
GET /notifications?limit=20&unread_only=true
Authorization: Bearer <token>

Response: 200 OK
{
  "notifications": [
    {
      "notification_id": "notif_123",
      "type": "transaction",
      "title": "Payment Successful",
      "message": "You paid $50.00 to Coffee Shop",
      "data": {
        "transaction_id": "txn_123"
      },
      "read": false,
      "created_at": "2026-01-08T00:00:00Z"
    }
  ],
  "unread_count": 5,
  "total": 100
}
```

### 20. Mark Notification as Read
```http
PUT /notifications/{notification_id}/read
Authorization: Bearer <token>

Response: 200 OK
{
  "notification_id": "notif_123",
  "read": true,
  "read_at": "2026-01-08T00:00:00Z"
}
```

## Webhook APIs (for Merchants)

### 21. Transaction Webhook
```http
POST https://merchant.example.com/webhooks/wallet
Content-Type: application/json
X-Wallet-Signature: sha256=<hmac_signature>

Payload:
{
  "event_type": "transaction.completed",
  "event_id": "evt_123",
  "timestamp": "2026-01-08T00:00:00Z",
  "data": {
    "transaction_id": "txn_123",
    "amount": 50.00,
    "currency": "USD",
    "status": "completed",
    "merchant_id": "merchant_123"
  }
}

Signature Verification:
HMAC-SHA256(payload, webhook_secret)
```

## SDK Integration

### iOS SDK Example
```swift
import WalletSDK

let wallet = WalletSDK(apiKey: "your_api_key")

// Initialize payment
wallet.initiatePayment(
    amount: 50.00,
    currency: "USD",
    merchantId: "merchant_123"
) { result in
    switch result {
    case .success(let transaction):
        print("Payment successful: \(transaction.id)")
    case .failure(let error):
        print("Payment failed: \(error)")
    }
}
```

### Android SDK Example
```kotlin
import com.wallet.sdk.WalletSDK

val wallet = WalletSDK(apiKey = "your_api_key")

wallet.initiatePayment(
    amount = 50.00,
    currency = "USD",
    merchantId = "merchant_123"
) { result ->
    result.onSuccess { transaction ->
        println("Payment successful: ${transaction.id}")
    }.onFailure { error ->
        println("Payment failed: $error")
    }
}
```

## Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Insufficient balance for this transaction",
    "details": {
      "available_balance": 10.00,
      "required_amount": 50.00
    },
    "request_id": "req_123",
    "timestamp": "2026-01-08T00:00:00Z"
  }
}
```

### Common Error Codes
```
400 Bad Request:
- INVALID_REQUEST
- INVALID_AMOUNT
- INVALID_CURRENCY

401 Unauthorized:
- INVALID_TOKEN
- TOKEN_EXPIRED
- AUTHENTICATION_REQUIRED

403 Forbidden:
- INSUFFICIENT_PERMISSIONS
- KYC_REQUIRED
- ACCOUNT_SUSPENDED

404 Not Found:
- PAYMENT_METHOD_NOT_FOUND
- TRANSACTION_NOT_FOUND
- USER_NOT_FOUND

409 Conflict:
- DUPLICATE_TRANSACTION
- PAYMENT_METHOD_EXISTS

422 Unprocessable Entity:
- INSUFFICIENT_FUNDS
- LIMIT_EXCEEDED
- FRAUD_DETECTED

429 Too Many Requests:
- RATE_LIMIT_EXCEEDED

500 Internal Server Error:
- INTERNAL_ERROR
- SERVICE_UNAVAILABLE

503 Service Unavailable:
- MAINTENANCE_MODE
- PAYMENT_NETWORK_DOWN
```

## Rate Limiting

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1641600000
```

### Rate Limits by Endpoint
```
Authentication:
- POST /auth/login: 5 requests/minute

Payments:
- POST /transactions/payment: 10 requests/minute
- POST /transactions/nfc: 20 requests/minute

P2P Transfers:
- POST /transfers/p2p: 5 requests/minute

Read Operations:
- GET /transactions: 100 requests/minute
- GET /balance: 100 requests/minute
```

## Interview Discussion Points

**Q: How ensure idempotency?**
- X-Idempotency-Key header
- Store key in database
- Return same response for duplicate requests
- 24-hour key expiration

**Q: How handle API versioning?**
- URL versioning (/v1, /v2)
- Header versioning (X-API-Version)
- Backward compatibility for 1 year
- Deprecation notices

**Q: How secure API endpoints?**
- JWT authentication
- Device binding
- Rate limiting
- Input validation
- HTTPS only

---
*Estimated Reading Time: 20 minutes*
