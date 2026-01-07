# Top-K Analysis System - Architecture

## High-Level Architecture

```
┌─────────────────────────────────┐
│      Event Sources              │
│  (Apps, APIs, Clickstreams)     │
└────────────┬────────────────────┘
             │
        ┌────▼────┐
        │  Kafka  │ (Event Stream)
        └────┬────┘
             │
        ┌────▼────────────────────┐
        │  Stream Processing      │
        │  (Flink)                │
        │  - Count-Min Sketch     │
        │  - Heavy Hitters        │
        │  - Space Saving         │
        └────┬────────────────────┘
             │
     ┌───────┴────────┐
     │                │
┌────▼────┐    ┌──────▼──────┐
│  Redis  │    │  ClickHouse │
│(Real-time│    │ (Historical)│
│ Top-K)  │    │             │
└────┬────┘    └──────┬──────┘
     │                │
     └────────┬───────┘
              │
        ┌─────▼─────┐
        │  API      │
        │  Service  │
        └───────────┘
```

## Algorithms

### 1. Count-Min Sketch
- Probabilistic counting
- O(1) update and query
- Space: O(K log N)
- Accuracy: ε error with δ probability

### 2. Heavy Hitters
- Identify frequent items
- Misra-Gries algorithm
- Space: O(K)
- Guarantees top-K

### 3. Space Saving
- Stream-Summary algorithm
- Maintains top-K with counts
- Space: O(K)
- Better accuracy than Count-Min

## Data Flow

### Real-time Processing
```
1. Events arrive in Kafka
2. Flink processes stream
3. Update Count-Min Sketch
4. Update Heavy Hitters
5. Store top-K in Redis
6. Persist to ClickHouse
```

### Query Flow
```
1. API receives top-K request
2. Check Redis cache
3. If miss, query ClickHouse
4. Merge and rank results
5. Return top-K list
```

This architecture provides accurate, real-time top-K analysis at scale.
