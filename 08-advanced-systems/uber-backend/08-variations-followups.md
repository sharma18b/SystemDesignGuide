# Uber Backend - Variations and Follow-up Questions

## Common Variations

### 1. UberPool (Ride Sharing)
**Problem**: Design ride-sharing where multiple riders share the same vehicle

**Additional Requirements**:
- Match riders going in similar directions
- Calculate optimal pickup/dropoff order
- Dynamic pricing based on detour distance
- Handle rider additions/removals mid-trip
- Split fare calculation

**Key Design Changes**:
```
Matching Algorithm:
1. Find riders with similar routes (within 10-minute detour)
2. Calculate optimal pickup/dropoff sequence
3. Estimate total trip time for each rider
4. Ensure no rider's trip increases by >30%
5. Match up to 3 riders per vehicle

Route Optimization:
- Use traveling salesman problem (TSP) solver
- Consider time windows for each pickup/dropoff
- Recalculate route when new rider added
- Dynamic ETA updates for all riders

Pricing:
- Base fare discount (30-50% off regular price)
- Calculate individual fare based on distance traveled
- Adjust for detour time
- Split savings among all riders
```

**Challenges**:
- NP-hard route optimization problem
- Real-time route recalculation
- Rider experience (longer trips, multiple stops)
- Cancellation handling (affects other riders)

### 2. UberEats (Food Delivery)
**Problem**: Adapt system for restaurant food delivery

**Additional Requirements**:
- Restaurant inventory and menu management
- Order preparation time estimation
- Food quality preservation (time limits)
- Multiple pickup locations (restaurant chains)
- Batch delivery optimization

**Key Design Changes**:
```
New Services:
- Restaurant Service: Menu, inventory, hours
- Order Service: Order management, preparation tracking
- Kitchen Display System: Real-time order updates

Matching Algorithm Changes:
- Consider food preparation time
- Match driver arrival with food ready time
- Optimize for food freshness (<30 minutes total)
- Batch multiple orders from same restaurant

Additional Constraints:
- Maximum delivery time: 30-45 minutes
- Temperature-controlled bags required
- Restaurant pickup confirmation
- Customer delivery confirmation (photo proof)
```

**Database Schema Additions**:
```sql
CREATE TABLE restaurants (
    restaurant_id UUID PRIMARY KEY,
    name VARCHAR(255),
    address TEXT,
    cuisine_type VARCHAR(50),
    rating DECIMAL(3,2),
    preparation_time_avg INTEGER, -- minutes
    is_open BOOLEAN,
    operating_hours JSONB
);

CREATE TABLE menu_items (
    item_id UUID PRIMARY KEY,
    restaurant_id UUID,
    name VARCHAR(255),
    description TEXT,
    price DECIMAL(10,2),
    preparation_time INTEGER,
    is_available BOOLEAN
);

CREATE TABLE orders (
    order_id UUID PRIMARY KEY,
    restaurant_id UUID,
    customer_id UUID,
    driver_id UUID,
    items JSONB,
    subtotal DECIMAL(10,2),
    delivery_fee DECIMAL(10,2),
    total DECIMAL(10,2),
    status VARCHAR(30),
    ordered_at TIMESTAMP,
    ready_at TIMESTAMP,
    delivered_at TIMESTAMP
);
```

### 3. Scheduled Rides
**Problem**: Allow users to schedule rides in advance (up to 30 days)

**Additional Requirements**:
- Reservation system for future rides
- Driver commitment mechanism
- Cancellation policies
- Reminder notifications
- Surge pricing prediction

**Key Design Changes**:
```
Scheduled Ride Flow:
1. User schedules ride for future time
2. System predicts surge pricing
3. Lock in price (with adjustment clause)
4. 30 minutes before: Find and assign driver
5. Driver commits to scheduled ride
6. Send reminders to rider and driver
7. Execute ride at scheduled time

Driver Matching:
- Match 30 minutes before scheduled time
- Consider driver's schedule and location
- Offer incentive for scheduled ride commitment
- Backup matching if driver cancels

Pricing:
- Predict surge based on historical data
- Lock in estimated price
- Allow ±20% adjustment based on actual surge
- Cancellation fees increase closer to scheduled time
```

**Database Schema**:
```sql
CREATE TABLE scheduled_rides (
    scheduled_ride_id UUID PRIMARY KEY,
    rider_id UUID,
    scheduled_time TIMESTAMP,
    pickup_location JSONB,
    dropoff_location JSONB,
    ride_type VARCHAR(20),
    estimated_fare DECIMAL(10,2),
    fare_locked BOOLEAN,
    status VARCHAR(30), -- SCHEDULED, CONFIRMED, CANCELLED, COMPLETED
    driver_id UUID,
    assigned_at TIMESTAMP,
    created_at TIMESTAMP
);
```

### 4. Multi-City Trips
**Problem**: Handle trips that cross city boundaries

**Additional Requirements**:
- Cross-city pricing calculation
- Driver authorization for multiple cities
- Regulatory compliance across jurisdictions
- Currency conversion
- Cross-shard data access

