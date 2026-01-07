# E-commerce API Design

## Overview (2 mins)
E-commerce APIs must handle complex business operations while maintaining security, performance, and reliability. The API design follows RESTful principles with GraphQL for complex queries and real-time capabilities through WebSockets.

## API Architecture Strategy (3 mins)

### API Gateway Pattern
```
Client Apps → API Gateway → Microservices
     ↓             ↓            ↓
   Mobile      Authentication  Product Service
   Web App     Rate Limiting   Order Service
   Partner     Load Balancing  User Service
```

### API Versioning Strategy
- **URL Versioning**: `/api/v1/products`, `/api/v2/products`
- **Header Versioning**: `Accept: application/vnd.api+json;version=1`
- **Backward Compatibility**: Maintain v1 for 12 months after v2 release

### Authentication & Authorization
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-API-Key: your-api-key-here (for partner integrations)
```

## Core API Endpoints (12 mins)

### 1. Product Catalog APIs

#### Get Product Details
```http
GET /api/v1/products/{productId}
Accept: application/json

Response:
{
  "product_id": "LAPTOP-DELL-XPS13-001",
  "sku": "LAPTOP-DELL-XPS13-001",
  "title": "Dell XPS 13 Laptop",
  "description": "High-performance ultrabook with Intel i7 processor",
  "brand": "Dell",
  "category": {
    "primary": "Electronics",
    "secondary": "Computers", 
    "tertiary": "Laptops"
  },
  "pricing": {
    "base_price": 1299.99,
    "final_price": 1299.99,
    "currency": "USD",
    "discount_percentage": 0
  },
  "inventory": {
    "available_stock": 142,
    "in_stock": true
  },
  "media": {
    "primary_image": "https://cdn.example.com/products/laptop-dell-xps13-001-main.jpg",
    "additional_images": [...]
  },
  "attributes": {
    "processor": "Intel Core i7-1165G7",
    "memory": "16GB LPDDR4x",
    "storage": "512GB SSD"
  }
}
```

#### Product Search with Filters
```http
GET /api/v1/products/search?q=laptop&category=electronics&brand=dell&price_min=1000&price_max=2000&sort=price_asc&page=1&limit=20

Response:
{
  "query": "laptop",
  "filters": {
    "category": "electronics",
    "brand": "dell",
    "price_range": {"min": 1000, "max": 2000}
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_pages": 5,
    "total_results": 87
  },
  "facets": {
    "brands": [
      {"name": "Dell", "count": 23},
      {"name": "HP", "count": 18},
      {"name": "Lenovo", "count": 15}
    ],
    "price_ranges": [
      {"range": "1000-1500", "count": 45},
      {"range": "1500-2000", "count": 42}
    ]
  },
  "products": [
    {
      "product_id": "LAPTOP-DELL-XPS13-001",
      "title": "Dell XPS 13 Laptop",
      "pricing": {"final_price": 1299.99, "currency": "USD"},
      "media": {"primary_image": "..."},
      "inventory": {"in_stock": true}
    }
  ]
}
```

#### Product Recommendations
```http
GET /api/v1/products/{productId}/recommendations?type=similar&limit=10

Response:
{
  "product_id": "LAPTOP-DELL-XPS13-001",
  "recommendation_type": "similar",
  "recommendations": [
    {
      "product_id": "LAPTOP-HP-SPECTRE-001",
      "title": "HP Spectre x360",
      "confidence_score": 0.89,
      "reason": "Similar specifications and price range"
    }
  ]
}
```

### 2. Shopping Cart APIs

#### Get User Cart
```http
GET /api/v1/cart
Authorization: Bearer {jwt_token}

Response:
{
  "cart_id": "cart_123456",
  "user_id": "user_789",
  "items": [
    {
      "cart_item_id": "item_001",
      "product_id": "LAPTOP-DELL-XPS13-001",
      "sku": "LAPTOP-DELL-XPS13-001",
      "title": "Dell XPS 13 Laptop",
      "quantity": 1,
      "unit_price": 1299.99,
      "total_price": 1299.99,
      "selected_attributes": {
        "color": "Platinum Silver",
        "storage": "512GB"
      },
      "availability": {
        "in_stock": true,
        "estimated_delivery": "2024-01-15"
      }
    }
  ],
  "summary": {
    "subtotal": 1299.99,
    "tax_amount": 104.00,
    "shipping_amount": 0.00,
    "total_amount": 1403.99,
    "currency": "USD",
    "item_count": 1
  },
  "updated_at": "2024-01-10T10:30:00Z"
}
```

#### Add Item to Cart
```http
POST /api/v1/cart/items
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "product_id": "LAPTOP-DELL-XPS13-001",
  "quantity": 1,
  "selected_attributes": {
    "color": "Platinum Silver",
    "storage": "512GB"
  }
}

Response:
{
  "cart_item_id": "item_002",
  "message": "Item added to cart successfully",
  "cart_summary": {
    "item_count": 2,
    "total_amount": 2703.98
  }
}
```

#### Update Cart Item
```http
PUT /api/v1/cart/items/{cartItemId}
Authorization: Bearer {jwt_token}

{
  "quantity": 2
}

Response:
{
  "cart_item_id": "item_001",
  "updated_quantity": 2,
  "new_total_price": 2599.98,
  "cart_summary": {
    "item_count": 2,
    "total_amount": 4103.97
  }
}
```

### 3. Order Management APIs

#### Create Order (Checkout)
```http
POST /api/v1/orders
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "shipping_address": {
    "street_address": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "postal_code": "94105",
    "country": "US"
  },
  "billing_address": {
    "street_address": "123 Main St",
    "city": "San Francisco", 
    "state": "CA",
    "postal_code": "94105",
    "country": "US"
  },
  "payment_method": {
    "type": "credit_card",
    "payment_method_id": "pm_123456"
  },
  "shipping_method": "standard",
  "items": [
    {
      "product_id": "LAPTOP-DELL-XPS13-001",
      "quantity": 1,
      "unit_price": 1299.99
    }
  ]
}

