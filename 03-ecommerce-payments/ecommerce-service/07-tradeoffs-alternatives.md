# E-commerce Tradeoffs and Alternatives

## Overview (2 mins)
E-commerce system design involves critical tradeoffs between consistency, availability, performance, and cost. Understanding these tradeoffs helps make informed architectural decisions based on business requirements and constraints.

## Consistency vs Availability Tradeoffs (4 mins)

### Inventory Management: Strong vs Eventual Consistency

#### Strong Consistency Approach
```python
# ACID transaction for inventory updates
@transaction.atomic
def process_order(order_data):
    """Strong consistency - may block during high traffic"""
    try:
        # 1. Validate inventory availability
        for item in order_data.items:
            inventory = Inventory.objects.select_for_update().get(
                product_id=item.product_id
            )
            if inventory.available_stock < item.quantity:
                raise InsufficientInventoryError()
        
        # 2. Create order
        order = Order.objects.create(**order_data)
        
        # 3. Update inventory atomically
        for item in order_data.items:
            Inventory.objects.filter(
                product_id=item.product_id
            ).update(
                available_stock=F('available_stock') - item.quantity,
                reserved_stock=F('reserved_stock') + item.quantity
            )
        
        return order
    except Exception as e:
        # Transaction automatically rolled back
        raise OrderProcessingError(str(e))

# Pros: Perfect inventory accuracy, no overselling
# Cons: Database locks, reduced throughput, potential deadlocks
```

#### Eventual Consistency Approach
```python
# Event-driven eventual consistency
class EventualConsistencyOrderProcessor:
    def __init__(self):
        self.event_bus = EventBus()
        self.inventory_cache = Redis()
    
    async def process_order(self, order_data):
        """Eventual consistency - higher throughput, compensation needed"""
        # 1. Optimistic inventory check (cache-based)
        for item in order_data.items:
            cached_stock = await self.inventory_cache.get(f"stock:{item.product_id}")
            if not cached_stock or int(cached_stock) < item.quantity:
                raise InsufficientInventoryError()
        
        # 2. Create order immediately
        order = await Order.objects.acreate(**order_data)
        
        # 3. Publish events for async processing
        await self.event_bus.publish(OrderCreatedEvent(order))
        
        # 4. Update cache optimistically
        for item in order_data.items:
            await self.inventory_cache.decrby(f"stock:{item.product_id}", item.quantity)
        
        return order
    
    async def handle_inventory_validation(self, event):
        """Async validation with compensation"""
        for item in event.order.items:
            actual_stock = await self.get_actual_inventory(item.product_id)
            if actual_stock < item.quantity:
                # Compensate: cancel order and refund
                await self.cancel_order(event.order.id, reason="insufficient_inventory")
                await self.refund_payment(event.order.payment_id)
                break

# Pros: High throughput, better user experience
# Cons: Potential overselling, compensation complexity
```

### Product Catalog: SQL vs NoSQL

#### SQL Approach (PostgreSQL)
```sql
-- Normalized relational schema
CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id INTEGER REFERENCES categories(category_id),
    level INTEGER NOT NULL,
    path TEXT NOT NULL -- Materialized path for hierarchy
);

CREATE TABLE products (
    product_id UUID PRIMARY KEY,
    sku VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    brand_id INTEGER REFERENCES brands(brand_id),
    category_id INTEGER REFERENCES categories(category_id),
    base_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_attributes (
    product_id UUID REFERENCES products(product_id),
    attribute_name VARCHAR(100) NOT NULL,
    attribute_value TEXT NOT NULL,
    PRIMARY KEY (product_id, attribute_name)
);

-- Complex query with joins
SELECT p.*, c.name as category_name, b.name as brand_name,
       array_agg(pa.attribute_name || ':' || pa.attribute_value) as attributes
FROM products p
JOIN categories c ON p.category_id = c.category_id
JOIN brands b ON p.brand_id = b.brand_id
LEFT JOIN product_attributes pa ON p.product_id = pa.product_id
WHERE p.category_id IN (SELECT category_id FROM categories WHERE path LIKE 'Electronics%')
GROUP BY p.product_id, c.name, b.name;

-- Pros: ACID compliance, complex queries, data integrity
-- Cons: Schema rigidity, join complexity, scaling challenges
```

