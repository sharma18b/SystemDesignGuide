# Database Batch Auditing Service - System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Production Databases                        │
│  (PostgreSQL, MySQL, Oracle, SQL Server)                │
└─────────────────┬───────────────────────────────────────┘
                  │
        ┌─────────▼─────────┐
        │  CDC Agents       │
        │  (Debezium/Maxwell)│
        └─────────┬─────────┘
                  │
        ┌─────────▼─────────┐
        │  Message Queue    │
        │  (Kafka)          │
        └─────────┬─────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼────┐  ┌────▼───┐  ┌─────▼──┐
│Processor│ │Processor│ │Processor│
│ Node 1  │ │ Node 2  │ │ Node 3 │
└───┬────┘  └────┬───┘  └────┬───┘
    │            │           │
    └────────────┴───────────┘
                 │
        ┌────────▼────────┐
        │  Audit Storage  │
        │ (ClickHouse/S3) │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │  Query API      │
        │  Reporting UI   │
        └─────────────────┘
```

## Core Components

### Change Data Capture (CDC)
```
Responsibilities:
- Monitor database logs
- Capture changes in real-time
- Minimal database overhead
- Reliable delivery

Technologies:
- Debezium (Kafka Connect)
- Maxwell (MySQL)
- Oracle GoldenGate
- SQL Server CDC
```

### Audit Processor
```
Processing Pipeline:
1. Validate change records
2. Enrich with metadata
3. Detect anomalies
4. Apply retention policies
5. Store in audit database
```

### Storage Layer
```
ClickHouse for Analytics:
- Fast columnar storage
- Efficient compression
- Real-time queries
- Aggregation support

S3 for Archival:
- Long-term retention
- Cost-effective
- Compliance storage
```

This architecture provides comprehensive, scalable database auditing.