Response:
{
  "order_id": "order_789123",
  "order_number": "ORD-2024-001234",
  "status": "pending",
  "total_amount": 1403.99,
  "currency": "USD",
  "estimated_delivery": "2024-01-15",
  "payment_status": "processing",
  "created_at": "2024-01-10T11:00:00Z"
}
```

#### Get Order Details
```http
GET /api/v1/orders/{orderId}
Authorization: Bearer {jwt_token}

Response:
{
  "order_id": "order_789123",
  "order_number": "ORD-2024-001234",
  "status": "confirmed",
  "user_id": "user_789",
  "items": [
    {
      "order_item_id": "item_001",
      "product_id": "LAPTOP-DELL-XPS13-001",
      "title": "Dell XPS 13 Laptop",
      "quantity": 1,
      "unit_price": 1299.99,
      "total_price": 1299.99,
      "fulfillment_status": "processing"
    }
  ],
  "pricing": {
    "subtotal": 1299.99,
    "tax_amount": 104.00,
    "shipping_amount": 0.00,
    "total_amount": 1403.99,
    "currency": "USD"
  },
  "addresses": {
    "shipping": {...},
    "billing": {...}
  },
  "payment": {
    "method": "credit_card",
    "status": "completed",
    "transaction_id": "txn_456789"
  },
  "shipping": {
    "method": "standard",
    "tracking_number": "1Z999AA1234567890",
    "estimated_delivery": "2024-01-15",
    "carrier": "UPS"
  },
  "timeline": [
    {
      "status": "pending",
      "timestamp": "2024-01-10T11:00:00Z",
      "description": "Order placed"
    },
    {
      "status": "confirmed", 
      "timestamp": "2024-01-10T11:05:00Z",
      "description": "Payment confirmed"
    }
  ]
}
```

#### Get User Orders
```http
GET /api/v1/orders?status=all&page=1&limit=10&sort=created_at_desc
Authorization: Bearer {jwt_token}

Response:
{
  "pagination": {
    "page": 1,
    "limit": 10,
    "total_pages": 3,
    "total_orders": 25
  },
  "orders": [
    {
      "order_id": "order_789123",
      "order_number": "ORD-2024-001234",
      "status": "shipped",
      "total_amount": 1403.99,
      "currency": "USD",
      "item_count": 1,
      "created_at": "2024-01-10T11:00:00Z",
      "estimated_delivery": "2024-01-15"
    }
  ]
}
```

### 4. User Management APIs

#### User Registration
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+1-555-123-4567"
}

Response:
{
  "user_id": "user_789",
  "email": "user@example.com",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IlJlZnJlc2gifQ...",
  "expires_in": 3600,
  "message": "Registration successful. Please verify your email."
}
```

#### User Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response:
{
  "user_id": "user_789",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IlJlZnJlc2gifQ...",
  "expires_in": 3600,
  "user": {
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "email_verified": true
  }
}
```

## Advanced API Features (2 mins)

### GraphQL for Complex Queries
```graphql
query GetProductWithRecommendations($productId: ID!) {
  product(id: $productId) {
    id
    title
    pricing {
      finalPrice
      currency
    }
    inventory {
      inStock
      availableStock
    }
    recommendations(type: SIMILAR, limit: 5) {
      id
      title
      pricing {
        finalPrice
      }
      confidenceScore
    }
    reviews(limit: 10) {
      rating
      comment
      createdAt
      user {
        firstName
      }
    }
  }
}
```

### WebSocket for Real-time Updates
```javascript
// Order status updates
const ws = new WebSocket('wss://api.example.com/ws/orders');

ws.onmessage = function(event) {
  const update = JSON.parse(event.data);
  if (update.type === 'order_status_changed') {
    console.log(`Order ${update.order_id} status: ${update.new_status}`);
  }
};

// Subscribe to order updates
ws.send(JSON.stringify({
  action: 'subscribe',
  channel: 'order_updates',
  order_id: 'order_789123'
}));
```

### Webhook APIs for Partners
```http
POST /api/v1/webhooks
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "url": "https://partner.example.com/webhooks/orders",
  "events": ["order.created", "order.shipped", "order.delivered"],
  "secret": "webhook_secret_key"
}

# Webhook payload sent to partner
{
  "event": "order.shipped",
  "timestamp": "2024-01-12T14:30:00Z",
  "data": {
    "order_id": "order_789123",
    "tracking_number": "1Z999AA1234567890",
    "carrier": "UPS"
  },
  "signature": "sha256=..."
}
```

## API Security and Best Practices (1 min)

### Rate Limiting
```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1609459200
```

### Error Handling
```json
{
  "error": {
    "code": "INSUFFICIENT_INVENTORY",
    "message": "Not enough inventory available",
    "details": {
      "product_id": "LAPTOP-DELL-XPS13-001",
      "requested_quantity": 5,
      "available_quantity": 2
    },
    "timestamp": "2024-01-10T11:00:00Z",
    "request_id": "req_123456"
  }
}
```

### API Documentation Standards
- **OpenAPI 3.0** specification for all endpoints
- **Interactive documentation** with Swagger UI
- **Code examples** in multiple languages
- **Webhook documentation** with payload examples
- **Rate limiting** and **authentication** details
