# E-commerce Database Design

## Overview (2 mins)
E-commerce platforms require sophisticated database designs to handle complex relationships between products, users, orders, and inventory while maintaining ACID properties for financial transactions and supporting high-performance queries.

## Database Architecture Strategy (3 mins)

### Polyglot Persistence Approach
Different data types require different database technologies:

- **Transactional Data**: PostgreSQL (orders, payments, users)
- **Product Catalog**: MongoDB (flexible product attributes)
- **Search**: Elasticsearch (full-text search, faceted search)
- **Cache**: Redis (sessions, frequently accessed data)
- **Analytics**: ClickHouse (time-series data, reporting)

### Data Partitioning Strategy
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Shard 1  │    │   User Shard 2  │    │   User Shard 3  │
│   (users 1-1M)  │    │  (users 1M-2M)  │    │  (users 2M-3M)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Order Shard 1  │    │  Order Shard 2  │    │  Order Shard 3  │
│  (by user_id)   │    │  (by user_id)   │    │  (by user_id)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Core Database Schemas (10 mins)

### 1. User Management Schema (PostgreSQL)

```sql
-- Users table with authentication
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    date_of_birth DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP
);

-- User addresses for shipping/billing
CREATE TABLE user_addresses (
    address_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    address_type VARCHAR(20) CHECK (address_type IN ('shipping', 'billing')),
    is_default BOOLEAN DEFAULT false,
    street_address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(2) NOT NULL, -- ISO country code
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User payment methods
CREATE TABLE user_payment_methods (
    payment_method_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    payment_type VARCHAR(20) CHECK (payment_type IN ('credit_card', 'debit_card', 'paypal', 'bank_account')),
    is_default BOOLEAN DEFAULT false,
    card_last_four VARCHAR(4), -- Only store last 4 digits
    card_brand VARCHAR(20), -- Visa, MasterCard, etc.
    expiry_month INTEGER,
    expiry_year INTEGER,
    billing_address_id UUID REFERENCES user_addresses(address_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX idx_user_payment_methods_user_id ON user_payment_methods(user_id);
```

### 2. Product Catalog Schema (MongoDB)

```javascript
// Products collection with flexible schema
{
  "_id": ObjectId("..."),
  "sku": "LAPTOP-DELL-XPS13-001",
  "title": "Dell XPS 13 Laptop",
  "description": "High-performance ultrabook with Intel i7 processor",
  "brand": "Dell",
  "category": {
    "primary": "Electronics",
    "secondary": "Computers",
    "tertiary": "Laptops"
  },
  "attributes": {
    "processor": "Intel Core i7-1165G7",
    "memory": "16GB LPDDR4x",
    "storage": "512GB SSD",
    "display": "13.3-inch FHD+",
    "weight": "2.64 lbs",
    "color": "Platinum Silver"
  },
  "pricing": {
    "base_price": 1299.99,
    "currency": "USD",
    "discount_percentage": 0,
    "final_price": 1299.99,
    "tax_inclusive": false
  },
  "inventory": {
    "total_stock": 150,
    "available_stock": 142,
    "reserved_stock": 8,
    "reorder_level": 20,
    "supplier_id": "SUPPLIER-DELL-001"
  },
  "media": {
    "primary_image": "https://cdn.example.com/products/laptop-dell-xps13-001-main.jpg",
    "additional_images": [
      "https://cdn.example.com/products/laptop-dell-xps13-001-side.jpg",
      "https://cdn.example.com/products/laptop-dell-xps13-001-back.jpg"
    ],
    "videos": []
  },
  "seo": {
    "meta_title": "Dell XPS 13 Laptop - High Performance Ultrabook",
    "meta_description": "Shop the Dell XPS 13 laptop with Intel i7 processor...",
    "keywords": ["laptop", "dell", "xps", "ultrabook", "intel i7"]
  },
  "status": "active",
  "created_at": ISODate("2024-01-01T00:00:00Z"),
  "updated_at": ISODate("2024-01-01T00:00:00Z"),
  "created_by": "admin@example.com"
}

// Categories collection for hierarchy
{
  "_id": ObjectId("..."),
  "name": "Laptops",
  "slug": "laptops",
  "parent_category": "Computers",
  "level": 3,
  "path": "Electronics > Computers > Laptops",
  "description": "Portable computers for work and entertainment",
  "is_active": true,
  "sort_order": 1
}
```

