# Digital Wallet - Scale and Constraints

**Reading Time**: 20 minutes

## Scale Requirements

### User Scale
- **Total Users**: 100 million registered wallets
- **Active Users**: 50 million monthly active users (MAU)
- **Daily Active Users**: 20 million DAU
- **Peak Concurrent**: 500,000 simultaneous users
- **Growth Rate**: 20% year-over-year

### Transaction Volume
- **Daily Transactions**: 50 million transactions/day
- **Peak TPS**: 10,000 transactions per second (holiday shopping)
- **Average TPS**: 580 transactions per second
- **P2P Transfers**: 5 million transfers/day
- **Transaction Value**: $10 billion daily volume

### Data Volume
- **Payment Methods**: 150 million stored cards/accounts
- **Transactions**: 18 billion transactions/year
- **Transaction History**: 5 years retention
- **Receipts**: 10 billion digital receipts
- **Total Storage**: 500 TB (transactions + receipts + metadata)

### Geographic Distribution
- **Regions**: North America, Europe, Asia-Pacific
- **Countries**: 50+ countries
- **Currencies**: 30+ supported currencies
- **Languages**: 25+ language localizations
- **Data Centers**: 6 regions (multi-region active-active)

## Performance Constraints

### Latency Requirements

#### Payment Authorization
```
Target: P95 < 2 seconds, P99 < 3 seconds

Breakdown:
- Client to API Gateway: 50ms
- Authentication/Authorization: 100ms
- Token retrieval: 50ms
- Payment network call: 1200ms
- Fraud check: 300ms
- Database write: 100ms
- Response to client: 50ms
Total: ~1850ms (within target)
```

#### NFC Contactless Payment
```
Target: P99 < 500ms (tap-to-pay)

Breakdown:
- NFC handshake: 50ms
- Device authentication: 100ms
- Token generation: 50ms
- Cryptogram creation: 100ms
- Terminal communication: 150ms
- Transaction log: 50ms
Total: ~500ms (at limit)
```

#### Transaction History Load
```
Target: P95 < 1 second

Breakdown:
- API call: 50ms
- Cache check: 10ms (hit) or 200ms (miss)
- Database query: 150ms
- Data aggregation: 50ms
- Response serialization: 40ms
Total: ~300ms (cached) or ~490ms (uncached)
```

#### P2P Transfer
```
Target: P95 < 3 seconds

Breakdown:
- Sender authentication: 100ms
- Balance check: 50ms
- Fraud screening: 400ms
- Debit sender: 200ms
- Credit receiver: 200ms
- Notification dispatch: 50ms
- Confirmation: 50ms
Total: ~1050ms
```

### Throughput Requirements

#### API Endpoints
- **Payment Authorization**: 10,000 requests/second (peak)
- **Transaction History**: 50,000 requests/second
- **Add Payment Method**: 500 requests/second
- **P2P Transfer**: 2,000 requests/second
- **Balance Check**: 20,000 requests/second

#### Database Operations
- **Writes**: 15,000 writes/second (transactions + logs)
- **Reads**: 100,000 reads/second (history, balance, methods)
- **Token Lookups**: 10,000 lookups/second
- **Fraud Checks**: 10,000 checks/second

## Availability Constraints

### Uptime Requirements
```
SLA: 99.99% availability
- Allowed downtime: 52.56 minutes/year
- Monthly downtime: 4.38 minutes/month
- Daily downtime: 8.64 seconds/day

Critical Services (99.995%):
- Payment authorization
- Token vault
- Fraud detection

Non-Critical Services (99.9%):
- Transaction history
- Receipt storage
- Analytics
```

### Disaster Recovery
- **RTO (Recovery Time Objective)**: 1 hour
- **RPO (Recovery Point Objective)**: 5 minutes
- **Backup Frequency**: Continuous replication
- **Multi-Region**: Active-active in 3+ regions
- **Failover Time**: < 30 seconds automatic

