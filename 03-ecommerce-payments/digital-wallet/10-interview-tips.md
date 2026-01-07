# Digital Wallet - Interview Tips

**Reading Time**: 20 minutes

## Interview Structure

### Typical 45-Minute Interview Breakdown

```
Phase 1: Requirements Gathering (5-10 minutes)
├── Clarify functional requirements
├── Understand scale constraints
├── Identify key features
└── Discuss compliance needs

Phase 2: High-Level Design (10-15 minutes)
├── Draw architecture diagram
├── Identify core services
├── Explain data flow
└── Discuss technology choices

Phase 3: Deep Dives (15-20 minutes)
├── Database schema design
├── API design
├── Security architecture
├── Scaling strategies
└── Fraud detection

Phase 4: Tradeoffs and Follow-ups (5-10 minutes)
├── Discuss alternatives
├── Explain tradeoffs
├── Handle follow-up questions
└── Address edge cases
```

## Key Questions to Ask

### Functional Requirements

```
Essential Questions:
1. "What payment methods should we support?"
   - Cards (Visa, Mastercard, Amex)
   - Bank accounts (ACH, SEPA)
   - Alternative methods (PayPal, Venmo)

2. "What types of transactions are needed?"
   - In-store contactless (NFC)
   - Online payments
   - P2P transfers
   - QR code payments

3. "What platforms should we support?"
   - Mobile (iOS, Android)
   - Web
   - Wearables (Watch)

4. "Are there specific security requirements?"
   - PCI DSS compliance level
   - Biometric authentication
   - Multi-factor authentication
   - Fraud detection sophistication

5. "What regions/countries to support?"
   - US only vs global
   - Multi-currency support
   - Regional compliance (PSD2, GDPR)
```

### Scale and Performance

```
Critical Questions:
1. "How many users do we expect?"
   - Total users: 100M
   - Active users: 50M MAU
   - Concurrent users: 500K

2. "What's the transaction volume?"
   - Daily transactions: 50M
   - Peak TPS: 10,000
   - Average transaction value: $50

3. "What are the latency requirements?"
   - Payment authorization: < 2 seconds
   - NFC tap: < 500ms
   - Transaction history: < 1 second

4. "What's the availability requirement?"
   - 99.99% uptime (52 minutes/year)
   - Multi-region deployment
   - Disaster recovery needs
```

## Common Interview Topics

### 1. Payment Authorization Flow

**What to Cover:**
```
End-to-End Flow:
1. User initiates payment
2. API Gateway authenticates request
3. User Service validates user
4. Token Vault retrieves payment token
5. Fraud Detection performs risk check
6. Transaction Service calls payment network
7. Payment network authorizes
8. Transaction recorded in database
9. Notification sent to user
10. Response returned to client

Key Points to Emphasize:
- Idempotency (prevent duplicate charges)
- Fraud detection (real-time risk assessment)
- Tokenization (no raw PAN storage)
- Latency optimization (< 2 seconds)
- Error handling (retry logic, fallbacks)
```

**Sample Answer:**
```
"When a user initiates a payment, the request goes through our API Gateway 
which handles authentication and rate limiting. The User Service validates 
the user's identity and checks their status. We then retrieve the payment 
token from our Token Vault, which is HSM-protected and never stores raw 
card numbers.

Before processing, we run the transaction through our Fraud Detection 
Service, which uses both rule-based and ML-based detection to assign a 
risk score. If the score is acceptable, we proceed to call the payment 
network with the token and cryptogram.

The entire flow is designed to complete in under 2 seconds, with proper 
error handling and retry logic. We use idempotency keys to prevent 
duplicate charges, and all transactions are logged for audit purposes."
```

### 2. Database Design

**What to Cover:**
```
Key Tables:
├── users (profile, KYC status)
├── devices (device binding)
├── payment_methods (tokenized cards)
├── tokens (encrypted, HSM-protected)
├── transactions (partitioned by time)
├── p2p_transfers (atomic operations)
├── balances (optimistic locking)
└── fraud_events (risk scoring)

Scaling Strategies:
├── Sharding by user_id (1000 shards)
├── Read replicas (3 per shard)
├── Partitioning (transactions by month)
├── Caching (Redis for hot data)
└── Archival (S3 for old data)

Key Points:
- ACID compliance for financial data
- Optimistic locking for balances
- Idempotency keys for transactions
- Audit trail for compliance
```

**Sample Answer:**
```
"For the database design, I'd use PostgreSQL for its ACID compliance, 
which is critical for financial data. We'd shard by user_id across 1000 
shards to distribute the load, with 3 read replicas per shard for read-heavy 
operations like transaction history.

The transactions table would be partitioned by month for efficient queries 
and easy archival. We'd use optimistic locking on the balances table to 
handle concurrent updates safely. All tables would have proper indexes, 
and we'd cache hot data in Redis with a 90% hit rate.

For compliance, we'd maintain a complete audit trail and retain transaction 
data for 7 years as required by regulations."
```

