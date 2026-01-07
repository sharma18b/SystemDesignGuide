# Food Delivery - Scale and Constraints

**Reading Time**: 20 minutes

## Scale Requirements

### User Scale
- **Customers**: 10 million registered users
- **Active Customers**: 3 million monthly active users (MAU)
- **Daily Active Customers**: 1 million DAU
- **Restaurants**: 100,000 active restaurants
- **Drivers**: 1 million registered drivers
- **Active Drivers**: 200,000 daily active drivers

### Order Volume
- **Daily Orders**: 5 million orders/day
- **Peak Orders**: 2,000 orders/second (lunch/dinner rush)
- **Average Orders**: 58 orders/second
- **Order Value**: Average $30 per order
- **Daily GMV**: $150 million/day

### Geographic Distribution
- **Cities**: 500+ cities
- **Countries**: 10 countries
- **Regions**: North America, Europe, Asia
- **Coverage Area**: Urban and suburban areas
- **Data Centers**: 6 regions

## Performance Constraints

### Latency Requirements

#### Restaurant Search
```
Target: P95 < 500ms

Breakdown:
- API Gateway: 20ms
- Search Service: 200ms
- Elasticsearch query: 150ms
- Result ranking: 80ms
- Response serialization: 50ms
Total: ~500ms
```

#### Order Placement
```
Target: P95 < 2 seconds

Breakdown:
- Validation: 100ms
- Inventory check: 200ms
- Payment authorization: 800ms
- Order creation: 200ms
- Driver matching: 500ms
- Notification: 100ms
Total: ~1900ms
```

#### Driver Assignment
```
Target: P95 < 30 seconds

Breakdown:
- Find nearby drivers: 500ms
- Calculate ETAs: 1000ms
- Rank drivers: 500ms
- Send notifications: 2000ms
- Wait for acceptance: 25 seconds
- Retry if declined: 1 second
Total: ~30 seconds
```

#### Location Updates
```
Target: Every 5-10 seconds

Driver App:
- GPS reading: 1 second
- Network upload: 500ms
- Server processing: 100ms
- Database write: 200ms
- Customer notification: 200ms
Total: ~2 seconds per update
```

#### ETA Calculation
```
Target: P95 < 1 second

Breakdown:
- Fetch driver location: 50ms
- Fetch restaurant location: 50ms
- Calculate route: 400ms
- Traffic data lookup: 200ms
- Preparation time estimate: 100ms
- ETA computation: 100ms
Total: ~900ms
```

### Throughput Requirements

#### API Endpoints
- **Search**: 10,000 requests/second
- **Order Placement**: 2,000 requests/second
- **Location Updates**: 40,000 updates/second (200K drivers × 1 update/5s)
- **Order Tracking**: 50,000 requests/second
- **Menu Fetch**: 5,000 requests/second

#### Database Operations
- **Writes**: 50,000 writes/second (orders, locations, status updates)
- **Reads**: 200,000 reads/second (search, tracking, menus)
- **Location Queries**: 40,000 queries/second (geospatial)

## Availability Constraints

### Uptime Requirements
```
SLA: 99.9% availability
- Allowed downtime: 8.7 hours/year
- Monthly downtime: 43.8 minutes/month
- Daily downtime: 1.44 minutes/day

Critical Services (99.95%):
- Order placement
- Payment processing
- Driver assignment

Non-Critical Services (99.5%):
- Analytics
- Reporting
- Historical data
```

### Disaster Recovery
- **RTO (Recovery Time Objective)**: 2 hours
- **RPO (Recovery Point Objective)**: 15 minutes
- **Backup Frequency**: Continuous replication
- **Multi-Region**: Active-passive (cost optimization)
- **Failover Time**: < 5 minutes automatic

### Peak Hour Handling
```
Peak Hours:
- Lunch: 11:30 AM - 1:30 PM (3x traffic)
- Dinner: 6:00 PM - 9:00 PM (4x traffic)
- Weekends: 20% higher than weekdays

Capacity Planning:
- Normal: 58 orders/second
- Lunch Peak: 174 orders/second (3x)
- Dinner Peak: 232 orders/second (4x)
- Design for: 500 orders/second (8x buffer)
```

## Data Constraints

### Storage Requirements

#### Hot Storage (Fast Access)
```
Active Orders (24 hours):
- Volume: 5 million orders/day
- Size: ~50 GB/day
- Database: PostgreSQL with SSD
- Retention: 24 hours in hot storage

Driver Locations (Real-time):
- Volume: 200K active drivers
- Updates: Every 5 seconds
- Size: ~100 GB/day (time-series)
- Database: InfluxDB or TimescaleDB
- Retention: 7 days
```

#### Warm Storage (Moderate Access)
```
Recent Orders (30 days):
- Volume: 150 million orders
- Size: ~1.5 TB
- Database: Partitioned PostgreSQL
- Retention: 30 days

Historical Locations:
- Volume: Driver routes
- Size: ~3 TB/month
- Database: Time-series DB
- Retention: 90 days
```

#### Cold Storage (Archive)
```
Old Orders (1+ year):
- Volume: 1.8 billion orders/year
- Size: ~18 TB/year
- Storage: S3 Glacier
- Retention: 7 years (compliance)

Analytics Data:
- Volume: Aggregated metrics
- Size: ~5 TB/year
- Storage: Data warehouse (Redshift)
- Retention: Indefinite
```

### Data Retention
```
Orders: 7 years (tax/legal)
Locations: 90 days (privacy)
User Profiles: Until account deletion + 30 days
Restaurant Menus: Until restaurant inactive + 1 year
Driver Data: Until driver inactive + 2 years
Analytics: Indefinite (anonymized)
```

