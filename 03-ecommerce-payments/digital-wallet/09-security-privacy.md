# Digital Wallet - Security and Privacy

**Reading Time**: 20 minutes

## Security Architecture

### Multi-Layer Security Model

```
Layer 1: Network Security
├── WAF (Web Application Firewall)
├── DDoS Protection (AWS Shield)
├── VPC with private subnets
├── Security Groups (firewall rules)
└── Network ACLs

Layer 2: Application Security
├── API Gateway authentication
├── Rate limiting (per user, per IP)
├── Input validation
├── OWASP Top 10 protection
└── SQL injection prevention

Layer 3: Service Security
├── mTLS between services
├── Service-to-service authentication
├── JWT token validation
├── Role-based access control (RBAC)
└── Least privilege principle

Layer 4: Data Security
├── Encryption at rest (AES-256)
├── Encryption in transit (TLS 1.3)
├── Tokenization (no raw PAN storage)
├── HSM for key management
└── Secure Element (mobile devices)

Layer 5: Monitoring & Response
├── Real-time threat detection
├── Anomaly detection
├── Audit logging
├── Incident response
└── Security information and event management (SIEM)
```

## Compliance Standards

### PCI DSS Level 1 Compliance

```
Requirements:
├── Build and Maintain Secure Network
│   ├── Firewall configuration
│   ├── No default passwords
│   └── Network segmentation
├── Protect Cardholder Data
│   ├── No storage of full PAN
│   ├── Encryption at rest
│   ├── Encryption in transit
│   └── Tokenization
├── Maintain Vulnerability Management
│   ├── Anti-virus software
│   ├── Secure coding practices
│   ├── Regular security updates
│   └── Penetration testing
├── Implement Strong Access Control
│   ├── Need-to-know access
│   ├── Unique IDs per user
│   ├── Multi-factor authentication
│   └── Physical access controls
├── Monitor and Test Networks
│   ├── Audit trails
│   ├── Log monitoring
│   ├── Security testing
│   └── Intrusion detection
└── Maintain Information Security Policy
    ├── Security policy
    ├── Risk assessment
    ├── Security awareness training
    └── Incident response plan

Audit Frequency:
- Annual on-site assessment
- Quarterly network scans
- Continuous monitoring
```

### PSD2 (Europe) Compliance

```
Strong Customer Authentication (SCA):
├── Two-Factor Authentication
│   ├── Something you know (PIN/Password)
│   ├── Something you have (Device/Phone)
│   └── Something you are (Biometric)
├── Dynamic Linking
│   ├── Transaction amount
│   ├── Payee information
│   └── Cryptographic binding
└── Exemptions
    ├── Low-risk transactions (< €30)
    ├── Trusted beneficiaries
    ├── Recurring transactions
    └── Transaction risk analysis

Implementation:
- Biometric + device possession
- Dynamic CVV per transaction
- Risk-based authentication
- Exemption management
```

### GDPR Compliance

```
Data Protection Principles:
├── Lawfulness, Fairness, Transparency
├── Purpose Limitation
├── Data Minimization
├── Accuracy
├── Storage Limitation
├── Integrity and Confidentiality
└── Accountability

User Rights:
├── Right to Access (data export)
├── Right to Rectification (data correction)
├── Right to Erasure (account deletion)
├── Right to Restrict Processing
├── Right to Data Portability
├── Right to Object
└── Rights related to automated decision-making

Implementation:
- Consent management
- Data retention policies
- Data deletion workflows
- Privacy by design
- Data protection impact assessment (DPIA)
```

## Authentication and Authorization

### Multi-Factor Authentication

```
Authentication Factors:
1. Knowledge Factor (Something you know)
   - PIN (4-6 digits)
   - Password (8+ characters)
   - Security questions

2. Possession Factor (Something you have)
   - Mobile device
   - Hardware token
   - SMS OTP
   - Email OTP

3. Inherence Factor (Something you are)
   - Fingerprint
   - Face ID
   - Voice recognition
   - Behavioral biometrics

MFA Flows:
Login:
- Email/Password + SMS OTP
- Email/Password + Biometric
- Biometric + Device possession

High-Value Transaction:
- Biometric + PIN
- Biometric + SMS OTP
- PIN + Device possession
```

### Biometric Authentication

```
Supported Biometrics:
├── Fingerprint
│   ├── Touch ID (iOS)
│   ├── Fingerprint sensor (Android)
│   ├── False Accept Rate: < 1 in 50,000
│   └── False Reject Rate: < 1 in 100
├── Face Recognition
│   ├── Face ID (iOS)
│   ├── Face Unlock (Android)
│   ├── Liveness detection
│   └── 3D depth mapping
└── Behavioral Biometrics
    ├── Typing patterns
    ├── Swipe patterns
    ├── Device angle
    └── Pressure sensitivity

Security Measures:
- Biometric data never leaves device
- Stored in Secure Enclave / TEE
- Encrypted biometric templates
- Liveness detection (prevent spoofing)
- Fallback to PIN/Password
```