**Key Design Changes**:
```
Cross-City Handling:
1. Detect cross-city trip during request
2. Verify driver has authorization for both cities
3. Calculate fare using both cities' pricing
4. Handle regulatory requirements (permits, insurance)
5. Update driver's active city after trip

Pricing Calculation:
- Split trip into segments by city boundary
- Apply each city's pricing to its segment
- Add cross-city surcharge if applicable
- Handle currency conversion if needed

Data Sharding:
- Trip data stored in origin city shard
- Replicate to destination city shard
- Handle distributed transaction for trip completion
```

### 5. Corporate Accounts
**Problem**: Support business accounts with multiple riders

**Additional Requirements**:
- Company billing and invoicing
- Ride approval workflows
- Budget limits and controls
- Expense reporting integration
- Admin dashboard

**Key Design Changes**:
```
Corporate Features:
- Centralized billing to company account
- Ride purpose and cost center tracking
- Manager approval for expensive rides
- Monthly invoicing with detailed breakdown
- Integration with expense systems (Concur, Expensify)

Database Schema:
CREATE TABLE corporate_accounts (
    account_id UUID PRIMARY KEY,
    company_name VARCHAR(255),
    billing_email VARCHAR(255),
    payment_method_id UUID,
    monthly_budget DECIMAL(10,2),
    requires_approval BOOLEAN,
    approval_threshold DECIMAL(10,2)
);

CREATE TABLE corporate_riders (
    rider_id UUID,
    account_id UUID,
    role VARCHAR(50), -- ADMIN, MANAGER, EMPLOYEE
    budget_limit DECIMAL(10,2),
    can_approve BOOLEAN,
    PRIMARY KEY (rider_id, account_id)
);
```

## Follow-up Questions

### Technical Deep Dives

**Q1: How do you handle GPS inaccuracies in urban canyons or tunnels?**
```
Solution:
1. Dead Reckoning:
   - Use accelerometer and gyroscope data
   - Estimate position based on last known location and movement
   - Interpolate position during GPS signal loss

2. Map Matching:
   - Snap GPS coordinates to nearest road
   - Use road network topology
   - Consider heading and speed

3. Sensor Fusion:
   - Combine GPS, accelerometer, gyroscope, magnetometer
   - Kalman filter for position estimation
   - Machine learning for pattern recognition

4. Fallback Mechanisms:
   - Use cell tower triangulation
   - WiFi positioning
   - Last known good position with staleness indicator
```

**Q2: How do you prevent drivers from gaming the surge pricing system?**
```
Detection Mechanisms:
1. Pattern Analysis:
   - Detect coordinated offline behavior
   - Identify drivers going offline simultaneously
   - Flag suspicious location patterns

2. Machine Learning:
   - Train models on historical gaming attempts
   - Detect anomalous behavior
   - Real-time fraud scoring

3. Behavioral Signals:
   - Rapid status changes (online/offline)
   - Unusual movement patterns
   - Correlation with surge zones

Mitigation:
- Delay surge pricing updates (1-2 minute lag)
- Smooth surge transitions
- Penalize drivers caught gaming
- Suspend accounts for repeated violations
- Use predictive pricing to reduce gaming incentive
```

**Q3: How do you handle payment failures after trip completion?**
```
Payment Failure Handling:
1. Immediate Retry:
   - Retry payment 3 times with exponential backoff
   - Try alternative payment methods on file

2. Async Processing:
   - Queue failed payment for later retry
   - Retry every 6 hours for 7 days
   - Send notification to rider

3. Account Management:
   - Mark account as having outstanding balance
   - Block new rides until payment resolved
   - Offer payment plan for large balances

4. Collections:
   - After 30 days, send to collections
   - Report to credit bureaus if necessary
   - Legal action for large amounts

5. Driver Protection:
   - Pay driver immediately from Uber's funds
   - Uber absorbs the risk
   - Recover from rider separately
```

**Q4: How do you ensure driver safety during trips?**
```
Safety Features:
1. Real-time Monitoring:
   - Detect unusual route deviations
   - Monitor for extended stops
   - Flag trips that exceed expected duration by 50%

2. Emergency Features:
   - In-app emergency button (calls 911)
   - Share trip status with emergency contacts
   - Two-way audio recording (with consent)
   - Automatic incident detection (crash detection)

3. Driver Verification:
   - Continuous background checks
   - Facial recognition at login
   - Random photo verification during shifts
   - Vehicle inspection requirements

4. Rider Verification:
   - Phone number verification
   - Payment method verification
   - Rating system (low-rated riders flagged)
   - Behavioral analysis

5. Post-Trip:
   - Automated safety check-in
   - Report suspicious behavior
   - Support team review of flagged trips
```

