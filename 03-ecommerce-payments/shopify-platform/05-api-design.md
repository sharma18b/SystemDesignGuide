# API Design for Shopify Platform

*Estimated reading time: 20 minutes*

## Overview

The Shopify platform requires a comprehensive API strategy that supports multiple client types (web, mobile, third-party apps), handles multi-tenancy, and provides both REST and GraphQL interfaces for different use cases.

## API Architecture Strategy

### 1. Multi-API Approach

**API Types and Use Cases**:
```python
class APIGateway:
    def __init__(self):
        self.apis = {
            'storefront_api': StorefrontAPI(),      # Customer-facing
            'admin_api': AdminAPI(),                # Merchant management
            'partner_api': PartnerAPI(),            # App developers
            'webhook_api': WebhookAPI(),            # Event notifications
            'graphql_api': GraphQLAPI()             # Flexible queries
        }
    
    def route_request(self, request):
        api_type = self.determine_api_type(request)
        return self.apis[api_type].handle_request(request)
```

### 2. Tenant-Aware API Design

**Multi-Tenant Request Handling**:
```python
class TenantAwareAPI:
    def __init__(self):
        self.tenant_resolver = TenantResolver()
        self.rate_limiter = TenantRateLimiter()
    
    async def handle_request(self, request):
        # Resolve tenant from request
        tenant = await self.tenant_resolver.resolve(request)
        
        # Apply tenant-specific rate limiting
        await self.rate_limiter.check_limits(tenant.store_id, request)
        
        # Add tenant context
        request.context.tenant = tenant
        request.headers['X-Shopify-Shop-Domain'] = tenant.domain
        
        return await self.process_request(request)
```

## Storefront API Design

### 1. Product Catalog APIs

**Product Retrieval**:
```python
# GET /api/storefront/products
class ProductAPI:
    async def list_products(self, request):
        """
        GET /api/storefront/products?limit=50&page=1&collection_id=123
        """
        params = {
            'store_id': request.context.tenant.store_id,
            'limit': min(int(request.query.get('limit', 50)), 250),
            'page': int(request.query.get('page', 1)),
            'collection_id': request.query.get('collection_id'),
            'product_type': request.query.get('product_type'),
            'vendor': request.query.get('vendor'),
            'tags': request.query.getlist('tags')
        }
        
        products = await self.product_service.get_products(params)
        
        return {
            'products': [self.serialize_product(p) for p in products],
            'pagination': {
                'current_page': params['page'],
                'total_pages': products.total_pages,
                'total_count': products.total_count
            }
        }
    
    def serialize_product(self, product):
        return {
            'id': product.id,
            'title': product.title,
            'handle': product.handle,
            'description': product.description,
            'product_type': product.product_type,
            'vendor': product.vendor,
            'tags': product.tags,
            'images': [self.serialize_image(img) for img in product.images],
            'variants': [self.serialize_variant(v) for v in product.variants],
            'options': [self.serialize_option(opt) for opt in product.options],
            'created_at': product.created_at.isoformat(),
            'updated_at': product.updated_at.isoformat()
        }
```

**Product Search API**:
```python
# GET /api/storefront/products/search
class ProductSearchAPI:
    async def search_products(self, request):
        """
        GET /api/storefront/products/search?q=shirt&filters[price][min]=10&filters[price][max]=100
        """
        search_params = {
            'store_id': request.context.tenant.store_id,
            'query': request.query.get('q', ''),
            'filters': self.parse_filters(request.query),
            'sort_by': request.query.get('sort_by', 'relevance'),
            'limit': min(int(request.query.get('limit', 20)), 100)
        }
        
        results = await self.search_service.search_products(search_params)
        
        return {
            'products': [self.serialize_product(p) for p in results.products],
            'facets': results.facets,
            'total_count': results.total_count,
            'search_time_ms': results.search_time
        }
    
    def parse_filters(self, query_params):
        filters = {}
        for key, value in query_params.items():
            if key.startswith('filters['):
                # Parse filters[price][min]=10 format
                filter_match = re.match(r'filters\[(\w+)\]\[(\w+)\]', key)
                if filter_match:
                    filter_name, filter_type = filter_match.groups()
                    if filter_name not in filters:
                        filters[filter_name] = {}
                    filters[filter_name][filter_type] = value
        return filters
```

