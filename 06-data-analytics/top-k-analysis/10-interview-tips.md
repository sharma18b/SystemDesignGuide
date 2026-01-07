# Top-K Analysis System - Interview Tips

## Interview Approach

### 1. Clarify Requirements (5 minutes)
**Key Questions**:
- Event volume: Events per second?
- K value: Top 10, 100, 1000?
- Accuracy: Exact or approximate acceptable?
- Latency: Real-time or batch?
- Dimensions: What to track?

### 2. High-Level Design (10 minutes)
**Components**:
- Event ingestion (Kafka)
- Stream processing (Flink)
- Counting algorithm (Count-Min Sketch)
- Storage (Redis)
- Query API

### 3. Deep Dive (20 minutes)
**Focus Areas**:
- Counting algorithms (CMS, Heavy Hitters)
- Space complexity optimization
- Accuracy guarantees
- Window management
- Scaling strategy

### 4. Tradeoffs (10 minutes)
**Discuss**:
- Exact vs approximate
- Memory vs accuracy
- Real-time vs batch
- Complexity vs performance

## Common Pitfalls

### Don't
- Use exact counting for billions of items
- Ignore space complexity
- Forget about accuracy requirements
- Overlook window management
- Ignore late-arriving data

### Do
- Discuss probabilistic structures
- Explain space-time tradeoffs
- Consider multiple algorithms
- Think about failure modes
- Mention accuracy bounds

## Key Topics

### Algorithms
- Count-Min Sketch
- Heavy Hitters (Misra-Gries)
- Space Saving
- Bloom filters

### Data Structures
- Sorted sets
- Hash maps
- Min-heaps
- Probabilistic structures

### Stream Processing
- Windowing
- State management
- Watermarks
- Late data handling

### Scaling
- Partitioning
- Sharding
- Caching
- Approximation

## Strong Signals

### Technical Depth
- Understand probabilistic algorithms
- Know space-time tradeoffs
- Familiar with stream processing
- Understand distributed systems

### System Thinking
- Consider accuracy requirements
- Think about memory constraints
- Discuss failure modes
- Consider operational aspects

## Sample Answers

**Q: How do you find top-K from 1 billion items?**
A: Count-Min Sketch for approximate counting (O(K) space), Heavy Hitters for top-K identification, Space Saving for better accuracy.

**Q: How do you ensure accuracy?**
A: Multiple algorithms, error bounds (ε, δ), periodic exact counting, reconciliation, monitoring.

**Q: How do you handle 1M events/sec?**
A: Kafka partitioning, Flink parallelism, approximate counting, Redis cluster, horizontal scaling.

This structured approach demonstrates comprehensive understanding of top-K analysis systems.