### 3. Order Management Schema (PostgreSQL)

```sql
-- Orders table
CREATE TABLE orders (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL, -- Human-readable order number
    user_id UUID REFERENCES users(user_id),
    order_status VARCHAR(20) DEFAULT 'pending' CHECK (
        order_status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')
    ),
    
    -- Pricing information
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    shipping_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Address information (denormalized for historical accuracy)
    shipping_address JSONB NOT NULL,
    billing_address JSONB NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    
    -- Additional metadata
    payment_method VARCHAR(50),
    shipping_method VARCHAR(50),
    notes TEXT
);

-- Order items table
CREATE TABLE order_items (
    order_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id VARCHAR(100) NOT NULL, -- Reference to MongoDB product
    sku VARCHAR(100) NOT NULL,
    
    -- Product information (denormalized for historical accuracy)
    product_name VARCHAR(255) NOT NULL,
    product_attributes JSONB, -- Color, size, etc.
    
    -- Pricing and quantity
    unit_price DECIMAL(10,2) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    total_price DECIMAL(10,2) NOT NULL,
    
    -- Fulfillment information
    fulfillment_status VARCHAR(20) DEFAULT 'pending' CHECK (
        fulfillment_status IN ('pending', 'allocated', 'picked', 'packed', 'shipped', 'delivered')
    ),
    warehouse_id VARCHAR(50),
    tracking_number VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order status history for audit trail
CREATE TABLE order_status_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
    previous_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_by UUID REFERENCES users(user_id),
    change_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
```

### 4. Inventory Management Schema (PostgreSQL)

```sql
-- Warehouses table
CREATE TABLE warehouses (
    warehouse_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory table with real-time stock levels
CREATE TABLE inventory (
    inventory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR(100) NOT NULL, -- Reference to MongoDB product
    warehouse_id VARCHAR(50) REFERENCES warehouses(warehouse_id),
    
    -- Stock levels
    total_stock INTEGER NOT NULL DEFAULT 0,
    available_stock INTEGER NOT NULL DEFAULT 0,
    reserved_stock INTEGER NOT NULL DEFAULT 0,
    damaged_stock INTEGER NOT NULL DEFAULT 0,
    
    -- Reorder information
    reorder_level INTEGER NOT NULL DEFAULT 0,
    max_stock_level INTEGER,
    
    -- Timestamps
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_restock_date TIMESTAMP,
    
    -- Constraints
    CONSTRAINT check_stock_levels CHECK (
        total_stock = available_stock + reserved_stock + damaged_stock
    ),
    UNIQUE(product_id, warehouse_id)
);

-- Inventory movements for audit trail
CREATE TABLE inventory_movements (
    movement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR(100) NOT NULL,
    warehouse_id VARCHAR(50) REFERENCES warehouses(warehouse_id),
    
    -- Movement details
    movement_type VARCHAR(20) NOT NULL CHECK (
        movement_type IN ('inbound', 'outbound', 'transfer', 'adjustment', 'damage', 'return')
    ),
    quantity INTEGER NOT NULL,
    reference_id UUID, -- Order ID, transfer ID, etc.
    reference_type VARCHAR(50), -- 'order', 'transfer', 'adjustment'
    
    -- Stock levels after movement
    stock_after_movement INTEGER NOT NULL,
    
    -- Metadata
    reason TEXT,
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for inventory queries
CREATE INDEX idx_inventory_product_warehouse ON inventory(product_id, warehouse_id);
CREATE INDEX idx_inventory_available_stock ON inventory(available_stock);
CREATE INDEX idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_created_at ON inventory_movements(created_at);
```