### Offline Mode
```
Offline Transaction Support:
- Cache last 10 transactions
- Store 3 most-used payment tokens
- Enable up to 5 offline transactions
- Max offline amount: $100 per transaction
- Sync when connection restored
```

## Security Constraints

### Compliance Requirements

#### PCI DSS Level 1
```
Requirements:
- No storage of full card numbers (use tokens)
- Encrypt cardholder data at rest (AES-256)
- Encrypt data in transit (TLS 1.3)
- Quarterly vulnerability scans
- Annual penetration testing
- Secure coding practices
- Access control and monitoring
```

#### PSD2 (Europe)
```
Strong Customer Authentication (SCA):
- Two-factor authentication required
- Biometric + device possession
- Exemptions for low-risk transactions
- Transaction risk analysis
```

#### KYC/AML
```
Know Your Customer:
- Identity verification (government ID)
- Address verification
- Phone number verification
- Email verification

Anti-Money Laundering:
- Transaction monitoring
- Suspicious activity reporting
- Daily transaction limits
- Cumulative limits tracking
```

### Authentication Requirements
```
Multi-Factor Authentication:
1. Something you know: PIN/Password
2. Something you have: Device/Phone
3. Something you are: Biometric (fingerprint, face)

Biometric Standards:
- False Accept Rate (FAR): < 1 in 50,000
- False Reject Rate (FRR): < 1 in 100
- Liveness detection: Required
- Fallback: PIN/Password
```

### Encryption Standards
```
Data at Rest:
- Algorithm: AES-256-GCM
- Key Management: HSM (Hardware Security Module)
- Key Rotation: Every 90 days
- Secure Element: For device-stored keys

Data in Transit:
- Protocol: TLS 1.3
- Certificate: 2048-bit RSA or 256-bit ECC
- Perfect Forward Secrecy: Required
- Certificate Pinning: Mobile apps
```

### Token Security
```
Tokenization:
- Standard: EMV Payment Tokenization
- Token Format: 16-digit PAN replacement
- Token Vault: HSM-protected
- Token Lifecycle: Provision, suspend, delete
- Token Binding: Device-specific

Token Cryptogram:
- Dynamic CVV per transaction
- HMAC-SHA256 signature
- Timestamp-based nonce
- Replay attack prevention
```

## Data Constraints

### Storage Requirements

#### Hot Storage (Fast Access)
```
Recent Transactions (90 days):
- Volume: 4.5 billion transactions
- Size: ~50 TB
- Database: PostgreSQL with SSD
- Replication: 3x replicas
- Backup: Hourly incremental
```

#### Warm Storage (Moderate Access)
```
Historical Transactions (1-5 years):
- Volume: 18 billion transactions
- Size: ~200 TB
- Database: Partitioned PostgreSQL
- Replication: 2x replicas
- Backup: Daily full
```

#### Cold Storage (Archive)
```
Old Transactions (5+ years):
- Volume: Unlimited
- Size: ~250 TB
- Storage: S3 Glacier
- Compliance: 7-year retention
- Access: Rare, slow retrieval
```

#### Token Vault
```
Payment Tokens:
- Volume: 150 million tokens
- Size: ~5 TB
- Database: Encrypted PostgreSQL
- HSM: Hardware Security Module
- Replication: 5x replicas (critical)
- Backup: Real-time continuous
```

### Data Retention
```
Transaction Data: 7 years (regulatory)
Payment Methods: Until user deletes
User Profile: Until account closure + 90 days
Audit Logs: 10 years
Fraud Data: Indefinite (anonymized)
Receipts: 5 years
```

## Network Constraints

### Bandwidth Requirements
```
Peak Traffic:
- Inbound: 50 Gbps
- Outbound: 100 Gbps
- CDN: 200 Gbps (static assets)

Per Transaction:
- Request: ~5 KB
- Response: ~10 KB
- Total: ~15 KB per transaction

Daily Bandwidth:
- 50M transactions × 15 KB = 750 GB/day
- Peak hour: 150 GB/hour
```

