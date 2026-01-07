# Variations and Follow-up Questions for Food Delivery Service

## Business Model Variations

### 1. Restaurant-to-Consumer (DoorDash Model)
```python
class RestaurantDelivery:
    features = ['restaurant_partnerships', 'driver_fleet', 'customer_app']
```

### 2. Cloud Kitchen (Virtual Restaurants)
```python
class CloudKitchen:
    features = ['centralized_kitchen', 'multiple_brands', 'delivery_only']
```

### 3. Grocery Delivery (Instacart Model)
```python
class GroceryDelivery:
    features = ['store_partnerships', 'personal_shoppers', 'item_substitution']
```

## Regional Variations

### US Market
- Credit card primary
- Tipping culture
- Suburban delivery

### Asian Market
```python
class AsianMarket:
    features = ['cash_on_delivery', 'motorbike_delivery', 'dense_urban']
```

### European Market
- GDPR compliance
- Bicycle delivery
- Shorter distances

## Common Follow-up Questions

### Q1: "How would you handle order cancellations?"

```python
class CancellationPolicy:
    async def cancel_order(self, order_id, reason):
        order = await self.get_order(order_id)
        
        if order.status == 'PENDING':
            # Full refund
            await self.refund(order_id, order.total)
        elif order.status == 'PREPARING':
            # Partial refund (minus prep cost)
            await self.refund(order_id, order.total * 0.5)
        elif order.status in ['PICKED_UP', 'IN_TRANSIT']:
            # No refund
            return CancelResult(allowed=False)
        
        await self.update_status(order_id, 'CANCELLED')
```

### Q2: "How would you optimize driver routes?"

```python
class RouteOptimization:
    async def optimize_multi_pickup(self, driver_id, orders):
        # Traveling salesman problem
        optimal_route = self.tsp_solver.solve(
            start=driver.location,
            stops=[o.restaurant for o in orders] + [o.delivery for o in orders]
        )
        return optimal_route
```

### Q3: "How would you handle peak demand?"

```python
class PeakDemandHandling:
    strategies = [
        'dynamic_pricing',
        'driver_incentives',
        'auto_scaling',
        'order_batching',
        'estimated_wait_times'
    ]
    
    async def handle_peak(self):
        if self.demand_ratio > 1.5:
            await self.increase_pricing(multiplier=1.3)
            await self.send_driver_incentives()
            await self.scale_up_servers()
```

### Q4: "How would you implement restaurant ratings?"

```python
class RatingSystem:
    async def submit_rating(self, order_id, rating, review):
        await self.db.insert_rating({
            'order_id': order_id,
            'restaurant_id': order.restaurant_id,
            'driver_id': order.driver_id,
            'food_rating': rating.food,
            'delivery_rating': rating.delivery,
            'review': review
        })
        
        # Update aggregated ratings
        await self.update_restaurant_rating(order.restaurant_id)
        await self.update_driver_rating(order.driver_id)
```

### Q5: "How would you handle driver earnings?"

```python
class EarningsCalculation:
    def calculate_payout(self, delivery):
        base_pay = 3.00
        distance_pay = delivery.distance_km * 0.60
        time_pay = delivery.duration_minutes * 0.10
        tip = delivery.tip
        
        total = base_pay + distance_pay + time_pay + tip
        
        # Peak hour bonus
        if self.is_peak_hour(delivery.timestamp):
            total *= 1.2
        
        return total
```

### Q6: "How would you implement scheduled orders?"

```python
class ScheduledOrders:
    async def schedule_order(self, order_data, scheduled_time):
        order = await self.create_order(order_data, status='SCHEDULED')
        
        # Schedule job to process order
        await self.scheduler.schedule(
            job=self.process_scheduled_order,
            args=[order.id],
            run_at=scheduled_time - timedelta(minutes=30)
        )
```

This document covers major variations and common interview follow-up questions. The next documents will cover security and interview tips.