### 3. Security Architecture

**What to Cover:**
```
Multi-Layer Security:
├── Network (WAF, DDoS protection)
├── Application (rate limiting, input validation)
├── Service (mTLS, JWT)
├── Data (encryption, tokenization, HSM)
└── Monitoring (threat detection, audit logs)

Key Security Features:
├── Tokenization (EMV standard)
├── Biometric authentication
├── Device binding
├── Fraud detection (rules + ML)
├── PCI DSS Level 1 compliance
└── Encryption (AES-256 at rest, TLS 1.3 in transit)

Critical Points:
- No storage of full PAN
- HSM for key management
- Secure Element for mobile
- Real-time fraud detection
```

**Sample Answer:**
```
"Security is paramount for a digital wallet. We implement defense in depth 
with multiple layers. At the network level, we use WAF and DDoS protection. 
At the application level, we enforce rate limiting and input validation.

For payment data, we never store full card numbers - only tokens generated 
through EMV tokenization. These tokens are stored in an HSM-protected vault. 
On mobile devices, we leverage the Secure Element for iOS and TEE for Android 
to store cryptographic keys.

We implement multi-factor authentication with biometric + device possession, 
and run all transactions through our fraud detection system which combines 
rule-based and ML-based detection. This entire architecture is designed to 
meet PCI DSS Level 1 compliance."
```

### 4. Fraud Detection

**What to Cover:**
```
Detection Approaches:
├── Rule-Based
│   ├── Velocity checks (10 txn/hour)
│   ├── Amount thresholds ($1000/txn)
│   ├── Geographic anomalies
│   └── Device fingerprinting
└── ML-Based
    ├── Anomaly detection
    ├── Behavior profiling
    ├── Risk scoring (0-100)
    └── Model retraining (weekly)

Risk Actions:
├── Low (0-30): Auto-approve
├── Medium (31-70): Require 2FA
├── High (71-90): Manual review
└── Critical (91-100): Block

Key Metrics:
- Detection rate: > 99%
- False positive rate: < 1%
- Latency: < 300ms
```

**Sample Answer:**
```
"Our fraud detection uses a hybrid approach combining rules and machine 
learning. Rules catch known patterns like velocity violations (more than 
10 transactions per hour) or impossible travel (US to Russia in 1 hour).

For ML, we use an ensemble of XGBoost and LSTM models trained on 100+ 
features including transaction history, device characteristics, and network 
analysis. The model assigns a risk score from 0-100, and we take different 
actions based on the score: auto-approve for low risk, require 2FA for 
medium, manual review for high, and block for critical.

The entire fraud check completes in under 300ms, and we achieve over 99% 
detection rate with less than 1% false positives. Models are retrained 
weekly with new fraud patterns."
```

### 5. Scaling Strategies

**What to Cover:**
```
Horizontal Scaling:
├── Application: 10-500 pods (auto-scale)
├── Database: 1000 shards + read replicas
├── Cache: Redis cluster (384 GB)
└── Message Queue: Kafka (10-20 partitions)

Performance Optimization:
├── Caching (90% hit rate)
├── Connection pooling
├── Query optimization
├── CDN for static assets
└── Edge computing (Lambda@Edge)

Multi-Region:
├── Active-active deployment
├── Geo-routing (Route 53)
├── Cross-region replication
└── Eventual consistency
```

**Sample Answer:**
```
"To handle 10,000 TPS at peak, we implement horizontal scaling across all 
tiers. The application layer auto-scales from 10 to 500 pods based on CPU 
and memory utilization. The database is sharded by user_id across 1000 
shards, each with 3 read replicas.

We use Redis for caching with a 90% hit rate, which significantly reduces 
database load. For global users, we deploy active-active across multiple 
regions with geo-routing to minimize latency.

The architecture can handle 10x traffic spikes by auto-scaling compute, 
adding read replicas, and enabling aggressive caching. We also use CDN 
for static content and Lambda@Edge for edge computing."
```

## Common Mistakes to Avoid

### 1. Ignoring Compliance
```
❌ Wrong: "We'll store card numbers encrypted in the database"
✅ Right: "We'll use tokenization and never store full PANs to comply 
          with PCI DSS. Tokens will be stored in an HSM-protected vault."
```

### 2. Weak Security
```
❌ Wrong: "Users can log in with just email and password"
✅ Right: "We'll implement multi-factor authentication with biometric + 
          device possession, and require 2FA for high-value transactions."
```

### 3. Poor Fraud Detection
```
❌ Wrong: "We'll check if the transaction amount is too high"
✅ Right: "We'll use a hybrid approach with rule-based detection for known 
          patterns and ML-based detection for anomalies, achieving 99% 
          detection rate with < 1% false positives."
```