### Device Binding

```
Device Registration:
1. User logs in with credentials
2. Device generates unique ID
3. Device public key sent to server
4. Server stores device ID + public key
5. Device stores private key in Secure Element

Device Verification:
1. User initiates transaction
2. Device signs transaction with private key
3. Server verifies signature with public key
4. Transaction proceeds if valid

Device Management:
- List registered devices
- Remove device remotely
- Limit: 5 devices per user
- Require re-authentication on new device
```

## Encryption

### Data at Rest

```
Database Encryption:
├── PostgreSQL Transparent Data Encryption (TDE)
├── Algorithm: AES-256-GCM
├── Key Management: AWS KMS
├── Key Rotation: Every 90 days
└── Encrypted backups

Application-Level Encryption:
├── Sensitive fields (PII, PAN)
├── Algorithm: AES-256-GCM
├── Key per user (derived from master key)
├── Envelope encryption
└── HSM for master keys

Token Vault:
├── Hardware Security Module (HSM)
├── FIPS 140-2 Level 3 certified
├── Tamper-resistant
├── Key generation and storage
└── Cryptographic operations
```

### Data in Transit

```
TLS Configuration:
├── Protocol: TLS 1.3
├── Cipher Suites:
│   ├── TLS_AES_256_GCM_SHA384
│   ├── TLS_CHACHA20_POLY1305_SHA256
│   └── TLS_AES_128_GCM_SHA256
├── Certificate: 2048-bit RSA or 256-bit ECC
├── Perfect Forward Secrecy (PFS)
└── HSTS (HTTP Strict Transport Security)

Certificate Pinning (Mobile):
- Pin public key hash
- Backup pins for rotation
- Fail closed on mismatch
- Update pins with app updates
```

## Tokenization

### EMV Payment Tokenization

```
Token Lifecycle:
1. Provision
   - User adds card
   - Card validated with issuer
   - Token requested from network
   - Token stored in vault
   - Token provisioned to device

2. Use
   - Transaction initiated
   - Token retrieved
   - Cryptogram generated
   - Transaction authorized
   - Token usage logged

3. Suspend
   - Suspicious activity detected
   - User reports lost device
   - Token temporarily disabled
   - Can be reactivated

4. Delete
   - User removes card
   - Device deregistered
   - Token permanently deleted
   - Cannot be reactivated

Token Format:
- 16-digit PAN replacement
- Same BIN as original card
- Unique per device
- Expiry date
- Dynamic CVV per transaction
```

### Token Security

```
Token Vault:
├── HSM-protected storage
├── Encrypted at rest
├── Access logging
├── Rate limiting
└── Anomaly detection

Token-to-PAN Mapping:
- One-way hash (SHA-256)
- No reverse lookup
- Separate database
- Restricted access
- Audit trail

Cryptogram Generation:
- HMAC-SHA256
- Timestamp-based nonce
- Transaction amount
- Merchant ID
- Replay attack prevention
```

## Fraud Detection

### Rule-Based Detection

```
Velocity Rules:
├── Max 10 transactions per hour
├── Max 20 transactions per day
├── Max $5,000 per day
├── Max $1,000 per transaction
└── Max 3 failed attempts per hour

Geographic Rules:
├── Impossible travel (US → Russia in 1 hour)
├── High-risk countries
├── VPN/Proxy detection
├── Location mismatch (billing vs transaction)
└── Frequent location changes

Device Rules:
├── New device (require 2FA)
├── Rooted/Jailbroken device (block)
├── Emulator detection (block)
├── Device fingerprint mismatch
└── Multiple accounts per device

Amount Rules:
├── Unusual amount (3x average)
├── Round amounts ($1000, $5000)
├── Micro-transactions (< $1)
├── High-value transactions (> $1000)
└── Rapid amount escalation
```

### ML-Based Detection

