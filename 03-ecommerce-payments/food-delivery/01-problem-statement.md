# Food Delivery - Problem Statement

**Reading Time**: 20 minutes

## Business Context

A food delivery platform connects three parties: customers ordering food, restaurants preparing meals, and delivery drivers transporting orders. Systems like DoorDash, Uber Eats, and Grubhub have transformed food delivery by providing real-time tracking, dynamic pricing, and efficient logistics.

## Core Problem

Design a food delivery system that:
- Connects customers, restaurants, and drivers
- Provides real-time order tracking
- Optimizes driver assignment and routing
- Handles payments and settlements
- Manages restaurant menus and inventory
- Ensures food quality and delivery speed

## Functional Requirements

### 1. Customer Features
- **Restaurant Discovery**: Search, browse, filter by cuisine/rating/distance
- **Menu Browsing**: View items, prices, descriptions, photos
- **Order Placement**: Add to cart, customize items, apply promos
- **Payment**: Multiple payment methods, split payments
- **Order Tracking**: Real-time driver location, ETA updates
- **Ratings & Reviews**: Rate restaurant and driver

### 2. Restaurant Features
- **Menu Management**: Add/edit items, prices, availability
- **Order Management**: Accept/reject orders, preparation time
- **Inventory Tracking**: Mark items out of stock
- **Analytics Dashboard**: Sales, popular items, ratings
- **Payout Management**: View earnings, settlement schedule

### 3. Driver Features
- **Order Assignment**: Accept/reject delivery requests
- **Navigation**: Turn-by-turn directions to restaurant and customer
- **Status Updates**: Picked up, on the way, delivered
- **Earnings Tracking**: View earnings, tips, bonuses
- **Availability Management**: Go online/offline

### 4. Platform Features
- **Dynamic Pricing**: Surge pricing during peak hours
- **Driver Matching**: Assign nearest available driver
- **Route Optimization**: Minimize delivery time
- **Fraud Detection**: Prevent fake orders, account abuse
- **Customer Support**: Chat, phone, refunds

## Non-Functional Requirements

### 1. Performance
- **Search Latency**: < 500ms for restaurant search
- **Order Placement**: < 2 seconds
- **Driver Assignment**: < 30 seconds
- **Location Updates**: Every 5-10 seconds
- **ETA Calculation**: < 1 second

### 2. Availability
- **Uptime**: 99.9% (8.7 hours downtime/year)
- **Peak Hours**: Handle 3x normal traffic (lunch, dinner)
- **Graceful Degradation**: Core features work during partial outages

### 3. Scalability
- **Users**: 10 million customers
- **Restaurants**: 100,000 restaurants
- **Drivers**: 1 million drivers
- **Daily Orders**: 5 million orders/day
- **Peak Orders**: 2,000 orders/second

### 4. Consistency
- **Order State**: Strong consistency (no duplicate orders)
- **Inventory**: Eventual consistency acceptable
- **Location**: Real-time updates (5-10 second lag acceptable)
- **Payments**: Strong consistency (no double charges)

## Key Challenges

### 1. Real-Time Location Tracking
**Challenge**: Track thousands of drivers in real-time with minimal latency

**Considerations**:
- GPS accuracy and battery consumption
- Network connectivity issues
- Efficient storage and querying of location data
- Privacy concerns

### 2. Driver Matching Algorithm
**Challenge**: Assign optimal driver to each order

**Considerations**:
- Distance to restaurant
- Driver availability and capacity
- Estimated preparation time
- Traffic conditions
- Driver ratings and acceptance rate
- Batch assignments for efficiency

### 3. ETA Calculation
**Challenge**: Accurate delivery time estimates

**Considerations**:
- Restaurant preparation time (historical data)
- Distance and traffic conditions
- Driver speed and route
- Weather conditions
- Order complexity

### 4. Dynamic Pricing
**Challenge**: Balance supply and demand

**Considerations**:
- Current demand (orders per area)
- Driver availability
- Time of day and day of week
- Weather conditions
- Special events
- Customer price sensitivity

### 5. Three-Sided Marketplace
**Challenge**: Balance interests of customers, restaurants, and drivers

