# Web Analytics Tool - Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
├─────────────────────────────────────────────────────────────────┤
│  Web Browsers  │  Mobile Apps  │  Server-side  │  IoT Devices  │
│  (JS SDK)      │  (Native SDK) │  (API)        │  (Embedded)   │
└────────┬────────────────┬────────────────┬──────────────────────┘
         │                │                │
         └────────────────┴────────────────┘
                          │
                    ┌─────▼─────┐
                    │    CDN    │ (Static Assets, SDK)
                    └─────┬─────┘
                          │
         ┌────────────────┴────────────────┐
         │                                  │
    ┌────▼────┐                      ┌─────▼─────┐
    │  Load   │                      │   API     │
    │ Balancer│                      │  Gateway  │
    └────┬────┘                      └─────┬─────┘
         │                                  │
┌────────┴──────────────────────────────────┴────────────┐
│              Ingestion Layer                            │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Tracking │  │  Event   │  │  Data    │             │
│  │ Endpoint │→ │Validator │→ │Enrichment│             │
│  └──────────┘  └──────────┘  └──────────┘             │
│         │             │              │                  │
│         └─────────────┴──────────────┘                 │
│                       │                                 │
│                  ┌────▼────┐                           │
│                  │  Kafka  │ (Event Stream)            │
│                  └────┬────┘                           │
└───────────────────────┼─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
│  Real-time   │ │   Batch     │ │  Session   │
│  Processing  │ │ Processing  │ │ Processor  │
│  (Flink)     │ │  (Spark)    │ │            │
└───────┬──────┘ └──────┬──────┘ └─────┬──────┘
        │               │               │
        └───────────────┴───────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
│  Event Store │ │ Aggregation │ │  Session   │
│ (ClickHouse) │ │Store (Druid)│ │Store(Redis)│
└───────┬──────┘ └──────┬──────┘ └─────┬──────┘
        │               │               │
        └───────────────┴───────────────┘
                        │
┌───────────────────────┼─────────────────────────────────┐
│              Query Layer                                 │
├──────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Query   │  │  Cache   │  │  Query   │              │
│  │ Optimizer│→ │  Layer   │→ │ Executor │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────┼─────────────────────────────────┐
│           Application Layer                              │
├──────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │Dashboard │  │ Reporting│  │   API    │              │
│  │ Service  │  │ Service  │  │ Service  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└───────────────────────┬──────────────────────────────────┘
                        │
                   ┌────▼────┐
                   │  Users  │
                   └─────────┘
```

## Component Architecture

### 1. Client Layer

#### JavaScript SDK
```javascript
// Lightweight tracking library
class AnalyticsSDK {
  constructor(trackingId, config) {
    this.trackingId = trackingId;
    this.config = config;
    this.queue = [];
    this.sessionId = this.generateSessionId();
    this.userId = this.getUserId();
    this.init();
  }

  // Track page view
  trackPageView(page, title) {
    this.track('pageview', {
      page: page,
      title: title,
      referrer: document.referrer,
      timestamp: Date.now()
    });
  }

  // Track custom event
  trackEvent(category, action, label, value) {
    this.track('event', {
      category, action, label, value,
      timestamp: Date.now()
    });
  }

  // Send to backend
  track(type, data) {
    const event = {
      type: type,
      tracking_id: this.trackingId,
      session_id: this.sessionId,
      user_id: this.userId,
      data: data,
      context: this.getContext()
    };
    
    this.queue.push(event);
    this.flush();
  }

  // Batch send events
  flush() {
    if (this.queue.length === 0) return;
    
    const events = this.queue.splice(0, 20);
    navigator.sendBeacon(
      this.config.endpoint,
      JSON.stringify(events)
    );
  }
}
```

#### Mobile SDK Architecture
```
┌─────────────────────────────────────┐
│         Mobile SDK                  │
├─────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐        │
│  │  Event   │  │  Queue   │        │
│  │ Tracker  │→ │ Manager  │        │
│  └──────────┘  └────┬─────┘        │
│                     │               │
│  ┌──────────┐  ┌───▼──────┐       │
│  │ Session  │  │  Batch   │        │
│  │ Manager  │  │  Sender  │        │
│  └──────────┘  └──────────┘        │
│                                     │
│  ┌──────────┐  ┌──────────┐       │
│  │ Offline  │  │  Config  │        │
│  │ Storage  │  │  Manager │        │
│  └──────────┘  └──────────┘        │
└─────────────────────────────────────┘
```

### 2. Ingestion Layer

#### Tracking Endpoint
```python
# High-performance event ingestion
class TrackingEndpoint:
    def __init__(self):
        self.validator = EventValidator()
        self.enricher = DataEnricher()
        self.kafka_producer = KafkaProducer()
    
    async def handle_event(self, request):
        # Parse and validate
        events = await request.json()
        valid_events = []
        
        for event in events:
            # Validate event structure
            if not self.validator.validate(event):
                continue
            
            # Enrich with server-side data
            enriched = self.enricher.enrich(event, request)
            valid_events.append(enriched)
        
        # Send to Kafka
        await self.kafka_producer.send_batch(
            topic='raw_events',
            events=valid_events
        )
        
        return {'status': 'ok', 'received': len(valid_events)}
