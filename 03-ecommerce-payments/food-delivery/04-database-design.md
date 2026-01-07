# Food Delivery - Database Design

**Reading Time**: 20 minutes

## Database Schema

### 1. Users Table
```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100),
    user_type VARCHAR(20) NOT NULL, -- customer, restaurant, driver
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_type (user_type)
);
```

### 2. Restaurants Table
```sql
CREATE TABLE restaurants (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    cuisine_type VARCHAR(50),
    address TEXT,
    location GEOGRAPHY(POINT, 4326), -- PostGIS
    rating DECIMAL(3, 2) DEFAULT 0,
    total_ratings INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    prep_time_avg INT DEFAULT 30, -- minutes
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_location USING GIST (location),
    INDEX idx_cuisine (cuisine_type),
    INDEX idx_rating (rating DESC)
);
```

### 3. Menu Items Table
```sql
CREATE TABLE menu_items (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(50),
    is_available BOOLEAN DEFAULT TRUE,
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_restaurant (restaurant_id),
    INDEX idx_category (category),
    INDEX idx_available (is_available)
);
```

### 4. Drivers Table
```sql
CREATE TABLE drivers (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    vehicle_type VARCHAR(20), -- bike, scooter, car
    license_number VARCHAR(50),
    rating DECIMAL(3, 2) DEFAULT 0,
    total_ratings INT DEFAULT 0,
    acceptance_rate DECIMAL(5, 2) DEFAULT 100,
    completion_rate DECIMAL(5, 2) DEFAULT 100,
    is_online BOOLEAN DEFAULT FALSE,
    current_location GEOGRAPHY(POINT, 4326),
    last_location_update TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_online (is_online),
    INDEX idx_location USING GIST (current_location),
    INDEX idx_rating (rating DESC)
);
```

### 5. Orders Table (Partitioned)
```sql
CREATE TABLE orders (
    id BIGSERIAL,
    customer_id BIGINT NOT NULL,
    restaurant_id BIGINT NOT NULL,
    driver_id BIGINT,
    status VARCHAR(20) NOT NULL, -- placed, confirmed, preparing, ready, picked_up, delivered, cancelled
    subtotal DECIMAL(10, 2) NOT NULL,
    delivery_fee DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) NOT NULL,
    tip DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    delivery_address TEXT,
    delivery_location GEOGRAPHY(POINT, 4326),
    estimated_delivery_time TIMESTAMP,
    actual_delivery_time TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Partitions by day
CREATE TABLE orders_2026_01_08 PARTITION OF orders
    FOR VALUES FROM ('2026-01-08') TO ('2026-01-09');

CREATE INDEX idx_orders_customer ON orders(customer_id, created_at DESC);
CREATE INDEX idx_orders_restaurant ON orders(restaurant_id, created_at DESC);
CREATE INDEX idx_orders_driver ON orders(driver_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(status);
```

### 6. Order Items Table
```sql
CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    menu_item_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    special_instructions TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_order (order_id)
);
```

### 7. Driver Locations Table (Time-Series)
```sql
CREATE TABLE driver_locations (
    time TIMESTAMPTZ NOT NULL,
    driver_id BIGINT NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    speed DECIMAL(5, 2), -- km/h
    heading DECIMAL(5, 2), -- degrees
    accuracy DECIMAL(5, 2), -- meters
    PRIMARY KEY (driver_id, time)
);

-- TimescaleDB hypertable
SELECT create_hypertable('driver_locations', 'time');

-- Retention policy (7 days)
SELECT add_retention_policy('driver_locations', INTERVAL '7 days');
```

### 8. Order Status History Table
```sql
CREATE TABLE order_status_history (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_order (order_id, created_at)
);
```

### 9. Ratings Table
```sql
CREATE TABLE ratings (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL,
    restaurant_id BIGINT,
    driver_id BIGINT,
    restaurant_rating INT CHECK (restaurant_rating BETWEEN 1 AND 5),
    driver_rating INT CHECK (driver_rating BETWEEN 1 AND 5),
    restaurant_review TEXT,
    driver_review TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_restaurant (restaurant_id),
    INDEX idx_driver (driver_id)
);
```

### 10. Payments Table
```sql
CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(20), -- card, cash, wallet
    payment_status VARCHAR(20), -- pending, completed, failed, refunded
    transaction_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_order (order_id),
    INDEX idx_customer (customer_id),
    INDEX idx_status (payment_status)
);
```

## Database Sharding Strategy

### Sharding by City/Region
```
Shard Key: city_id or region_id
Number of Shards: 500 (one per major city)

Shard Calculation:
shard_id = hash(city_id) % 500

Benefits:
- Geographic data locality
- Easier compliance (data residency)
- Predictable load distribution
- City-specific optimizations

Tables to Shard:
- orders (by restaurant city)
- restaurants (by city)
- drivers (by operating city)
- order_items (follows orders)

Global Tables (Not Sharded):
- users (accessed by user_id)
- payments (centralized)
- ratings (centralized)
```

