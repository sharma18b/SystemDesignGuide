# Uber Backend - Database Design

## Database Technology Stack

### Primary Databases
- **PostgreSQL**: Transactional data (trips, users, payments)
- **Cassandra**: Time-series data (GPS locations, analytics)
- **Redis**: Caching and real-time data (driver locations, sessions)
- **Elasticsearch**: Search and analytics (trip search, driver search)
- **S3/Object Storage**: Media files, backups, archives

### Database Selection Rationale
```
PostgreSQL:
- ACID compliance for financial transactions
- Complex queries with joins
- Strong consistency for critical data
- Mature ecosystem and tooling

Cassandra:
- High write throughput for GPS data
- Time-series data storage
- Linear scalability
- Multi-datacenter replication

Redis:
- Sub-millisecond latency
- Geospatial queries (GEORADIUS)
- Pub/sub for real-time updates
- Session management

Elasticsearch:
- Full-text search capabilities
- Real-time analytics
- Log aggregation
- Complex filtering and aggregation
```

## Core Data Models

### 1. User Schema (PostgreSQL)
```sql
-- Riders Table
CREATE TABLE riders (
    rider_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    profile_image_url TEXT,
    rating DECIMAL(3,2) DEFAULT 5.00,
    total_trips INTEGER DEFAULT 0,
    account_status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone (phone_number),
    INDEX idx_email (email)
);

-- Drivers Table
CREATE TABLE drivers (
    driver_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    profile_image_url TEXT,
    license_number VARCHAR(50) NOT NULL,
    license_expiry DATE NOT NULL,
    rating DECIMAL(3,2) DEFAULT 5.00,
    total_trips INTEGER DEFAULT 0,
    acceptance_rate DECIMAL(5,2) DEFAULT 100.00,
    cancellation_rate DECIMAL(5,2) DEFAULT 0.00,
    home_city_id UUID NOT NULL,
    vehicle_id UUID,
    status VARCHAR(20) DEFAULT 'OFFLINE',
    account_status VARCHAR(20) DEFAULT 'PENDING_VERIFICATION',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone (phone_number),
    INDEX idx_status (status),
    INDEX idx_city (home_city_id),
    FOREIGN KEY (home_city_id) REFERENCES cities(city_id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
);

-- Vehicles Table
CREATE TABLE vehicles (
    vehicle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL,
    make VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    color VARCHAR(30) NOT NULL,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type VARCHAR(20) NOT NULL, -- UBER_X, UBER_XL, UBER_BLACK
    capacity INTEGER NOT NULL,
    insurance_policy VARCHAR(100) NOT NULL,
    insurance_expiry DATE NOT NULL,
    registration_expiry DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_driver (driver_id),
    INDEX idx_type (vehicle_type),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
);
```

### 2. Trip Schema (PostgreSQL - Sharded by city_id)
```sql
-- Trips Table (Sharded)
CREATE TABLE trips (
    trip_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL,
    driver_id UUID NOT NULL,
    city_id UUID NOT NULL,
    ride_type VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL,
    
    -- Pickup Information
    pickup_lat DECIMAL(10,8) NOT NULL,
    pickup_lng DECIMAL(11,8) NOT NULL,
    pickup_address TEXT NOT NULL,
    pickup_time TIMESTAMP,
    
    -- Dropoff Information
    dropoff_lat DECIMAL(10,8),
    dropoff_lng DECIMAL(11,8),
    dropoff_address TEXT,
    dropoff_time TIMESTAMP,
    
    -- Route Information
    distance_miles DECIMAL(10,2),
    duration_minutes INTEGER,
    route_polyline TEXT,
    
    -- Pricing Information
    base_fare DECIMAL(10,2),
    distance_fare DECIMAL(10,2),
    time_fare DECIMAL(10,2),
    surge_multiplier DECIMAL(3,2) DEFAULT 1.00,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    total_fare DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Metadata
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    matched_at TIMESTAMP,
    accepted_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    cancelled_by VARCHAR(10), -- RIDER, DRIVER, SYSTEM
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_rider (rider_id),
    INDEX idx_driver (driver_id),
    INDEX idx_city (city_id),
    INDEX idx_status (status),
    INDEX idx_requested_at (requested_at),
    INDEX idx_completed_at (completed_at),
    FOREIGN KEY (rider_id) REFERENCES riders(rider_id),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id),
    FOREIGN KEY (city_id) REFERENCES cities(city_id)
);

-- Trip Status History (Audit Trail)
CREATE TABLE trip_status_history (
    history_id BIGSERIAL PRIMARY KEY,
    trip_id UUID NOT NULL,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    changed_by VARCHAR(10), -- RIDER, DRIVER, SYSTEM
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_trip (trip_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (trip_id) REFERENCES trips(trip_id)
);
```

