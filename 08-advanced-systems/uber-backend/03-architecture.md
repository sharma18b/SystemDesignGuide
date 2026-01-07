# Uber Backend - System Architecture

## High-Level Architecture Overview

### System Architecture Principles
- **Microservices Architecture**: 2,000+ independent services
- **Event-Driven Design**: Async communication via message queues
- **Geographic Sharding**: Data partitioned by city/region
- **Multi-Region Deployment**: Active-active across 10+ regions
- **Real-time First**: Optimized for sub-second latency
- **Fault Tolerance**: Graceful degradation and automatic recovery

### Core Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Rider Apps   │  │ Driver Apps  │  │  Web Portal  │         │
│  │ (iOS/Android)│  │ (iOS/Android)│  │   (Browser)  │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                            │
          ┌─────────────────┴─────────────────┐
          │      Global Load Balancer         │
          │    (GeoDNS + Anycast Routing)     │
          └─────────────────┬─────────────────┘
                            │
          ┌─────────────────┴─────────────────┐
          │         API Gateway               │
          │  (Auth, Rate Limit, Routing)      │
          └─────────────────┬─────────────────┘
                            │
    ┌───────────────────────┼───────────────────────┐
    │                       │                       │
┌───┴────────┐    ┌─────────┴─────────┐    ┌───────┴────────┐
│  Matching  │    │   Location        │    │   Payment      │
│  Service   │    │   Service         │    │   Service      │
└───┬────────┘    └─────────┬─────────┘    └───────┬────────┘
    │                       │                       │
    └───────────────────────┼───────────────────────┘
                            │
          ┌─────────────────┴─────────────────┐
          │      Message Queue (Kafka)        │
          │    (Event Streaming Platform)     │
          └─────────────────┬─────────────────┘
                            │
    ┌───────────────────────┼───────────────────────┐
    │                       │                       │
┌───┴────────┐    ┌─────────┴─────────┐    ┌───────┴────────┐
│   Trip     │    │   Notification    │    │   Analytics    │
│  Service   │    │   Service         │    │   Service      │
└───┬────────┘    └─────────┬─────────┘    └───────┬────────┘
    │                       │                       │
    └───────────────────────┼───────────────────────┘
                            │
          ┌─────────────────┴─────────────────┐
          │         Data Layer                │
          │  ┌──────────┐  ┌──────────┐      │
          │  │PostgreSQL│  │  Redis   │      │
          │  │ Clusters │  │ Clusters │      │
          │  └──────────┘  └──────────┘      │
          └───────────────────────────────────┘
```

## Core Service Architecture

### 1. Matching Service (DISCO - Dispatch Optimization)
```
┌─────────────────────────────────────────────────────────────┐
│                    Matching Service                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Request    │  │   Driver     │  │   Matching   │     │
│  │   Handler    │  │   Finder     │  │   Algorithm  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │             │
│         ▼                  ▼                  ▼             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Validation  │  │  Geospatial  │  │   Scoring    │     │
│  │   & Queue    │  │    Index     │  │   Engine     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Responsibilities**:
- Receive ride requests from riders
- Query geospatial index for nearby available drivers
- Score and rank drivers based on multiple factors
- Send ride offers to selected drivers
- Handle driver acceptance/rejection
- Retry matching if initial attempts fail
- Optimize for ETA, driver earnings, and rider experience

**Matching Algorithm**:
```
1. Receive ride request (pickup, dropoff, ride type)
2. Determine search radius (start 0.5 miles, expand to 5 miles)
3. Query geospatial index for drivers in radius
4. Filter drivers:
   - Available status
   - Correct vehicle type
   - Minimum rating threshold
   - Not recently rejected by rider
5. Score each driver:
   - Distance to pickup (40% weight)
   - Driver rating (20% weight)
   - Acceptance rate (15% weight)
   - Driver earnings balance (15% weight)
   - Time since last trip (10% weight)
6. Rank drivers by score
7. Send offer to top 3 drivers simultaneously
8. First to accept gets the trip
9. If no acceptance in 15 seconds, expand search and retry
```

**Geospatial Indexing**:
- **Technology**: S2 Geometry library for spatial indexing
- **Cell Levels**: Level 13 cells (~1km²) for driver indexing
- **Update Frequency**: Real-time updates as drivers move
- **Query Performance**: O(log n) for nearby driver queries
- **Sharding**: Partition by city/region for horizontal scaling

### 2. Location Service (Real-time GPS Tracking)
```
┌─────────────────────────────────────────────────────────────┐
│                    Location Service                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   GPS Data   │  │   Location   │  │     ETA      │     │
│  │   Ingestion  │  │   Storage    │  │  Calculator  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │             │
│         ▼                  ▼                  ▼             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Kafka      │  │  Geospatial  │  │   Routing    │     │
│  │   Stream     │  │   Database   │  │   Engine     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Responsibilities**:
- Ingest 750K GPS updates per second from driver apps
- Store real-time driver locations in geospatial index
- Calculate ETAs using traffic data and routing algorithms
- Provide location history for trip reconstruction
- Detect geofence events (arrival at pickup/dropoff)
- Monitor driver movement patterns for fraud detection

**GPS Data Pipeline**:
```
Driver App → Load Balancer → Location API → Kafka Topic
                                                  ↓
                                          Stream Processor
                                                  ↓
                                    ┌─────────────┴─────────────┐
                                    ↓                           ↓
                            Geospatial Index              Time-Series DB
                            (Real-time queries)           (Historical data)