**Q5: How do you handle high-traffic events (concerts, sports games)?**
```
Event Handling Strategy:
1. Predictive Scaling:
   - Identify events from calendar data
   - Predict demand based on historical patterns
   - Pre-scale infrastructure 2 hours before event

2. Geofencing:
   - Create special zones around venues
   - Designated pickup/dropoff areas
   - Queue management for riders

3. Driver Incentives:
   - Surge pricing to attract drivers
   - Bonus payments for event areas
   - Pre-notify drivers of upcoming events

4. Traffic Management:
   - Coordinate with venue security
   - Stagger pickup times
   - Route optimization to avoid congestion

5. Alternative Options:
   - Suggest nearby pickup locations
   - Offer UberPool for cost savings
   - Partner with public transit
```

### Scalability Questions

**Q6: How would you scale to 10x current traffic?**
```
Scaling Strategy:
1. Horizontal Scaling:
   - 10x application servers (5K → 50K instances)
   - 10x database shards (500 → 5,000 shards)
   - 10x cache clusters (200 → 2,000 Redis nodes)

2. Geographic Expansion:
   - Add more regions (10 → 25 regions)
   - Edge computing for location processing
   - Regional data centers in every continent

3. Technology Upgrades:
   - Migrate to more efficient protocols (gRPC)
   - Implement edge caching (Cloudflare Workers)
   - Use serverless for burst traffic

4. Algorithm Optimization:
   - More aggressive caching
   - Pre-computation of common queries
   - Approximate algorithms for non-critical paths

5. Cost Optimization:
   - Spot instances for batch processing
   - Reserved instances for baseline capacity
   - Auto-scaling for peak traffic
```

**Q7: How do you handle database hotspots (popular cities)?**
```
Hotspot Mitigation:
1. Further Sharding:
   - Split large cities into sub-regions
   - NYC: Manhattan, Brooklyn, Queens (separate shards)
   - Each sub-region gets dedicated shard

2. Read Replicas:
   - Add more read replicas for hot shards
   - 10+ replicas for top cities
   - Geographic distribution of replicas

3. Caching:
   - Aggressive caching for hot data
   - Cache warming before peak hours
   - Distributed cache with consistent hashing

4. Load Shedding:
   - Rate limiting per city
   - Queue requests during extreme load
   - Graceful degradation (disable non-critical features)

5. Async Processing:
   - Move non-critical writes to async queues
   - Batch updates for analytics
   - Eventual consistency for non-critical data
```

### Business Logic Questions

**Q8: How do you calculate and update driver ratings?**
```
Rating System:
1. Rating Collection:
   - Prompt rider to rate driver after trip
   - 1-5 star rating + optional feedback
   - Tags for specific feedback (friendly, clean car, etc.)

2. Rating Calculation:
   - Weighted average of last 500 trips
   - Recent trips weighted more heavily
   - Outliers (1-star, 5-star) have less weight
   - Minimum 10 trips before rating displayed

3. Rating Updates:
   - Update driver rating asynchronously
   - Recalculate every hour
   - Cache rating for fast access

4. Rating Impact:
   - Drivers below 4.6 receive warning
   - Drivers below 4.5 for 30 days deactivated
   - High ratings (4.9+) get priority matching

Implementation:
CREATE TABLE driver_ratings (
    driver_id UUID PRIMARY KEY,
    current_rating DECIMAL(3,2),
    total_ratings INTEGER,
    rating_distribution JSONB, -- {1: 5, 2: 10, 3: 50, 4: 200, 5: 735}
    last_updated TIMESTAMP
);
```

**Q9: How do you handle surge pricing transparency and regulation?**
```
Transparency Measures:
1. Upfront Pricing:
   - Show exact fare before ride confirmation
   - Display surge multiplier clearly
   - Explain why surge is active

2. Price Caps:
   - Maximum surge multiplier (e.g., 5x)
   - Regulatory compliance per city
   - Emergency caps during disasters

3. Notifications:
   - Alert riders when surge is active
   - Suggest waiting for surge to decrease
   - Show historical surge patterns

4. Regulatory Compliance:
   - Report surge data to regulators
   - Comply with price gouging laws
   - Adjust algorithms per jurisdiction

5. Alternative Options:
   - Offer scheduled rides at lower prices
   - Suggest UberPool for savings
   - Show public transit options
```

**Q10: How do you handle driver and rider disputes?**
```
Dispute Resolution:
1. Automated Resolution:
   - GPS data analysis
   - Trip timeline reconstruction
   - Automatic refunds for clear issues

2. Support Ticket System:
   - Rider/driver can file dispute
   - AI categorization and routing
   - Priority based on severity

3. Evidence Collection:
   - GPS trail
   - Trip photos
   - Audio recordings (if enabled)
   - Payment records
   - Communication logs

4. Resolution Process:
   - Support agent reviews evidence
   - Contact both parties if needed
   - Make decision within 24-48 hours
   - Issue refunds/adjustments

5. Appeals:
   - Allow appeals within 7 days
   - Senior agent review
   - Final decision binding

Common Disputes:
- Wrong route taken
- Cancellation fees
- Cleanliness issues
- Lost items
- Pricing discrepancies
```

These variations and follow-up questions demonstrate the complexity and breadth of considerations required when designing a global ride-sharing platform like Uber.
