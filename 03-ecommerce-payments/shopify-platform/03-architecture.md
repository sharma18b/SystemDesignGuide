# Architecture Design for Shopify Platform

*Estimated reading time: 20 minutes*

## High-Level Architecture Overview

The Shopify platform uses a multi-tenant microservices architecture with clear separation between merchant-facing services, customer-facing storefronts, and internal platform services.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Global CDN Layer                         │
├─────────────────────────────────────────────────────────────────┤
│                     Load Balancer / API Gateway                 │
├─────────────────────────────────────────────────────────────────┤
│  Storefront Services  │  Admin Services  │  Platform Services   │
│  ┌─────────────────┐  │  ┌─────────────┐ │  ┌─────────────────┐ │
│  │ Product Catalog │  │  │ Merchant    │ │  │ Tenant          │ │
│  │ Shopping Cart   │  │  │ Dashboard   │ │  │ Management      │ │
│  │ Checkout        │  │  │ Inventory   │ │  │ Billing         │ │
│  │ Search          │  │  │ Orders      │ │  │ Analytics       │ │
│  └─────────────────┘  │  │ Analytics   │ │  │ Notifications   │ │
│                       │  └─────────────┘ │  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                    Shared Platform Services                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │ Payment     │ │ Shipping    │ │ Notification│ │ File      │ │
│  │ Processing  │ │ & Logistics │ │ Service     │ │ Storage   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                      Data Layer                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │ Primary DB  │ │ Analytics   │ │ Search      │ │ Cache     │ │
│  │ (Sharded)   │ │ Warehouse   │ │ Engine      │ │ Layer     │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Core Service Architecture

### 1. Storefront Services

**Product Catalog Service**:
```python
class ProductCatalogService:
    def __init__(self):
        self.product_db = ShardedDatabase('products')
        self.search_engine = ElasticsearchCluster()
        self.cache = RedisCluster()
        self.cdn = CDNService()
    
    async def get_product(self, store_id, product_id):
        # Multi-level caching strategy
        cache_key = f"product:{store_id}:{product_id}"
        
        # L1: Local cache
        product = await self.cache.get(cache_key)
        if product:
            return product
        
        # L2: Database with read replica
        shard = self.product_db.get_shard(store_id)
        product = await shard.read_replica.get_product(product_id)
        
        # Cache for future requests
        await self.cache.set(cache_key, product, ttl=3600)
        return product
    
    async def search_products(self, store_id, query, filters):
        # Use Elasticsearch for complex search
        search_request = {
            'query': {
                'bool': {
                    'must': [
                        {'match': {'title': query}},
                        {'term': {'store_id': store_id}},
                        {'term': {'status': 'active'}}
                    ],
                    'filter': self.build_filters(filters)
                }
            },
            'sort': [{'popularity_score': 'desc'}]
        }
        
        return await self.search_engine.search(search_request)
```

**Shopping Cart Service**:
```python
class ShoppingCartService:
    def __init__(self):
        self.cart_cache = RedisCluster()
        self.inventory_service = InventoryService()
        self.pricing_service = PricingService()
    
    async def add_to_cart(self, session_id, store_id, product_id, quantity):
        # Check inventory availability
        available = await self.inventory_service.check_availability(
            store_id, product_id, quantity
        )
        
        if not available:
            raise InsufficientInventoryError()
        
        # Get current cart
        cart_key = f"cart:{session_id}:{store_id}"
        cart = await self.cart_cache.get(cart_key) or {'items': []}
        
        # Add item to cart
        cart['items'].append({
            'product_id': product_id,
            'quantity': quantity,
            'added_at': datetime.utcnow()
        })
        
        # Recalculate totals
        cart['totals'] = await self.pricing_service.calculate_cart_totals(
            store_id, cart['items']
        )
        
        # Save cart with expiration
        await self.cart_cache.set(cart_key, cart, ttl=86400)  # 24 hours
        
        return cart
```

### 2. Admin Services

