# Digital Wallet - Tradeoffs and Alternatives

**Reading Time**: 20 minutes

## Architecture Tradeoffs

### 1. Microservices vs Monolith

#### Microservices (Chosen)
```
Pros:
✓ Independent scaling per service
✓ Technology flexibility (Go, Java, Python)
✓ Team autonomy
✓ Fault isolation
✓ Easier to understand individual services

Cons:
✗ Distributed system complexity
✗ Network latency between services
✗ Data consistency challenges
✗ Operational overhead
✗ Debugging difficulty

Decision: Microservices
Reason: Scale requirements and team structure favor microservices
```

#### Monolith (Alternative)
```
Pros:
✓ Simpler deployment
✓ Easier debugging
✓ No network latency
✓ ACID transactions easier
✓ Lower operational overhead

Cons:
✗ Difficult to scale specific components
✗ Technology lock-in
✗ Tight coupling
✗ Large codebase
✗ Deployment risk (all-or-nothing)

When to Use: Small team, early stage, simple requirements
```

### 2. SQL vs NoSQL

#### PostgreSQL (Chosen)
```
Pros:
✓ ACID compliance (critical for financial data)
✓ Strong consistency
✓ Complex queries (transaction history)
✓ Mature ecosystem
✓ JSONB for flexibility

Cons:
✗ Harder to scale writes
✗ Vertical scaling limits
✗ Sharding complexity

Decision: PostgreSQL
Reason: Financial data requires ACID compliance
```

#### NoSQL Alternatives

**DynamoDB**
```
Pros:
✓ Automatic scaling
✓ High write throughput
✓ Low latency
✓ Managed service

Cons:
✗ Eventual consistency (default)
✗ Limited query flexibility
✗ No joins
✗ Cost at scale

When to Use: High write throughput, simple queries, eventual consistency acceptable
```

**MongoDB**
```
Pros:
✓ Flexible schema
✓ Horizontal scaling
✓ Good for document storage
✓ Rich query language

Cons:
✗ Weaker consistency guarantees
✗ No ACID across documents (older versions)
✗ Memory intensive

When to Use: Flexible schema, document-oriented data
```

### 3. Synchronous vs Asynchronous Processing

#### Hybrid Approach (Chosen)
```
Synchronous:
- Payment authorization (user waits)
- Balance checks (immediate response)
- P2P transfers (atomic operation)

Asynchronous:
- Notifications (fire and forget)
- Receipt generation (background job)
- Analytics (batch processing)
- Fraud model training (offline)

Decision: Hybrid
Reason: Balance user experience with system efficiency
```

#### Fully Synchronous
```
Pros:
✓ Immediate feedback
✓ Simpler error handling
✓ Easier debugging

Cons:
✗ Higher latency
✗ Resource intensive
✗ Cascading failures

When to Use: Simple workflows, low volume
```

#### Fully Asynchronous
```
Pros:
✓ Better resource utilization
✓ Fault tolerance
✓ Scalability

Cons:
✗ Complex error handling
✗ Eventual consistency
✗ User experience challenges

When to Use: Background processing, high volume
```

### 4. Tokenization Approaches

#### Secure Element (Chosen for iOS)
```
Pros:
✓ Hardware-based security
✓ Isolated from OS
✓ Tamper-resistant
✓ PCI DSS compliant

Cons:
✗ Platform-specific
✗ Limited storage
✗ Slower provisioning

Decision: Secure Element for iOS
Reason: Highest security for payment data
```

#### Host Card Emulation (Chosen for Android)
```
Pros:
✓ Software-based (flexible)
✓ Faster provisioning
✓ No hardware dependency
✓ Easier updates

Cons:
✗ Less secure than Secure Element
✗ Vulnerable to OS compromise
✗ Requires strong app security

Decision: HCE for Android
Reason: Balance security with flexibility
```

#### Cloud-Based Tokens
```
Pros:
✓ Platform-independent
✓ Easy to update
✓ Centralized management

Cons:
✗ Network dependency
✗ Latency for token retrieval
✗ Single point of failure

When to Use: Web-based wallets, cross-platform consistency
```

