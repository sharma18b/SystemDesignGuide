# API Design for Food Delivery Service

## REST APIs

### Customer APIs

```http
POST /api/v1/restaurants/search
{
  "location": {"lat": 37.7749, "lon": -122.4194},
  "cuisine": "italian",
  "radius_km": 5
}

Response 200:
{
  "restaurants": [{
    "id": "rest_123",
    "name": "Pizza Palace",
    "rating": 4.5,
    "delivery_time": "30-40 min",
    "delivery_fee": 2.99
  }]
}

POST /api/v1/orders
{
  "restaurant_id": "rest_123",
  "items": [{"item_id": "item_456", "quantity": 2}],
  "delivery_address": "123 Main St",
  "payment_method_id": "pm_789"
}

Response 201:
{
  "order_id": "ord_abc",
  "status": "PENDING",
  "total": 45.99,
  "estimated_delivery": "2024-01-08T13:30:00Z"
}

GET /api/v1/orders/{order_id}/track
Response 200:
{
  "status": "IN_TRANSIT",
  "driver": {"name": "John", "rating": 4.8},
  "location": {"lat": 37.7749, "lon": -122.4194},
  "eta": "2024-01-08T13:25:00Z"
}
```

### Driver APIs

```http
POST /api/v1/drivers/status
{"status": "available"}

GET /api/v1/drivers/delivery-requests
Response 200:
{
  "requests": [{
    "order_id": "ord_abc",
    "restaurant": "Pizza Palace",
    "pickup_location": {"lat": 37.7749, "lon": -122.4194},
    "delivery_location": {"lat": 37.7849, "lon": -122.4294},
    "estimated_distance_km": 3.5,
    "payout": 8.50
  }]
}

POST /api/v1/drivers/accept-delivery
{"order_id": "ord_abc"}

POST /api/v1/drivers/location
{"lat": 37.7749, "lon": -122.4194}
```

### Restaurant APIs

```http
GET /api/v1/restaurants/orders
Response 200:
{
  "orders": [{
    "order_id": "ord_abc",
    "items": [{"name": "Pizza", "quantity": 2}],
    "status": "PENDING",
    "created_at": "2024-01-08T12:00:00Z"
  }]
}

POST /api/v1/restaurants/orders/{order_id}/accept
{"prep_time_minutes": 20}

PUT /api/v1/restaurants/menu/{item_id}
{"is_available": false}
```

## WebSocket APIs

```javascript
// Customer tracking
ws://api.example.com/ws/orders/{order_id}

Messages:
{
  "type": "location_update",
  "driver_location": {"lat": 37.7749, "lon": -122.4194},
  "eta": "2024-01-08T13:25:00Z"
}

{
  "type": "status_update",
  "status": "PICKED_UP",
  "message": "Driver picked up your order"
}

// Driver updates
ws://api.example.com/ws/drivers/{driver_id}

Messages:
{
  "type": "new_delivery_request",
  "order_id": "ord_abc",
  "restaurant": "Pizza Palace"
}
```

## SDK Example

```python
from food_delivery_sdk import FoodDeliveryClient

client = FoodDeliveryClient(api_key="key_123")

# Search restaurants
restaurants = client.restaurants.search(
    location=(37.7749, -122.4194),
    cuisine="italian"
)

# Place order
order = client.orders.create(
    restaurant_id="rest_123",
    items=[{"item_id": "item_456", "quantity": 2}],
    delivery_address="123 Main St"
)

# Track order
tracking = client.orders.track(order.id)
print(f"Driver location: {tracking.driver_location}")
print(f"ETA: {tracking.eta}")
```

This API design provides comprehensive interfaces for all platform actors. The next documents will cover scaling, tradeoffs, variations, security, and interview tips.