```

**ETA Calculation**:
- **Routing Engine**: Google Maps API / Mapbox / Internal routing
- **Traffic Data**: Real-time traffic conditions from multiple sources
- **Historical Patterns**: ML models trained on historical trip data
- **Dynamic Updates**: Recalculate ETA every 30 seconds during trip
- **Accuracy Target**: Within 2 minutes 90% of the time

### 3. Payment Service
```
┌─────────────────────────────────────────────────────────────┐
│                    Payment Service                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Payment    │  │    Fraud     │  │   Billing    │     │
│  │  Processing  │  │  Detection   │  │   Engine     │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │             │
│         ▼                  ▼                  ▼             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Stripe/    │  │   ML Fraud   │  │   Invoice    │     │
│  │   Braintree  │  │   Models     │  │  Generator   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Responsibilities**:
- Process 1,800 payment transactions per second at peak
- Support multiple payment methods (cards, wallets, cash)
- Calculate trip fares with surge pricing
- Handle split payments and promotions
- Detect and prevent fraudulent transactions
- Generate invoices and receipts
- Process driver payouts

**Payment Flow**:
```
1. Trip Completion Event
2. Calculate Fare:
   - Base fare + (distance × per-mile rate) + (time × per-minute rate)
   - Apply surge multiplier
   - Apply promotions/discounts
   - Calculate taxes and fees
3. Fraud Check:
   - Verify payment method validity
   - Check user fraud score
   - Validate trip legitimacy
4. Process Payment:
   - Authorize payment method
   - Capture funds
   - Handle payment failures with retry logic
5. Distribute Funds:
   - Rider charged
   - Driver credited (minus Uber commission)
   - Generate receipt
6. Async Processing:
   - Update analytics
   - Trigger notifications
   - Archive transaction
```

### 4. Trip Service (Ride Lifecycle Management)
```
┌─────────────────────────────────────────────────────────────┐
│                      Trip Service                           │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │     Trip     │  │    State     │  │   History    │     │
│  │  Management  │  │   Machine    │  │   Storage    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │             │
│         ▼                  ▼                  ▼             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Trip DB    │  │   Event      │  │   Analytics  │     │
│  │   (Sharded)  │  │   Stream     │  │   Pipeline   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Trip State Machine**:
```
REQUESTED → MATCHED → ACCEPTED → ARRIVING → ARRIVED → 
STARTED → IN_PROGRESS → COMPLETED → PAID

Cancellation States:
REQUESTED → CANCELLED_BY_RIDER
MATCHED → CANCELLED_BY_DRIVER
ACCEPTED → CANCELLED_BY_RIDER (with fee)
ARRIVING → CANCELLED_BY_DRIVER (with penalty)
```

**Trip Data Model**:
```json
{
  "trip_id": "uuid",
  "rider_id": "uuid",
  "driver_id": "uuid",
  "status": "IN_PROGRESS",
  "ride_type": "UBER_X",
  "pickup": {
    "lat": 37.7749,
    "lng": -122.4194,
    "address": "123 Market St, SF",
    "timestamp": "2026-01-08T10:00:00Z"
  },
  "dropoff": {
    "lat": 37.7849,
    "lng": -122.4094,
    "address": "456 Mission St, SF",
    "timestamp": "2026-01-08T10:20:00Z"
  },
  "fare": {
    "base_fare": 2.50,
    "distance_fare": 8.00,
    "time_fare": 3.50,
    "surge_multiplier": 1.5,
    "total": 21.00,
    "currency": "USD"
  },
  "route": {
    "distance_miles": 4.2,
    "duration_minutes": 18,
    "gps_trail": [...]
  },
  "created_at": "2026-01-08T09:55:00Z",
  "updated_at": "2026-01-08T10:20:00Z"
}
```

### 5. Surge Pricing Service (Dynamic Pricing)
```
┌─────────────────────────────────────────────────────────────┐
│                  Surge Pricing Service                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Supply/    │  │   Surge      │  │   Price      │     │
│  │   Demand     │  │  Calculator  │  │  Optimizer   │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │             │
│         ▼                  ▼                  ▼             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Heat Map   │  │   ML Price   │  │   Cache      │     │
│  │   Generator  │  │   Models     │  │   Layer      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Surge Calculation Algorithm**:
```
1. Divide city into hexagonal grid cells (H3 geospatial index)
2. For each cell, calculate:
   - Active ride requests (demand)
   - Available drivers (supply)
   - Supply/Demand ratio
3. Determine surge multiplier:
   - Ratio > 2.0: No surge (1.0x)
   - Ratio 1.5-2.0: Low surge (1.2x)
   - Ratio 1.0-1.5: Medium surge (1.5x)
   - Ratio 0.5-1.0: High surge (2.0x)
   - Ratio < 0.5: Extreme surge (3.0x-5.0x)
4. Apply smoothing:
   - Gradual changes to avoid price shocks
   - Neighboring cell influence
   - Time-based decay
5. Update surge map every 1-2 minutes
6. Cache surge values for fast lookups
```