**Merchant Dashboard Service**:
```python
class MerchantDashboardService:
    def __init__(self):
        self.analytics_db = AnalyticsDatabase()
        self.real_time_metrics = RedisCluster()
        self.notification_service = NotificationService()
    
    async def get_dashboard_data(self, merchant_id):
        # Parallel data fetching for dashboard
        tasks = [
            self.get_sales_metrics(merchant_id),
            self.get_traffic_metrics(merchant_id),
            self.get_inventory_alerts(merchant_id),
            self.get_recent_orders(merchant_id)
        ]
        
        sales, traffic, alerts, orders = await asyncio.gather(*tasks)
        
        return {
            'sales_metrics': sales,
            'traffic_metrics': traffic,
            'inventory_alerts': alerts,
            'recent_orders': orders,
            'last_updated': datetime.utcnow()
        }
    
    async def get_sales_metrics(self, merchant_id):
        # Real-time metrics from cache
        today_sales = await self.real_time_metrics.get(
            f"sales:today:{merchant_id}"
        )
        
        # Historical data from analytics DB
        historical_data = await self.analytics_db.get_sales_trend(
            merchant_id, days=30
        )
        
        return {
            'today_sales': today_sales,
            'monthly_trend': historical_data,
            'growth_rate': self.calculate_growth_rate(historical_data)
        }
```

**Inventory Management Service**:
```python
class InventoryManagementService:
    def __init__(self):
        self.inventory_db = ShardedDatabase('inventory')
        self.event_bus = EventBus()
        self.warehouse_integrations = WarehouseIntegrations()
    
    async def update_inventory(self, store_id, product_id, location_id, quantity_change):
        shard = self.inventory_db.get_shard(store_id)
        
        async with shard.transaction():
            # Get current inventory with row lock
            current_inventory = await shard.get_inventory_for_update(
                product_id, location_id
            )
            
            new_quantity = current_inventory.quantity + quantity_change
            
            if new_quantity < 0:
                raise InsufficientInventoryError()
            
            # Update inventory
            await shard.update_inventory(
                product_id, location_id, new_quantity
            )
            
            # Publish inventory change event
            await self.event_bus.publish('inventory.updated', {
                'store_id': store_id,
                'product_id': product_id,
                'location_id': location_id,
                'old_quantity': current_inventory.quantity,
                'new_quantity': new_quantity,
                'change': quantity_change
            })
            
            # Check for low stock alerts
            if new_quantity <= current_inventory.low_stock_threshold:
                await self.send_low_stock_alert(store_id, product_id, new_quantity)
```

### 3. Platform Services

**Tenant Management Service**:
```python
class TenantManagementService:
    def __init__(self):
        self.tenant_db = Database('tenants')
        self.resource_allocator = ResourceAllocator()
        self.billing_service = BillingService()
    
    async def create_store(self, merchant_id, store_config):
        # Generate unique store identifier
        store_id = self.generate_store_id()
        
        # Allocate resources based on plan
        resources = await self.resource_allocator.allocate_resources(
            store_id, store_config.plan
        )
        
        # Create tenant record
        tenant = {
            'store_id': store_id,
            'merchant_id': merchant_id,
            'plan': store_config.plan,
            'domain': store_config.domain,
            'resources': resources,
            'status': 'active',
            'created_at': datetime.utcnow()
        }
        
        await self.tenant_db.create_tenant(tenant)
        
        # Initialize store data
        await self.initialize_store_data(store_id, store_config)
        
        # Set up billing
        await self.billing_service.create_subscription(
            merchant_id, store_id, store_config.plan
        )
        
        return store_id
    
    async def initialize_store_data(self, store_id, config):
        # Create default store structure
        tasks = [
            self.create_default_collections(store_id),
            self.install_default_theme(store_id, config.theme),
            self.setup_payment_gateways(store_id, config.payment_methods),
            self.configure_shipping_zones(store_id, config.shipping_zones)
        ]
        
        await asyncio.gather(*tasks)
```

## Multi-Tenancy Architecture

### 1. Data Isolation Strategy

