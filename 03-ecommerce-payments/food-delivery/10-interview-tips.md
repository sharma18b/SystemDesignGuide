# Interview Tips for Food Delivery Service Design

## Interview Structure (45-60 minutes)

### Phase 1: Requirements (10 minutes)
- Clarify actors (customers, drivers, restaurants)
- Understand scale (users, orders, cities)
- Define core features (ordering, tracking, matching)
- Identify constraints (real-time, location accuracy)

### Phase 2: High-Level Design (15 minutes)
- Draw core services (order, matching, location, payment)
- Explain order flow
- Discuss driver assignment algorithm
- Address real-time tracking

### Phase 3: Deep Dive (15 minutes)
- Database design for orders and locations
- Geospatial queries and indexing
- WebSocket architecture for real-time updates
- Driver matching optimization

### Phase 4: Advanced Topics (10 minutes)
- Scaling strategies
- Peak demand handling
- Regional variations
- Follow-up questions

## Key Discussion Points

### 1. Real-time Location Tracking

**Strong Answer:**
```python
"For real-time tracking, I'd use:

1. Redis Geo for spatial queries:
   - Store driver locations with GEOADD
   - Query nearby drivers with GEORADIUS
   - O(log N) complexity for spatial queries

2. WebSocket connections:
   - Persistent connections for customers tracking orders
   - Push location updates every 5 seconds
   - Automatic reconnection on network issues

3. Location update optimization:
   - Only update when driver moves > 50 meters
   - Batch updates to reduce database writes
   - Use time-series database for historical data"
```

### 2. Driver Assignment Algorithm

**Comprehensive Answer:**
```python
"Driver assignment considers multiple factors:

1. Scoring algorithm:
   - Distance to restaurant (40% weight)
   - Driver rating (30% weight)
   - Completion rate (20% weight)
   - Current order load (10% weight)

2. Assignment flow:
   - Find drivers within 5km of restaurant
   - Calculate score for each driver
   - Send request to highest scoring driver
   - 30-second timeout, then try next driver

3. Optimization:
   - Batch matching every 30 seconds
   - Consider multiple orders per driver
   - Route optimization for multi-pickup"
```

### 3. Handling Peak Demand

**Strategy:**
```python
"Multi-pronged approach:

1. Dynamic Pricing:
   - Increase delivery fees by 20-50%
   - Based on demand/supply ratio
   - Transparent to customers

2. Driver Incentives:
   - Peak hour bonuses
   - Guaranteed minimum earnings
   - Push notifications to offline drivers

3. System Scaling:
   - Auto-scale to 3x capacity
   - Increase cache hit rate
   - Batch order processing

4. Customer Communication:
   - Show estimated wait times
   - Suggest off-peak ordering
   - Offer scheduled delivery"
```

### 4. Database Design

**Key Points:**
```sql
-- Emphasize geospatial capabilities
CREATE INDEX idx_restaurants_location 
ON restaurants USING GIST(location);

-- Time-based partitioning for orders
CREATE TABLE orders_2024_01 PARTITION OF orders
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Sharding strategy
"Shard orders by order_id hash (16 shards)
Shard users by user_id hash (8 shards)
Shard locations by city_id for locality"
```

## Common Pitfalls to Avoid

### ❌ Wrong: "Store all location updates in main database"
### ✅ Right: "Use Redis Geo for active tracking, time-series DB for history"

### ❌ Wrong: "Assign driver to nearest restaurant"
### ✅ Right: "Multi-factor scoring: distance, rating, availability, current load"

### ❌ Wrong: "Poll for location updates every second"
### ✅ Right: "WebSocket push updates every 5 seconds, only when driver moves"

### ❌ Wrong: "Single database for all data"
### ✅ Right: "Polyglot persistence: PostgreSQL for orders, Redis for locations, TimescaleDB for history"

## Advanced Topics

### 1. Route Optimization
```python
"For multi-pickup optimization:
- Traveling Salesman Problem (TSP)
- Use approximation algorithms (2-opt, genetic)
- Consider time windows for each pickup
- Real-time traffic integration"
```

### 2. ETA Calculation
```python
"Accurate ETA requires:
- Real-time traffic data (Google Maps API)
- Historical delivery times
- Restaurant preparation time
- Driver speed patterns
- Weather conditions"
```

### 3. Fraud Prevention
```python
"Detect fraudulent orders:
- Unusual delivery locations
- High-frequency ordering
- Payment method patterns
- Customer behavior analysis
- ML-based risk scoring"
```

## Closing Strong

**Summary Template:**
```
"My food delivery design includes:

1. Real-time tracking: Redis Geo + WebSockets
2. Smart matching: Multi-factor driver scoring
3. Scalability: Sharded databases, auto-scaling services
4. Performance: < 30s driver assignment, 5s location updates

Key tradeoffs:
- Greedy vs optimal driver assignment (chose greedy for speed)
- Location update frequency (5s for balance)
- Dynamic pricing for supply/demand balance"
```

## Practice Questions

1. How would you handle order cancellations?
2. How would you optimize for multiple pickups?
3. How would you implement restaurant ratings?
4. How would you handle driver earnings calculation?
5. How would you support scheduled orders?
6. How would you handle poor network connectivity?
7. How would you implement surge pricing?
8. How would you handle restaurant capacity limits?

This interview guide provides comprehensive preparation for food delivery system design discussions.
