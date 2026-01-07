# Stock Trading Platform - API Design

## API Protocols

### REST API (HTTP/2)
- Standard trading operations
- Account management
- Historical data queries

### WebSocket API
- Real-time market data
- Order updates
- Portfolio updates

### FIX Protocol
- Institutional clients
- High-frequency trading
- Industry standard

## Order Management APIs

### 1. Place Order
```
POST /api/v1/orders
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "symbol": "AAPL",
  "side": "BUY",
  "order_type": "LIMIT",
  "quantity": 100,
  "price": 150.25,
  "time_in_force": "DAY"
}

Response: 201 Created
{
  "order_id": 67890,
  "status": "PENDING",
  "symbol": "AAPL",
  "side": "BUY",
  "order_type": "LIMIT",
  "quantity": 100,
  "filled_quantity": 0,
  "price": 150.25,
  "average_fill_price": null,
  "time_in_force": "DAY",
  "created_at": "2026-01-08T10:00:00.123456Z",
  "expires_at": "2026-01-08T16:00:00.000000Z"
}

Errors:
400 - Invalid parameters
402 - Insufficient funds
403 - Trading not allowed
422 - Risk limit exceeded
429 - Rate limit exceeded
```

### 2. Cancel Order
```
DELETE /api/v1/orders/{order_id}
Authorization: Bearer {token}

Response: 200 OK
{
  "order_id": 67890,
  "status": "CANCELLED",
  "cancelled_at": "2026-01-08T10:01:00.123456Z"
}

Errors:
404 - Order not found
409 - Order already filled/cancelled
```

### 3. Modify Order
```
PATCH /api/v1/orders/{order_id}
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "price": 150.50,
  "quantity": 150
}

Response: 200 OK
{
  "order_id": 67890,
  "status": "PENDING",
  "price": 150.50,
  "quantity": 150,
  "modified_at": "2026-01-08T10:02:00.123456Z"
}
```

### 4. Get Order Status
```
GET /api/v1/orders/{order_id}
Authorization: Bearer {token}

Response: 200 OK
{
  "order_id": 67890,
  "status": "PARTIALLY_FILLED",
  "symbol": "AAPL",
  "side": "BUY",
  "order_type": "LIMIT",
  "quantity": 100,
  "filled_quantity": 50,
  "remaining_quantity": 50,
  "price": 150.25,
  "average_fill_price": 150.20,
  "fills": [
    {
      "trade_id": 12345,
      "quantity": 30,
      "price": 150.20,
      "executed_at": "2026-01-08T10:00:01.234567Z"
    },
    {
      "trade_id": 12346,
      "quantity": 20,
      "price": 150.20,
      "executed_at": "2026-01-08T10:00:02.345678Z"
    }
  ],
  "created_at": "2026-01-08T10:00:00.123456Z"
}
```

### 5. List Orders
```
GET /api/v1/orders?status=PENDING&symbol=AAPL&limit=50
Authorization: Bearer {token}

Response: 200 OK
{
  "orders": [
    {
      "order_id": 67890,
      "symbol": "AAPL",
      "side": "BUY",
      "status": "PENDING",
      "quantity": 100,
      "price": 150.25,
      "created_at": "2026-01-08T10:00:00.123456Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1
  }
}
```

## Market Data APIs

### 1. Get Quote
```
GET /api/v1/quotes/{symbol}

Response: 200 OK
{
  "symbol": "AAPL",
  "bid": 150.20,
  "ask": 150.25,
  "bid_size": 500,
  "ask_size": 300,
  "last_trade_price": 150.22,
  "last_trade_size": 100,
  "last_trade_time": "2026-01-08T10:00:00.123456Z",
  "volume": 1234567,
  "open": 149.50,
  "high": 151.00,
  "low": 149.00,
  "close": 150.22,
  "timestamp": "2026-01-08T10:00:00.123456Z"
}
```

### 2. Get Order Book
```
GET /api/v1/orderbook/{symbol}?depth=10

Response: 200 OK
{
  "symbol": "AAPL",
  "bids": [
    {"price": 150.20, "quantity": 500, "orders": 5},
    {"price": 150.19, "quantity": 300, "orders": 3},
    {"price": 150.18, "quantity": 200, "orders": 2}
  ],
  "asks": [
    {"price": 150.25, "quantity": 300, "orders": 3},
    {"price": 150.26, "quantity": 400, "orders": 4},
    {"price": 150.27, "quantity": 250, "orders": 2}
  ],
  "timestamp": "2026-01-08T10:00:00.123456Z"
}
```

### 3. Get Historical Data
```
GET /api/v1/history/{symbol}?interval=1m&from=2026-01-08T09:00:00Z&to=2026-01-08T10:00:00Z

Response: 200 OK
{
  "symbol": "AAPL",
  "interval": "1m",
  "data": [
    {
      "time": "2026-01-08T09:00:00Z",
      "open": 149.50,
      "high": 149.75,
      "low": 149.45,
      "close": 149.70,
      "volume": 12345
    }
  ]
}
```

## Account APIs

### 1. Get Account Info
```
GET /api/v1/account
Authorization: Bearer {token}

Response: 200 OK
{
  "account_id": 12345,
  "account_type": "MARGIN",
  "cash_balance": 50000.00,
  "buying_power": 100000.00,
  "portfolio_value": 75000.00,
  "margin_used": 25000.00,
  "maintenance_margin": 15000.00,
  "day_trade_count": 2,
  "pattern_day_trader": false,
  "account_status": "ACTIVE"
}
```

