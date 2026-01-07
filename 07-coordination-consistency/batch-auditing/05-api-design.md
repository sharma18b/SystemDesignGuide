# Database Batch Auditing Service - API Design

## Query API

### Get Audit Trail
```http
GET /api/v1/audit?database=prod_db&table=users&start=2024-01-01&end=2024-01-03

Response 200:
{
  "records": [
    {
      "audit_id": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2024-01-03T19:30:00Z",
      "operation": "UPDATE",
      "table": "users",
      "primary_key": "user_123",
      "changes": {
        "email": {
          "before": "old@example.com",
          "after": "new@example.com"
        }
      },
      "user": "admin@company.com"
    }
  ],
  "total": 1250,
  "page": 1
}
```

### Generate Compliance Report
```http
POST /api/v1/reports/compliance
Content-Type: application/json

{
  "compliance_type": "GDPR",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "databases": ["prod_db"]
}

Response 202:
{
  "report_id": "report_abc123",
  "status": "processing",
  "estimated_completion": "2024-01-03T19:35:00Z"
}
```

### Search Changes
```http
POST /api/v1/audit/search
Content-Type: application/json

{
  "database": "prod_db",
  "table": "users",
  "user": "admin@company.com",
  "operation": "DELETE",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31"
}
```

## Client Library (Python)
```python
from audit_client import AuditClient

client = AuditClient(endpoint='https://audit.example.com')

# Query audit trail
changes = client.get_audit_trail(
    database='prod_db',
    table='users',
    start_date='2024-01-01',
    end_date='2024-01-31'
)

# Generate compliance report
report = client.generate_compliance_report(
    compliance_type='GDPR',
    start_date='2024-01-01',
    end_date='2024-01-31'
)
```

This API provides comprehensive audit querying and reporting capabilities.
