# Database Batch Auditing Service - Interview Tips

## Interview Approach

### Problem Clarification
```
Key Questions:
- "How many databases need auditing?"
- "What's the change rate per database?"
- "What compliance requirements exist?"
- "How long should we retain audit data?"
- "Do we need real-time or batch auditing?"
```

### High-Level Design
```
"I'll design a database auditing system with:

1. Components:
   - CDC agents (change capture)
   - Kafka (message queue)
   - Processors (enrichment)
   - ClickHouse (storage)
   - Query API (reporting)

2. Data Flow:
   - Databases → CDC → Kafka → Processors → Storage

3. Key Features:
   - <10ms overhead per operation
   - 100K changes/sec throughput
   - 7-year retention
   - Compliance reporting
   - Anomaly detection"
```

### Key Points to Emphasize
```
✓ Low database overhead (<10ms)
✓ No data loss (100% capture)
✓ Compliance ready (GDPR, SOX, HIPAA)
✓ Scalable ingestion (100K+ changes/sec)
✓ Fast queries (<5 seconds)
✓ Cost-effective storage
```

## Common Mistakes

### ❌ Don't Say:
```
"We'll use database triggers for everything"
→ Too much overhead

"Audit data doesn't need encryption"
→ Compliance violation
```

### ✅ Do Say:
```
"Log-based CDC minimizes database overhead"
→ Shows production awareness

"Immutable audit storage ensures integrity"
→ Demonstrates compliance knowledge
```

This guide prepares you for database auditing system interviews.
