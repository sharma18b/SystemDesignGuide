# Digital Wallet - Architecture

**Reading Time**: 20 minutes

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│   iOS App    │  Android App │  Web Portal  │  Wearables (Watch) │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬─────────────┘
       │              │              │              │
       └──────────────┴──────────────┴──────────────┘
                      │
       ┌──────────────▼──────────────┐
       │     API Gateway (Kong)       │
       │  - Rate Limiting             │
       │  - Authentication            │
       │  - Request Routing           │
       └──────────────┬──────────────┘
                      │
       ┌──────────────┴──────────────────────────────────┐
       │                                                  │
┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐  ┌───▼────────┐
│   User      │  │  Payment    │  │ Transaction │  │   P2P      │
│  Service    │  │   Method    │  │   Service   │  │  Service   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───┬────────┘
       │                │                │              │
┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐  ┌───▼────────┐
│   Token     │  │   Fraud     │  │ Notification│  │  Loyalty   │
│   Vault     │  │  Detection  │  │   Service   │  │  Service   │
│   (HSM)     │  │   Service   │  │             │  │            │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───┬────────┘
       │                │                │              │
       └────────────────┴────────────────┴──────────────┘
                      │
       ┌──────────────▼──────────────────────────────────┐
       │              Event Bus (Kafka)                   │
       └──────────────┬──────────────────────────────────┘
                      │
       ┌──────────────┴──────────────────────────────────┐
       │                                                  │
┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐  ┌───▼────────┐
│  PostgreSQL │  │    Redis    │  │ Elasticsearch│  │   S3       │
│  (Primary)  │  │   (Cache)   │  │  (Search)    │  │ (Receipts) │
└─────────────┘  └─────────────┘  └──────────────┘  └────────────┘
```

## Core Services

### 1. User Service
**Responsibility**: User account management and authentication

```
Components:
├── User Registration (KYC validation)
├── Authentication (JWT + Biometric)
├── Device Management
└── Profile Management

Database Schema:
- users (id, email, phone, kyc_status, created_at)
- devices (id, user_id, device_token, biometric_hash)
- sessions (id, user_id, device_id, jwt_token, expires_at)
```

### 2. Payment Method Service
**Responsibility**: Store and manage payment methods

```
Components:
├── Add Payment Method (Card/Bank)
├── Token Management
├── Verification (CVV, Micro-deposit)
└── Default Payment Selection

Database Schema:
- payment_methods (id, user_id, type, token_id, last4, expiry)
- tokens (id, token_value, card_hash, status, created_at)
```

### 3. Token Vault Service
**Responsibility**: Secure token storage with HSM

```
Components:
├── Token Generation (EMV tokenization)
├── Cryptogram Generation (Dynamic CVV)
├── Key Management (HSM)
└── Token Lifecycle

Technology:
- HSM: AWS CloudHSM or Thales Luna
- Encryption: AES-256-GCM
- Protocol: EMV Payment Tokenization
```

### 4. Transaction Service
**Responsibility**: Process payments and maintain history

```
Components:
├── Payment Authorization
├── Transaction Recording
├── Transaction History
└── Refund Processing

Database Schema:
- transactions (id, user_id, amount, currency, status, timestamp)
- transaction_details (id, transaction_id, merchant, category)
```

### 5. Fraud Detection Service
**Responsibility**: Real-time fraud detection

```
Components:
├── Rule-Based Detection (Velocity, Amount, Geo)
├── ML-Based Detection (Anomaly, Behavior)
├── Risk Assessment
└── Action Engine (Block, 2FA, Review)

Technology:
- ML: TensorFlow/PyTorch
- Real-time: Kafka Streams
- Batch: Apache Spark
```

### 6. P2P Transfer Service
**Responsibility**: Peer-to-peer money transfers

```
Components:
├── Transfer Initiation
├── Transfer Processing (Atomic)
├── Transfer History
└── Transfer Limits

Database Schema:
- p2p_transfers (id, sender_id, receiver_id, amount, status)
- transfer_limits (user_id, daily_limit, used_today)
```

### 7. Notification Service
**Responsibility**: Real-time notifications

```
Components:
├── Push Notifications (FCM, APNs)
├── Email Notifications
├── SMS Notifications
└── In-App Notifications

Technology:
- Push: Firebase, Apple Push
- Email: Amazon SES
- SMS: Twilio
```

## Payment Authorization Flow

```
Client → API Gateway → User Service (Auth)
                    → Token Vault (Get Token)
                    → Fraud Detection (Risk Check)
                    → Transaction Service (Authorize)
                    → Payment Network (Process)
                    → Database (Record)
                    → Notification Service (Notify)
                    → Client (Confirmation)

Latency Breakdown:
- Authentication: 100ms
- Token retrieval: 50ms
- Fraud check: 300ms
- Payment network: 1200ms
- Database write: 100ms
- Total: ~1850ms (within 2s target)
```

## Technology Stack

### Backend
```
Language: Go (performance), Java (Spring Boot)
API Gateway: Kong
Service Mesh: Istio
Container: Docker + Kubernetes
```

### Databases
```
Primary: PostgreSQL 14+ (ACID)
Cache: Redis 7+
Search: Elasticsearch 8+
```

### Security
```
HSM: AWS CloudHSM
Secrets: HashiCorp Vault
WAF: AWS WAF
```

### Monitoring
```
Metrics: Prometheus + Grafana
Logging: ELK Stack
Tracing: Jaeger
APM: Datadog
```

## Security Architecture

### Defense in Depth
```
Layer 1: Network (WAF, DDoS, VPC)
Layer 2: Application (Rate limiting, Input validation)
Layer 3: Service (mTLS, JWT)
Layer 4: Data (Encryption, Tokenization, HSM)
Layer 5: Monitoring (Threat detection, Audit logs)
```

### Secure Element Integration
```
iOS: Secure Enclave (biometric, keys)
Android: TEE (Trusted Execution Environment)
```

## Deployment Architecture

### Multi-Region Active-Active
```
Region 1 (US-East)    Region 2 (US-West)    Region 3 (EU-West)
├── Load Balancer     ├── Load Balancer     ├── Load Balancer
├── K8s (100 nodes)   ├── K8s (100 nodes)   ├── K8s (80 nodes)
└── PostgreSQL        └── PostgreSQL        └── PostgreSQL
    (Primary)             (Primary)             (Primary)
         └────────── Cross-Region Replication ──────────┘
```

### Auto-Scaling
```yaml
HorizontalPodAutoscaler:
  minReplicas: 10
  maxReplicas: 500
  targetCPU: 70%
  targetMemory: 80%
  scaleUp: 50% per minute
  scaleDown: 10% per minute
```

## Interview Discussion Points

**Q: Why microservices over monolith?**
- Independent scaling per service
- Technology flexibility
- Fault isolation
- Team autonomy

**Q: Why PostgreSQL over NoSQL?**
- ACID compliance for financial data
- Complex queries for history
- Strong consistency
- Mature ecosystem

**Q: How ensure zero downtime?**
- Blue-green deployment
- Rolling updates
- Feature flags
- Canary deployments (1% → 100%)

---
*Estimated Reading Time: 20 minutes*
