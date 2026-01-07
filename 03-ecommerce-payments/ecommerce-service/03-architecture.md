# E-commerce Service Architecture

## Overview (2 mins)
An e-commerce platform like Amazon requires a sophisticated microservices architecture to handle millions of products, users, and transactions. The architecture must support high availability, scalability, and data consistency across multiple business domains.

## Core Architecture Principles (3 mins)

### Domain-Driven Design
- **Product Catalog Domain**: Product information, categories, search
- **Inventory Domain**: Stock levels, warehouse management, allocation
- **Order Domain**: Cart, checkout, order processing, fulfillment
- **User Domain**: Authentication, profiles, preferences, recommendations
- **Payment Domain**: Payment processing, billing, refunds
- **Logistics Domain**: Shipping, tracking, delivery management

### Microservices Boundaries
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │    │  Load Balancer  │    │   CDN/Cache     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
┌─────────────────────────────────────────────────────────────────┐
│                    Microservices Layer                          │
├─────────────┬─────────────┬─────────────┬─────────────────────┤
│   Product   │  Inventory  │    Order    │       User          │
│   Service   │   Service   │   Service   │     Service         │
├─────────────┼─────────────┼─────────────┼─────────────────────┤
│   Payment   │  Logistics  │ Notification│   Recommendation    │
│   Service   │   Service   │   Service   │     Service         │
└─────────────┴─────────────┴─────────────┴─────────────────────┘
```

## Service Architecture Details (8 mins)

### 1. Product Catalog Service
**Responsibilities:**
- Product information management (title, description, images, specifications)
- Category hierarchy and navigation
- Product search and filtering
- Price management and promotional pricing

**Technology Stack:**
- **Database**: PostgreSQL for structured data, Elasticsearch for search
- **Cache**: Redis for frequently accessed products
- **Storage**: S3 for product images and media
- **Search**: Elasticsearch with custom analyzers for product search

**Key APIs:**
```
GET /products/{id}
GET /products/search?q={query}&category={cat}&price_range={range}
GET /categories/{id}/products
POST /products (admin only)
PUT /products/{id} (admin only)
```

### 2. Inventory Management Service
**Responsibilities:**
- Real-time stock tracking across multiple warehouses
- Inventory allocation and reservation
- Stock replenishment alerts
- Inventory forecasting

**Architecture Pattern:**
- **Event Sourcing**: Track all inventory changes as immutable events
- **CQRS**: Separate read/write models for inventory queries vs updates
- **Eventual Consistency**: Accept temporary inconsistencies for performance

**Data Flow:**
```
Order Placed → Inventory Reserved → Payment Confirmed → Inventory Allocated
     ↓              ↓                    ↓                    ↓
Event Store → Read Model Update → Warehouse Notification → Fulfillment
```

### 3. Order Processing Service
**Responsibilities:**
- Shopping cart management
- Order creation and validation
- Order state management (pending, confirmed, shipped, delivered)
- Order history and tracking

**State Machine:**
```
Cart → Checkout → Payment → Confirmed → Fulfillment → Shipped → Delivered
  ↓       ↓         ↓         ↓           ↓           ↓         ↓
Save   Validate  Process   Allocate   Pick/Pack   Track    Complete
```

**Database Design:**
- **Orders Table**: Order metadata, customer info, totals
- **Order Items Table**: Individual products, quantities, prices
- **Order Events Table**: State changes, timestamps, reasons

### 4. User Management Service
**Responsibilities:**
- User authentication and authorization
- Profile management
- Address book and payment methods
- User preferences and settings

**Security Features:**
- JWT tokens for stateless authentication
- OAuth2 integration for social login
- Role-based access control (customer, admin, vendor)
- Password hashing with bcrypt

## Data Architecture (4 mins)

### Database Strategy
**Polyglot Persistence:**
- **PostgreSQL**: Transactional data (orders, users, inventory)
- **MongoDB**: Product catalog with flexible schemas
- **Redis**: Session storage, caching, real-time data
- **Elasticsearch**: Product search and analytics

### Data Consistency Patterns
**Strong Consistency:**
- Financial transactions (payments, refunds)
- Inventory allocation during checkout
- User authentication and authorization

**Eventual Consistency:**
- Product catalog updates
- Recommendation engine data
- Analytics and reporting data

### Event-Driven Architecture
```
Service A → Event Bus → Service B
    ↓         ↓           ↓
Publish   Route     Subscribe
```

**Key Events:**
- `ProductCreated`, `ProductUpdated`
- `InventoryChanged`, `StockLevelLow`
- `OrderPlaced`, `OrderConfirmed`, `OrderShipped`
- `PaymentProcessed`, `PaymentFailed`
- `UserRegistered`, `UserProfileUpdated`

## Integration Patterns (3 mins)

### API Gateway Pattern
- **Authentication**: Centralized JWT validation
- **Rate Limiting**: Prevent API abuse
- **Request Routing**: Route to appropriate microservices
- **Response Aggregation**: Combine data from multiple services

### Circuit Breaker Pattern
```python
class CircuitBreaker:
    def __init__(self, failure_threshold=5, timeout=60):
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.state = 'CLOSED'  # CLOSED, OPEN, HALF_OPEN
    
    def call(self, func):
        if self.state == 'OPEN':
            if time.time() - self.last_failure > self.timeout:
                self.state = 'HALF_OPEN'
            else:
                raise CircuitBreakerOpenException()
        
        try:
            result = func()
            if self.state == 'HALF_OPEN':
                self.state = 'CLOSED'
                self.failure_count = 0
            return result
        except Exception as e:
            self.failure_count += 1
            if self.failure_count >= self.failure_threshold:
                self.state = 'OPEN'
                self.last_failure = time.time()
            raise e
```

### Saga Pattern for Distributed Transactions
**Order Processing Saga:**
1. Reserve Inventory
2. Process Payment
3. Create Order
4. Send Confirmation
5. Update Analytics

**Compensation Actions:**
- Release inventory if payment fails
- Refund payment if order creation fails
- Send cancellation notification if any step fails

## Key Architectural Decisions

### Synchronous vs Asynchronous
**Synchronous**: User-facing operations (product search, cart operations)
**Asynchronous**: Background processing (inventory updates, notifications, analytics)

### Caching Strategy
- **L1 Cache**: Application-level caching (in-memory)
- **L2 Cache**: Distributed caching (Redis)
- **L3 Cache**: CDN for static content (images, CSS, JS)

### Security Architecture
- **API Gateway**: Authentication, authorization, rate limiting
- **Service Mesh**: mTLS between services
- **Secrets Management**: Vault for API keys and credentials
- **Data Encryption**: At rest and in transit