### 5. Fraud Detection Approaches

#### Hybrid (Rule-Based + ML) - Chosen
```
Rule-Based:
- Velocity checks (10 transactions/hour)
- Amount thresholds ($1000/transaction)
- Geographic anomalies (US → Russia in 1 hour)
- Device fingerprinting

ML-Based:
- Anomaly detection (unusual patterns)
- Behavior profiling (user habits)
- Risk scoring (0-100)
- Model retraining (weekly)

Decision: Hybrid
Reason: Rules for known patterns, ML for unknown
```

#### Rule-Based Only
```
Pros:
✓ Explainable decisions
✓ Fast execution
✓ Easy to update
✓ No training data needed

Cons:
✗ Misses novel fraud patterns
✗ High false positives
✗ Manual rule maintenance

When to Use: Early stage, limited data, regulatory requirements
```

#### ML-Only
```
Pros:
✓ Detects novel patterns
✓ Adapts to new fraud
✓ Lower false positives (with good data)

Cons:
✗ Black box (hard to explain)
✗ Requires large training data
✗ Model drift over time
✗ Slower execution

When to Use: Large dataset, mature product, low regulatory scrutiny
```

### 6. Multi-Region Strategy

#### Active-Active (Chosen)
```
Pros:
✓ Low latency globally
✓ High availability
✓ Load distribution
✓ No failover delay

Cons:
✗ Complex data consistency
✗ Higher cost
✗ Conflict resolution needed

Decision: Active-Active
Reason: Global user base requires low latency everywhere
```

#### Active-Passive
```
Pros:
✓ Simpler consistency
✓ Lower cost
✓ Easier to manage

Cons:
✗ Higher latency for some users
✗ Failover delay (minutes)
✗ Underutilized resources

When to Use: Regional user base, cost-sensitive, simpler requirements
```

#### Single Region
```
Pros:
✓ Simplest architecture
✓ Lowest cost
✓ No consistency issues

Cons:
✗ High latency for distant users
✗ Single point of failure
✗ Limited by region capacity

When to Use: Small user base, single geography, early stage
```

## Technology Alternatives

### 1. API Gateway

#### Kong (Chosen)
```
Pros:
✓ Open source
✓ Plugin ecosystem
✓ High performance
✓ Kubernetes-native

Cons:
✗ Self-managed
✗ Operational overhead

Alternatives:
- AWS API Gateway (managed, serverless)
- Nginx (lightweight, fast)
- Envoy (modern, service mesh)
```

### 2. Message Queue

#### Kafka (Chosen)
```
Pros:
✓ High throughput
✓ Durable storage
✓ Replay capability
✓ Stream processing

Cons:
✗ Complex setup
✗ Operational overhead

Alternatives:
- RabbitMQ (easier, lower throughput)
- Amazon SQS (managed, simpler)
- Redis Streams (lightweight)
```

### 3. Cache

#### Redis (Chosen)
```
Pros:
✓ Fast (in-memory)
✓ Rich data structures
✓ Pub/Sub support
✓ Persistence options

Cons:
✗ Memory-bound
✗ Single-threaded (per instance)

Alternatives:
- Memcached (simpler, faster for simple use cases)
- Hazelcast (distributed, Java-native)
- Amazon ElastiCache (managed Redis/Memcached)
```

### 4. Search Engine

#### Elasticsearch (Chosen)
```
Pros:
✓ Full-text search
✓ Aggregations
✓ Scalable
✓ Real-time indexing

Cons:
✗ Resource intensive
✗ Complex tuning

Alternatives:
- Amazon CloudSearch (managed, simpler)
- Algolia (SaaS, fast)
- PostgreSQL Full-Text Search (simpler, integrated)
```

### 5. Container Orchestration

#### Kubernetes (Chosen)
```
Pros:
✓ Industry standard
✓ Rich ecosystem
✓ Multi-cloud support
✓ Auto-scaling

Cons:
✗ Complex learning curve
✗ Operational overhead

Alternatives:
- Amazon ECS (simpler, AWS-native)
- Docker Swarm (simpler, less features)
- Nomad (simpler, HashiCorp ecosystem)
```

