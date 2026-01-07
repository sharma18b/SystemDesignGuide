# Payment Service - API Design

## RESTful API Architecture

### API Versioning and Base Structure
```
Base URL: https://api.payments.com/v1/
Authentication: Bearer token (API Key)
Content-Type: application/json
Rate Limiting: 1000 requests/minute per API key
```

### Core Payment APIs

#### Create Payment Intent
```http
POST /v1/payment_intents
```

**Request:**
```json
{
  "amount": 2000,
  "currency": "usd",
  "payment_method_types": ["card", "apple_pay"],
  "customer_id": "cus_1234567890",
  "description": "Payment for Order #12345",
  "metadata": {
    "order_id": "12345",
    "customer_email": "customer@example.com"
  },
  "capture_method": "automatic",
  "confirmation_method": "automatic"
}
```

**Response:**
```json
{
  "id": "pi_1234567890abcdef",
  "object": "payment_intent",
  "amount": 2000,
  "currency": "usd",
  "status": "requires_payment_method",
  "client_secret": "pi_1234567890abcdef_secret_xyz",
  "created": 1640995200,
  "description": "Payment for Order #12345",
  "metadata": {
    "order_id": "12345",
    "customer_email": "customer@example.com"
  },
  "payment_method_types": ["card", "apple_pay"],
  "capture_method": "automatic",
  "confirmation_method": "automatic"
}
```

#### Confirm Payment
```http
POST /v1/payment_intents/{id}/confirm
```

**Request:**
```json
{
  "payment_method": "pm_1234567890abcdef",
  "return_url": "https://merchant.com/return",
  "use_stripe_sdk": true
}
```

**Response:**
```json
{
  "id": "pi_1234567890abcdef",
  "status": "succeeded",
  "amount_received": 2000,
  "charges": {
    "data": [
      {
        "id": "ch_1234567890abcdef",
        "amount": 2000,
        "currency": "usd",
        "status": "succeeded",
        "payment_method": {
          "id": "pm_1234567890abcdef",
          "type": "card",
          "card": {
            "brand": "visa",
            "last4": "4242",
            "exp_month": 12,
            "exp_year": 2025
          }
        },
        "receipt_url": "https://pay.payments.com/receipts/ch_1234567890abcdef"
      }
    ]
  }
}
```

### Payment Methods API

#### Create Payment Method
```http
POST /v1/payment_methods
```

**Request:**
```json
{
  "type": "card",
  "card": {
    "number": "4242424242424242",
    "exp_month": 12,
    "exp_year": 2025,
    "cvc": "123"
  },
  "billing_details": {
    "name": "John Doe",
    "email": "john@example.com",
    "address": {
      "line1": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "postal_code": "94105",
      "country": "US"
    }
  }
}
```

**Response:**
```json
{
  "id": "pm_1234567890abcdef",
  "object": "payment_method",
  "type": "card",
  "card": {
    "brand": "visa",
    "last4": "4242",
    "exp_month": 12,
    "exp_year": 2025,
    "fingerprint": "abc123def456",
    "funding": "credit",
    "country": "US"
  },
  "billing_details": {
    "name": "John Doe",
    "email": "john@example.com",
    "address": {
      "line1": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "postal_code": "94105",
      "country": "US"
    }
  },
  "created": 1640995200
}
```

#### Attach Payment Method to Customer
```http
POST /v1/payment_methods/{id}/attach
```

**Request:**
```json
{
  "customer": "cus_1234567890"
}
```

### Refunds API

#### Create Refund
```http
POST /v1/refunds
```

**Request:**
```json
{
  "charge": "ch_1234567890abcdef",
  "amount": 1000,
  "reason": "requested_by_customer",
  "metadata": {
    "refund_reason": "Product returned",
    "processed_by": "support_agent_123"
  }
}
```

**Response:**
```json
{
  "id": "re_1234567890abcdef",
  "object": "refund",
  "amount": 1000,
  "charge": "ch_1234567890abcdef",
  "created": 1640995200,
  "currency": "usd",
  "reason": "requested_by_customer",
  "status": "succeeded",
  "metadata": {
    "refund_reason": "Product returned",
    "processed_by": "support_agent_123"
  }
}
```

## Webhook API

### Webhook Events
```http
POST {merchant_webhook_url}
```

**Headers:**
```
Content-Type: application/json
Payments-Signature: t=1640995200,v1=abc123def456...
```