### 3. Location Data (Cassandra - Time-Series)
```cql
-- Driver Locations (High Write Throughput)
CREATE TABLE driver_locations (
    driver_id UUID,
    timestamp TIMESTAMP,
    latitude DECIMAL,
    longitude DECIMAL,
    accuracy DECIMAL,
    speed DECIMAL,
    heading DECIMAL,
    battery_level INTEGER,
    network_type TEXT,
    PRIMARY KEY (driver_id, timestamp)
) WITH CLUSTERING ORDER BY (timestamp DESC)
  AND compaction = {'class': 'TimeWindowCompactionStrategy'}
  AND default_time_to_live = 7776000; -- 90 days

-- Trip GPS Trail
CREATE TABLE trip_gps_trail (
    trip_id UUID,
    timestamp TIMESTAMP,
    latitude DECIMAL,
    longitude DECIMAL,
    accuracy DECIMAL,
    speed DECIMAL,
    PRIMARY KEY (trip_id, timestamp)
) WITH CLUSTERING ORDER BY (timestamp ASC)
  AND compaction = {'class': 'TimeWindowCompactionStrategy'}
  AND default_time_to_live = 2592000; -- 30 days
```

### 4. Real-time Driver State (Redis)
```
# Driver Location (Geospatial Index)
GEOADD drivers:locations {longitude} {latitude} {driver_id}
GEORADIUS drivers:locations {lng} {lat} 5 km WITHDIST WITHCOORD

# Driver Status
HSET driver:{driver_id}:status
  status "AVAILABLE"
  last_update "2026-01-08T10:00:00Z"
  current_trip_id ""
  battery_level "85"

# Driver Session
SET driver:{driver_id}:session {session_token}
EXPIRE driver:{driver_id}:session 86400

# Active Trips (Sorted Set by timestamp)
ZADD active:trips {timestamp} {trip_id}
ZRANGEBYSCORE active:trips {start_time} {end_time}
```