**Tenant-Aware Database Sharding**:
```python
class TenantAwareSharding:
    def __init__(self):
        self.shard_map = ShardMap()
        self.tenant_registry = TenantRegistry()
    
    def get_shard_for_tenant(self, store_id):
        # Consistent hashing for tenant distribution
        shard_key = self.calculate_shard_key(store_id)
        return self.shard_map.get_shard(shard_key)
    
    def calculate_shard_key(self, store_id):
        # Use store_id for consistent routing
        return hash(store_id) % self.shard_map.total_shards
    
    async def execute_tenant_query(self, store_id, query, params):
        # Automatically add tenant filter
        tenant_aware_query = self.add_tenant_filter(query, store_id)
        shard = self.get_shard_for_tenant(store_id)
        return await shard.execute(tenant_aware_query, params)
    
    def add_tenant_filter(self, query, store_id):
        # Ensure all queries include store_id filter
        if 'WHERE' in query.upper():
            return query.replace('WHERE', f'WHERE store_id = \'{store_id}\' AND')
        else:
            return query + f' WHERE store_id = \'{store_id}\''
```

### 2. Resource Isolation

**Tenant Resource Management**:
```python
class TenantResourceManager:
    def __init__(self):
        self.resource_pools = ResourcePools()
        self.quota_manager = QuotaManager()
    
    async def allocate_compute_resources(self, store_id, plan):
        quota = self.quota_manager.get_quota(plan)
        
        # Allocate based on plan limits
        allocation = {
            'cpu_cores': quota.cpu_cores,
            'memory_mb': quota.memory_mb,
            'storage_gb': quota.storage_gb,
            'bandwidth_gb': quota.bandwidth_gb,
            'api_requests_per_hour': quota.api_limit
        }
        
        # Reserve resources in appropriate pool
        pool = self.resource_pools.get_pool_for_plan(plan)
        await pool.reserve_resources(store_id, allocation)
        
        return allocation
    
    async def enforce_rate_limits(self, store_id, request_type):
        quota = await self.quota_manager.get_current_usage(store_id)
        limits = await self.quota_manager.get_limits(store_id)
        
        if quota.get(request_type, 0) >= limits.get(request_type, float('inf')):
            raise RateLimitExceededException(
                f"Rate limit exceeded for {request_type}"
            )
        
        await self.quota_manager.increment_usage(store_id, request_type)
```

## Event-Driven Architecture

### 1. Event Bus Implementation

**Distributed Event System**:
```python
class EventBusService:
    def __init__(self):
        self.kafka_cluster = KafkaCluster()
        self.event_store = EventStore()
        self.subscribers = SubscriberRegistry()
    
    async def publish_event(self, event_type, payload, store_id=None):
        event = {
            'event_id': str(uuid.uuid4()),
            'event_type': event_type,
            'payload': payload,
            'store_id': store_id,
            'timestamp': datetime.utcnow(),
            'version': 1
        }
        
        # Store event for audit and replay
        await self.event_store.store_event(event)
        
        # Publish to appropriate topic
        topic = self.get_topic_for_event(event_type)
        partition_key = store_id or event['event_id']
        
        await self.kafka_cluster.produce(
            topic=topic,
            key=partition_key,
            value=event
        )
    
    async def subscribe_to_events(self, event_types, handler):
        for event_type in event_types:
            topic = self.get_topic_for_event(event_type)
            await self.kafka_cluster.subscribe(topic, handler)
```

### 2. Event-Driven Workflows

**Order Processing Workflow**:
```python
class OrderProcessingWorkflow:
    def __init__(self):
        self.event_bus = EventBusService()
        self.payment_service = PaymentService()
        self.inventory_service = InventoryService()
        self.fulfillment_service = FulfillmentService()
    
    async def handle_order_created(self, event):
        order = event['payload']
        
        try:
            # Step 1: Reserve inventory
            await self.inventory_service.reserve_inventory(order)
            await self.event_bus.publish_event(
                'inventory.reserved', order, order['store_id']
            )
            
            # Step 2: Process payment
            payment_result = await self.payment_service.process_payment(order)
            await self.event_bus.publish_event(
                'payment.processed', payment_result, order['store_id']
            )
            
            # Step 3: Create fulfillment
            if payment_result['status'] == 'success':
                await self.fulfillment_service.create_fulfillment(order)
                await self.event_bus.publish_event(
                    'fulfillment.created', order, order['store_id']
                )
            
        except Exception as e:
            # Publish failure event for compensation
            await self.event_bus.publish_event(
                'order.processing.failed', 
                {'order_id': order['id'], 'error': str(e)},
                order['store_id']
            )
```

## API Gateway and Routing

### 1. Multi-Tenant API Gateway

