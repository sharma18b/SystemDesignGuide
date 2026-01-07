# Web Analytics Tool - Database Design

## Database Selection Strategy

### Data Store Types
```
1. Event Store: ClickHouse (time-series, raw events)
2. Aggregation Store: Apache Druid (OLAP, pre-aggregated)
3. Metadata Store: PostgreSQL (websites, users, config)
4. Session Store: Redis (active sessions, real-time)
5. Cache Layer: Redis (query results, hot data)
6. Object Storage: S3 (raw logs, backups, cold data)
```

## Event Store Schema (ClickHouse)

### Raw Events Table
```sql
CREATE TABLE events_distributed ON CLUSTER analytics AS events_local;

CREATE TABLE events_local (
    -- Identifiers
    event_id UUID DEFAULT generateUUIDv4(),
    website_id String,
    session_id String,
    user_id String,
    
    -- Event data
    event_type LowCardinality(String),  -- pageview, event, transaction
    event_category LowCardinality(String),
    event_action String,
    event_label String,
    event_value Float64,
    
    -- Timestamps
    client_timestamp DateTime64(3),
    server_timestamp DateTime64(3) DEFAULT now64(),
    
    -- Page data
    page_url String,
    page_title String,
    page_referrer String,
    page_path String,
    
    -- User data
    ip_address IPv4,
    user_agent String,
    
    -- Geo data
    country LowCardinality(String),
    region String,
    city String,
    latitude Float32,
    longitude Float32,
    
    -- Device data
    device_type LowCardinality(String),  -- desktop, mobile, tablet
    device_brand String,
    device_model String,
    os LowCardinality(String),
    os_version String,
    browser LowCardinality(String),
    browser_version String,
    screen_resolution String,
    
    -- Traffic source
    traffic_source LowCardinality(String),  -- organic, paid, direct, referral
    traffic_medium LowCardinality(String),
    traffic_campaign String,
    traffic_keyword String,
    
    -- E-commerce data (nullable)
    transaction_id Nullable(String),
    transaction_revenue Nullable(Float64),
    transaction_tax Nullable(Float64),
    transaction_shipping Nullable(Float64),
    product_sku Nullable(String),
    product_name Nullable(String),
    product_category Nullable(String),
    product_price Nullable(Float64),
    product_quantity Nullable(Int32),
    
    -- Custom dimensions (up to 20)
    custom_dimension_1 String DEFAULT '',
    custom_dimension_2 String DEFAULT '',
    custom_dimension_3 String DEFAULT '',
    -- ... up to custom_dimension_20
    
    -- Custom metrics (up to 20)
    custom_metric_1 Float64 DEFAULT 0,
    custom_metric_2 Float64 DEFAULT 0,
    custom_metric_3 Float64 DEFAULT 0,
    -- ... up to custom_metric_20
    
    -- Metadata
    is_bot UInt8 DEFAULT 0,
    is_duplicate UInt8 DEFAULT 0,
    sdk_version String,
    
    -- Indexes
    INDEX idx_website website_id TYPE bloom_filter GRANULARITY 4,
    INDEX idx_session session_id TYPE bloom_filter GRANULARITY 4,
    INDEX idx_user user_id TYPE bloom_filter GRANULARITY 4,
    INDEX idx_page page_path TYPE tokenbf_v1(30000, 3, 0) GRANULARITY 4
)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{shard}/events_local', '{replica}')
PARTITION BY toYYYYMMDD(server_timestamp)
ORDER BY (website_id, server_timestamp, event_id)
TTL server_timestamp + INTERVAL 14 MONTH
SETTINGS index_granularity = 8192;
```

### Sessions Table
```sql
CREATE TABLE sessions_local (
    session_id String,
    website_id String,
    user_id String,
    
    -- Session timing
    session_start DateTime,
    session_end DateTime,
    session_duration UInt32,  -- seconds
    
    -- Session metrics
    pageviews UInt32,
    events UInt32,
    transactions UInt32,
    revenue Float64,
    
    -- Entry/exit
    landing_page String,
    exit_page String,
    
    -- Traffic source
    traffic_source LowCardinality(String),
    traffic_medium LowCardinality(String),
    traffic_campaign String,
    
    -- Device
    device_type LowCardinality(String),
    browser LowCardinality(String),
    os LowCardinality(String),
    
    -- Geo
    country LowCardinality(String),
    city String,
    
    -- Behavior
    is_bounce UInt8,  -- single page session
    is_conversion UInt8,
    
    INDEX idx_website website_id TYPE bloom_filter GRANULARITY 4,
    INDEX idx_user user_id TYPE bloom_filter GRANULARITY 4
)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{shard}/sessions_local', '{replica}')
PARTITION BY toYYYYMM(session_start)
ORDER BY (website_id, session_start, session_id)
TTL session_start + INTERVAL 14 MONTH;
```