### API Rate Limits
```
Per User:
- Payment: 10 transactions/minute
- P2P Transfer: 5 transfers/minute
- History: 100 requests/minute
- Add Payment: 3 additions/hour

Per IP:
- Anonymous: 100 requests/minute
- Authenticated: 1000 requests/minute
- Burst: 2x limit for 10 seconds
```

## Cost Constraints

### Infrastructure Costs (Monthly)
```
Compute:
- Application Servers: $50,000
- Database Servers: $80,000
- Cache Servers: $20,000
- Load Balancers: $10,000
Total Compute: $160,000/month

Storage:
- Hot Storage (SSD): $30,000
- Warm Storage (HDD): $15,000
- Cold Storage (S3): $5,000
- Backups: $10,000
Total Storage: $60,000/month

Network:
- Data Transfer: $40,000
- CDN: $20,000
- VPN/Direct Connect: $5,000
Total Network: $65,000/month

Third-Party:
- Payment Networks: $100,000 (transaction fees)
- HSM Service: $20,000
- Fraud Detection: $30,000
- Monitoring: $10,000
Total Third-Party: $160,000/month

Grand Total: ~$445,000/month
```

### Cost Per Transaction
```
Infrastructure: $0.01
Payment Network: $0.02
Fraud Detection: $0.005
Total: ~$0.035 per transaction

Revenue Model:
- Interchange fee: 1.5% of transaction
- Average transaction: $50
- Revenue per transaction: $0.75
- Profit margin: $0.715 per transaction
```

## Scalability Constraints

### Horizontal Scaling Limits
```
Application Tier:
- Max instances: 1000 pods
- Auto-scale trigger: 70% CPU
- Scale-up time: 2 minutes
- Scale-down time: 10 minutes

Database Tier:
- Read replicas: 10 per primary
- Sharding: By user_id (1000 shards)
- Connection pool: 100 per instance
- Max connections: 10,000 total
```

### Vertical Scaling Limits
```
Database Servers:
- Max CPU: 64 cores
- Max RAM: 512 GB
- Max IOPS: 100,000
- Max Storage: 64 TB

Application Servers:
- Max CPU: 16 cores
- Max RAM: 64 GB
- Typical: 8 cores, 32 GB
```

## Monitoring Constraints

### Metrics Collection
```
Frequency:
- System metrics: Every 10 seconds
- Application metrics: Every 30 seconds
- Business metrics: Every 1 minute
- Logs: Real-time streaming

Retention:
- Raw metrics: 7 days
- Aggregated (1-min): 30 days
- Aggregated (1-hour): 1 year
- Logs: 90 days (hot), 1 year (cold)
```

### Alerting Thresholds
```
Critical (Page Immediately):
- API error rate > 1%
- Payment success rate < 99%
- Latency P95 > 3 seconds
- Database CPU > 90%

Warning (Notify Team):
- API error rate > 0.5%
- Payment success rate < 99.5%
- Latency P95 > 2 seconds
- Database CPU > 80%
```

## Interview Discussion Points

### Handling Scale Questions

**Q: How do you handle 10,000 TPS during Black Friday?**
```
Answer Framework:
1. Horizontal scaling: Auto-scale to 500+ instances
2. Database: Read replicas + caching (Redis)
3. Rate limiting: Protect backend from overload
4. Queue-based: Async processing for non-critical
5. CDN: Offload static content
6. Pre-warming: Scale up before peak
```

**Q: How do you ensure 99.99% availability?**
```
Answer Framework:
1. Multi-region: Active-active deployment
2. Redundancy: No single point of failure
3. Health checks: Automatic failover
4. Circuit breakers: Prevent cascade failures
5. Graceful degradation: Core features always work
6. Chaos engineering: Regular failure testing
```

**Q: How do you handle database scaling?**
```
Answer Framework:
1. Sharding: By user_id (consistent hashing)
2. Read replicas: 10 replicas for read-heavy
3. Caching: Redis for hot data (90% hit rate)
4. Partitioning: Time-based for transactions
5. Archival: Move old data to cold storage
```

---
*Estimated Reading Time: 20 minutes*