### 2. Shopping Cart APIs

**Cart Management**:
```python
# POST /api/storefront/cart/add
class CartAPI:
    async def add_to_cart(self, request):
        """
        POST /api/storefront/cart/add
        {
            "variant_id": "123",
            "quantity": 2,
            "properties": {"gift_message": "Happy Birthday!"}
        }
        """
        data = await request.json()
        cart_token = request.cookies.get('cart_token') or self.generate_cart_token()
        
        cart_item = {
            'variant_id': data['variant_id'],
            'quantity': data['quantity'],
            'properties': data.get('properties', {})
        }
        
        # Validate variant and inventory
        variant = await self.product_service.get_variant(
            request.context.tenant.store_id, 
            cart_item['variant_id']
        )
        
        if not variant:
            raise APIError('Variant not found', 404)
        
        # Check inventory
        available = await self.inventory_service.check_availability(
            request.context.tenant.store_id,
            cart_item['variant_id'],
            cart_item['quantity']
        )
        
        if not available:
            raise APIError('Insufficient inventory', 400)
        
        # Add to cart
        cart = await self.cart_service.add_item(
            cart_token, 
            request.context.tenant.store_id,
            cart_item
        )
        
        response = self.serialize_cart(cart)
        response.set_cookie('cart_token', cart_token, max_age=86400*30)  # 30 days
        
        return response
    
    async def get_cart(self, request):
        """GET /api/storefront/cart"""
        cart_token = request.cookies.get('cart_token')
        if not cart_token:
            return {'cart': None}
        
        cart = await self.cart_service.get_cart(
            cart_token, 
            request.context.tenant.store_id
        )
        
        return {'cart': self.serialize_cart(cart)}
```

### 3. Checkout APIs

**Checkout Process**:
```python
# POST /api/storefront/checkouts
class CheckoutAPI:
    async def create_checkout(self, request):
        """
        POST /api/storefront/checkouts
        {
            "line_items": [
                {"variant_id": "123", "quantity": 2}
            ],
            "email": "customer@example.com"
        }
        """
        data = await request.json()
        
        checkout = await self.checkout_service.create_checkout(
            store_id=request.context.tenant.store_id,
            line_items=data['line_items'],
            email=data.get('email'),
            shipping_address=data.get('shipping_address'),
            billing_address=data.get('billing_address')
        )
        
        return {
            'checkout': self.serialize_checkout(checkout),
            'checkout_url': f"/checkouts/{checkout.token}"
        }
    
    async def update_checkout(self, request):
        """PUT /api/storefront/checkouts/{token}"""
        token = request.path_params['token']
        data = await request.json()
        
        checkout = await self.checkout_service.update_checkout(
            token=token,
            store_id=request.context.tenant.store_id,
            updates=data
        )
        
        return {'checkout': self.serialize_checkout(checkout)}
    
    async def complete_checkout(self, request):
        """POST /api/storefront/checkouts/{token}/complete"""
        token = request.path_params['token']
        data = await request.json()
        
        # Process payment
        payment_result = await self.payment_service.process_payment(
            checkout_token=token,
            payment_method=data['payment_method'],
            store_id=request.context.tenant.store_id
        )
        
        if payment_result.success:
            order = await self.order_service.create_order_from_checkout(
                token, payment_result
            )
            return {'order': self.serialize_order(order)}
        else:
            raise APIError('Payment failed', 400, payment_result.errors)
```

## Admin API Design

### 1. Store Management APIs

**Store Configuration**:
```python
# GET /api/admin/shop
class ShopAPI:
    async def get_shop(self, request):
        """GET /api/admin/shop"""
        store = await self.store_service.get_store(
            request.context.tenant.store_id
        )
        
        return {'shop': self.serialize_store(store)}
    
    async def update_shop(self, request):
        """PUT /api/admin/shop"""
        data = await request.json()
        
        # Validate permissions
        if not request.context.user.can_manage_store():
            raise APIError('Insufficient permissions', 403)
        
        store = await self.store_service.update_store(
            store_id=request.context.tenant.store_id,
            updates=data['shop']
        )
        
        return {'shop': self.serialize_store(store)}
```