### Materialized Views for Aggregations

#### Hourly Page Views
```sql
CREATE MATERIALIZED VIEW page_views_hourly_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (website_id, page_path, hour, country, device_type)
AS SELECT
    website_id,
    page_path,
    toStartOfHour(server_timestamp) as hour,
    country,
    device_type,
    count() as pageviews,
    uniqExact(user_id) as unique_users,
    uniqExact(session_id) as sessions,
    avg(time_on_page) as avg_time_on_page,
    sum(CASE WHEN is_bounce = 1 THEN 1 ELSE 0 END) as bounces
FROM events_local
WHERE event_type = 'pageview'
GROUP BY website_id, page_path, hour, country, device_type;
```

#### Daily Traffic Sources
```sql
CREATE MATERIALIZED VIEW traffic_sources_daily_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (website_id, date, traffic_source, traffic_medium)
AS SELECT
    website_id,
    toDate(session_start) as date,
    traffic_source,
    traffic_medium,
    traffic_campaign,
    count() as sessions,
    uniqExact(user_id) as users,
    sum(pageviews) as pageviews,
    sum(revenue) as revenue,
    sum(transactions) as transactions,
    avg(session_duration) as avg_session_duration,
    sum(is_bounce) / count() as bounce_rate
FROM sessions_local
GROUP BY website_id, date, traffic_source, traffic_medium, traffic_campaign;
```

## Aggregation Store (Apache Druid)

### Page Views Datasource
```json
{
  "type": "index_parallel",
  "spec": {
    "dataSchema": {
      "dataSource": "page_views",
      "timestampSpec": {
        "column": "timestamp",
        "format": "auto"
      },
      "dimensionsSpec": {
        "dimensions": [
          "website_id",
          "page_path",
          "page_title",
          "country",
          "region",
          "city",
          "device_type",
          "browser",
          "os",
          "traffic_source",
          "traffic_medium",
          "traffic_campaign"
        ]
      },
      "metricsSpec": [
        {"type": "count", "name": "pageviews"},
        {"type": "hyperUnique", "name": "unique_users", "fieldName": "user_id"},
        {"type": "hyperUnique", "name": "unique_sessions", "fieldName": "session_id"},
        {"type": "doubleSum", "name": "total_time", "fieldName": "time_on_page"},
        {"type": "doubleSum", "name": "bounces", "fieldName": "is_bounce"}
      ],
      "granularitySpec": {
        "type": "uniform",
        "segmentGranularity": "day",
        "queryGranularity": "minute",
        "rollup": true
      }
    },
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "kafka",
        "consumerProperties": {
          "bootstrap.servers": "kafka:9092"
        },
        "topic": "page_views"
      },
      "inputFormat": {
        "type": "json"
      }
    },
    "tuningConfig": {
      "type": "index_parallel",
      "maxRowsPerSegment": 5000000,
      "maxRowsInMemory": 1000000
    }
  }
}
```

## Metadata Store (PostgreSQL)

### Websites Table
```sql
CREATE TABLE websites (
    website_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_id VARCHAR(50) UNIQUE NOT NULL,
    domain VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    owner_user_id UUID NOT NULL REFERENCES users(user_id),
    
    -- Configuration
    timezone VARCHAR(50) DEFAULT 'UTC',
    currency VARCHAR(3) DEFAULT 'USD',
    industry VARCHAR(100),
    
    -- Settings
    bot_filtering_enabled BOOLEAN DEFAULT true,
    ip_anonymization_enabled BOOLEAN DEFAULT false,
    data_retention_days INTEGER DEFAULT 426,  -- 14 months
    sampling_rate DECIMAL(3,2) DEFAULT 1.00,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active',  -- active, paused, deleted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_owner (owner_user_id),
    INDEX idx_tracking (tracking_id),
    INDEX idx_status (status)
);

CREATE TABLE website_properties (
    property_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL REFERENCES websites(website_id) ON DELETE CASCADE,
    property_key VARCHAR(100) NOT NULL,
    property_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(website_id, property_key)
);
```

### Users and Permissions
```sql
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Profile
    company VARCHAR(255),
    role VARCHAR(100),
    
    -- Status
    email_verified BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_status (status)
);

CREATE TABLE website_permissions (
    permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL REFERENCES websites(website_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,  -- owner, admin, editor, viewer
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES users(user_id),
    
    UNIQUE(website_id, user_id),
    INDEX idx_website (website_id),
    INDEX idx_user (user_id)
);
```