### Read Replicas
```
Configuration per Shard:
├── 1 Primary (writes)
├── 3 Replicas (reads)
├── Replication Lag: < 100ms
└── Failover: Automatic

Read Distribution:
- Restaurant search: 95% reads → Replicas
- Order history: 90% reads → Replicas
- Order placement: 100% writes → Primary
- Status updates: 100% writes → Primary
```

## Caching Strategy

### Redis Cache Layers

#### L1: Restaurant Data (TTL: 15 minutes)
```
Key Pattern: restaurant:{restaurant_id}
Value: Restaurant details JSON
Size: ~2 KB per restaurant
Total: 100K restaurants × 2 KB = 200 MB

Key Pattern: menu:{restaurant_id}
Value: Menu items JSON
Size: ~10 KB per restaurant
Total: 100K × 10 KB = 1 GB
```

#### L2: Active Orders (TTL: 1 hour)
```
Key Pattern: order:{order_id}
Value: Order details JSON
Size: ~5 KB per order
Total: 500K active orders × 5 KB = 2.5 GB
```

#### L3: Driver Locations (TTL: 30 seconds)
```
Key Pattern: driver:location:{driver_id}
Value: Current location (lat, lon, timestamp)
Size: ~100 bytes per driver
Total: 200K active drivers × 100 bytes = 20 MB

Geospatial Index:
GEOADD drivers:online {lon} {lat} {driver_id}
GEORADIUS drivers:online {lon} {lat} 5 km
```

#### L4: Search Results (TTL: 5 minutes)
```
Key Pattern: search:{location}:{filters}
Value: Restaurant IDs list
Size: ~1 KB per search
Total: 100K unique searches × 1 KB = 100 MB

Total Redis Memory: ~4 GB
Redis Cluster: 6 nodes × 8 GB = 48 GB
```

## Geospatial Indexing

### PostGIS for Restaurants
```sql
-- Create spatial index
CREATE INDEX idx_restaurants_location 
ON restaurants USING GIST (location);

-- Find restaurants within 10 km
SELECT id, name, 
       ST_Distance(location, ST_MakePoint(lon, lat)::geography) as distance
FROM restaurants
WHERE ST_DWithin(
    location,
    ST_MakePoint(lon, lat)::geography,
    10000 -- 10 km in meters
)
AND is_active = TRUE
ORDER BY distance
LIMIT 100;
```

### Redis Geo for Drivers
```
-- Add driver location
GEOADD drivers:online {lon} {lat} {driver_id}

-- Find drivers within 5 km
GEORADIUS drivers:online {lon} {lat} 5 km WITHDIST

-- Remove offline driver
ZREM drivers:online {driver_id}

Benefits:
- Fast queries (< 10ms)
- Real-time updates
- Memory-efficient
```

## Data Consistency

### Order State Machine
```sql
-- Ensure valid state transitions
CREATE OR REPLACE FUNCTION validate_order_status()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status = 'delivered' AND NEW.status != 'delivered') THEN
        RAISE EXCEPTION 'Cannot change status of delivered order';
    END IF;
    
    IF (OLD.status = 'cancelled' AND NEW.status != 'cancelled') THEN
        RAISE EXCEPTION 'Cannot change status of cancelled order';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_status_validation
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION validate_order_status();
```

### Idempotency
```sql
-- Prevent duplicate orders
CREATE UNIQUE INDEX idx_orders_idempotency 
ON orders(customer_id, restaurant_id, created_at)
WHERE status != 'cancelled';

-- Idempotency key for API requests
CREATE TABLE idempotency_keys (
    key VARCHAR(100) PRIMARY KEY,
    response JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_idempotency_created 
ON idempotency_keys(created_at);
```

## Data Archival

### Archival Strategy
```
Hot Data (0-7 days):
- Storage: PostgreSQL SSD
- Access: Real-time
- Retention: 7 days

Warm Data (7-90 days):
- Storage: PostgreSQL HDD (partitioned)
- Access: Moderate (1-2 seconds)
- Retention: 90 days

Cold Data (90+ days):
- Storage: S3 Glacier
- Access: Rare (minutes to hours)
- Retention: 7 years (compliance)

Archival Process:
1. Daily job identifies old partitions
2. Export to Parquet format
3. Upload to S3 Glacier
4. Drop old partition
5. Update metadata table
```

## Interview Discussion Points

**Q: How handle high write throughput for orders?**
```
Strategy:
- Sharding by city (500 shards)
- Partitioning by day (easy archival)
- Batch inserts for status history
- Async writes for analytics
- Write-ahead logging
```

**Q: How optimize geospatial queries?**
```
Approach:
- PostGIS for restaurants (static data)
- Redis Geo for drivers (real-time)
- Spatial indexes (GIST)
- Bounding box pre-filter
- Distance calculation optimization
```

**Q: How ensure data consistency for orders?**
```
Measures:
- ACID transactions
- State machine validation
- Idempotency keys
- Optimistic locking
- Event sourcing for audit trail
```

---
*Estimated Reading Time: 20 minutes*
