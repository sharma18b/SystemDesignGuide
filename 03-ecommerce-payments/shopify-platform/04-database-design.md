# Database Design for Shopify Platform

*Estimated reading time: 20 minutes*

## Overview

The Shopify platform requires a sophisticated database design that supports multi-tenancy, handles massive scale, and maintains data isolation between merchants while enabling efficient queries and analytics.

## Multi-Tenant Database Strategy

### 1. Tenant Isolation Approach

**Shared Database with Tenant ID**:
```sql
-- All tables include store_id for tenant isolation
CREATE TABLE stores (
    store_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    custom_domain VARCHAR(255),
    plan_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Row Level Security for automatic tenant filtering
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY store_isolation_policy ON stores
    USING (store_id = current_setting('app.current_store_id')::UUID);
```

### 2. Database Sharding Strategy

**Shard by Store ID**:
```python
class DatabaseSharding:
    def __init__(self):
        self.shard_count = 64  # Number of database shards
        self.shard_map = self.initialize_shard_map()
    
    def get_shard_for_store(self, store_id):
        # Consistent hashing for even distribution
        shard_number = hash(str(store_id)) % self.shard_count
        return self.shard_map[shard_number]
    
    def get_connection(self, store_id, read_only=False):
        shard = self.get_shard_for_store(store_id)
        
        if read_only:
            # Use read replica for read operations
            return shard.read_replica_pool.get_connection()
        else:
            # Use primary for write operations
            return shard.primary_pool.get_connection()
```

## Core Entity Design

### 1. Store and Merchant Management