### 2. Product Management APIs

**Product CRUD Operations**:
```python
# POST /api/admin/products
class AdminProductAPI:
    async def create_product(self, request):
        """
        POST /api/admin/products
        {
            "product": {
                "title": "New Product",
                "body_html": "<p>Description</p>",
                "vendor": "Acme Corp",
                "product_type": "Widget",
                "variants": [
                    {
                        "price": "10.00",
                        "sku": "WIDGET-001",
                        "inventory_quantity": 100
                    }
                ]
            }
        }
        """
        data = await request.json()
        
        # Validate product data
        product_data = data['product']
        self.validate_product_data(product_data)
        
        # Check plan limits
        await self.check_product_limits(request.context.tenant)
        
        product = await self.product_service.create_product(
            store_id=request.context.tenant.store_id,
            product_data=product_data,
            created_by=request.context.user.id
        )
        
        return {'product': self.serialize_admin_product(product)}, 201
    
    async def update_product(self, request):
        """PUT /api/admin/products/{product_id}"""
        product_id = request.path_params['product_id']
        data = await request.json()
        
        product = await self.product_service.update_product(
            store_id=request.context.tenant.store_id,
            product_id=product_id,
            updates=data['product'],
            updated_by=request.context.user.id
        )
        
        return {'product': self.serialize_admin_product(product)}
    
    async def delete_product(self, request):
        """DELETE /api/admin/products/{product_id}"""
        product_id = request.path_params['product_id']
        
        await self.product_service.delete_product(
            store_id=request.context.tenant.store_id,
            product_id=product_id,
            deleted_by=request.context.user.id
        )
        
        return {}, 204
```

### 3. Order Management APIs

**Order Processing**:
```python
# GET /api/admin/orders
class AdminOrderAPI:
    async def list_orders(self, request):
        """
        GET /api/admin/orders?status=open&limit=50&since_id=123
        """
        params = {
            'store_id': request.context.tenant.store_id,
            'status': request.query.get('status'),
            'financial_status': request.query.get('financial_status'),
            'fulfillment_status': request.query.get('fulfillment_status'),
            'limit': min(int(request.query.get('limit', 50)), 250),
            'since_id': request.query.get('since_id'),
            'created_at_min': request.query.get('created_at_min'),
            'created_at_max': request.query.get('created_at_max')
        }
        
        orders = await self.order_service.list_orders(params)
        
        return {
            'orders': [self.serialize_admin_order(o) for o in orders],
            'pagination': self.build_pagination_links(request, orders)
        }
    
    async def fulfill_order(self, request):
        """POST /api/admin/orders/{order_id}/fulfillments"""
        order_id = request.path_params['order_id']
        data = await request.json()
        
        fulfillment = await self.fulfillment_service.create_fulfillment(
            store_id=request.context.tenant.store_id,
            order_id=order_id,
            line_items=data['fulfillment']['line_items'],
            tracking_number=data['fulfillment'].get('tracking_number'),
            tracking_company=data['fulfillment'].get('tracking_company'),
            notify_customer=data['fulfillment'].get('notify_customer', True)
        )
        
        return {'fulfillment': self.serialize_fulfillment(fulfillment)}, 201
```

## GraphQL API Design

### 1. Schema Definition

