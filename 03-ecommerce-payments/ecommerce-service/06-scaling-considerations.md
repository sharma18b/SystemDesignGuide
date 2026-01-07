# E-commerce Scaling Considerations

## Overview (2 mins)
Scaling an e-commerce platform requires addressing multiple dimensions: traffic spikes, data growth, geographic expansion, and feature complexity. The key is building systems that can handle Black Friday-level traffic while maintaining sub-second response times and 99.99% availability.

## Traffic Scaling Patterns (4 mins)

### Load Distribution Strategy
```
                    ┌─────────────────┐
                    │   CDN/CloudFlare │
                    └─────────────────┘
                             │
                    ┌─────────────────┐
                    │  Load Balancer   │
                    │  (Geographic)    │
                    └─────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   US East   │    │   US West   │    │   Europe    │
│  API Gateway │    │ API Gateway │    │ API Gateway │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Auto-scaling Configuration
```yaml
# Kubernetes HPA for API services
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: product-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: product-service
  minReplicas: 10
  maxReplicas: 100
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

### Circuit Breaker Implementation
```python
class CircuitBreaker:
    def __init__(self, failure_threshold=5, recovery_timeout=60, expected_exception=Exception):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'CLOSED'  # CLOSED, OPEN, HALF_OPEN
    
    def call(self, func, *args, **kwargs):
        if self.state == 'OPEN':
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = 'HALF_OPEN'
            else:
                raise CircuitBreakerOpenException("Circuit breaker is OPEN")
        
        try:
            result = func(*args, **kwargs)
            self.on_success()
            return result
        except self.expected_exception as e:
            self.on_failure()
            raise e
    
    def on_success(self):
        self.failure_count = 0
        self.state = 'CLOSED'
    
    def on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = 'OPEN'

# Usage in product service
@circuit_breaker(failure_threshold=3, recovery_timeout=30)
def get_product_recommendations(product_id):
    return recommendation_service.get_similar_products(product_id)
```

## Database Scaling Strategies (5 mins)

### Read Replica Configuration
```python
# Database routing based on operation type
class DatabaseRouter:
    def __init__(self):
        self.master = DatabaseConnection('db-master.example.com')
        self.read_replicas = [
            DatabaseConnection('db-replica-1.example.com'),
            DatabaseConnection('db-replica-2.example.com'),
            DatabaseConnection('db-replica-3.example.com')
        ]
        self.replica_index = 0
    
    def get_connection(self, operation_type='read'):
        if operation_type in ['write', 'transaction']:
            return self.master
        else:
            # Round-robin load balancing for read operations
            replica = self.read_replicas[self.replica_index]
            self.replica_index = (self.replica_index + 1) % len(self.read_replicas)
            return replica

# Usage in service layer
def get_product(product_id):
    db = db_router.get_connection('read')
    return db.query("SELECT * FROM products WHERE id = %s", [product_id])

def update_inventory(product_id, quantity):
    db = db_router.get_connection('write')
    return db.execute("UPDATE inventory SET stock = %s WHERE product_id = %s", 
                     [quantity, product_id])
```

### Database Sharding Strategy
```python
# Sharding by user_id for orders and user data
class ShardRouter:
    def __init__(self):
        self.shards = {
            'shard_1': {'range': (0, 1000000), 'connection': 'db-shard-1.example.com'},
            'shard_2': {'range': (1000001, 2000000), 'connection': 'db-shard-2.example.com'},
            'shard_3': {'range': (2000001, 3000000), 'connection': 'db-shard-3.example.com'}
        }
    
    def get_shard(self, user_id):
        user_id_hash = hash(str(user_id)) % 3000000
        for shard_name, shard_info in self.shards.items():
            if shard_info['range'][0] <= user_id_hash <= shard_info['range'][1]:
                return shard_info['connection']
        raise Exception("No shard found for user_id")
    
    def get_user_orders(self, user_id):
        shard_connection = self.get_shard(user_id)
        db = DatabaseConnection(shard_connection)
        return db.query("SELECT * FROM orders WHERE user_id = %s", [user_id])
```

### Caching Layers
```python
# Multi-level caching strategy
class CacheManager:
    def __init__(self):
        self.l1_cache = {}  # In-memory cache
        self.l2_cache = redis.Redis(host='redis-cluster.example.com')  # Redis
        self.l3_cache = 'CDN'  # CloudFront for static content
    
    def get(self, key):
        # L1 Cache (In-memory)
        if key in self.l1_cache:
            return self.l1_cache[key]
        
        # L2 Cache (Redis)
        value = self.l2_cache.get(key)
        if value:
            self.l1_cache[key] = json.loads(value)
            return self.l1_cache[key]
        
        return None
    
    def set(self, key, value, ttl=3600):
        # Set in all cache levels
        self.l1_cache[key] = value
        self.l2_cache.setex(key, ttl, json.dumps(value))
    
    def invalidate(self, key):
        # Remove from all cache levels
        if key in self.l1_cache:
            del self.l1_cache[key]
        self.l2_cache.delete(key)

# Cache warming for popular products
def warm_product_cache():
    popular_products = analytics_service.get_popular_products(limit=10000)
    for product in popular_products:
        product_data = product_service.get_product_details(product.id)
        cache_manager.set(f"product:{product.id}", product_data, ttl=7200)
```