### 4. Ignoring Latency
```
❌ Wrong: "We'll make synchronous calls to all services"
✅ Right: "We'll optimize the critical path to complete payment authorization 
          in under 2 seconds, with async processing for non-critical operations 
          like notifications and analytics."
```

### 5. No Disaster Recovery
```
❌ Wrong: "We'll deploy in a single region"
✅ Right: "We'll deploy active-active across multiple regions with automatic 
          failover, achieving 99.99% availability with < 30 second failover time."
```

## Follow-up Questions and Answers

### Q: "How would you handle a payment network outage?"

**Strong Answer:**
```
"We'd implement a circuit breaker pattern to detect the outage quickly. 
Once detected, we'd:

1. Return a clear error to the user (don't retry indefinitely)
2. Queue the transaction for retry when the network recovers
3. Notify users via push notification about the issue
4. Switch to a backup payment network if available
5. Monitor the situation and update status page

For critical transactions, we might offer alternative payment methods. 
We'd also implement exponential backoff for retries to avoid overwhelming 
the network when it comes back online."
```

### Q: "How would you prevent duplicate charges?"

**Strong Answer:**
```
"We'd use idempotency keys to prevent duplicate charges. When a client 
initiates a payment, they include a unique idempotency key (UUID) in the 
request. We store this key in the database with the transaction.

If we receive another request with the same key within 24 hours, we return 
the original transaction result instead of processing a new charge. This 
handles cases like network timeouts, user double-clicks, or retry logic.

The idempotency key is indexed for fast lookups, and we clean up keys 
older than 24 hours to manage storage."
```

### Q: "How would you handle P2P transfers atomically?"

**Strong Answer:**
```
"P2P transfers require atomicity - either both the debit and credit succeed, 
or neither does. I'd use a database transaction with row-level locks:

1. BEGIN TRANSACTION
2. Lock sender's balance row (SELECT FOR UPDATE)
3. Verify sufficient funds
4. Debit sender's balance
5. Credit receiver's balance
6. Record transfer in p2p_transfers table
7. COMMIT TRANSACTION

We'd use optimistic locking with a version field to handle concurrent 
updates. If the transaction fails at any step, we ROLLBACK and return 
an error. For cross-shard transfers, we'd use the Saga pattern with 
compensating transactions."
```

### Q: "How would you scale to 100M users?"

**Strong Answer:**
```
"To scale to 100M users, I'd focus on:

1. Database Sharding: Shard by user_id across 1000 shards, each handling 
   100K users. This distributes both data and load.

2. Read Replicas: Add 3 read replicas per shard for read-heavy operations 
   like transaction history, achieving 90% read offload.

3. Caching: Implement Redis caching for hot data (user profiles, payment 
   methods, recent transactions) with 90% hit rate.

4. Multi-Region: Deploy active-active across 4 regions (US-East, US-West, 
   EU-West, APAC) to reduce latency and increase availability.

5. Auto-Scaling: Configure horizontal pod autoscaling from 10 to 500 
   instances based on CPU/memory utilization.

This architecture can handle 50M daily active users and 10K TPS at peak."
```

## Final Tips

### Do's
```
✓ Start with requirements clarification
✓ Draw clear architecture diagrams
✓ Explain your reasoning for decisions
✓ Discuss tradeoffs explicitly
✓ Consider security from the start
✓ Think about scale and performance
✓ Handle edge cases and failures
✓ Ask clarifying questions
✓ Be specific with numbers
✓ Show depth in one area
```

### Don'ts
```
✗ Jump into design without requirements
✗ Ignore compliance requirements
✗ Overlook security considerations
✗ Forget about fraud detection
✗ Ignore latency requirements
✗ Skip error handling
✗ Assume unlimited resources
✗ Use buzzwords without understanding
✗ Ignore interviewer hints
✗ Be vague about tradeoffs
```

### Time Management
```
Requirements: 5-10 minutes (don't rush this)
High-Level Design: 10-15 minutes (clear diagram)
Deep Dives: 15-20 minutes (show expertise)
Tradeoffs: 5-10 minutes (thoughtful discussion)

Adjust based on interviewer's focus, but ensure you cover:
- Security (critical for payments)
- Fraud detection (expected topic)
- Scaling (handle growth)
- Compliance (PCI DSS, GDPR)
```

## Practice Questions

### Easy
1. Design the user registration and KYC flow
2. Design the add payment method API
3. Design the transaction history feature
4. Design the notification system

### Medium
1. Design the payment authorization flow
2. Design the P2P transfer system
3. Design the fraud detection system
4. Design the multi-currency support

### Hard
1. Design the complete digital wallet system
2. Design for 100M users and 10K TPS
3. Design with PCI DSS Level 1 compliance
4. Design with multi-region active-active deployment

---
*Estimated Reading Time: 20 minutes*

**Good luck with your interview!**