**ML-Based Price Optimization**:
- **Features**: Time of day, day of week, weather, events, historical patterns
- **Model**: Gradient boosting for demand prediction
- **Training**: Continuous learning from trip data
- **Objective**: Maximize rider acceptance rate while balancing supply

## Data Architecture

### Database Sharding Strategy
```
┌─────────────────────────────────────────────────────────────┐
│                  Database Sharding                          │
├─────────────────────────────────────────────────────────────┤
│  Geographic Sharding (Primary Strategy)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   US-West    │  │   US-East    │  │   Europe     │     │
│  │   Shard      │  │   Shard      │  │   Shard      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│  User ID Sharding (Secondary Strategy)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Shard 0-99  │  │ Shard 100-199│  │ Shard 200-299│     │
│  │  (User IDs)  │  │  (User IDs)  │  │  (User IDs)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Sharding Keys**:
- **Trips**: Shard by city_id (geographic locality)
- **Users**: Shard by user_id hash (even distribution)
- **Drivers**: Shard by home_city_id (driver's primary city)
- **Payments**: Shard by transaction_id (time-based UUID)

### Caching Strategy
```
┌─────────────────────────────────────────────────────────────┐
│                    Cache Architecture                       │
├─────────────────────────────────────────────────────────────┤
│  L1 Cache (Application Memory)                              │
│  - Driver locations (5-second TTL)                          │
│  - Surge pricing (60-second TTL)                            │
│  - User sessions (30-minute TTL)                            │
│                                                             │
│  L2 Cache (Redis Cluster)                                   │
│  - User profiles (1-hour TTL)                               │
│  - Driver profiles (1-hour TTL)                             │
│  - Trip history (5-minute TTL)                              │
│  - Payment methods (10-minute TTL)                          │
│                                                             │
│  L3 Cache (CDN)                                             │
│  - Static assets (24-hour TTL)                              │
│  - Map tiles (7-day TTL)                                    │
│  - Profile images (1-day TTL)                               │
└─────────────────────────────────────────────────────────────┘
```

## Event-Driven Architecture

### Event Streaming with Kafka
```
┌─────────────────────────────────────────────────────────────┐
│                    Kafka Topics                             │
├─────────────────────────────────────────────────────────────┤
│  trip-events          : Trip lifecycle events               │
│  location-updates     : GPS location updates                │
│  payment-events       : Payment transactions                │
│  driver-status-events : Driver availability changes         │
│  surge-updates        : Surge pricing changes               │
│  notification-events  : Push notification triggers          │
│  analytics-events     : User behavior and metrics           │
└─────────────────────────────────────────────────────────────┘
```

**Event Flow Example (Trip Completion)**:
```
1. Driver marks trip as completed
2. Trip Service publishes "trip.completed" event to Kafka
3. Multiple consumers process event:
   - Payment Service: Calculate and charge fare
   - Notification Service: Send receipt to rider
   - Analytics Service: Update metrics and ML models
   - Rating Service: Prompt rider/driver to rate each other
   - Earnings Service: Update driver earnings
   - Fraud Service: Analyze trip for anomalies
4. Each service publishes its own events
5. Eventual consistency achieved across all services
```

## Multi-Region Architecture

### Active-Active Deployment
```
┌─────────────────────────────────────────────────────────────┐
│                  Global Architecture                        │
├─────────────────────────────────────────────────────────────┤
│  Region: US-West (Primary)                                  │
│  - Serves: California, Nevada, Oregon, Washington          │
│  - Data Centers: San Francisco, Los Angeles, Seattle       │
│                                                             │
│  Region: US-East (Primary)                                  │
│  - Serves: New York, Boston, DC, Florida                   │
│  - Data Centers: Virginia, New York, Atlanta               │
│                                                             │
│  Region: Europe (Primary)                                   │
│  - Serves: UK, France, Germany, Netherlands                │
│  - Data Centers: London, Amsterdam, Frankfurt              │
│                                                             │
│  Region: Asia-Pacific (Primary)                             │
│  - Serves: India, Singapore, Australia, Japan              │
│  - Data Centers: Mumbai, Singapore, Sydney, Tokyo          │
└─────────────────────────────────────────────────────────────┘
```

**Cross-Region Replication**:
- **User Data**: Async replication with 5-minute lag
- **Trip Data**: Replicated to backup region only
- **Payment Data**: Sync replication for compliance
- **Analytics Data**: Async replication with 1-hour lag

This architecture enables Uber to handle millions of concurrent rides globally while maintaining sub-second response times and high reliability through geographic distribution, microservices, and event-driven design.