## Search and Catalog Scaling (3 mins)

### Elasticsearch Cluster Configuration
```yaml
# Elasticsearch cluster for product search
cluster:
  name: ecommerce-search
  nodes:
    master:
      count: 3
      resources:
        memory: "8Gi"
        cpu: "2"
    data:
      count: 6
      resources:
        memory: "32Gi"
        cpu: "8"
        storage: "1Ti"
    ingest:
      count: 2
      resources:
        memory: "4Gi"
        cpu: "2"

# Index configuration for products
PUT /products
{
  "settings": {
    "number_of_shards": 6,
    "number_of_replicas": 2,
    "refresh_interval": "30s",
    "index.max_result_window": 50000
  },
  "mappings": {
    "properties": {
      "title": {
        "type": "text",
        "analyzer": "standard",
        "fields": {
          "keyword": {"type": "keyword"},
          "suggest": {"type": "completion"}
        }
      },
      "category_path": {"type": "keyword"},
      "price": {"type": "double"},
      "brand": {"type": "keyword"},
      "availability": {"type": "boolean"},
      "created_at": {"type": "date"}
    }
  }
}
```

### Search Performance Optimization
```python
# Optimized search with aggregations and filters
def search_products(query, filters, page=1, size=20):
    search_body = {
        "query": {
            "bool": {
                "must": [
                    {
                        "multi_match": {
                            "query": query,
                            "fields": ["title^3", "description^2", "brand", "category"],
                            "type": "best_fields",
                            "fuzziness": "AUTO"
                        }
                    }
                ],
                "filter": []
            }
        },
        "aggs": {
            "brands": {
                "terms": {"field": "brand", "size": 20}
            },
            "categories": {
                "terms": {"field": "category_path", "size": 20}
            },
            "price_ranges": {
                "range": {
                    "field": "price",
                    "ranges": [
                        {"to": 50},
                        {"from": 50, "to": 100},
                        {"from": 100, "to": 500},
                        {"from": 500}
                    ]
                }
            }
        },
        "from": (page - 1) * size,
        "size": size,
        "sort": [{"_score": {"order": "desc"}}]
    }
    
    # Add filters
    if filters.get('brand'):
        search_body["query"]["bool"]["filter"].append(
            {"terms": {"brand": filters['brand']}}
        )
    
    if filters.get('price_range'):
        search_body["query"]["bool"]["filter"].append(
            {"range": {"price": filters['price_range']}}
        )
    
    return elasticsearch_client.search(index="products", body=search_body)
```

## Inventory Scaling Challenges (3 mins)

### Real-time Inventory Updates
```python
# Event-driven inventory management
class InventoryEventHandler:
    def __init__(self):
        self.event_store = EventStore()
        self.inventory_cache = Redis()
        self.notification_service = NotificationService()
    
    def handle_order_placed(self, event):
        """Reserve inventory when order is placed"""
        for item in event.order_items:
            # Atomic inventory reservation
            current_stock = self.inventory_cache.get(f"stock:{item.product_id}")
            if current_stock and int(current_stock) >= item.quantity:
                # Reserve inventory
                self.inventory_cache.decrby(f"stock:{item.product_id}", item.quantity)
                self.inventory_cache.incrby(f"reserved:{item.product_id}", item.quantity)
                
                # Record event
                self.event_store.append(InventoryReservedEvent(
                    product_id=item.product_id,
                    quantity=item.quantity,
                    order_id=event.order_id
                ))
            else:
                # Insufficient inventory
                raise InsufficientInventoryException(
                    f"Not enough inventory for product {item.product_id}"
                )
    
    def handle_payment_confirmed(self, event):
        """Allocate reserved inventory when payment is confirmed"""
        for item in event.order_items:
            # Move from reserved to allocated
            self.inventory_cache.decrby(f"reserved:{item.product_id}", item.quantity)
            self.inventory_cache.incrby(f"allocated:{item.product_id}", item.quantity)
            
            # Check if reorder is needed
            current_stock = int(self.inventory_cache.get(f"stock:{item.product_id}") or 0)
            reorder_level = int(self.inventory_cache.get(f"reorder:{item.product_id}") or 0)
            
            if current_stock <= reorder_level:
                self.notification_service.send_reorder_alert(item.product_id)
```

