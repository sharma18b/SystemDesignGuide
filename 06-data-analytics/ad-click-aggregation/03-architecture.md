# Ad Click Aggregation - Architecture

## High-Level Architecture

```
┌─────────────────────────────────────┐
│        Ad Servers / Websites         │
└────────────┬────────────────────────┘
             │ Click Events
        ┌────▼────┐
        │   CDN   │ (Click Tracking Pixel)
        └────┬────┘
             │
        ┌────▼────────────────────────┐
        │  Click Ingestion Service    │
        │  (Validation, Deduplication)│
        └────┬────────────────────────┘
             │
        ┌────▼────┐
        │  Kafka  │ (Click Stream)
        └────┬────┘
             │
     ┌───────┴───────┐
     │               │
┌────▼────┐    ┌─────▼─────┐
│  Fraud  │    │   Real-   │
│Detection│    │   time    │
│ Service │    │Aggregation│
└────┬────┘    │  (Flink)  │
     │         └─────┬─────┘
     │               │
     └───────┬───────┘
             │
     ┌───────┴────────┐
     │                │
┌────▼────┐    ┌──────▼──────┐
│  Raw    │    │ Aggregated  │
│ Clicks  │    │   Counts    │
│(ClickH.)│    │ (ClickHouse)│
└─────────┘    └──────┬──────┘
                      │
               ┌──────▼──────┐
               │  Dashboard  │
               │   & API     │
               └─────────────┘
```

## Components

### 1. Click Ingestion
- Receive clicks via tracking pixel
- Validate click data
- Deduplicate within window
- Enrich with metadata

### 2. Fraud Detection
- Real-time fraud scoring
- Bot detection
- IP reputation check
- Pattern analysis

### 3. Stream Processing
- Flink for aggregation
- Tumbling windows (1min, 1hour)
- Exactly-once semantics
- State management

### 4. Storage
- Raw clicks in ClickHouse
- Aggregates in ClickHouse
- Fast queries
- Time-based partitioning

### 5. Query Layer
- Real-time dashboards
- Billing reports
- Analytics API
- Historical queries

## Data Flow

### Click Processing
```
1. Click arrives at CDN
2. Ingestion service validates
3. Deduplicate in Redis
4. Send to Kafka
5. Fraud detection
6. Flink aggregation
7. Store in ClickHouse
```

This architecture provides accurate, real-time ad click aggregation at massive scale.
