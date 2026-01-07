# Distributed Tracing System - Interview Tips

## Interview Approach

### Problem Clarification
```
Key Questions:
- "How many services and requests per second?"
- "What's the acceptable overhead on applications?"
- "How long should we retain trace data?"
- "Do we need real-time or batch processing?"
- "What's the sampling strategy?"
```

### High-Level Design
```
"I'll design a distributed tracing system with:

1. Components:
   - Tracing agents (instrumentation)
   - Collectors (ingestion)
   - Processors (enrichment)
   - Storage (Cassandra + Elasticsearch)
   - Query API (search and visualization)

2. Data Flow:
   - Apps → Agents → Collectors → Kafka → Processors → Storage

3. Key Features:
   - 1% sampling for cost efficiency
   - OpenTelemetry compatibility
   - Sub-1% application overhead
   - 7-day retention"
```

### Key Points to Emphasize
```
✓ Low overhead (<1% CPU)
✓ Scalable ingestion (100K+ spans/sec)
✓ Intelligent sampling
✓ Fast queries (<1 second)
✓ Cost-effective storage
✓ OpenTelemetry standard
```

## Common Mistakes

### ❌ Don't Say:
```
"We'll trace every request"
→ Too expensive at scale

"Sampling doesn't matter"
→ Critical for cost control
```

### ✅ Do Say:
```
"Adaptive sampling balances cost and coverage"
→ Shows production awareness

"OpenTelemetry provides vendor neutrality"
→ Demonstrates industry knowledge
```

This guide prepares you for distributed tracing system interviews.
