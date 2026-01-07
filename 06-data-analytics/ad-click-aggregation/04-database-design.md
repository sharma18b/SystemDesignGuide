# Ad Click Aggregation - Database Design

## Raw Clicks Table (ClickHouse)

```sql
CREATE TABLE clicks (
    click_id UUID,
    timestamp DateTime64(3),
    ad_id UInt64,
    campaign_id UInt64,
    advertiser_id UInt64,
    user_id String,
    ip_address IPv4,
    country LowCardinality(String),
    device_type LowCardinality(String),
    is_fraud UInt8,
    cost_per_click Decimal(10,4)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (advertiser_id, timestamp, click_id)
TTL timestamp + INTERVAL 90 DAY;
```

## Aggregated Clicks

```sql
CREATE TABLE clicks_aggregated (
    timestamp DateTime,
    advertiser_id UInt64,
    campaign_id UInt64,
    ad_id UInt64,
    country LowCardinality(String),
    device_type LowCardinality(String),
    click_count UInt64,
    unique_users UInt64,
    total_cost Decimal(18,4),
    fraud_count UInt64
)
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (advertiser_id, campaign_id, timestamp);
```

## Deduplication Cache (Redis)

```
Key: click:{click_id}
Value: 1
TTL: 300 seconds (5 minutes)
```

## Fraud Scores (Redis)

```
Key: fraud:{user_id}:{hour}
Value: click_count
TTL: 3600 seconds
```

This database design ensures accurate click tracking and fast aggregation queries.