**Store Configuration**:
```sql
CREATE TABLE stores (
    store_id UUID PRIMARY KEY,
    merchant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    domain VARCHAR(255) UNIQUE,
    custom_domain VARCHAR(255),
    plan_type VARCHAR(50) NOT NULL,
    currency CHAR(3) DEFAULT 'USD',
    timezone VARCHAR(50) DEFAULT 'UTC',
    country_code CHAR(2),
    language_code CHAR(2) DEFAULT 'en',
    status VARCHAR(20) DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_stores_merchant_id ON stores(merchant_id);
CREATE INDEX idx_stores_domain ON stores(domain);
CREATE INDEX idx_stores_custom_domain ON stores(custom_domain);

-- Store themes and customization
CREATE TABLE store_themes (
    theme_id UUID PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(store_id),
    name VARCHAR(255) NOT NULL,
    template_id UUID,
    custom_css TEXT,
    custom_html TEXT,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Merchant Information**:
```sql
CREATE TABLE merchants (
    merchant_id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company_name VARCHAR(255),
    phone VARCHAR(20),
    address JSONB,
    tax_id VARCHAR(50),
    business_type VARCHAR(50),
    verification_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Merchant authentication
CREATE TABLE merchant_auth (
    merchant_id UUID PRIMARY KEY REFERENCES merchants(merchant_id),
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(255) NOT NULL,
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255),
    last_login TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP
);
```

### 2. Product Catalog Design

**Products and Variants**:
```sql
CREATE TABLE products (
    product_id UUID PRIMARY KEY,
    store_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    product_type VARCHAR(100),
    vendor VARCHAR(100),
    tags TEXT[],
    handle VARCHAR(255), -- URL slug
    seo_title VARCHAR(255),
    seo_description TEXT,
    status VARCHAR(20) DEFAULT 'draft',
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Partition by store_id for better performance
CREATE TABLE products_partitioned (
    LIKE products INCLUDING ALL
) PARTITION BY HASH (store_id);

-- Create partitions
CREATE TABLE products_partition_0 PARTITION OF products_partitioned
    FOR VALUES WITH (MODULUS 16, REMAINDER 0);
-- ... create 15 more partitions

CREATE INDEX idx_products_store_status ON products(store_id, status);
CREATE INDEX idx_products_handle ON products(store_id, handle);
CREATE INDEX idx_products_tags ON products USING GIN(tags);

-- Product variants for different options (size, color, etc.)
CREATE TABLE product_variants (
    variant_id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(product_id),
    store_id UUID NOT NULL,
    title VARCHAR(255),
    sku VARCHAR(100),
    barcode VARCHAR(100),
    price DECIMAL(15,2) NOT NULL,
    compare_at_price DECIMAL(15,2),
    cost_per_item DECIMAL(15,2),
    weight DECIMAL(10,3),
    weight_unit VARCHAR(10) DEFAULT 'kg',
    requires_shipping BOOLEAN DEFAULT true,
    taxable BOOLEAN DEFAULT true,
    inventory_policy VARCHAR(20) DEFAULT 'deny',
    fulfillment_service VARCHAR(50) DEFAULT 'manual',
    inventory_management VARCHAR(50),
    position INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(store_id, sku);
```

**Product Options and Values**:
```sql
-- Product options (Color, Size, Material, etc.)
CREATE TABLE product_options (
    option_id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(product_id),
    store_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL, -- "Color", "Size"
    position INTEGER DEFAULT 1,
    values TEXT[] NOT NULL -- ["Red", "Blue", "Green"]
);

-- Variant option values (specific combination)
CREATE TABLE variant_option_values (
    variant_id UUID REFERENCES product_variants(variant_id),
    option_id UUID REFERENCES product_options(option_id),
    value VARCHAR(100) NOT NULL,
    PRIMARY KEY (variant_id, option_id)
);
```

### 3. Inventory Management

**Inventory Tracking**:
```sql
CREATE TABLE inventory_locations (
    location_id UUID PRIMARY KEY,
    store_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    address JSONB,
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE inventory_levels (
    variant_id UUID REFERENCES product_variants(variant_id),
    location_id UUID REFERENCES inventory_locations(location_id),
    store_id UUID NOT NULL,
    available INTEGER NOT NULL DEFAULT 0,
    committed INTEGER NOT NULL DEFAULT 0, -- Reserved for orders
    on_hand INTEGER NOT NULL DEFAULT 0,   -- Physical inventory
    reserved INTEGER NOT NULL DEFAULT 0,  -- Reserved for other reasons
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (variant_id, location_id)
);

-- Inventory movements for audit trail
CREATE TABLE inventory_movements (
    movement_id UUID PRIMARY KEY,
    variant_id UUID NOT NULL,
    location_id UUID NOT NULL,
    store_id UUID NOT NULL,
    quantity_change INTEGER NOT NULL,
    reason VARCHAR(50) NOT NULL, -- 'sale', 'restock', 'adjustment'
    reference_id UUID, -- Order ID, adjustment ID, etc.
    created_at TIMESTAMP DEFAULT NOW()
);

-- Partitioned by date for efficient archival
CREATE TABLE inventory_movements_partitioned (
    LIKE inventory_movements INCLUDING ALL
) PARTITION BY RANGE (created_at);
```

### 4. Order Management

**Orders and Line Items**:
```sql
CREATE TABLE orders (
    order_id UUID PRIMARY KEY,
    store_id UUID NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    customer_id UUID,
    email VARCHAR(255),
    phone VARCHAR(20),
    
    -- Financial information
    subtotal_price DECIMAL(15,2) NOT NULL,
    total_tax DECIMAL(15,2) DEFAULT 0,
    total_discounts DECIMAL(15,2) DEFAULT 0,
    total_shipping DECIMAL(15,2) DEFAULT 0,
    total_price DECIMAL(15,2) NOT NULL,
    currency CHAR(3) NOT NULL,
    
    -- Status tracking
    financial_status VARCHAR(20) DEFAULT 'pending',
    fulfillment_status VARCHAR(20) DEFAULT 'unfulfilled',
    
    -- Addresses
    billing_address JSONB,
    shipping_address JSONB,
    
    -- Metadata
    tags TEXT[],
    note TEXT,
    source_name VARCHAR(50),
    
    -- Timestamps
    processed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    closed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Partition orders by date for better performance
CREATE TABLE orders_partitioned (
    LIKE orders INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE orders_2024_01 PARTITION OF orders_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE INDEX idx_orders_store_status ON orders(store_id, financial_status, fulfillment_status);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_number ON orders(store_id, order_number);

-- Order line items
CREATE TABLE order_line_items (
    line_item_id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(order_id),
    store_id UUID NOT NULL,
    variant_id UUID REFERENCES product_variants(variant_id),
    product_id UUID NOT NULL,
    
    -- Product information (snapshot at time of order)
    title VARCHAR(255) NOT NULL,
    variant_title VARCHAR(255),
    sku VARCHAR(100),
    
    -- Pricing and quantity
    quantity INTEGER NOT NULL,
    price DECIMAL(15,2) NOT NULL,
    total_discount DECIMAL(15,2) DEFAULT 0,
    
    -- Fulfillment
    fulfillment_status VARCHAR(20) DEFAULT 'unfulfilled',
    fulfillment_service VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 5. Customer Management

**Customer Profiles**:
```sql
CREATE TABLE customers (
    customer_id UUID PRIMARY KEY,
    store_id UUID NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    
    -- Customer status
    accepts_marketing BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    state VARCHAR(20) DEFAULT 'enabled', -- enabled, disabled, invited
    
    -- Statistics
    orders_count INTEGER DEFAULT 0,
    total_spent DECIMAL(15,2) DEFAULT 0,
    last_order_id UUID,
    last_order_date TIMESTAMP,
    
    -- Metadata
    tags TEXT[],
    note TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(store_id, email)
);

CREATE INDEX idx_customers_store_email ON customers(store_id, email);
CREATE INDEX idx_customers_phone ON customers(store_id, phone);

-- Customer addresses
CREATE TABLE customer_addresses (
    address_id UUID PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(customer_id),
    store_id UUID NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company VARCHAR(255),
    address1 VARCHAR(255) NOT NULL,
    address2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    province VARCHAR(100),
    country CHAR(2) NOT NULL,
    zip VARCHAR(20),
    phone VARCHAR(20),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Analytics and Reporting Schema

### 1. Sales Analytics

**Aggregated Sales Data**:
```sql
-- Daily sales summary for fast reporting
CREATE TABLE daily_sales_summary (
    summary_date DATE,
    store_id UUID,
    currency CHAR(3),
    
    -- Order metrics
    orders_count INTEGER DEFAULT 0,
    gross_sales DECIMAL(15,2) DEFAULT 0,
    net_sales DECIMAL(15,2) DEFAULT 0,
    total_tax DECIMAL(15,2) DEFAULT 0,
    total_discounts DECIMAL(15,2) DEFAULT 0,
    total_shipping DECIMAL(15,2) DEFAULT 0,
    
    -- Customer metrics
    new_customers INTEGER DEFAULT 0,
    returning_customers INTEGER DEFAULT 0,
    
    -- Product metrics
    units_sold INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (summary_date, store_id, currency)
);

-- Materialized view for real-time analytics
CREATE MATERIALIZED VIEW hourly_sales_mv AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    store_id,
    currency,
    COUNT(*) as orders_count,
    SUM(total_price) as gross_sales,
    SUM(subtotal_price) as net_sales,
    COUNT(DISTINCT customer_id) as unique_customers
FROM orders
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at), store_id, currency;

-- Refresh materialized view every 5 minutes
CREATE OR REPLACE FUNCTION refresh_hourly_sales_mv()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY hourly_sales_mv;
END;
$$ LANGUAGE plpgsql;
```

### 2. Product Performance Analytics

**Product Analytics Schema**:
```sql
CREATE TABLE product_analytics (
    analytics_date DATE,
    store_id UUID,
    product_id UUID,
    variant_id UUID,
    
    -- Sales metrics
    units_sold INTEGER DEFAULT 0,
    gross_sales DECIMAL(15,2) DEFAULT 0,
    net_sales DECIMAL(15,2) DEFAULT 0,
    
    -- Traffic metrics
    page_views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    add_to_cart INTEGER DEFAULT 0,
    
    -- Conversion metrics
    conversion_rate DECIMAL(5,4) DEFAULT 0,
    cart_abandonment_rate DECIMAL(5,4) DEFAULT 0,
    
    PRIMARY KEY (analytics_date, store_id, product_id, variant_id)
);

-- Indexes for common queries
CREATE INDEX idx_product_analytics_store_date ON product_analytics(store_id, analytics_date);
CREATE INDEX idx_product_analytics_product ON product_analytics(product_id, analytics_date);
```

## Performance Optimization

### 1. Indexing Strategy

**Composite Indexes for Multi-Tenant Queries**:
```sql
-- Always include store_id as first column for tenant isolation
CREATE INDEX idx_products_store_status_created ON products(store_id, status, created_at);
CREATE INDEX idx_orders_store_financial_created ON orders(store_id, financial_status, created_at);
CREATE INDEX idx_customers_store_updated ON customers(store_id, updated_at);

-- Partial indexes for common filtered queries
CREATE INDEX idx_products_published ON products(store_id, published_at) 
    WHERE status = 'active';

CREATE INDEX idx_orders_pending ON orders(store_id, created_at) 
    WHERE financial_status = 'pending';

-- GIN indexes for JSONB and array columns
CREATE INDEX idx_stores_settings ON stores USING GIN(settings);
CREATE INDEX idx_products_tags ON products USING GIN(tags);
CREATE INDEX idx_orders_billing_address ON orders USING GIN(billing_address);
```

### 2. Query Optimization Patterns

**Efficient Multi-Tenant Queries**:
```python
class OptimizedQueries:
    def __init__(self, db_connection):
        self.db = db_connection
    
    async def get_store_products(self, store_id, limit=50, offset=0):
        # Always filter by store_id first for partition pruning
        query = """
        SELECT p.product_id, p.title, p.status, p.created_at,
               COUNT(pv.variant_id) as variant_count
        FROM products p
        LEFT JOIN product_variants pv ON p.product_id = pv.product_id
        WHERE p.store_id = $1 AND p.status = 'active'
        GROUP BY p.product_id, p.title, p.status, p.created_at
        ORDER BY p.created_at DESC
        LIMIT $2 OFFSET $3
        """
        
        return await self.db.fetch(query, store_id, limit, offset)
    
    async def get_order_summary(self, store_id, date_range):
        # Use materialized view for better performance
        query = """
        SELECT 
            summary_date,
            orders_count,
            gross_sales,
            net_sales
        FROM daily_sales_summary
        WHERE store_id = $1 
        AND summary_date BETWEEN $2 AND $3
        ORDER BY summary_date DESC
        """
        
        return await self.db.fetch(query, store_id, date_range.start, date_range.end)
```

## Data Archival and Retention

### 1. Time-Based Partitioning

**Automated Partition Management**:
```sql
-- Function to create monthly partitions
CREATE OR REPLACE FUNCTION create_monthly_partition(
    table_name TEXT,
    start_date DATE
) RETURNS void AS $$
DECLARE
    partition_name TEXT;
    end_date DATE;
BEGIN
    partition_name := table_name || '_' || TO_CHAR(start_date, 'YYYY_MM');
    end_date := start_date + INTERVAL '1 month';
    
    EXECUTE format('CREATE TABLE %I PARTITION OF %I 
                   FOR VALUES FROM (%L) TO (%L)',
                   partition_name, table_name, start_date, end_date);
    
    -- Create indexes on new partition
    EXECUTE format('CREATE INDEX %I ON %I (store_id, created_at)',
                   'idx_' || partition_name || '_store_created', partition_name);
END;
$$ LANGUAGE plpgsql;

-- Automated partition creation job
CREATE OR REPLACE FUNCTION maintain_partitions() RETURNS void AS $$
BEGIN
    -- Create next month's partition
    PERFORM create_monthly_partition('orders_partitioned', 
                                   DATE_TRUNC('month', NOW() + INTERVAL '1 month'));
    
    -- Archive old partitions (older than 2 years)
    PERFORM archive_old_partition('orders_partitioned',
                                DATE_TRUNC('month', NOW() - INTERVAL '2 years'));
END;
$$ LANGUAGE plpgsql;
```

### 2. Data Lifecycle Management

**Automated Data Archival**:
```python
class DataLifecycleManager:
    def __init__(self):
        self.db = DatabaseConnection()
        self.archive_storage = ArchiveStorage()
    
    async def archive_old_data(self):
        # Archive orders older than 2 years
        cutoff_date = datetime.now() - timedelta(days=730)
        
        # Export to archive storage
        old_orders = await self.db.fetch("""
            SELECT * FROM orders 
            WHERE created_at < $1
        """, cutoff_date)
        
        await self.archive_storage.store_orders(old_orders)
        
        # Drop old partitions
        await self.db.execute("""
            DROP TABLE IF EXISTS orders_2022_01 CASCADE
        """)
    
    async def cleanup_analytics_data(self):
        # Keep detailed analytics for 1 year, aggregated for 7 years
        one_year_ago = datetime.now() - timedelta(days=365)
        
        # Aggregate daily data to monthly
        await self.db.execute("""
            INSERT INTO monthly_sales_summary 
            SELECT 
                DATE_TRUNC('month', summary_date) as month,
                store_id,
                currency,
                SUM(orders_count) as orders_count,
                SUM(gross_sales) as gross_sales,
                SUM(net_sales) as net_sales
            FROM daily_sales_summary
            WHERE summary_date < $1
            GROUP BY DATE_TRUNC('month', summary_date), store_id, currency
            ON CONFLICT (month, store_id, currency) DO UPDATE SET
                orders_count = EXCLUDED.orders_count,
                gross_sales = EXCLUDED.gross_sales,
                net_sales = EXCLUDED.net_sales
        """, one_year_ago)
        
        # Delete old daily data
        await self.db.execute("""
            DELETE FROM daily_sales_summary 
            WHERE summary_date < $1
        """, one_year_ago)
```

This database design provides a scalable, performant foundation for a multi-tenant e-commerce platform while maintaining data isolation, supporting complex analytics, and enabling efficient operations at massive scale.
