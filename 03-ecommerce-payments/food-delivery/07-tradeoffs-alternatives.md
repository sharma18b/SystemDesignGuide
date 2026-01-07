# Tradeoffs and Alternatives for Food Delivery Service

## Driver Assignment Algorithms

### Greedy Assignment (Chosen)
```python
# Assign to nearest available driver
def assign_greedy(order, drivers):
    return min(drivers, key=lambda d: distance(d.location, order.restaurant))
```
**Pros:** Fast, simple  
**Cons:** May not optimize globally

### Optimal Assignment
```python
# Hungarian algorithm for global optimization
def assign_optimal(orders, drivers):
    cost_matrix = build_cost_matrix(orders, drivers)
    return hungarian_algorithm(cost_matrix)
```
**Pros:** Global optimization  
**Cons:** Slower, complex

## Location Update Frequency

### High Frequency (5 seconds)
- Better tracking accuracy
- Higher battery drain
- More network traffic

### Low Frequency (30 seconds)
- Lower battery usage
- Less accurate tracking
- Reduced server load

## Database Choices

### PostgreSQL + PostGIS (Chosen)
```sql
SELECT * FROM restaurants
WHERE ST_DWithin(location, ST_Point($1, $2)::geography, 5000);
```
**Pros:** ACID, geospatial support  
**Cons:** Scaling complexity

### MongoDB
```javascript
db.restaurants.find({
  location: {
    $near: {
      $geometry: {type: "Point", coordinates: [lon, lat]},
      $maxDistance: 5000
    }
  }
})
```
**Pros:** Flexible schema, horizontal scaling  
**Cons:** Eventual consistency

## Real-time Communication

### WebSockets (Chosen)
- Bidirectional, low latency
- Persistent connections
- Higher server resources

### Server-Sent Events
- Unidirectional, simpler
- Lower resource usage
- No client-to-server push

### Polling
- Simple implementation
- Higher latency
- More bandwidth usage

## Pricing Models

### Fixed Pricing
```python
delivery_fee = base_fee + distance_fee
```
**Pros:** Predictable  
**Cons:** No demand adjustment

### Dynamic Pricing (Chosen)
```python
delivery_fee = base_fee * demand_multiplier + distance_fee
```
**Pros:** Balances supply/demand  
**Cons:** Customer dissatisfaction

## Order Matching

### First-Come-First-Served
- Simple, fair
- Not optimal for efficiency

### Batch Matching (Chosen)
```python
# Match multiple orders every 30 seconds
def batch_match(orders, drivers):
    return optimize_assignments(orders, drivers)
```
- Better optimization
- Slight delay in assignment

This document covers key tradeoffs in food delivery system design. The next document will explore variations.