**Core GraphQL Schema**:
```graphql
type Query {
  # Storefront queries
  products(
    first: Int
    after: String
    query: String
    sortKey: ProductSortKeys
    reverse: Boolean
  ): ProductConnection!
  
  product(id: ID, handle: String): Product
  
  collections(
    first: Int
    after: String
    query: String
  ): CollectionConnection!
  
  # Admin queries (requires authentication)
  shop: Shop
  orders(
    first: Int
    after: String
    query: String
  ): OrderConnection
}

type Mutation {
  # Cart mutations
  cartLinesAdd(cartId: ID!, lines: [CartLineInput!]!): CartLinesAddPayload
  cartLinesUpdate(cartId: ID!, lines: [CartLineUpdateInput!]!): CartLinesUpdatePayload
  cartLinesRemove(cartId: ID!, lineIds: [ID!]!): CartLinesRemovePayload
  
  # Checkout mutations
  checkoutCreate(input: CheckoutCreateInput!): CheckoutCreatePayload
  checkoutShippingAddressUpdate(checkoutId: ID!, shippingAddress: MailingAddressInput!): CheckoutShippingAddressUpdatePayload
  checkoutComplete(checkoutId: ID!): CheckoutCompletePayload
  
  # Admin mutations
  productCreate(input: ProductInput!): ProductCreatePayload
  productUpdate(input: ProductUpdateInput!): ProductUpdatePayload
  productDelete(input: ProductDeleteInput!): ProductDeletePayload
}

type Product {
  id: ID!
  title: String!
  handle: String!
  description: String
  descriptionHtml: HTML
  productType: String
  vendor: String
  tags: [String!]!
  images(first: Int, after: String): ImageConnection!
  variants(first: Int, after: String): ProductVariantConnection!
  options: [ProductOption!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### 2. GraphQL Resolvers

**Efficient Data Loading**:
```python
class GraphQLResolvers:
    def __init__(self):
        self.product_loader = DataLoader(self.load_products)
        self.variant_loader = DataLoader(self.load_variants)
        self.image_loader = DataLoader(self.load_images)
    
    async def resolve_product(self, info, id=None, handle=None):
        store_id = info.context.tenant.store_id
        
        if id:
            return await self.product_loader.load((store_id, id))
        elif handle:
            return await self.product_service.get_product_by_handle(
                store_id, handle
            )
        
        raise ValueError("Must provide either id or handle")
    
    async def resolve_product_variants(self, product, info, first=10, after=None):
        # Use DataLoader to batch variant requests
        variants = await self.variant_loader.load_many([
            (product.store_id, variant_id) 
            for variant_id in product.variant_ids
        ])
        
        return self.paginate_results(variants, first, after)
    
    async def load_products(self, keys):
        # Batch load products by (store_id, product_id) tuples
        store_product_map = {}
        for store_id, product_id in keys:
            if store_id not in store_product_map:
                store_product_map[store_id] = []
            store_product_map[store_id].append(product_id)
        
        results = {}
        for store_id, product_ids in store_product_map.items():
            products = await self.product_service.get_products_by_ids(
                store_id, product_ids
            )
            for product in products:
                results[(store_id, product.id)] = product
        
        return [results.get(key) for key in keys]
```

## Webhook API Design

### 1. Webhook Management

**Webhook Registration**:
```python
# POST /api/admin/webhooks
class WebhookAPI:
    async def create_webhook(self, request):
        """
        POST /api/admin/webhooks
        {
            "webhook": {
                "topic": "orders/create",
                "address": "https://example.com/webhooks/orders/create",
                "format": "json"
            }
        }
        """
        data = await request.json()
        webhook_data = data['webhook']
        
        # Validate webhook URL
        await self.validate_webhook_url(webhook_data['address'])
        
        webhook = await self.webhook_service.create_webhook(
            store_id=request.context.tenant.store_id,
            topic=webhook_data['topic'],
            address=webhook_data['address'],
            format=webhook_data.get('format', 'json'),
            created_by=request.context.user.id
        )
        
        return {'webhook': self.serialize_webhook(webhook)}, 201
    
    async def validate_webhook_url(self, url):
        # Verify URL is accessible and returns 200
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=5.0)
                if response.status_code != 200:
                    raise APIError('Webhook URL not accessible', 400)
        except httpx.RequestError:
            raise APIError('Invalid webhook URL', 400)