```

#### Data Enrichment
```python
class DataEnricher:
    def enrich(self, event, request):
        # Add server-side metadata
        event['server_timestamp'] = time.time()
        event['ip_address'] = request.client.host
        
        # Geo-location lookup
        event['geo'] = self.geo_lookup(event['ip_address'])
        
        # User-agent parsing
        event['device'] = self.parse_user_agent(
            request.headers.get('user-agent')
        )
        
        # Bot detection
        event['is_bot'] = self.detect_bot(event)
        
        # Session enrichment
        event['session_info'] = self.get_session_info(
            event['session_id']
        )
        
        return event
```

### 3. Stream Processing Layer

#### Real-time Processing (Apache Flink)
```java
// Real-time event processing pipeline
public class RealTimeProcessor {
    public static void main(String[] args) {
        StreamExecutionEnvironment env = 
            StreamExecutionEnvironment.getExecutionEnvironment();
        
        // Read from Kafka
        DataStream<Event> events = env
            .addSource(new FlinkKafkaConsumer<>(
                "raw_events",
                new EventDeserializer(),
                properties
            ));
        
        // Filter bots
        DataStream<Event> validEvents = events
            .filter(event -> !event.isBot());
        
        // Sessionize events
        DataStream<Session> sessions = validEvents
            .keyBy(event -> event.getSessionId())
            .window(EventTimeSessionWindows.withGap(
                Time.minutes(30)
            ))
            .process(new SessionProcessor());
        
        // Real-time aggregations
        DataStream<Metric> metrics = validEvents
            .keyBy(event -> event.getWebsiteId())
            .timeWindow(Time.seconds(10))
            .aggregate(new MetricAggregator());
        
        // Write to stores
        metrics.addSink(new RedisSink());
        sessions.addSink(new ClickHouseSink());
        
        env.execute("Real-time Analytics");
    }
}
```

#### Batch Processing (Apache Spark)
```python
# Daily aggregation job
class DailyAggregation:
    def run(self, date):
        spark = SparkSession.builder.appName("DailyAgg").getOrCreate()
        
        # Read raw events
        events = spark.read.parquet(
            f"s3://events/{date}/*.parquet"
        )
        
        # Page view aggregations
        page_views = events \
            .filter(col("type") == "pageview") \
            .groupBy("website_id", "page", "date") \
            .agg(
                count("*").alias("views"),
                countDistinct("user_id").alias("unique_users"),
                avg("time_on_page").alias("avg_time")
            )
        
        # Traffic source aggregations
        sources = events \
            .groupBy("website_id", "source", "medium", "date") \
            .agg(
                count("*").alias("sessions"),
                countDistinct("user_id").alias("users"),
                sum("revenue").alias("revenue")
            )
        
        # Write to OLAP store
        page_views.write.format("druid").save()
        sources.write.format("druid").save()
```

### 4. Storage Layer

#### Event Store (ClickHouse)
```sql
-- Events table schema
CREATE TABLE events (
    event_id UUID,
    website_id String,
    session_id String,
    user_id String,
    event_type String,
    timestamp DateTime,
    page String,
    referrer String,
    ip_address String,
    country String,
    city String,
    device_type String,
    browser String,
    os String,
    properties Map(String, String),
    INDEX idx_website website_id TYPE bloom_filter,
    INDEX idx_session session_id TYPE bloom_filter,
    INDEX idx_timestamp timestamp TYPE minmax
)
ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (website_id, timestamp, event_id)
TTL timestamp + INTERVAL 14 MONTH;

-- Materialized view for page views
CREATE MATERIALIZED VIEW page_views_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMMDD(date)
ORDER BY (website_id, page, date)
AS SELECT
    website_id,
    page,
    toDate(timestamp) as date,
    count() as views,
    uniqExact(user_id) as unique_users,
    avg(time_on_page) as avg_time
