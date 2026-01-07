# Database Batch Auditing Service - Database Design

## ClickHouse Schema

### Audit Log Table
```sql
CREATE TABLE audit_log (
    audit_id UUID DEFAULT generateUUIDv4(),
    timestamp DateTime64(3),
    database_name String,
    table_name String,
    operation_type Enum8('INSERT'=1, 'UPDATE'=2, 'DELETE'=3, 'DDL'=4),
    primary_key String,
    before_value String,
    after_value String,
    user_name String,
    application_name String,
    ip_address String,
    transaction_id String,
    change_size UInt32
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (database_name, table_name, timestamp)
SETTINGS index_granularity = 8192;
```

### Compliance Tracking
```sql
CREATE TABLE compliance_events (
    event_id UUID,
    timestamp DateTime,
    compliance_type Enum8('GDPR'=1, 'SOX'=2, 'HIPAA'=3, 'PCI'=4),
    database_name String,
    table_name String,
    record_id String,
    event_type String,
    user_name String,
    status Enum8('COMPLIANT'=1, 'VIOLATION'=2, 'PENDING'=3)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (compliance_type, timestamp);
```

### Anomaly Detection
```sql
CREATE TABLE anomalies (
    anomaly_id UUID,
    detected_at DateTime,
    database_name String,
    table_name String,
    anomaly_type String,
    severity Enum8('LOW'=1, 'MEDIUM'=2, 'HIGH'=3, 'CRITICAL'=4),
    description String,
    affected_records UInt32,
    user_name String
) ENGINE = MergeTree()
ORDER BY (detected_at, severity);
```

## S3 Archive Structure
```
s3://audit-archive/
  year=2024/
    month=01/
      day=03/
        database=prod_db/
          table=users/
            audit_20240103_000000.parquet.gz
```

This database design enables efficient audit storage and fast compliance queries.