**Considerations**:
- Fair commission rates
- Driver earnings vs customer prices
- Restaurant profitability
- Platform sustainability
- Quality vs speed tradeoffs

## Success Metrics

### Business Metrics
- **Order Volume**: Daily orders, growth rate
- **GMV**: Gross Merchandise Value
- **Take Rate**: Platform commission percentage
- **Customer Retention**: Monthly active users, churn rate
- **Restaurant Retention**: Active restaurants, churn rate
- **Driver Retention**: Active drivers, churn rate

### Operational Metrics
- **Delivery Time**: Average time from order to delivery
- **Order Accuracy**: % of orders delivered correctly
- **Cancellation Rate**: % of orders cancelled
- **Driver Utilization**: % of time drivers are on delivery
- **Restaurant Response Time**: Time to accept orders

### Technical Metrics
- **Search Latency**: P95 < 500ms
- **Order Placement Success**: > 99%
- **Driver Assignment Time**: P95 < 30 seconds
- **Location Update Frequency**: Every 5-10 seconds
- **API Availability**: 99.9% uptime

## User Personas

### 1. Busy Professional
- **Needs**: Quick ordering, reliable delivery, quality food
- **Pain Points**: Long wait times, cold food, wrong orders
- **Usage**: Lunch and dinner, 3-5 times/week

### 2. Family Household
- **Needs**: Large orders, multiple cuisines, scheduled delivery
- **Pain Points**: High delivery fees, limited options
- **Usage**: Weekends, special occasions

### 3. Restaurant Owner
- **Needs**: More customers, efficient operations, fair commissions
- **Pain Points**: High platform fees, order management complexity
- **Usage**: Daily operations, menu updates

### 4. Delivery Driver
- **Needs**: Flexible hours, good earnings, efficient routing
- **Pain Points**: Low pay, long wait times, unclear instructions
- **Usage**: Part-time or full-time work

## Scope Boundaries

### In Scope
- Restaurant discovery and search
- Order placement and tracking
- Driver assignment and routing
- Real-time location updates
- Payment processing
- Ratings and reviews
- Basic analytics

### Out of Scope
- Restaurant POS integration (separate system)
- Grocery delivery (different logistics)
- Alcohol delivery (regulatory complexity)
- Drone/robot delivery (future feature)
- Restaurant supply chain management
- Driver background checks (third-party service)

## Interview Discussion Points

### Clarifying Questions to Ask

1. **Scale and Geography**:
   - How many cities/regions?
   - Urban vs suburban vs rural?
   - International expansion plans?

2. **Order Types**:
   - Delivery only or pickup too?
   - Scheduled orders or immediate only?
   - Group orders supported?

3. **Driver Model**:
   - Independent contractors or employees?
   - Multi-order delivery (batching)?
   - Driver incentives and bonuses?

4. **Restaurant Integration**:
   - Menu sync frequency?
   - Inventory management?
   - Order confirmation process?

5. **Payment Model**:
   - Commission structure?
   - Driver payment frequency?
   - Refund and dispute handling?

### Key Points to Emphasize

1. **Real-Time Systems**: Location tracking, ETA updates
2. **Matching Algorithm**: Efficient driver assignment
3. **Scalability**: Handle peak hours (lunch, dinner)
4. **Reliability**: Order state consistency
5. **User Experience**: Fast search, accurate ETAs

## Real-World Examples

### DoorDash
- **Strengths**: Wide restaurant selection, DashPass subscription
- **Architecture**: Microservices, real-time tracking, ML for ETAs
- **Scale**: 25M+ users, 450K+ restaurants

### Uber Eats
- **Strengths**: Uber driver network, global presence
- **Architecture**: Shared infrastructure with Uber rides
- **Scale**: 100M+ users, 800K+ restaurants

### Grubhub
- **Strengths**: Early market entry, restaurant partnerships
- **Architecture**: Restaurant-focused features
- **Scale**: 33M+ users, 300K+ restaurants

## Next Steps

After understanding the problem:
1. Define scale and constraints (02-scale-constraints.md)
2. Design high-level architecture (03-architecture.md)
3. Model database schema (04-database-design.md)
4. Design APIs (05-api-design.md)

---
*Estimated Reading Time: 20 minutes*
