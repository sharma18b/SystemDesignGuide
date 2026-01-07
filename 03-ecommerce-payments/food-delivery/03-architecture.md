# Food Delivery - Architecture

**Reading Time**: 20 minutes

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                            │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ Customer App │Restaurant App│  Driver App  │   Web Portal   │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬─────────┘
       │              │              │              │
       └──────────────┴──────────────┴──────────────┘
                      │
       ┌──────────────▼──────────────┐
       │   API Gateway (Kong)         │
       │  - Rate Limiting             │
       │  - Authentication            │
       │  - Request Routing           │
       └──────────────┬──────────────┘
                      │
       ┌──────────────┴──────────────────────────────────┐
       │                                                  │
┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐  ┌───▼────────┐
│  Restaurant │  │   Order     │  │   Driver    │  │  Customer  │
│   Service   │  │  Service    │  │  Service    │  │  Service   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───┬────────┘
       │                │                │              │
┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐  ┌───▼────────┐
│   Search    │  │  Matching   │  │  Location   │  │  Payment   │
│   Service   │  │  Service    │  │  Service    │  │  Service   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───┬────────┘
       │                │                │              │
┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐  ┌───▼────────┐
│     ETA     │  │Notification │  │  Analytics  │  │   Pricing  │
│   Service   │  │  Service    │  │  Service    │  │  Service   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───┬────────┘
       │                │                │              │
       └────────────────┴────────────────┴──────────────┘
                      │
       ┌──────────────▼──────────────────────────────────┐
       │           Event Bus (Kafka)                      │
       └──────────────┬──────────────────────────────────┘
                      │
       ┌──────────────┴──────────────────────────────────┐
       │                                                  │
┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐  ┌───▼────────┐
│  PostgreSQL │  │    Redis    │  │  InfluxDB   │  │Elasticsearch│
│  (Orders)   │  │   (Cache)   │  │ (Locations) │  │  (Search)   │
└─────────────┘  └─────────────┘  └─────────────┘  └────────────┘
```

## Core Services

### 1. Restaurant Service
**Responsibility**: Restaurant and menu management

```
Components:
├── Restaurant Management
│   ├── Registration and onboarding
│   ├── Profile management
│   └── Operating hours
├── Menu Management
│   ├── Item CRUD operations
│   ├── Pricing and availability
│   └── Categories and modifiers
└── Inventory Management
    ├── Stock tracking
    └── Out-of-stock notifications

Database Schema:
- restaurants (id, name, address, cuisine, rating)
- menu_items (id, restaurant_id, name, price, available)
- operating_hours (id, restaurant_id, day, open_time, close_time)
```

### 2. Order Service
**Responsibility**: Order lifecycle management

```
Components:
├── Order Creation
│   ├── Cart validation
│   ├── Price calculation
│   └── Order placement
├── Order State Machine
│   ├── Placed → Confirmed → Preparing
│   ├── Ready → Picked Up → Delivered
│   └── Cancelled (any state)
├── Order Tracking
│   ├── Status updates
│   └── Real-time notifications
└── Order History
    └── Past orders query

Database Schema:
- orders (id, customer_id, restaurant_id, driver_id, status, total)
- order_items (id, order_id, item_id, quantity, price)
- order_status_history (id, order_id, status, timestamp)
```

### 3. Driver Service
**Responsibility**: Driver management and availability

```
Components:
├── Driver Management
│   ├── Registration and verification
│   ├── Profile management
│   └── Document verification
├── Availability Management
│   ├── Online/offline status
│   ├── Shift scheduling
│   └── Break management
├── Earnings Tracking
│   ├── Delivery earnings
│   ├── Tips and bonuses
│   └── Payout management
└── Performance Metrics
    ├── Acceptance rate
    ├── Completion rate
    └── Average rating