### Distributed Inventory Management
```python
# Inventory allocation across multiple warehouses
class WarehouseInventoryManager:
    def __init__(self):
        self.warehouses = {
            'US_EAST': {'location': 'New York', 'priority': 1},
            'US_WEST': {'location': 'California', 'priority': 2},
            'US_CENTRAL': {'location': 'Texas', 'priority': 3}
        }
    
    def allocate_inventory(self, product_id, quantity, shipping_address):
        """Allocate inventory from optimal warehouse"""
        # Find warehouses with available inventory
        available_warehouses = []
        for warehouse_id in self.warehouses:
            stock = self.get_warehouse_stock(warehouse_id, product_id)
            if stock >= quantity:
                distance = self.calculate_distance(warehouse_id, shipping_address)
                available_warehouses.append({
                    'warehouse_id': warehouse_id,
                    'stock': stock,
                    'distance': distance,
                    'shipping_cost': self.calculate_shipping_cost(distance)
                })
        
        # Sort by distance and shipping cost
        available_warehouses.sort(key=lambda x: (x['distance'], x['shipping_cost']))
        
        if available_warehouses:
            optimal_warehouse = available_warehouses[0]
            return self.reserve_from_warehouse(
                optimal_warehouse['warehouse_id'], 
                product_id, 
                quantity
            )
        else:
            # Split allocation across multiple warehouses
            return self.split_allocation(product_id, quantity, shipping_address)
```

## Global Scaling Considerations (2 mins)

### Multi-Region Deployment
```yaml
# Global deployment configuration
regions:
  us-east-1:
    primary: true
    services: [api, database, cache]
    traffic_percentage: 40
  us-west-2:
    primary: false
    services: [api, cache]
    traffic_percentage: 30
  eu-west-1:
    primary: false
    services: [api, database, cache]
    traffic_percentage: 20
  ap-southeast-1:
    primary: false
    services: [api, cache]
    traffic_percentage: 10

# Database replication strategy
database_replication:
  master: us-east-1
  read_replicas:
    - region: us-west-2
      lag_tolerance: 100ms
    - region: eu-west-1
      lag_tolerance: 200ms
    - region: ap-southeast-1
      lag_tolerance: 300ms
```

### Currency and Localization Scaling
```python
# Multi-currency pricing service
class PricingService:
    def __init__(self):
        self.exchange_rate_cache = Redis()
        self.currency_service = CurrencyService()
    
    def get_localized_price(self, base_price, base_currency, target_currency, region):
        """Convert price to target currency with regional adjustments"""
        if base_currency == target_currency:
            return base_price
        
        # Get cached exchange rate
        rate_key = f"exchange_rate:{base_currency}:{target_currency}"
        exchange_rate = self.exchange_rate_cache.get(rate_key)
        
        if not exchange_rate:
            exchange_rate = self.currency_service.get_exchange_rate(
                base_currency, target_currency
            )
            # Cache for 1 hour
            self.exchange_rate_cache.setex(rate_key, 3600, exchange_rate)
        
        converted_price = base_price * float(exchange_rate)
        
        # Apply regional pricing adjustments
        regional_multiplier = self.get_regional_multiplier(region)
        final_price = converted_price * regional_multiplier
        
        return round(final_price, 2)
    
    def get_regional_multiplier(self, region):
        """Apply regional pricing strategies"""
        multipliers = {
            'US': 1.0,
            'EU': 1.2,  # Higher due to VAT
            'APAC': 0.9,  # Competitive pricing
            'LATAM': 0.8  # Emerging market pricing
        }
        return multipliers.get(region, 1.0)
```

## Performance Monitoring and Optimization (1 min)

### Key Metrics to Monitor
```python
# Performance monitoring dashboard
PERFORMANCE_METRICS = {
    'api_response_time': {
        'target': '< 200ms',
        'alert_threshold': '> 500ms'
    },
    'database_query_time': {
        'target': '< 50ms',
        'alert_threshold': '> 100ms'
    },
    'search_response_time': {
        'target': '< 100ms',
        'alert_threshold': '> 300ms'
    },
    'cache_hit_ratio': {
        'target': '> 90%',
        'alert_threshold': '< 80%'
    },
    'inventory_accuracy': {
        'target': '> 99.9%',
        'alert_threshold': '< 99%'
    },
    'order_processing_time': {
        'target': '< 30 seconds',
        'alert_threshold': '> 60 seconds'
    }
}
```

### Auto-scaling Triggers
- **CPU Usage**: Scale up when > 70% for 5 minutes
- **Memory Usage**: Scale up when > 80% for 3 minutes
- **Response Time**: Scale up when > 500ms for 2 minutes
- **Queue Depth**: Scale up when > 1000 messages for 1 minute
- **Error Rate**: Scale up when > 1% for 2 minutes