FROM events
WHERE event_type = 'pageview'
GROUP BY website_id, page, date;
```

#### Aggregation Store (Apache Druid)
```json
{
  "dataSchema": {
    "dataSource": "page_views",
    "timestampSpec": {
      "column": "timestamp",
      "format": "auto"
    },
    "dimensionsSpec": {
      "dimensions": [
        "website_id",
        "page",
        "country",
        "device_type",
        "browser",
        "source",
        "medium"
      ]
    },
    "metricsSpec": [
      {"type": "count", "name": "views"},
      {"type": "hyperUnique", "name": "unique_users", "fieldName": "user_id"},
      {"type": "doubleSum", "name": "total_time", "fieldName": "time_on_page"},
      {"type": "doubleSum", "name": "revenue", "fieldName": "revenue"}
    ],
    "granularitySpec": {
      "segmentGranularity": "day",
      "queryGranularity": "minute",
      "rollup": true
    }
  }
}
```

### 5. Query Layer

#### Query Service
```python
class QueryService:
    def __init__(self):
        self.clickhouse = ClickHouseClient()
        self.druid = DruidClient()
        self.cache = RedisCache()
        self.optimizer = QueryOptimizer()
    
    async def execute_query(self, query_request):
        # Generate cache key
        cache_key = self.generate_cache_key(query_request)
        
        # Check cache
        cached = await self.cache.get(cache_key)
        if cached:
            return cached
        
        # Optimize query
        optimized = self.optimizer.optimize(query_request)
        
        # Route to appropriate store
        if optimized.is_realtime:
            result = await self.clickhouse.query(optimized)
        else:
            result = await self.druid.query(optimized)
        
        # Cache result
        await self.cache.set(
            cache_key,
            result,
            ttl=optimized.cache_ttl
        )
        
        return result
```

#### Query Optimizer
```python
class QueryOptimizer:
    def optimize(self, query):
        # Choose data source
        if query.time_range <= timedelta(days=7):
            query.data_source = 'clickhouse'  # Hot data
        else:
            query.data_source = 'druid'  # Aggregated data
        
        # Apply sampling for large datasets
        if query.estimated_rows > 10_000_000:
            query.sample_rate = 0.1
        
        # Push down filters
        query.filters = self.push_down_filters(query.filters)
        
        # Optimize aggregations
        if query.has_aggregations:
            query = self.use_materialized_views(query)
        
        # Set cache TTL
        query.cache_ttl = self.calculate_cache_ttl(query)
        
        return query
```

### 6. Application Layer

#### Dashboard Service
```python
class DashboardService:
    def __init__(self):
        self.query_service = QueryService()
        self.websocket_manager = WebSocketManager()
    
    async def get_realtime_dashboard(self, website_id):
        # Real-time metrics
        metrics = await self.query_service.execute_query({
            'website_id': website_id,
            'metrics': ['active_users', 'pageviews', 'events'],
            'time_range': 'last_30_minutes',
            'granularity': 'minute'
        })
        
        # Subscribe to real-time updates
        await self.websocket_manager.subscribe(
            website_id,
            self.send_realtime_updates
        )
        
        return metrics
    
    async def get_historical_report(self, website_id, date_range):
        # Historical data
        report = await self.query_service.execute_query({
            'website_id': website_id,
            'metrics': ['users', 'sessions', 'pageviews', 'bounce_rate'],
            'dimensions': ['date', 'source', 'device'],
            'date_range': date_range,
            'granularity': 'day'
        })
        
        return report
```

## Data Flow

### Event Ingestion Flow
```
1. Client sends event → Load Balancer
2. Load Balancer → Tracking Endpoint
3. Tracking Endpoint validates and enriches event
4. Enriched event → Kafka topic
5. Kafka → Stream processors (Flink)
6. Stream processors → Multiple stores:
   - ClickHouse (raw events)
   - Redis (real-time metrics)
   - Druid (aggregated data)
```

### Query Flow
```
1. User requests report → API Gateway
2. API Gateway → Query Service
3. Query Service checks cache
4. If cache miss:
   - Query Optimizer determines best data source
   - Execute query on ClickHouse or Druid
   - Cache result in Redis
5. Return result to user
```

### Real-time Update Flow
```
1. Event arrives → Flink processor
2. Flink updates real-time metrics in Redis
3. Redis pub/sub notifies Dashboard Service
4. Dashboard Service pushes update via WebSocket
5. User sees real-time update in dashboard
```

This architecture provides a scalable, performant foundation for a web analytics platform capable of handling billions of events while delivering real-time insights.