Database Schema:
- drivers (id, name, phone, vehicle_type, status, rating)
- driver_availability (id, driver_id, is_online, last_active)
- driver_earnings (id, driver_id, order_id, amount, tips)
```

### 4. Matching Service
**Responsibility**: Assign drivers to orders

```
Components:
├── Driver Discovery
│   ├── Geospatial query (nearby drivers)
│   ├── Availability check
│   └── Capacity check (multi-order)
├── Ranking Algorithm
│   ├── Distance to restaurant
│   ├── Estimated pickup time
│   ├── Driver rating
│   ├── Acceptance rate
│   └── Current load
├── Assignment Logic
│   ├── Send notification to top driver
│   ├── Wait for acceptance (30 seconds)
│   ├── Retry with next driver
│   └── Escalate if no acceptance
└── Batch Optimization
    ├── Multi-order assignments
    └── Route optimization

Algorithm:
score = w1 * (1/distance) + w2 * rating + w3 * acceptance_rate
Select driver with highest score
```

### 5. Location Service
**Responsibility**: Real-time location tracking

```
Components:
├── Location Ingestion
│   ├── Receive GPS updates
│   ├── Validate coordinates
│   └── Store in time-series DB
├── Location Query
│   ├── Current location
│   ├── Location history
│   └── Geospatial search
├── Geofencing
│   ├── Restaurant arrival detection
│   ├── Customer arrival detection
│   └── Zone-based notifications
└── Location Streaming
    ├── WebSocket connections
    └── Real-time push to customers

Technology:
- Database: InfluxDB or TimescaleDB
- Geospatial: PostGIS or Redis Geo
- Streaming: WebSocket or Server-Sent Events
```

### 6. ETA Service
**Responsibility**: Delivery time estimation

```
Components:
├── Preparation Time Estimation
│   ├── Historical data (restaurant)
│   ├── Order complexity
│   └── Current load
├── Travel Time Estimation
│   ├── Distance calculation
│   ├── Traffic data (Google Maps API)
│   ├── Driver speed profile
│   └── Route optimization
├── ETA Calculation
│   ├── Pickup ETA (driver → restaurant)
│   ├── Delivery ETA (restaurant → customer)
│   └── Total ETA (order → delivery)
└── ETA Updates
    ├── Recalculate on status change
    └── Push updates to customer

Formula:
ETA = prep_time + pickup_travel_time + delivery_travel_time
    + buffer (10% for uncertainty)
```

### 7. Search Service
**Responsibility**: Restaurant discovery

```
Components:
├── Indexing
│   ├── Restaurant data sync
│   ├── Menu item indexing
│   └── Real-time updates
├── Search Query
│   ├── Text search (name, cuisine)
│   ├── Geospatial filter (distance)
│   ├── Faceted search (cuisine, rating, price)
│   └── Autocomplete
├── Ranking
│   ├── Relevance score
│   ├── Distance weight
│   ├── Rating weight
│   ├── Popularity weight
│   └── Personalization
└── Caching
    ├── Popular searches
    └── User-specific results

Technology:
- Elasticsearch for full-text search
- Redis for caching
- Personalization engine (ML)
```

### 8. Pricing Service
**Responsibility**: Dynamic pricing and fees

```
Components:
├── Base Price Calculation
│   ├── Distance-based fee
│   ├── Time-based fee
│   └── Service fee
├── Dynamic Pricing
│   ├── Demand surge (orders/area)
│   ├── Supply shortage (drivers/area)
│   ├── Weather conditions
│   └── Special events
├── Discounts and Promos
│   ├── Promo code validation
│   ├── Discount calculation
│   └── First-time user offers
└── Commission Calculation
    ├── Restaurant commission
    ├── Driver payout
    └── Platform revenue

Formula:
delivery_fee = base_fee + distance_fee + surge_multiplier
surge_multiplier = 1.0 + (demand - supply) / supply
```

## Data Flow Diagrams

### Order Placement Flow

```
Customer → API Gateway → Order Service
                       → Restaurant Service (validate menu)
                       → Pricing Service (calculate total)
                       → Payment Service (authorize)
                       → Order Service (create order)
                       → Matching Service (assign driver)
                       → Notification Service (notify all parties)
                       → Customer (confirmation)