## Search and Analytics (3 mins)

### Elasticsearch Product Index

```json
{
  "mappings": {
    "properties": {
      "sku": {"type": "keyword"},
      "title": {
        "type": "text",
        "analyzer": "standard",
        "fields": {
          "keyword": {"type": "keyword"},
          "suggest": {"type": "completion"}
        }
      },
      "description": {"type": "text"},
      "brand": {"type": "keyword"},
      "category": {
        "properties": {
          "primary": {"type": "keyword"},
          "secondary": {"type": "keyword"},
          "tertiary": {"type": "keyword"}
        }
      },
      "attributes": {"type": "object", "dynamic": true},
      "pricing": {
        "properties": {
          "final_price": {"type": "double"},
          "currency": {"type": "keyword"}
        }
      },
      "inventory": {
        "properties": {
          "available_stock": {"type": "integer"}
        }
      },
      "status": {"type": "keyword"},
      "created_at": {"type": "date"}
    }
  }
}
```

### Redis Caching Strategy

```python
# Product cache with TTL
CACHE_KEYS = {
    'product_detail': 'product:{product_id}',  # TTL: 1 hour
    'product_search': 'search:{query_hash}',   # TTL: 30 minutes
    'user_cart': 'cart:{user_id}',             # TTL: 7 days
    'inventory_level': 'inventory:{product_id}:{warehouse_id}',  # TTL: 5 minutes
    'user_session': 'session:{session_id}',   # TTL: 24 hours
}

# Cache warming for popular products
def warm_product_cache():
    popular_products = get_popular_products(limit=1000)
    for product in popular_products:
        cache_key = CACHE_KEYS['product_detail'].format(product_id=product.id)
        redis_client.setex(cache_key, 3600, json.dumps(product.to_dict()))
```

## Data Consistency and Transactions (2 mins)

### ACID Transactions for Critical Operations

```sql
-- Order placement with inventory reservation
BEGIN;

-- 1. Create order
INSERT INTO orders (user_id, total_amount, order_status) 
VALUES (?, ?, 'pending') RETURNING order_id;

-- 2. Reserve inventory
UPDATE inventory 
SET available_stock = available_stock - ?,
    reserved_stock = reserved_stock + ?
WHERE product_id = ? AND warehouse_id = ? 
AND available_stock >= ?;

-- 3. Create order items
INSERT INTO order_items (order_id, product_id, quantity, unit_price)
VALUES (?, ?, ?, ?);

-- 4. Record inventory movement
INSERT INTO inventory_movements (product_id, warehouse_id, movement_type, quantity, reference_id)
VALUES (?, ?, 'outbound', ?, ?);

COMMIT;
```

### Eventual Consistency for Non-Critical Data

```python
# Product updates propagated via events
class ProductUpdateHandler:
    def handle_product_updated(self, event):
        # Update search index asynchronously
        elasticsearch_client.index(
            index='products',
            id=event.product_id,
            body=event.product_data
        )
        
        # Update cache
        cache_key = f"product:{event.product_id}"
        redis_client.setex(cache_key, 3600, json.dumps(event.product_data))
        
        # Update recommendation engine
        recommendation_service.update_product(event.product_id, event.product_data)
```

## Performance Optimization Strategies

### Database Indexing Strategy
- **Primary Keys**: UUID with proper clustering
- **Foreign Keys**: Always indexed for joins
- **Query Patterns**: Index on commonly filtered columns
- **Composite Indexes**: For multi-column WHERE clauses
- **Partial Indexes**: For filtered queries (e.g., active products only)

### Connection Pooling and Read Replicas
```python
# Database connection configuration
DATABASE_CONFIG = {
    'master': {
        'host': 'db-master.example.com',
        'max_connections': 20,
        'connection_timeout': 30
    },
    'read_replicas': [
        {'host': 'db-replica-1.example.com', 'weight': 1},
        {'host': 'db-replica-2.example.com', 'weight': 1}
    ]
}
```