### Goals and Conversions
```sql
CREATE TABLE goals (
    goal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL REFERENCES websites(website_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,  -- destination, duration, pages_per_session, event
    
    -- Goal configuration
    match_type VARCHAR(20),  -- equals, begins_with, regex
    value TEXT,
    value_numeric DECIMAL(10,2),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_website (website_id),
    INDEX idx_active (is_active)
);

CREATE TABLE funnels (
    funnel_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL REFERENCES websites(website_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Configuration
    steps JSONB NOT NULL,  -- Array of step definitions
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_website (website_id)
);
```

### Custom Dimensions and Metrics
```sql
CREATE TABLE custom_dimensions (
    dimension_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL REFERENCES websites(website_id) ON DELETE CASCADE,
    index INTEGER NOT NULL CHECK (index BETWEEN 1 AND 20),
    name VARCHAR(100) NOT NULL,
    scope VARCHAR(20) NOT NULL,  -- hit, session, user
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(website_id, index),
    INDEX idx_website (website_id)
);

CREATE TABLE custom_metrics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL REFERENCES websites(website_id) ON DELETE CASCADE,
    index INTEGER NOT NULL CHECK (index BETWEEN 1 AND 20),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL,  -- integer, currency, time
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(website_id, index),
    INDEX idx_website (website_id)
);
```

## Session Store (Redis)

### Active Sessions
```
Key Pattern: session:{session_id}
Type: Hash
TTL: 30 minutes
Fields:
  - website_id: UUID
  - user_id: UUID
  - start_time: timestamp
  - last_activity: timestamp
  - pageviews: counter
  - events: counter
  - landing_page: string
  - current_page: string
  - device_type: string
  - country: string
```

### Real-time Metrics
```
Key Pattern: realtime:{website_id}:{minute}
Type: Hash
TTL: 1 hour
Fields:
  - active_users: HyperLogLog
  - pageviews: counter
  - events: counter
  - top_pages: sorted set
  - top_countries: sorted set
```

### User Tracking
```
Key Pattern: user:{user_id}:sessions
Type: Sorted Set
Score: timestamp
Value: session_id
TTL: 90 days
```

## Data Partitioning Strategy

### ClickHouse Partitioning
```sql
-- Partition by date for time-based queries
PARTITION BY toYYYYMMDD(server_timestamp)

-- Shard by website_id for horizontal scaling
-- Sharding key: cityHash64(website_id) % num_shards

-- Benefits:
-- 1. Easy TTL management (drop old partitions)
-- 2. Efficient time-range queries
-- 3. Parallel query execution
-- 4. Balanced load distribution
```

### Druid Partitioning
```
Segment Granularity: DAY
- Each day's data in separate segments
- Parallel query processing
- Easy data management

Time Chunk: 1 day
Partition Size: 5 million rows
- Optimal query performance
- Balanced segment sizes
```

## Data Retention and Archival

### Retention Tiers
```
Hot Tier (0-7 days):
- Storage: NVMe SSD
- Replication: 3x
- Access: Real-time queries
- Cost: High

Warm Tier (8-90 days):
- Storage: SSD
- Replication: 2x
- Access: Standard queries
- Cost: Medium

Cold Tier (91-426 days):
- Storage: HDD / S3
- Replication: 1x + S3
- Access: Historical queries
- Cost: Low

Archive (426+ days):
- Storage: S3 Glacier
- Replication: S3 (11 9's)
- Access: On-demand restore
- Cost: Very low
```

### Archival Process
```python
class DataArchival:
    def archive_old_data(self, cutoff_date):
        # Export to Parquet
        events = self.clickhouse.query(f"""
            SELECT *
            FROM events
            WHERE toDate(server_timestamp) = '{cutoff_date}'
        """)
        
        # Write to S3
        parquet_file = f"s3://analytics-archive/{cutoff_date}.parquet"
        events.to_parquet(parquet_file, compression='snappy')
        
        # Drop partition
        self.clickhouse.execute(f"""
            ALTER TABLE events
            DROP PARTITION '{cutoff_date.strftime('%Y%m%d')}'
        """)
```

## Query Optimization

### Indexes
```sql
-- Bloom filter for high-cardinality columns
INDEX idx_website website_id TYPE bloom_filter GRANULARITY 4

-- Token bloom filter for text search
INDEX idx_page page_path TYPE tokenbf_v1(30000, 3, 0) GRANULARITY 4

-- MinMax for range queries
INDEX idx_timestamp server_timestamp TYPE minmax GRANULARITY 1
```

### Materialized Views
```sql
-- Pre-aggregate common queries
CREATE MATERIALIZED VIEW daily_summary_mv
AS SELECT
    website_id,
    toDate(server_timestamp) as date,
    count() as events,
    uniqExact(user_id) as users,
    uniqExact(session_id) as sessions
FROM events
GROUP BY website_id, date;
```

This database design provides a robust foundation for storing and querying massive amounts of analytics data efficiently.