## Design Pattern Tradeoffs

### 1. Event Sourcing vs CRUD

#### CRUD (Chosen)
```
Pros:
✓ Simpler to understand
✓ Easier to implement
✓ Standard tooling
✓ Lower storage

Cons:
✗ No audit trail by default
✗ Difficult to replay events
✗ Lost historical context

Decision: CRUD with audit logs
Reason: Simpler for most use cases, audit logs for compliance
```

#### Event Sourcing
```
Pros:
✓ Complete audit trail
✓ Event replay
✓ Temporal queries
✓ Event-driven architecture

Cons:
✗ Complex implementation
✗ Higher storage
✗ Eventual consistency
✗ Difficult to query current state

When to Use: Complex domain, audit requirements, event-driven workflows
```

### 2. Saga vs Two-Phase Commit

#### Saga (Chosen for P2P)
```
Pros:
✓ Better availability
✓ No distributed locks
✓ Scalable
✓ Compensating transactions

Cons:
✗ Eventual consistency
✗ Complex error handling
✗ Compensating logic needed

Decision: Saga for P2P transfers
Reason: Better availability, acceptable eventual consistency
```

#### Two-Phase Commit
```
Pros:
✓ Strong consistency
✓ ACID guarantees
✓ Simpler reasoning

Cons:
✗ Blocking protocol
✗ Lower availability
✗ Coordinator bottleneck

When to Use: Strong consistency required, low volume, single database
```

### 3. Push vs Pull Notifications

#### Push (Chosen)
```
Pros:
✓ Real-time delivery
✓ Better user experience
✓ Lower battery usage

Cons:
✗ Requires device registration
✗ Platform-specific (FCM, APNs)
✗ Delivery not guaranteed

Decision: Push notifications
Reason: Real-time updates critical for payments
```

#### Pull (Polling)
```
Pros:
✓ Simpler implementation
✓ Platform-independent
✓ No registration needed

Cons:
✗ Higher latency
✗ Battery drain
✗ Wasted requests

When to Use: Web-only, infrequent updates, simple requirements
```

## Security Tradeoffs

### 1. Biometric vs PIN

#### Biometric (Primary)
```
Pros:
✓ Convenient (no memorization)
✓ Fast authentication
✓ Difficult to steal

Cons:
✗ Privacy concerns
✗ False positives/negatives
✗ Irreversible if compromised

Decision: Biometric with PIN fallback
Reason: Best user experience with security backup
```

### 2. Token Storage

#### Device-Based (Chosen)
```
Pros:
✓ Offline capability
✓ Lower latency
✓ No network dependency

Cons:
✗ Device compromise risk
✗ Difficult to revoke
✗ Limited to one device

Decision: Device-based with cloud backup
Reason: Balance offline capability with multi-device support
```

#### Cloud-Based
```
Pros:
✓ Multi-device support
✓ Easy revocation
✓ Centralized management

Cons:
✗ Network dependency
✗ Latency
✗ Single point of failure

When to Use: Web-based wallets, multi-device priority
```

## Interview Discussion Points

**Q: Why PostgreSQL over DynamoDB?**
```
Answer:
- Financial data requires ACID compliance
- Complex queries for transaction history
- Strong consistency critical
- Acceptable to scale with sharding
- Trade write throughput for consistency
```

**Q: Why microservices over monolith?**
```
Answer:
- Independent scaling (Transaction Service vs Notification)
- Technology flexibility (Go for performance, Python for ML)
- Team autonomy (separate teams own services)
- Fault isolation (fraud service down doesn't block payments)
- Trade complexity for scalability
```

**Q: Why hybrid fraud detection?**
```
Answer:
- Rules for known patterns (fast, explainable)
- ML for novel patterns (adaptive, accurate)
- Rules as guardrails for ML
- Explainability for regulatory compliance
- Trade simplicity for accuracy
```

---
*Estimated Reading Time: 20 minutes*