#### NoSQL Approach (MongoDB)
```javascript
// Denormalized document schema
{
  "_id": ObjectId("..."),
  "sku": "LAPTOP-DELL-XPS13-001",
  "title": "Dell XPS 13 Laptop",
  "description": "High-performance ultrabook...",
  "brand": {
    "id": "brand_dell",
    "name": "Dell",
    "logo_url": "https://cdn.example.com/brands/dell.png"
  },
  "category": {
    "id": "cat_laptops",
    "name": "Laptops",
    "path": ["Electronics", "Computers", "Laptops"],
    "level": 3
  },
  "attributes": {
    "processor": "Intel Core i7-1165G7",
    "memory": "16GB LPDDR4x",
    "storage": "512GB SSD",
    "display": "13.3-inch FHD+",
    "color": "Platinum Silver"
  },
  "pricing": {
    "base_price": 1299.99,
    "currency": "USD",
    "discount_percentage": 0
  },
  "inventory": {
    "total_stock": 150,
    "available_stock": 142
  },
  "created_at": ISODate("2024-01-01T00:00:00Z")
}

// Simple query without joins
db.products.find({
  "category.path": "Electronics",
  "pricing.base_price": {$gte: 1000, $lte: 2000},
  "inventory.available_stock": {$gt: 0}
}).sort({"pricing.base_price": 1});

// Pros: Flexible schema, fast reads, horizontal scaling
// Cons: Data duplication, eventual consistency, limited transactions
```

## Synchronous vs Asynchronous Processing (4 mins)

### Order Processing Patterns

#### Synchronous Processing
```python
class SynchronousOrderProcessor:
    def process_order(self, order_data):
        """All operations in single request-response cycle"""
        start_time = time.time()
        
        try:
            # 1. Validate order (200ms)
            validation_result = self.validate_order(order_data)
            
            # 2. Process payment (800ms)
            payment_result = self.payment_service.charge_card(
                order_data.payment_method,
                order_data.total_amount
            )
            
            # 3. Reserve inventory (300ms)
            inventory_result = self.inventory_service.reserve_items(
                order_data.items
            )
            
            # 4. Create order record (100ms)
            order = self.create_order_record(order_data, payment_result)
            
            # 5. Send confirmation email (400ms)
            self.notification_service.send_order_confirmation(order)
            
            # 6. Update analytics (200ms)
            self.analytics_service.track_order(order)
            
            total_time = time.time() - start_time
            logger.info(f"Order processed in {total_time:.2f}s")
            
            return {
                'order_id': order.id,
                'status': 'confirmed',
                'processing_time': total_time
            }
            
        except Exception as e:
            # Rollback all operations
            self.rollback_order_processing(order_data)
            raise OrderProcessingError(str(e))

# Pros: Immediate feedback, simpler error handling, data consistency
# Cons: Slow response (2000ms), poor user experience, cascading failures
```

#### Asynchronous Processing
```python
class AsynchronousOrderProcessor:
    def __init__(self):
        self.task_queue = TaskQueue()
        self.event_bus = EventBus()
    
    async def process_order(self, order_data):
        """Fast response with background processing"""
        start_time = time.time()
        
        # 1. Quick validation only (50ms)
        basic_validation = await self.quick_validate(order_data)
        if not basic_validation.valid:
            raise ValidationError(basic_validation.errors)
        
        # 2. Create pending order (100ms)
        order = await self.create_pending_order(order_data)
        
        # 3. Queue background tasks
        await self.task_queue.enqueue('process_payment', {
            'order_id': order.id,
            'payment_data': order_data.payment_method
        })
        
        await self.task_queue.enqueue('reserve_inventory', {
            'order_id': order.id,
            'items': order_data.items
        })
        
        total_time = time.time() - start_time
        
        return {
            'order_id': order.id,
            'status': 'processing',
            'estimated_completion': '2-3 minutes',
            'processing_time': total_time
        }
    
    async def handle_payment_completed(self, event):
        """Background payment processing"""
        if event.payment_status == 'success':
            await self.confirm_order(event.order_id)
            await self.send_confirmation_email(event.order_id)
        else:
            await self.cancel_order(event.order_id, reason='payment_failed')

# Pros: Fast response (150ms), better user experience, fault isolation
# Cons: Complex state management, eventual consistency, monitoring complexity
```

### Message Queue vs Direct API Calls

#### Message Queue Approach
```python
# Decoupled services with message queues
class OrderEventHandler:
    def __init__(self):
        self.queue = RabbitMQ()
        self.dead_letter_queue = RabbitMQ('dlq')
    
    def publish_order_event(self, event_type, order_data):
        message = {
            'event_type': event_type,
            'order_id': order_data.order_id,
            'timestamp': datetime.utcnow().isoformat(),
            'data': order_data.to_dict(),
            'retry_count': 0
        }
        
        self.queue.publish(
            exchange='orders',
            routing_key=event_type,
            body=json.dumps(message),
            properties={
                'delivery_mode': 2,  # Persistent
                'expiration': '3600000'  # 1 hour TTL
            }
        )
    
    def handle_inventory_reservation(self, message):
        try:
            order_data = json.loads(message.body)
            result = self.inventory_service.reserve_items(order_data['items'])
            
            if result.success:
                self.publish_order_event('inventory_reserved', order_data)
            else:
                self.publish_order_event('inventory_failed', order_data)
                
        except Exception as e:
            # Retry logic
            if message.retry_count < 3:
                message.retry_count += 1
                self.queue.publish_delayed(message, delay=60)  # Retry in 1 minute
            else:
                self.dead_letter_queue.publish(message)

# Pros: Fault tolerance, scalability, loose coupling
# Cons: Message ordering, duplicate processing, debugging complexity
```

