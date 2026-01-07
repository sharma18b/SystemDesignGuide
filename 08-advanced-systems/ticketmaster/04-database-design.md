# Ticketmaster - Database Design

## Database Technology Stack

### Primary Databases
- **PostgreSQL**: Transactional data (events, orders, seats)
- **Redis**: Queue system, caching, session management
- **Elasticsearch**: Event search and discovery
- **S3**: Ticket PDFs, event images, backups

## Core Schema Design

### Events Table
```sql
CREATE TABLE events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    venue_id UUID NOT NULL,
    artist_id UUID,
    category VARCHAR(50),
    event_date TIMESTAMP NOT NULL,
    doors_open TIMESTAMP,
    
    -- Sale Configuration
    presale_start TIMESTAMP,
    general_sale_start TIMESTAMP,
    sale_end TIMESTAMP,
    
    -- Capacity
    total_capacity INTEGER,
    available_seats INTEGER,
    
    -- Status
    status VARCHAR(20) DEFAULT 'UPCOMING',
    -- UPCOMING, ON_SALE, SOLD_OUT, CANCELLED, COMPLETED
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_sale_date (general_sale_start, status),
    INDEX idx_venue (venue_id, event_date),
    INDEX idx_artist (artist_id, event_date)
);
```

### Seats Table (Sharded by event_id)
```sql
CREATE TABLE seats (
    seat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    
    -- Location
    section VARCHAR(50) NOT NULL,
    row VARCHAR(10) NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    
    -- Pricing
    price_tier VARCHAR(50),
    base_price DECIMAL(10,2) NOT NULL,
    fees DECIMAL(10,2) DEFAULT 0,
    total_price DECIMAL(10,2) NOT NULL,
    
    -- Status Management
    status VARCHAR(20) DEFAULT 'AVAILABLE',
    -- AVAILABLE, RESERVED, PURCHASED, HELD, BLOCKED
    version INTEGER DEFAULT 0, -- For optimistic locking
    
    -- Reservation Tracking
    reserved_at TIMESTAMP,
    reserved_by UUID,
    reservation_expires_at TIMESTAMP,
    
    -- Purchase Tracking
    purchased_at TIMESTAMP,
    purchased_by UUID,
    order_id UUID,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE (event_id, section, row, seat_number),
    INDEX idx_event_status (event_id, status),
    INDEX idx_reservation_expiry (reservation_expires_at) 
        WHERE status = 'RESERVED',
    INDEX idx_price_tier (event_id, price_tier, status)
);
```

### Orders Table
```sql
CREATE TABLE orders (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    event_id UUID NOT NULL,
    
    -- Order Details
    seat_ids UUID[] NOT NULL,
    num_tickets INTEGER NOT NULL,
    
    -- Pricing
    subtotal DECIMAL(10,2) NOT NULL,
    fees DECIMAL(10,2) NOT NULL,
    taxes DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    
    -- Payment
    payment_method_id UUID,
    payment_status VARCHAR(20),
    -- PENDING, AUTHORIZED, CAPTURED, FAILED, REFUNDED
    payment_transaction_id VARCHAR(255),
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING, CONFIRMED, CANCELLED, REFUNDED
    
    -- Delivery
    delivery_method VARCHAR(20), -- MOBILE, EMAIL, PRINT, WILL_CALL
    tickets_delivered BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    
    INDEX idx_user (user_id, created_at DESC),
    INDEX idx_event (event_id, status),
    INDEX idx_payment_status (payment_status, created_at)
);
```

### Users Table
```sql
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    
    -- Authentication
    password_hash VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    
    -- Account Status
    account_status VARCHAR(20) DEFAULT 'ACTIVE',
    -- ACTIVE, SUSPENDED, BANNED
    trust_score DECIMAL(5,2) DEFAULT 100.00,
    
    -- Preferences
    notification_preferences JSONB,
    favorite_artists UUID[],
    favorite_venues UUID[],
    
    -- Fraud Detection
    failed_login_attempts INTEGER DEFAULT 0,
    last_failed_login TIMESTAMP,
    suspicious_activity_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_trust_score (trust_score) WHERE account_status = 'ACTIVE'
);
```

### Venues Table
```sql
CREATE TABLE venues (
    venue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(50),
    postal_code VARCHAR(20),
    
    -- Capacity
    total_capacity INTEGER,
    
    -- Seat Map
    seat_map_url TEXT,
    seat_map_data JSONB, -- Interactive seat map configuration
    
    -- Sections Configuration
    sections JSONB,
    -- [{"name": "Floor", "rows": 20, "seats_per_row": 30}, ...]
    
    -- Metadata
    timezone VARCHAR(50),
    parking_info TEXT,
    accessibility_info TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_city (city, country),
    INDEX idx_capacity (total_capacity)
);
```

## Queue System (Redis)

### Queue Data Structures
```
# Waiting Queue (Sorted Set by timestamp)
ZADD queue:event:{event_id} {timestamp} {user_id}

# User Session Data (Hash)
HSET session:{user_id} 
    queue_position {position}
    estimated_wait {minutes}
    access_token {token}
    expires_at {timestamp}

# Active Sessions (Set)
SADD active:event:{event_id} {user_id}

# Queue Statistics (Hash)
HSET stats:event:{event_id}
    total_queued {count}
    processing_rate {rate}
    average_wait {minutes}
```