**Event Types:**
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.dispute.created`
- `invoice.payment_succeeded`
- `customer.subscription.created`

**Webhook Payload:**
```json
{
  "id": "evt_1234567890abcdef",
  "object": "event",
  "type": "payment_intent.succeeded",
  "created": 1640995200,
  "data": {
    "object": {
      "id": "pi_1234567890abcdef",
      "object": "payment_intent",
      "amount": 2000,
      "currency": "usd",
      "status": "succeeded"
    }
  },
  "livemode": true,
  "pending_webhooks": 1,
  "request": {
    "id": "req_1234567890abcdef",
    "idempotency_key": "order_12345_payment"
  }
}
```

### Webhook Verification
```python
import hmac
import hashlib
import time

def verify_webhook_signature(payload: str, signature: str, secret: str) -> bool:
    """Verify webhook signature for security"""
    
    # Parse signature header
    elements = signature.split(',')
    timestamp = None
    signatures = []
    
    for element in elements:
        key, value = element.split('=', 1)
        if key == 't':
            timestamp = int(value)
        elif key.startswith('v'):
            signatures.append(value)
    
    if not timestamp or not signatures:
        return False
    
    # Check timestamp (prevent replay attacks)
    current_time = int(time.time())
    if abs(current_time - timestamp) > 300:  # 5 minutes tolerance
        return False
    
    # Verify signature
    signed_payload = f"{timestamp}.{payload}"
    expected_signature = hmac.new(
        secret.encode(),
        signed_payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return any(
        hmac.compare_digest(expected_signature, signature)
        for signature in signatures
    )
```

## Authentication and Authorization

### API Key Authentication
```python
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def authenticate_api_key(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> dict:
    """Authenticate API key and return merchant context"""
    
    api_key = credentials.credentials
    
    # Validate API key format
    if not api_key.startswith(('pk_live_', 'pk_test_', 'sk_live_', 'sk_test_')):
        raise HTTPException(
            status_code=401,
            detail="Invalid API key format"
        )
    
    # Determine environment
    is_live = 'live' in api_key
    key_type = 'publishable' if api_key.startswith('pk_') else 'secret'
    
    # Validate against database
    merchant = await get_merchant_by_api_key(api_key)
    if not merchant:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key"
        )
    
    if not merchant['active']:
        raise HTTPException(
            status_code=403,
            detail="Account suspended"
        )
    
    return {
        'merchant_id': merchant['id'],
        'environment': 'live' if is_live else 'test',
        'key_type': key_type,
        'permissions': merchant['permissions']
    }
```

### Rate Limiting
```python
from fastapi import Request
import redis
import time

class RateLimiter:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.limits = {
            'default': {'requests': 1000, 'window': 60},  # 1000/minute
            'payment_creation': {'requests': 100, 'window': 60},  # 100/minute
            'webhook_delivery': {'requests': 10000, 'window': 60}  # 10000/minute
        }
    
    async def check_rate_limit(
        self, 
        api_key: str, 
        endpoint: str, 
        request: Request
    ) -> bool:
        """Check if request is within rate limits"""
        
        # Determine limit type
        limit_type = self.get_limit_type(endpoint)
        limit_config = self.limits.get(limit_type, self.limits['default'])
        
        # Create rate limit key
        window_start = int(time.time()) // limit_config['window']
        rate_key = f"rate_limit:{api_key}:{endpoint}:{window_start}"
        
        # Check current count
        current_count = await self.redis.get(rate_key)
        current_count = int(current_count) if current_count else 0
        
        if current_count >= limit_config['requests']:
            return False
        
        # Increment counter
        pipe = self.redis.pipeline()
        pipe.incr(rate_key)
        pipe.expire(rate_key, limit_config['window'])
        await pipe.execute()
        
        return True
    
    def get_limit_type(self, endpoint: str) -> str:
        """Determine rate limit type based on endpoint"""
        if '/payment_intents' in endpoint:
            return 'payment_creation'
        elif '/webhooks' in endpoint:
            return 'webhook_delivery'
        else:
            return 'default'
```

## Error Handling

### Standard Error Response Format
```json
{
  "error": {
    "type": "card_error",
    "code": "card_declined",
    "message": "Your card was declined.",
    "decline_code": "insufficient_funds",
    "param": "payment_method",
    "request_id": "req_1234567890abcdef"
  }
}
```

### Error Types and Codes
```python
class PaymentErrorTypes:
    # Client errors (4xx)
    INVALID_REQUEST = "invalid_request_error"
    AUTHENTICATION = "authentication_error"
    CARD_ERROR = "card_error"
    RATE_LIMIT = "rate_limit_error"
    
    # Server errors (5xx)
    API_ERROR = "api_error"
    
class PaymentErrorCodes:
    # Card errors
    CARD_DECLINED = "card_declined"
    INSUFFICIENT_FUNDS = "insufficient_funds"
    EXPIRED_CARD = "expired_card"
    INCORRECT_CVC = "incorrect_cvc"
    PROCESSING_ERROR = "processing_error"
    
    # Request errors
    MISSING_PARAMETER = "parameter_missing"
    INVALID_PARAMETER = "parameter_invalid"
    RESOURCE_NOT_FOUND = "resource_missing"
    
    # Authentication errors
    INVALID_API_KEY = "invalid_api_key"
    UNAUTHORIZED = "unauthorized"

def create_error_response(
    error_type: str,
    error_code: str,
    message: str,
    param: str = None,
    decline_code: str = None
) -> dict:
    """Create standardized error response"""
    
    error_data = {
        "type": error_type,
        "code": error_code,
        "message": message,
        "request_id": generate_request_id()
    }
    
    if param:
        error_data["param"] = param
    
    if decline_code:
        error_data["decline_code"] = decline_code
    
    return {"error": error_data}
```

## SDK Integration Examples

### JavaScript SDK
```javascript
// Initialize Payment SDK
const payments = new PaymentsSDK('pk_test_1234567890abcdef');

// Create payment method
const paymentMethod = await payments.createPaymentMethod({
  type: 'card',
  card: {
    number: '4242424242424242',
    exp_month: 12,
    exp_year: 2025,
    cvc: '123'
  }
});

// Create and confirm payment
const paymentIntent = await payments.createPaymentIntent({
  amount: 2000,
  currency: 'usd',
  payment_method: paymentMethod.id,
  confirmation_method: 'automatic',
  confirm: true
});

if (paymentIntent.status === 'succeeded') {
  console.log('Payment succeeded!');
} else if (paymentIntent.status === 'requires_action') {
  // Handle 3D Secure authentication
  const result = await payments.handleCardAction(paymentIntent.client_secret);
  if (result.paymentIntent.status === 'succeeded') {
    console.log('Payment succeeded after authentication!');
  }
}
```

### Python SDK
```python
import payments

# Configure API key
payments.api_key = "sk_test_1234567890abcdef"

# Create payment intent
payment_intent = payments.PaymentIntent.create(
    amount=2000,
    currency='usd',
    payment_method_types=['card'],
    metadata={'order_id': '12345'}
)

# Confirm payment
confirmed_payment = payments.PaymentIntent.confirm(
    payment_intent.id,
    payment_method='pm_1234567890abcdef'
)

print(f"Payment status: {confirmed_payment.status}")
```

### Mobile SDK (iOS Swift)
```swift
import PaymentsSDK

class PaymentViewController: UIViewController {
    let paymentsSDK = PaymentsSDK(publishableKey: "pk_test_1234567890abcdef")
    
    func processPayment() {
        // Create payment method from card form
        let cardParams = CardParams(
            number: "4242424242424242",
            expMonth: 12,
            expYear: 2025,
            cvc: "123"
        )
        
        paymentsSDK.createPaymentMethod(card: cardParams) { [weak self] result in
            switch result {
            case .success(let paymentMethod):
                self?.confirmPayment(with: paymentMethod.id)
            case .failure(let error):
                self?.handleError(error)
            }
        }
    }
    
    func confirmPayment(with paymentMethodId: String) {
        let paymentIntentParams = PaymentIntentParams(
            clientSecret: self.clientSecret,
            paymentMethodId: paymentMethodId
        )
        
        paymentsSDK.confirmPayment(params: paymentIntentParams) { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let paymentIntent):
                    if paymentIntent.status == .succeeded {
                        self.showSuccessMessage()
                    }
                case .failure(let error):
                    self.handleError(error)
                }
            }
        }
    }
}
```

## API Monitoring and Analytics

### Request/Response Logging
```python
import logging
import time
from fastapi import Request, Response

class APILogger:
    def __init__(self):
        self.logger = logging.getLogger('payment_api')
        
    async def log_request_response(
        self,
        request: Request,
        response: Response,
        processing_time: float
    ):
        """Log API request and response for monitoring"""
        
        log_data = {
            'timestamp': time.time(),
            'method': request.method,
            'path': request.url.path,
            'status_code': response.status_code,
            'processing_time_ms': processing_time * 1000,
            'user_agent': request.headers.get('user-agent'),
            'api_key_prefix': self.get_api_key_prefix(request),
            'request_id': response.headers.get('request-id')
        }
        
        # Log different levels based on status code
        if response.status_code >= 500:
            self.logger.error('API Error', extra=log_data)
        elif response.status_code >= 400:
            self.logger.warning('API Client Error', extra=log_data)
        else:
            self.logger.info('API Request', extra=log_data)
```

*Reading Time: ~20 minutes*