Latency: ~2 seconds
```

### Driver Matching Flow

```
Order Service → Matching Service
              → Location Service (find nearby drivers)
              → Driver Service (check availability)
              → Ranking Algorithm (score drivers)
              → Notification Service (notify top driver)
              → Wait 30 seconds for acceptance
              → If declined, retry with next driver
              → If accepted, update order status
              → Notify customer

Latency: ~30 seconds (including wait time)
```

### Real-Time Tracking Flow

```
Driver App → Location Service (GPS update every 5s)
           → InfluxDB (store location)
           → WebSocket Server (push to customer)
           → Customer App (update map)
           → ETA Service (recalculate ETA)
           → Customer App (update ETA)

Latency: ~2 seconds per update
```

## Technology Stack

### Backend Services
```
Language: Go (high-performance), Python (ML)
Framework: gRPC for inter-service communication
API Gateway: Kong
Service Mesh: Istio
Container: Docker + Kubernetes
```

### Databases
```
Primary: PostgreSQL (orders, users, restaurants)
Cache: Redis (menus, locations, sessions)
Time-Series: InfluxDB (driver locations)
Search: Elasticsearch (restaurant search)
```

### Message Queue
```
Event Streaming: Apache Kafka
Message Queue: Amazon SQS
Pub/Sub: Redis Pub/Sub
```

### Real-Time
```
WebSocket: Socket.io or native WebSocket
Push Notifications: FCM, APNs
SMS: Twilio
```

### Maps and Location
```
Maps API: Google Maps Platform
Geocoding: Google Geocoding API
Routing: Google Directions API
Traffic: Google Traffic API
```

### Monitoring
```
Metrics: Prometheus + Grafana
Logging: ELK Stack
Tracing: Jaeger
APM: Datadog
```

## Deployment Architecture

### Multi-Region Deployment

```
Region 1 (US-East)          Region 2 (US-West)
├── Load Balancer           ├── Load Balancer
├── K8s (200 nodes)         ├── K8s (150 nodes)
├── PostgreSQL (Primary)    ├── PostgreSQL (Replica)
├── Redis Cluster           ├── Redis Cluster
└── InfluxDB                └── InfluxDB

Active-Passive:
- US-East: Primary (70% traffic)
- US-West: Standby (30% traffic)
- Failover: Automatic (< 5 minutes)
```

### Auto-Scaling Configuration

```yaml
HorizontalPodAutoscaler:
  minReplicas: 20
  maxReplicas: 2000
  targetCPU: 70%
  targetMemory: 80%
  scaleUp: 50% per minute
  scaleDown: 10% per minute
  
Custom Metrics:
  - Orders per second
  - Location updates per second
  - Search queries per second
```

## Interview Discussion Points

**Q: Why event-driven architecture?**
```
Reasons:
- Loose coupling between services
- Async processing for non-critical operations
- Event replay for debugging
- Scalability (independent scaling)
- Resilience (service failures don't cascade)
```

**Q: How handle driver matching at scale?**
```
Strategy:
1. Geospatial indexing (Redis Geo or PostGIS)
2. Query nearby drivers (5 km radius)
3. Filter by availability and capacity
4. Rank by distance, rating, acceptance rate
5. Notify top 3 drivers simultaneously
6. First to accept gets the order
7. Timeout and retry if no acceptance
```

**Q: How ensure real-time location accuracy?**
```
Approach:
1. GPS updates every 5 seconds (moving)
2. Adaptive frequency (battery optimization)
3. Time-series database (InfluxDB)
4. Geospatial indexing (fast queries)
5. WebSocket for real-time push
6. Interpolation for smooth tracking
```

---
*Estimated Reading Time: 20 minutes*