#### Direct API Calls
```python
# Tight coupling with direct service calls
class DirectOrderProcessor:
    def __init__(self):
        self.payment_service = PaymentServiceClient()
        self.inventory_service = InventoryServiceClient()
        self.notification_service = NotificationServiceClient()
    
    def process_order(self, order_data):
        try:
            # Direct synchronous calls
            payment_result = self.payment_service.process_payment(
                order_data.payment_method,
                order_data.total_amount
            )
            
            inventory_result = self.inventory_service.reserve_inventory(
                order_data.items
            )
            
            notification_result = self.notification_service.send_confirmation(
                order_data.user_email,
                order_data.order_details
            )
            
            return self.create_order(order_data, payment_result, inventory_result)
            
        except PaymentServiceError as e:
            raise OrderProcessingError(f"Payment failed: {e}")
        except InventoryServiceError as e:
            # Compensate payment
            self.payment_service.refund(payment_result.transaction_id)
            raise OrderProcessingError(f"Inventory failed: {e}")

# Pros: Simple debugging, immediate error handling, strong consistency
# Cons: Tight coupling, cascading failures, poor fault tolerance
```

## Monolith vs Microservices (4 mins)

### Monolithic Architecture
```python
# Single application with all functionality
class EcommerceApplication:
    def __init__(self):
        self.db = Database()
        self.cache = Cache()
        self.search = SearchEngine()
    
    # Product management
    def create_product(self, product_data):
        product = self.db.products.create(product_data)
        self.search.index_product(product)
        self.cache.invalidate(f"product:{product.id}")
        return product
    
    # Order processing
    def process_order(self, order_data):
        # All business logic in single codebase
        order = self.db.orders.create(order_data)
        self.update_inventory(order.items)
        self.process_payment(order.payment_info)
        self.send_notifications(order)
        return order
    
    # Inventory management
    def update_inventory(self, items):
        for item in items:
            self.db.inventory.update(
                product_id=item.product_id,
                quantity=item.quantity
            )
    
    # Single deployment unit
    def deploy(self):
        # Deploy entire application as one unit
        pass

# Pros: Simple deployment, easy debugging, ACID transactions
# Cons: Technology lock-in, scaling bottlenecks, team coordination issues
```

### Microservices Architecture
```python
# Separate services with clear boundaries
class ProductService:
    def __init__(self):
        self.db = ProductDatabase()
        self.search = ElasticsearchClient()
        self.event_bus = EventBus()
    
    def create_product(self, product_data):
        product = self.db.create(product_data)
        
        # Publish event for other services
        self.event_bus.publish(ProductCreatedEvent(product))
        
        return product

class OrderService:
    def __init__(self):
        self.db = OrderDatabase()
        self.payment_client = PaymentServiceClient()
        self.inventory_client = InventoryServiceClient()
        self.event_bus = EventBus()
    
    def process_order(self, order_data):
        # Orchestrate across multiple services
        order = self.db.create_pending_order(order_data)
        
        # Call other services
        payment_result = self.payment_client.process_payment(order.payment_info)
        inventory_result = self.inventory_client.reserve_items(order.items)
        
        if payment_result.success and inventory_result.success:
            order.status = 'confirmed'
            self.db.update(order)
            self.event_bus.publish(OrderConfirmedEvent(order))
        
        return order

class InventoryService:
    def __init__(self):
        self.db = InventoryDatabase()
        self.event_bus = EventBus()
    
    def reserve_items(self, items):
        # Independent service with own database
        for item in items:
            result = self.db.reserve_inventory(item.product_id, item.quantity)
            if not result.success:
                return ReservationResult(success=False, reason=result.error)
        
        return ReservationResult(success=True)

# Pros: Technology diversity, independent scaling, team autonomy
# Cons: Distributed complexity, network latency, data consistency challenges
```

## Caching Strategies (3 mins)

### Cache-Aside vs Write-Through

