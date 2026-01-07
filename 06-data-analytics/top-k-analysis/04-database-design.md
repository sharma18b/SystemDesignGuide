# Top-K Analysis System - Database Design

## Real-time Storage (Redis)

### Top-K Sorted Set
```
Key: topk:{dimension}:{window}
Type: Sorted Set
Score: Count
Member: Item ID
Example:
  topk:url:1hour
  - (score: 15234, member: "/home")
  - (score: 12341, member: "/products")
```

### Count-Min Sketch
```
Key: cms:{dimension}:{window}
Type: String (binary data)
Value: Serialized sketch
Size: 10 MB per sketch
```

## Historical Storage (ClickHouse)

### Events Table
```sql
CREATE TABLE events (
    timestamp DateTime,
    item_id String,
    dimension LowCardinality(String),
    count UInt64
)
ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (dimension, timestamp, item_id);
```

### Top-K Snapshots
```sql
CREATE TABLE topk_snapshots (
    timestamp DateTime,
    dimension LowCardinality(String),
    window LowCardinality(String),
    rank UInt8,
    item_id String,
    count UInt64
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (dimension, window, timestamp, rank);
```

This database design efficiently stores and queries top-K data.
