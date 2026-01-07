# Resource Allocation Service - Database Design

## Storage Architecture

### Resource State Store (Redis)
```
Resource Pool:
Key: resource:pool:{type}
Value: {
  "total": 10000,
  "available": 7500,
  "allocated": 2500,
  "reserved": 500
}

Active Allocations:
Key: allocation:{id}
Value: {
  "tenant_id": "tenant1",
  "resource_type": "cpu",
  "amount": 100,
  "priority": 5,
  "allocated_at": "2024-01-03T19:00:00Z",
  "expires_at": "2024-01-03T20:00:00Z"
}

Tenant Quotas:
Key: quota:{tenant_id}:{resource_type}
Value: {
  "limit": 1000,
  "used": 750,
  "reserved": 100
}
```

### Allocation History (PostgreSQL)
```sql
CREATE TABLE allocations (
    allocation_id UUID PRIMARY KEY,
    tenant_id VARCHAR(100),
    resource_type VARCHAR(50),
    amount INTEGER,
    priority INTEGER,
    status VARCHAR(20),
    allocated_at TIMESTAMP,
    released_at TIMESTAMP,
    duration_seconds INTEGER
);

CREATE INDEX idx_tenant_time ON allocations(tenant_id, allocated_at);
CREATE INDEX idx_resource_type ON allocations(resource_type, allocated_at);
```

This database design provides fast allocation decisions with historical tracking.
