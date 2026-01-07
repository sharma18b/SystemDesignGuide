# Distributed Tracing System - Variations and Follow-ups

## Common Variations

### 1. Metrics from Traces
**Enhancement**: Generate metrics from trace data

**Implementation**:
- Aggregate span durations
- Count error rates
- Calculate percentiles
- Service-level metrics

### 2. Trace-Based Alerting
**Enhancement**: Alert on trace patterns

**Rules**:
- Latency threshold exceeded
- Error rate spike
- Dependency failure
- SLA violations

### 3. Continuous Profiling
**Enhancement**: Combine tracing with profiling

**Benefits**:
- CPU/memory profiling
- Code-level insights
- Performance optimization
- Resource usage tracking

## Follow-Up Questions

### Q: "How do you handle high-cardinality tags?"
**Answer**:
```
Strategies:
1. Tag Filtering:
   - Whitelist important tags
   - Drop high-cardinality tags
   - Aggregate similar values

2. Sampling:
   - Sample high-cardinality traces
   - Keep low-cardinality fully

3. Storage:
   - Separate storage for tags
   - Bloom filters for existence
   - Approximate queries
```

### Q: "How do you trace across async operations?"
**Answer**:
```
Context Propagation:
1. Message Queue:
   - Inject trace context in message
   - Extract on consumer side
   - Link parent-child spans

2. Event-Driven:
   - Baggage for cross-service data
   - Correlation IDs
   - Async span linking

3. Callbacks:
   - Capture context before async
   - Restore in callback
   - Manual span management
```

This guide covers advanced tracing scenarios and common questions.