**Tenant-Aware Routing**:
```python
class MultiTenantAPIGateway:
    def __init__(self):
        self.tenant_resolver = TenantResolver()
        self.rate_limiter = RateLimiter()
        self.auth_service = AuthService()
        self.service_registry = ServiceRegistry()
    
    async def handle_request(self, request):
        # Resolve tenant from request
        tenant_info = await self.tenant_resolver.resolve_tenant(request)
        
        # Authenticate request
        auth_context = await self.auth_service.authenticate(
            request, tenant_info
        )
        
        # Apply rate limiting
        await self.rate_limiter.check_limits(
            tenant_info.store_id, auth_context.user_id
        )
        
        # Route to appropriate service
        service = self.service_registry.get_service(request.path)
        
        # Add tenant context to request
        request.headers['X-Store-ID'] = tenant_info.store_id
        request.headers['X-Tenant-Plan'] = tenant_info.plan
        
        return await service.handle_request(request)
    
    async def resolve_tenant_from_domain(self, domain):
        # Support custom domains and subdomains
        if domain.endswith('.myshopify.com'):
            store_name = domain.split('.')[0]
            return await self.tenant_resolver.get_by_subdomain(store_name)
        else:
            return await self.tenant_resolver.get_by_custom_domain(domain)
```

### 2. Service Discovery and Load Balancing

**Dynamic Service Discovery**:
```python
class ServiceDiscovery:
    def __init__(self):
        self.consul_client = ConsulClient()
        self.health_checker = HealthChecker()
        self.load_balancer = LoadBalancer()
    
    async def register_service(self, service_name, instance_info):
        await self.consul_client.register_service({
            'name': service_name,
            'id': instance_info.instance_id,
            'address': instance_info.host,
            'port': instance_info.port,
            'health_check': {
                'http': f"http://{instance_info.host}:{instance_info.port}/health",
                'interval': '10s'
            },
            'tags': instance_info.tags
        })
    
    async def discover_service(self, service_name):
        healthy_instances = await self.consul_client.get_healthy_instances(
            service_name
        )
        
        return self.load_balancer.select_instance(
            healthy_instances, algorithm='round_robin'
        )
```

## Caching Architecture

### 1. Multi-Level Caching Strategy

**Hierarchical Caching**:
```python
class CachingService:
    def __init__(self):
        self.l1_cache = LocalCache()      # Application-level
        self.l2_cache = RedisCluster()    # Distributed cache
        self.l3_cache = CDNService()      # Edge cache
    
    async def get_cached_data(self, key, fetch_function):
        # L1: Check local cache
        data = await self.l1_cache.get(key)
        if data:
            return data
        
        # L2: Check distributed cache
        data = await self.l2_cache.get(key)
        if data:
            await self.l1_cache.set(key, data, ttl=300)  # 5 minutes
            return data
        
        # L3: Fetch from source
        data = await fetch_function()
        
        # Populate all cache levels
        await self.l2_cache.set(key, data, ttl=3600)     # 1 hour
        await self.l1_cache.set(key, data, ttl=300)      # 5 minutes
        
        return data
    
    async def invalidate_cache(self, pattern):
        # Invalidate across all cache levels
        await self.l1_cache.delete_pattern(pattern)
        await self.l2_cache.delete_pattern(pattern)
        await self.l3_cache.purge_pattern(pattern)
```

## Security Architecture

### 1. Zero-Trust Security Model

**Security Enforcement**:
```python
class SecurityEnforcement:
    def __init__(self):
        self.identity_service = IdentityService()
        self.policy_engine = PolicyEngine()
        self.audit_logger = AuditLogger()
    
    async def enforce_security(self, request, resource):
        # Verify identity
        identity = await self.identity_service.verify_identity(request)
        
        # Check authorization
        authorized = await self.policy_engine.check_authorization(
            identity, resource, request.action
        )
        
        if not authorized:
            await self.audit_logger.log_unauthorized_access(
                identity, resource, request
            )
            raise UnauthorizedException()
        
        # Log authorized access
        await self.audit_logger.log_access(identity, resource, request)
        
        return identity
```

This architecture provides a scalable, secure, and maintainable foundation for a multi-tenant e-commerce platform that can handle millions of merchants and their customers.