### 5. Payment Schema (PostgreSQL)
```sql
-- Payment Methods
CREATE TABLE payment_methods (
    payment_method_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_type VARCHAR(10) NOT NULL, -- RIDER, DRIVER
    method_type VARCHAR(20) NOT NULL, -- CARD, WALLET, BANK_ACCOUNT
    
    -- Card Information (Tokenized)
    card_token VARCHAR(255),
    card_last_four VARCHAR(4),
    card_brand VARCHAR(20),
    card_expiry_month INTEGER,
    card_expiry_year INTEGER,
    
    -- Wallet Information
    wallet_provider VARCHAR(50),
    wallet_id VARCHAR(255),
    
    -- Bank Account Information
    bank_name VARCHAR(100),
    account_last_four VARCHAR(4),
    routing_number_hash VARCHAR(255),
    
    is_default BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user (user_id, user_type),
    INDEX idx_status (status)
);

-- Transactions
CREATE TABLE transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL,
    rider_id UUID NOT NULL,
    driver_id UUID NOT NULL,
    payment_method_id UUID NOT NULL,
    
    -- Amount Breakdown
    subtotal DECIMAL(10,2) NOT NULL,
    surge_amount DECIMAL(10,2) DEFAULT 0.00,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    tip_amount DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Commission
    uber_commission DECIMAL(10,2) NOT NULL,
    driver_earnings DECIMAL(10,2) NOT NULL,
    
    -- Payment Gateway
    gateway_provider VARCHAR(50) NOT NULL,
    gateway_transaction_id VARCHAR(255),
    gateway_status VARCHAR(30),
    
    -- Status
    status VARCHAR(30) NOT NULL, -- PENDING, AUTHORIZED, CAPTURED, FAILED, REFUNDED
    failure_reason TEXT,
    
    -- Timestamps
    authorized_at TIMESTAMP,
    captured_at TIMESTAMP,
    failed_at TIMESTAMP,
    refunded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_trip (trip_id),
    INDEX idx_rider (rider_id),
    INDEX idx_driver (driver_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (trip_id) REFERENCES trips(trip_id),
    FOREIGN KEY (rider_id) REFERENCES riders(rider_id),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id),
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(payment_method_id)
);

-- Driver Payouts
CREATE TABLE driver_payouts (
    payout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL,
    payout_period_start DATE NOT NULL,
    payout_period_end DATE NOT NULL,
    
    -- Earnings Breakdown
    total_earnings DECIMAL(10,2) NOT NULL,
    total_trips INTEGER NOT NULL,
    bonus_amount DECIMAL(10,2) DEFAULT 0.00,
    adjustment_amount DECIMAL(10,2) DEFAULT 0.00,
    payout_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Payout Details
    payout_method VARCHAR(20) NOT NULL, -- BANK_TRANSFER, INSTANT_PAY
    bank_account_id UUID,
    
    -- Status
    status VARCHAR(30) NOT NULL, -- PENDING, PROCESSING, COMPLETED, FAILED
    processed_at TIMESTAMP,
    completed_at TIMESTAMP,
    failure_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_driver (driver_id),
    INDEX idx_period (payout_period_start, payout_period_end),
    INDEX idx_status (status),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
);
```

### 6. Ratings and Reviews Schema
```sql
-- Ratings
CREATE TABLE ratings (
    rating_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL UNIQUE,
    
    -- Rider Rating of Driver
    rider_to_driver_rating INTEGER CHECK (rider_to_driver_rating BETWEEN 1 AND 5),
    rider_to_driver_feedback TEXT,
    rider_to_driver_tags TEXT[], -- ['Friendly', 'Clean Car', 'Safe Driving']
    
    -- Driver Rating of Rider
    driver_to_rider_rating INTEGER CHECK (driver_to_rider_rating BETWEEN 1 AND 5),
    driver_to_rider_feedback TEXT,
    driver_to_rider_tags TEXT[], -- ['Polite', 'On Time', 'Respectful']
    
    -- Timestamps
    rider_rated_at TIMESTAMP,
    driver_rated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_trip (trip_id),
    FOREIGN KEY (trip_id) REFERENCES trips(trip_id)
);
```

### 7. City and Geographic Data
```sql
-- Cities
CREATE TABLE cities (
    city_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    
    -- Service Area (Polygon)
    service_area_geojson JSONB NOT NULL,
    
    -- Pricing Configuration
    base_fare DECIMAL(10,2) NOT NULL,
    per_mile_rate DECIMAL(10,2) NOT NULL,
    per_minute_rate DECIMAL(10,2) NOT NULL,
    minimum_fare DECIMAL(10,2) NOT NULL,
    cancellation_fee DECIMAL(10,2) NOT NULL,
    
    -- Operational Settings
    max_surge_multiplier DECIMAL(3,2) DEFAULT 5.00,
    airport_fee DECIMAL(10,2) DEFAULT 0.00,
    
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_country (country),
    INDEX idx_status (status)
);

-- Surge Pricing Zones (H3 Hexagons)
CREATE TABLE surge_zones (
    zone_id VARCHAR(20) PRIMARY KEY, -- H3 cell ID
    city_id UUID NOT NULL,
    center_lat DECIMAL(10,8) NOT NULL,
    center_lng DECIMAL(11,8) NOT NULL,
    
    -- Current Surge Data
    current_multiplier DECIMAL(3,2) DEFAULT 1.00,
    active_requests INTEGER DEFAULT 0,
    available_drivers INTEGER DEFAULT 0,
    supply_demand_ratio DECIMAL(5,2),
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_city (city_id),
    INDEX idx_multiplier (current_multiplier),
    FOREIGN KEY (city_id) REFERENCES cities(city_id)
);
```