### 2. Get Portfolio
```
GET /api/v1/portfolio
Authorization: Bearer {token}

Response: 200 OK
{
  "positions": [
    {
      "symbol": "AAPL",
      "quantity": 100,
      "average_cost": 145.50,
      "current_price": 150.22,
      "market_value": 15022.00,
      "unrealized_pnl": 472.00,
      "unrealized_pnl_percent": 3.24,
      "day_pnl": 50.00
    }
  ],
  "total_market_value": 75000.00,
  "total_cost_basis": 70000.00,
  "total_unrealized_pnl": 5000.00,
  "cash_balance": 50000.00,
  "portfolio_value": 125000.00
}
```

### 3. Get Transaction History
```
GET /api/v1/transactions?from=2026-01-01&to=2026-01-08&limit=50
Authorization: Bearer {token}

Response: 200 OK
{
  "transactions": [
    {
      "transaction_id": 98765,
      "type": "TRADE_BUY",
      "symbol": "AAPL",
      "quantity": 100,
      "price": 150.20,
      "amount": -15020.00,
      "balance_after": 34980.00,
      "created_at": "2026-01-08T10:00:01.234567Z"
    }
  ]
}
```

## WebSocket APIs

### Connection
```
ws://api.trading.com/v1/stream
Authorization: Bearer {token}

Connection Message:
{
  "type": "subscribe",
  "channels": ["quotes", "trades", "orders"],
  "symbols": ["AAPL", "GOOGL", "MSFT"]
}
```

### Market Data Stream
```
# Quote Update
{
  "type": "quote",
  "symbol": "AAPL",
  "bid": 150.20,
  "ask": 150.25,
  "bid_size": 500,
  "ask_size": 300,
  "timestamp": "2026-01-08T10:00:00.123456Z"
}

# Trade Update
{
  "type": "trade",
  "symbol": "AAPL",
  "price": 150.22,
  "quantity": 100,
  "side": "BUY",
  "timestamp": "2026-01-08T10:00:00.123456Z"
}
```

### Order Updates
```
# Order Filled
{
  "type": "order_update",
  "order_id": 67890,
  "status": "FILLED",
  "filled_quantity": 100,
  "average_fill_price": 150.20,
  "timestamp": "2026-01-08T10:00:01.234567Z"
}

# Order Partially Filled
{
  "type": "order_update",
  "order_id": 67890,
  "status": "PARTIALLY_FILLED",
  "filled_quantity": 50,
  "remaining_quantity": 50,
  "average_fill_price": 150.20,
  "timestamp": "2026-01-08T10:00:01.234567Z"
}
```

## FIX Protocol

### New Order (FIX 4.4)
```
8=FIX.4.4|9=XXX|35=D|49=CLIENT|56=BROKER|34=1|52=20260108-10:00:00|
11=ORDER123|21=1|55=AAPL|54=1|60=20260108-10:00:00|38=100|40=2|44=150.25|
59=0|10=XXX|

Fields:
35=D: New Order Single
11=ORDER123: Client Order ID
55=AAPL: Symbol
54=1: Side (1=Buy, 2=Sell)
38=100: Quantity
40=2: Order Type (1=Market, 2=Limit)
44=150.25: Price
59=0: Time in Force (0=Day)
```

### Execution Report
```
8=FIX.4.4|9=XXX|35=8|49=BROKER|56=CLIENT|34=2|52=20260108-10:00:01|
11=ORDER123|37=67890|17=TRADE123|150=2|39=2|55=AAPL|54=1|38=100|
32=100|31=150.20|151=0|14=100|6=150.20|60=20260108-10:00:01|10=XXX|

Fields:
35=8: Execution Report
37=67890: Order ID
150=2: Exec Type (0=New, 1=Partial, 2=Fill)
39=2: Order Status (0=New, 1=Partial, 2=Filled)
32=100: Last Quantity
31=150.20: Last Price
14=100: Cumulative Quantity
6=150.20: Average Price
```

## Rate Limiting

### Rate Limits
```
Order Placement:
- 100 orders/second per user
- 1000 orders/second per account

Order Cancellation:
- 200 cancellations/second per user

Market Data:
- Unlimited (WebSocket)
- 100 requests/second (REST)

Account Queries:
- 10 requests/second per user

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
    "code": "INSUFFICIENT_FUNDS",
    "message": "Insufficient buying power for this order",
    "details": {
      "required": 15020.00,
      "available": 10000.00,
      "shortfall": 5020.00
    },
    "request_id": "req_123456",
    "timestamp": "2026-01-08T10:00:00.123456Z"
  }
}
```

### HTTP Status Codes
```
200 OK - Success
201 Created - Order placed
400 Bad Request - Invalid parameters
401 Unauthorized - Invalid token
402 Payment Required - Insufficient funds
403 Forbidden - Trading suspended
404 Not Found - Order not found
409 Conflict - Order already filled
422 Unprocessable Entity - Risk limit exceeded
429 Too Many Requests - Rate limit
500 Internal Server Error - Server error
503 Service Unavailable - Market closed
```

This API design provides comprehensive trading functionality with REST for standard operations, WebSocket for real-time updates, and FIX protocol for institutional clients, all with microsecond-level performance.