## Network Constraints

### Bandwidth Requirements
```
Peak Traffic:
- Inbound: 100 Gbps
- Outbound: 200 Gbps
- Location Updates: 50 Gbps

Per Order:
- Order placement: ~10 KB
- Location update: ~1 KB
- Order tracking: ~5 KB

Daily Bandwidth:
- Orders: 5M × 10 KB = 50 GB
- Locations: 200K × 17,280 updates × 1 KB = 3.5 TB
- Tracking: 5M × 5 KB × 10 checks = 250 GB
Total: ~3.8 TB/day
```

### API Rate Limits
```
Per User:
- Search: 100 requests/minute
- Order placement: 5 orders/hour
- Tracking: 60 requests/minute

Per Restaurant:
- Menu updates: 100 updates/hour
- Order status: 1000 updates/hour

Per Driver:
- Location updates: 12 updates/minute
- Order acceptance: 10 requests/minute
```

## Geospatial Constraints

### Location Accuracy
```
GPS Accuracy:
- Urban: ±5 meters
- Suburban: ±10 meters
- Indoor: ±20 meters (degraded)

Update Frequency:
- Moving: Every 5 seconds
- Stationary: Every 30 seconds
- Battery optimization: Adaptive frequency
```

### Geospatial Queries
```
Driver Search:
- Radius: 5 km from restaurant
- Max results: 50 drivers
- Query time: < 100ms
- Index: Geohash or R-tree

Restaurant Search:
- Radius: 10 km from customer
- Max results: 100 restaurants
- Query time: < 200ms
- Index: Geospatial index
```

## Cost Constraints

### Infrastructure Costs (Monthly)
```
Compute:
- Application Servers: $80,000
- Database Servers: $120,000
- Cache Servers: $30,000
- Load Balancers: $15,000
Total Compute: $245,000/month

Storage:
- Hot Storage (SSD): $40,000
- Warm Storage (HDD): $20,000
- Cold Storage (S3): $10,000
- Time-Series DB: $25,000
Total Storage: $95,000/month

Network:
- Data Transfer: $60,000
- CDN: $25,000
- SMS/Push: $30,000
Total Network: $115,000/month

Third-Party:
- Maps API: $50,000
- Payment Processing: $150,000
- SMS Gateway: $20,000
Total Third-Party: $220,000/month

Grand Total: ~$675,000/month
```

### Cost Per Order
```
Infrastructure: $0.05
Maps API: $0.02
Payment Processing: $0.30 (1% of $30)
SMS/Push: $0.01
Total: ~$0.38 per order

Revenue Model:
- Commission: 20-30% of order value
- Delivery fee: $3-5 per order
- Average order: $30
- Platform revenue: $9-12 per order
- Profit margin: $8-11 per order
```

## Scalability Constraints

### Horizontal Scaling Limits
```
Application Tier:
- Max instances: 2000 pods
- Auto-scale trigger: 70% CPU
- Scale-up time: 3 minutes
- Scale-down time: 10 minutes

Database Tier:
- Read replicas: 10 per primary
- Sharding: By city/region (500 shards)
- Connection pool: 100 per instance
- Max connections: 20,000 total

Cache Tier:
- Redis cluster: 20 nodes
- Memory per node: 64 GB
- Total cache: 1.28 TB
- Eviction: LRU policy
```

### Vertical Scaling Limits
```
Database Servers:
- Max CPU: 96 cores
- Max RAM: 768 GB
- Max IOPS: 200,000
- Max Storage: 64 TB

Application Servers:
- Max CPU: 16 cores
- Max RAM: 64 GB
- Typical: 8 cores, 32 GB
```

## Monitoring Constraints

### Metrics Collection
```
Frequency:
- System metrics: Every 10 seconds
- Application metrics: Every 30 seconds
- Business metrics: Every 1 minute
- Location data: Every 5 seconds

Retention:
- Raw metrics: 7 days
- Aggregated (1-min): 30 days
- Aggregated (1-hour): 1 year
- Logs: 30 days (hot), 1 year (cold)
```

### Alerting Thresholds
```
Critical (Page Immediately):
- Order placement failure > 1%
- Driver assignment failure > 5%
- API error rate > 2%
- Database CPU > 90%
- Location update lag > 30 seconds

Warning (Notify Team):
- Order placement failure > 0.5%
- Driver assignment failure > 2%
- API error rate > 1%
- Database CPU > 80%
- Location update lag > 15 seconds
```

## Interview Discussion Points

**Q: How handle 5 million orders per day?**
```
Answer Framework:
1. Sharding: By city/region (500 shards)
2. Caching: Redis for hot data (menus, locations)
3. Read replicas: 10 replicas per shard
4. Queue-based: Async processing for non-critical
5. Auto-scaling: Scale to 2000 instances at peak
6. CDN: Offload static content (images, menus)
```

**Q: How ensure 99.9% availability?**
```
Answer Framework:
1. Multi-region: Active-passive deployment
2. Redundancy: No single point of failure
3. Health checks: Automatic failover
4. Circuit breakers: Prevent cascade failures
5. Graceful degradation: Core features always work
6. Load shedding: Drop non-critical requests at peak
```

**Q: How handle real-time location updates?**
```
Answer Framework:
1. Time-series database: InfluxDB or TimescaleDB
2. Geospatial indexing: PostGIS or Redis Geo
3. WebSocket connections: For real-time push
4. Batch processing: Group updates every 5 seconds
5. Compression: Reduce bandwidth usage
6. Adaptive frequency: Based on battery and movement
```

---
*Estimated Reading Time: 20 minutes*