```
Features (100+):
├── User Features
│   ├── Account age
│   ├── Transaction history
│   ├── Average transaction amount
│   ├── Transaction frequency
│   └── Historical fraud rate
├── Transaction Features
│   ├── Amount
│   ├── Time of day
│   ├── Day of week
│   ├── Merchant category
│   └── Payment method
├── Device Features
│   ├── Device type
│   ├── OS version
│   ├── App version
│   ├── IP address
│   └── Location
└── Network Features
    ├── Transaction graph
    ├── Account linking
    ├── Shared devices
    └── Shared payment methods

Model Architecture:
├── Gradient Boosting (XGBoost)
│   ├── 1000 trees
│   ├── Max depth: 10
│   ├── Learning rate: 0.1
│   └── Training: Weekly
├── Neural Network (LSTM)
│   ├── Sequence modeling
│   ├── 3 layers, 128 units
│   ├── Dropout: 0.3
│   └── Training: Daily
└── Ensemble
    ├── Weighted average
    ├── XGBoost: 60%
    ├── LSTM: 30%
    └── Rules: 10%

Risk Scoring:
- Score: 0-100
- Low risk: 0-30 (auto-approve)
- Medium risk: 31-70 (2FA required)
- High risk: 71-90 (manual review)
- Critical risk: 91-100 (block)
```

### Fraud Response

```
Automated Actions:
├── Block transaction (score > 90)
├── Request 2FA (score 31-70)
├── Manual review queue (score 71-90)
├── Suspend account (multiple high-risk)
└── Notify user (suspicious activity)

Manual Review:
├── Review queue dashboard
├── Transaction details
├── User history
├── Device information
├── Analyst notes
└── Approve/Decline decision

User Notification:
├── Push notification (immediate)
├── Email (within 5 minutes)
├── SMS (high-risk only)
└── In-app alert
```

## Privacy Protection

### Data Minimization

```
Principles:
├── Collect only necessary data
├── Store only required duration
├── Delete when no longer needed
├── Anonymize for analytics
└── Pseudonymize where possible

Implementation:
- No storage of full PAN (use tokens)
- No storage of CVV
- No storage of biometric data (device-only)
- Minimal PII collection
- Data retention policies
```

### Data Retention

```
Retention Periods:
├── Transaction Data: 7 years (regulatory)
├── User Profile: Until account closure + 90 days
├── Payment Methods: Until user deletes
├── Audit Logs: 10 years
├── Fraud Data: Indefinite (anonymized)
├── Receipts: 5 years
└── Session Data: 30 days

Deletion Process:
1. User requests account deletion
2. 30-day grace period (can cancel)
3. Soft delete (mark as deleted)
4. 90-day retention (regulatory)
5. Hard delete (permanent removal)
6. Anonymize transaction history
7. Notify user of completion
```

### Data Export

```
GDPR Data Export:
├── User profile
├── Payment methods (masked)
├── Transaction history
├── P2P transfers
├── Notifications
├── Audit logs
└── Device information

Format:
- JSON or CSV
- Encrypted ZIP file
- Download link (expires in 7 days)
- Email notification
- Processing time: < 24 hours
```

## Incident Response

### Security Incident Handling

```
Incident Severity:
├── Critical (P0)
│   ├── Data breach
│   ├── Payment fraud
│   ├── System compromise
│   └── Response: Immediate
├── High (P1)
│   ├── Unauthorized access
│   ├── DDoS attack
│   ├── Malware detection
│   └── Response: < 1 hour
├── Medium (P2)
│   ├── Suspicious activity
│   ├── Policy violation
│   ├── Vulnerability
│   └── Response: < 4 hours
└── Low (P3)
    ├── Security alert
    ├── Audit finding
    ├── Minor issue
    └── Response: < 24 hours

Incident Response Process:
1. Detection (automated alerts, user reports)
2. Triage (severity assessment)
3. Containment (isolate affected systems)
4. Investigation (root cause analysis)
5. Eradication (remove threat)
6. Recovery (restore normal operations)
7. Post-Incident Review (lessons learned)
```

### Breach Notification

```
Notification Requirements:
├── Users (within 72 hours)
├── Regulators (within 72 hours)
├── Payment networks (immediately)
├── Law enforcement (if criminal)
└── Media (if > 500 users affected)

Notification Content:
- Nature of breach
- Data compromised
- Number of users affected
- Actions taken
- User recommendations
- Contact information
```

## Interview Discussion Points

**Q: How ensure PCI DSS compliance?**
```
Key Measures:
1. No storage of full PAN (use tokens)
2. Encryption at rest and in transit
3. HSM for key management
4. Network segmentation
5. Access controls
6. Audit logging
7. Regular security testing
8. Incident response plan
```

**Q: How handle biometric data?**
```
Security Measures:
1. Never leave device
2. Stored in Secure Enclave / TEE
3. Encrypted templates
4. Liveness detection
5. Fallback to PIN
6. No cloud storage
7. User consent required
```

**Q: How detect and prevent fraud?**
```
Multi-Layered Approach:
1. Rule-based detection (velocity, geo, amount)
2. ML-based detection (anomaly, behavior)
3. Device fingerprinting
4. Transaction risk analysis
5. Real-time scoring
6. Manual review queue
7. User notifications
```

---
*Estimated Reading Time: 20 minutes*