## Database Sharding Strategy

### Sharding by City (Geographic Sharding)
```
Shard Selection Logic:
1. Extract city_id from request
2. Hash city_id to determine shard: shard_id = city_id % num_shards
3. Route query to appropriate shard

Benefits:
- Geographic locality (most queries within same city)
- Reduced cross-shard queries
- Easy to add new cities

Challenges:
- Uneven distribution (NYC vs small cities)
- Cross-city trips require coordination
- Hot shards for popular cities

Mitigation:
- Further partition large cities into sub-regions
- Use consistent hashing for better distribution
- Dedicated shards for top 10 cities
```

### Sharding by User ID (Hash Sharding)
```
Shard Selection Logic:
1. Extract user_id from request
2. Hash user_id: shard_id = hash(user_id) % num_shards
3. Route query to appropriate shard

Benefits:
- Even distribution across shards
- Predictable shard assignment
- Easy to scale horizontally

Challenges:
- Trip queries require both rider_id and driver_id
- Cross-shard joins for analytics
- Rebalancing on shard addition

Mitigation:
- Denormalize data for common queries
- Use global secondary indices
- Consistent hashing for minimal rebalancing
```

## Data Consistency and Replication

### Replication Strategy
```
Primary-Replica Setup:
- 1 Primary (Write)
- 2 Replicas (Read)
- Async replication with <1 second lag

Read/Write Split:
- Writes → Primary
- Reads → Replicas (with fallback to primary)
- Critical reads → Primary (strong consistency)

Cross-Region Replication:
- Async replication to backup region
- 5-minute replication lag acceptable
- Used for disaster recovery only
```

### Consistency Models
```
Strong Consistency:
- Payment transactions
- Trip status changes
- Driver availability status

Eventual Consistency:
- Driver locations (5-second freshness acceptable)
- Surge pricing (1-minute lag acceptable)
- Analytics data (1-hour lag acceptable)

Causal Consistency:
- Trip events (must maintain order)
- Rating submissions (after trip completion)
```

## Data Retention and Archival

### Retention Policies
```
Hot Data (NVMe SSD):
- Active trips: Real-time
- Recent trips: 30 days
- Driver locations: 7 days
- User sessions: 24 hours

Warm Data (SATA SSD):
- Trip history: 30 days - 2 years
- Transaction history: 30 days - 7 years
- GPS trails: 7 days - 90 days

Cold Data (Object Storage):
- Archived trips: >2 years
- Archived transactions: >7 years (compliance)
- Historical analytics: >1 year

Deletion:
- User data: Deleted on account closure (GDPR)
- GPS data: Deleted after 90 days
- Logs: Deleted after 1 year
```

## Database Performance Optimization

### Indexing Strategy
```
Primary Indices:
- All foreign keys
- Frequently queried columns (status, timestamps)
- Geospatial columns (lat/lng)

Composite Indices:
- (rider_id, created_at) for trip history
- (driver_id, status) for driver queries
- (city_id, status, requested_at) for city analytics

Covering Indices:
- Include frequently accessed columns in index
- Avoid table lookups for common queries
```

### Query Optimization
```
Common Query Patterns:
1. Find nearby drivers:
   - Use geospatial index (GEORADIUS in Redis)
   - Filter by status in application layer
   - Limit results to top 50 drivers

2. Get trip history:
   - Query by rider_id with time range
   - Use composite index (rider_id, created_at)
   - Paginate results (LIMIT/OFFSET)

3. Calculate driver earnings:
   - Aggregate transactions by driver_id and date range
   - Use materialized views for common periods
   - Cache results in Redis
```

This database design provides the foundation for handling billions of trips while maintaining data integrity, performance, and scalability across global operations.