### Queue Operations
```
# Enqueue User
ZADD queue:event:123 {timestamp} user:456
HSET session:user:456 queue_position 1000 estimated_wait 30

# Get Queue Position
ZRANK queue:event:123 user:456

# Dequeue Batch (100 users)
ZPOPMIN queue:event:123 100

# Check Queue Size
ZCARD queue:event:123

# Remove User (abandoned)
ZREM queue:event:123 user:456
DEL session:user:456
```

## Seat Reservation System

### Optimistic Locking Implementation
```sql
-- Attempt to Reserve Seat
UPDATE seats
SET 
    status = 'RESERVED',
    version = version + 1,
    reserved_at = CURRENT_TIMESTAMP,
    reserved_by = :user_id,
    reservation_expires_at = CURRENT_TIMESTAMP + INTERVAL '10 minutes'
WHERE 
    seat_id = :seat_id
    AND event_id = :event_id
    AND status = 'AVAILABLE'
    AND version = :expected_version
RETURNING seat_id, version;

-- If affected_rows = 0, seat was taken by someone else
-- If affected_rows = 1, reservation successful
```

### Reservation Expiry Job
```sql
-- Find Expired Reservations
SELECT seat_id, event_id, reserved_by
FROM seats
WHERE status = 'RESERVED'
AND reservation_expires_at < CURRENT_TIMESTAMP
LIMIT 1000;

-- Release Expired Reservations
UPDATE seats
SET 
    status = 'AVAILABLE',
    reserved_at = NULL,
    reserved_by = NULL,
    reservation_expires_at = NULL
WHERE seat_id IN (:expired_seat_ids);

-- Notify Users in Queue
-- (Trigger event to Queue Service)
```

## Sharding Strategy

### Event-Based Sharding
```
Shard Key: event_id
Shard Count: 10,000 shards

Shard Assignment:
shard_id = hash(event_id) % 10000

Distribution:
- Popular events (Taylor Swift): Dedicated shard
- Regular events: 10-20 events per shard
- Small events: 50-100 events per shard

Benefits:
- All seats for an event on same shard
- No distributed transactions
- Easy to scale hot events
- Isolated failure domains
```

### Shard Rebalancing
```
When to Rebalance:
- New major event announced
- Shard becomes hot (>80% CPU)
- Uneven distribution detected

Process:
1. Identify hot shard
2. Create new dedicated shard
3. Migrate event data
4. Update routing table
5. Redirect traffic
6. Verify and cleanup
```

## Caching Strategy

### Redis Cache Layers
```
# Event Details Cache
SET event:{event_id} {json_data}
EXPIRE event:{event_id} 300  # 5 minutes

# Seat Availability Summary
HSET availability:event:{event_id}
    total_seats 50000
    available_seats 12000
    last_updated {timestamp}
EXPIRE availability:event:{event_id} 30  # 30 seconds

# User Session Cache
SET session:{session_id} {user_data}
EXPIRE session:{session_id} 3600  # 1 hour

# Hot Events List
ZADD hot:events {score} {event_id}
EXPIRE hot:events 60  # 1 minute
```

### Cache Invalidation
```
Event Update:
1. Update database
2. Delete cache key: DEL event:{event_id}
3. Publish invalidation event
4. All app servers clear local cache

Seat Purchase:
1. Update database (seat status)
2. Decrement availability counter
3. Update cache: HINCRBY availability:event:{event_id} available_seats -1
4. Broadcast to WebSocket clients
```

## Search Index (Elasticsearch)

### Event Search Index
```json
{
  "mappings": {
    "properties": {
      "event_id": {"type": "keyword"},
      "name": {"type": "text", "analyzer": "standard"},
      "description": {"type": "text"},
      "artist": {"type": "text"},
      "venue_name": {"type": "text"},
      "city": {"type": "keyword"},
      "category": {"type": "keyword"},
      "event_date": {"type": "date"},
      "on_sale_date": {"type": "date"},
      "price_range": {
        "type": "nested",
        "properties": {
          "min": {"type": "float"},
          "max": {"type": "float"}
        }
      },
      "available_seats": {"type": "integer"},
      "status": {"type": "keyword"}
    }
  }
}
```

### Search Queries
```
# Search by Artist
GET /events/_search
{
  "query": {
    "match": {
      "artist": "Taylor Swift"
    }
  },
  "filter": {
    "term": {"status": "ON_SALE"}
  },
  "sort": [{"event_date": "asc"}]
}

# Search by Location and Date
GET /events/_search
{
  "query": {
    "bool": {
      "must": [
        {"term": {"city": "New York"}},
        {"range": {"event_date": {"gte": "2026-06-01", "lte": "2026-12-31"}}}
      ]
    }
  }
}
```

## Data Retention and Archival

### Retention Policies
```
Active Events (Upcoming): Keep in hot storage
Completed Events (<1 year): Keep in warm storage
Historical Events (>1 year): Archive to cold storage
User Data: Keep indefinitely (GDPR compliance)
Order History: Keep for 7 years (legal requirement)
```

### Archival Process
```sql
-- Move Completed Events to Archive
INSERT INTO events_archive
SELECT * FROM events
WHERE status = 'COMPLETED'
AND event_date < CURRENT_DATE - INTERVAL '1 year';

-- Delete from Active Table
DELETE FROM events
WHERE event_id IN (SELECT event_id FROM events_archive);

-- Archive Seats
INSERT INTO seats_archive
SELECT * FROM seats
WHERE event_id IN (SELECT event_id FROM events_archive);

DELETE FROM seats
WHERE event_id IN (SELECT event_id FROM events_archive);
```

This database design ensures high concurrency, prevents double-booking through optimistic locking, and scales to handle millions of concurrent users during major ticket sales.