#### Cache-Aside Pattern
```python
class CacheAsideProductService:
    def __init__(self):
        self.db = Database()
        self.cache = Redis()
        self.cache_ttl = 3600  # 1 hour
    
    def get_product(self, product_id):
        # Try cache first
        cache_key = f"product:{product_id}"
        cached_product = self.cache.get(cache_key)
        
        if cached_product:
            return json.loads(cached_product)
        
        # Cache miss - fetch from database
        product = self.db.get_product(product_id)
        if product:
            # Store in cache for future requests
            self.cache.setex(
                cache_key, 
                self.cache_ttl, 
                json.dumps(product.to_dict())
            )
        
        return product
    
    def update_product(self, product_id, product_data):
        # Update database
        product = self.db.update_product(product_id, product_data)
        
        # Invalidate cache
        cache_key = f"product:{product_id}"
        self.cache.delete(cache_key)
        
        return product

# Pros: Cache only what's needed, handles cache failures gracefully
# Cons: Cache miss penalty, potential stale data, cache warming needed
```

#### Write-Through Pattern
```python
class WriteThroughProductService:
    def __init__(self):
        self.db = Database()
        self.cache = Redis()
        self.cache_ttl = 3600
    
    def get_product(self, product_id):
        # Always try cache first
        cache_key = f"product:{product_id}"
        cached_product = self.cache.get(cache_key)
        
        if cached_product:
            return json.loads(cached_product)
        
        # Cache miss - this shouldn't happen in write-through
        product = self.db.get_product(product_id)
        return product
    
    def update_product(self, product_id, product_data):
        # Update database first
        product = self.db.update_product(product_id, product_data)
        
        # Always update cache
        cache_key = f"product:{product_id}"
        self.cache.setex(
            cache_key,
            self.cache_ttl,
            json.dumps(product.to_dict())
        )
        
        return product
    
    def create_product(self, product_data):
        # Create in database
        product = self.db.create_product(product_data)
        
        # Immediately cache
        cache_key = f"product:{product.id}"
        self.cache.setex(
            cache_key,
            self.cache_ttl,
            json.dumps(product.to_dict())
        )
        
        return product

# Pros: Always fresh cache, predictable performance
# Cons: Write penalty, cache storage overhead, cache failure impact
```

## Search Technology Choices (2 mins)

### Elasticsearch vs Database Search

#### Elasticsearch Approach
```python
# Full-text search with Elasticsearch
class ElasticsearchProductSearch:
    def __init__(self):
        self.es = Elasticsearch(['localhost:9200'])
        self.index_name = 'products'
    
    def search_products(self, query, filters=None):
        search_body = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "multi_match": {
                                "query": query,
                                "fields": ["title^3", "description^2", "brand"],
                                "type": "best_fields",
                                "fuzziness": "AUTO"
                            }
                        }
                    ],
                    "filter": []
                }
            },
            "aggs": {
                "brands": {"terms": {"field": "brand.keyword"}},
                "categories": {"terms": {"field": "category.keyword"}},
                "price_ranges": {
                    "range": {
                        "field": "price",
                        "ranges": [
                            {"to": 50}, {"from": 50, "to": 100},
                            {"from": 100, "to": 500}, {"from": 500}
                        ]
                    }
                }
            }
        }
        
        if filters:
            if filters.get('brand'):
                search_body["query"]["bool"]["filter"].append(
                    {"terms": {"brand.keyword": filters['brand']}}
                )
        
        return self.es.search(index=self.index_name, body=search_body)

# Pros: Advanced search features, faceted search, performance
# Cons: Additional infrastructure, eventual consistency, complexity
```

#### Database Search Approach
```sql
-- PostgreSQL full-text search
CREATE INDEX idx_products_search ON products 
USING GIN(to_tsvector('english', title || ' ' || description));

-- Search query
SELECT p.*, ts_rank(to_tsvector('english', p.title || ' ' || p.description), 
                   plainto_tsquery('english', 'laptop dell')) as rank
FROM products p
WHERE to_tsvector('english', p.title || ' ' || p.description) 
      @@ plainto_tsquery('english', 'laptop dell')
ORDER BY rank DESC;

-- Pros: Single technology stack, ACID compliance, simpler architecture
-- Cons: Limited search features, performance at scale, no faceted search
```

## Decision Framework

### When to Choose Strong Consistency
- Financial transactions (payments, refunds)
- Inventory allocation during checkout
- User authentication and authorization
- Regulatory compliance requirements

### When to Accept Eventual Consistency
- Product catalog updates
- User activity tracking
- Recommendation engine data
- Analytics and reporting

### When to Use Microservices
- Large development teams (>50 developers)
- Different technology requirements per domain
- Independent scaling needs
- Regulatory isolation requirements

### When to Keep Monolith
- Small teams (<10 developers)
- Simple business domain
- Rapid prototyping phase
- Strong consistency requirements across domains