```

### 2. Webhook Delivery System

**Event Publishing and Delivery**:
```python
class WebhookDeliveryService:
    def __init__(self):
        self.delivery_queue = DeliveryQueue()
        self.retry_scheduler = RetryScheduler()
    
    async def publish_event(self, store_id, topic, payload):
        # Get all webhooks for this topic
        webhooks = await self.webhook_service.get_webhooks_for_topic(
            store_id, topic
        )
        
        # Queue delivery for each webhook
        for webhook in webhooks:
            delivery_job = {
                'webhook_id': webhook.id,
                'store_id': store_id,
                'topic': topic,
                'payload': payload,
                'attempt': 1,
                'max_attempts': 5
            }
            
            await self.delivery_queue.enqueue(delivery_job)
    
    async def deliver_webhook(self, delivery_job):
        webhook = await self.webhook_service.get_webhook(
            delivery_job['webhook_id']
        )
        
        # Prepare webhook payload
        webhook_payload = {
            'id': str(uuid.uuid4()),
            'topic': delivery_job['topic'],
            'created_at': datetime.utcnow().isoformat(),
            'data': delivery_job['payload']
        }
        
        # Calculate HMAC signature
        signature = self.calculate_hmac_signature(
            webhook.secret, json.dumps(webhook_payload)
        )
        
        headers = {
            'Content-Type': 'application/json',
            'X-Shopify-Topic': delivery_job['topic'],
            'X-Shopify-Hmac-Sha256': signature,
            'X-Shopify-Shop-Domain': webhook.store.domain
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    webhook.address,
                    json=webhook_payload,
                    headers=headers,
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    await self.webhook_service.mark_delivery_success(
                        delivery_job['webhook_id']
                    )
                else:
                    await self.handle_delivery_failure(delivery_job, response)
                    
        except Exception as e:
            await self.handle_delivery_failure(delivery_job, str(e))
```

## API Security and Authentication

### 1. Authentication Methods

**Multiple Auth Strategies**:
```python
class AuthenticationService:
    def __init__(self):
        self.jwt_service = JWTService()
        self.api_key_service = APIKeyService()
        self.oauth_service = OAuthService()
    
    async def authenticate_request(self, request):
        auth_header = request.headers.get('Authorization', '')
        
        if auth_header.startswith('Bearer '):
            # JWT token authentication
            token = auth_header[7:]
            return await self.jwt_service.verify_token(token)
        
        elif auth_header.startswith('Basic '):
            # API key authentication
            credentials = auth_header[6:]
            return await self.api_key_service.verify_credentials(credentials)
        
        elif 'X-Shopify-Access-Token' in request.headers:
            # OAuth access token
            access_token = request.headers['X-Shopify-Access-Token']
            return await self.oauth_service.verify_access_token(access_token)
        
        else:
            raise AuthenticationError('No valid authentication provided')
```

### 2. Rate Limiting

**Tenant-Aware Rate Limiting**:
```python
class TenantRateLimiter:
    def __init__(self):
        self.redis = RedisClient()
        self.rate_limits = {
            'basic': {'requests_per_minute': 500, 'burst': 100},
            'professional': {'requests_per_minute': 2000, 'burst': 400},
            'enterprise': {'requests_per_minute': 10000, 'burst': 2000}
        }
    
    async def check_limits(self, store_id, request):
        store = await self.store_service.get_store(store_id)
        limits = self.rate_limits[store.plan]
        
        # Sliding window rate limiting
        current_minute = int(time.time() / 60)
        key = f"rate_limit:{store_id}:{current_minute}"
        
        current_count = await self.redis.incr(key)
        await self.redis.expire(key, 60)
        
        if current_count > limits['requests_per_minute']:
            raise RateLimitExceededError(
                f"Rate limit exceeded: {current_count}/{limits['requests_per_minute']}"
            )
        
        # Add rate limit headers
        request.response_headers.update({
            'X-RateLimit-Limit': str(limits['requests_per_minute']),
            'X-RateLimit-Remaining': str(limits['requests_per_minute'] - current_count),
            'X-RateLimit-Reset': str((current_minute + 1) * 60)
        })
```

This comprehensive API design provides a scalable, secure foundation for the Shopify platform, supporting multiple client types while maintaining multi-tenant isolation and performance.
