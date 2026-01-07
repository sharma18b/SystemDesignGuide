# Ticketmaster - Security and Privacy

## Authentication and Authorization

### Multi-Factor Authentication
```
Primary Authentication:
- Email + Password
- Social login (Google, Facebook, Apple)
- Phone number verification

Secondary Authentication (High-Value Purchases):
- SMS OTP
- Email verification code
- Authenticator app (TOTP)
- Biometric (Face ID, Touch ID)

Session Management:
- JWT tokens (1-hour expiration)
- Refresh tokens (30-day expiration)
- Device fingerprinting
- Automatic logout after inactivity
```

### Role-Based Access Control
```
Roles:
- CUSTOMER: Browse, purchase, manage tickets
- VENUE_ADMIN: Manage venue events, scan tickets
- EVENT_ORGANIZER: Create events, view sales
- SUPPORT_AGENT: View orders, issue refunds
- SYSTEM_ADMIN: Full system access

Permissions:
- ticket:purchase, ticket:transfer, ticket:refund
- event:create, event:modify, event:delete
- order:view, order:refund
- user:manage, user:ban

Implementation:
- JWT contains user role and permissions
- API Gateway validates permissions
- Service-level authorization checks
- Audit logging of all actions
```

## Payment Security

### PCI DSS Compliance
```
Level 1 Requirements (>6M transactions/year):
- Annual security assessment
- Quarterly network scans
- Secure network architecture
- Protect cardholder data
- Vulnerability management
- Access control measures
- Network monitoring
- Security policies

Implementation:
1. Tokenization:
   - Never store card numbers
   - Use Stripe/Braintree tokens
   - Tokens in separate database

2. Network Segmentation:
   - Payment services isolated
   - Firewall rules
   - No direct internet access

3. Encryption:
   - TLS 1.3 for all traffic
   - AES-256 for data at rest
   - Key rotation every 90 days

4. Access Control:
   - Minimum necessary access
   - Multi-factor authentication
   - Audit logging
```

### Payment Data Handling
```
Store:
✓ Payment token
✓ Last 4 digits
✓ Expiry month/year
✓ Card brand

Never Store:
✗ Full card number
✗ CVV/CVC
✗ PIN

Payment Flow:
1. User enters card in app
2. App sends to Stripe (not our servers)
3. Stripe returns token
4. We store token only
5. For payments, send token to Stripe
```

## Fraud Detection

### Real-Time Fraud Scoring
```
Fraud Signals:
- New account with high-value purchase
- Multiple failed payment attempts
- VPN/proxy usage
- Unusual purchase patterns
- Device fingerprint mismatch
- Velocity checks (multiple purchases)
- Known fraudulent email/phone

ML Model:
- Features: 150+ signals
- Model: XGBoost
- Training: Daily on last 90 days
- Inference: <50ms

Fraud Score:
- 0-30: Low risk (auto-approve)
- 31-70: Medium risk (additional verification)
- 71-100: High risk (block transaction)

Actions:
- Low: Process normally
- Medium: Require 3D Secure, phone verification
- High: Block purchase, flag account
```

### Bot Detection
```
Detection Methods:

1. Behavioral Analysis:
   - Mouse movement patterns
   - Typing speed and rhythm
   - Time between actions
   - Navigation patterns
   - Scroll behavior

2. Device Fingerprinting:
   - Browser fingerprint
   - Screen resolution
   - Timezone
   - Installed fonts
   - Canvas fingerprint
   - WebGL fingerprint

3. Network Analysis:
   - IP reputation
   - Data center IPs
   - Tor exit nodes
   - VPN detection
   - Request patterns

4. CAPTCHA:
   - reCAPTCHA v3 (invisible)
   - Challenge low-score users
   - Adaptive difficulty

5. ML Models:
   - Real-time bot scoring
   - Pattern recognition
   - Anomaly detection
```

## Data Encryption

### Encryption at Rest
```
Database Encryption:
- PostgreSQL TDE (Transparent Data Encryption)
- AES-256 encryption
- Encrypted backups
- Key rotation every 90 days

Sensitive Fields:
- Payment tokens: Encrypted + tokenized
- SSN/Tax IDs: AES-256
- Phone numbers: Hashed for lookup, encrypted for storage
- Addresses: Encrypted

File Storage:
- S3 server-side encryption (SSE-S3)
- Ticket PDFs: Encrypted
- Profile images: Encrypted
- Signed URLs for access (1-hour expiration)
```

### Encryption in Transit
```
TLS Configuration:
- TLS 1.3 (minimum TLS 1.2)
- Strong cipher suites only
- Certificate pinning in mobile apps
- HSTS enabled
- Perfect forward secrecy

API Security:
- All APIs over HTTPS
- Certificate transparency monitoring
- Automatic certificate renewal
```

## Privacy and Compliance

### GDPR Compliance
```
User Rights:

1. Right to Access:
   - API: GET /users/me/data
   - Returns all user data
   - Response within 30 days

2. Right to Erasure:
   - API: DELETE /users/me
   - Anonymize personal data
   - Retain financial data (7 years)
   - Complete within 30 days

3. Right to Portability:
   - Export data in JSON/CSV
   - Include orders, tickets, preferences
   - Download link valid 7 days

4. Right to Rectification:
   - Update personal information
   - Email/SMS confirmation
   - Audit trail of changes

Data Minimization:
- Collect only necessary data
- Clear purpose for each field
- Regular data cleanup
- Automatic deletion of old data
```

### CCPA Compliance
```
Consumer Rights:

1. Right to Know:
   - Disclose data collected
   - Disclose data sources
   - Disclose business purpose
   - Disclose third-party sharing

2. Right to Delete:
   - Delete personal information
   - Exceptions for legal obligations
   - Confirm deletion within 45 days

3. Right to Opt-Out:
   - Opt-out of data sale (we don't sell)
   - Opt-out of targeted advertising
   - Prominent "Do Not Sell" link

4. Non-Discrimination:
   - Same service quality
   - Same prices
   - No penalties for exercising rights
```

### Data Retention
```
Retention Policies:
- Active user data: Indefinite
- Inactive users (>2 years): Anonymize
- Order history: 7 years (legal requirement)
- Payment data: 7 years
- Tickets: 1 year after event
- Logs: 1 year
- Analytics: 2 years

Deletion Process:
1. Identify data for deletion
2. Anonymize personal identifiers
3. Retain aggregated data
4. Audit trail of deletions
5. Confirm compliance
```

## Ticket Security

### QR Code Security
```
QR Code Generation:
- Unique per ticket
- Encrypted payload
- Timestamp included
- Digital signature
- Rotation on transfer

QR Code Content:
{
  "ticket_id": "uuid",
  "event_id": "uuid",
  "seat": "Floor-A-1",
  "timestamp": 1704715200,
  "signature": "hmac_sha256"
}

Validation:
1. Scan QR code
2. Decrypt payload
3. Verify signature
4. Check timestamp (within 5 minutes)
5. Verify ticket not already scanned
6. Mark as scanned
7. Allow entry

Security Features:
- One-time use
- Time-limited validity
- Offline validation capable
- Tamper-evident
```

### Ticket Transfer Security
```
Transfer Process:
1. Sender initiates transfer
2. Generate unique transfer token
3. Email link to recipient
4. Recipient accepts transfer
5. Invalidate old ticket
6. Generate new ticket
7. Notify both parties

Security Measures:
- Transfer token expires in 7 days
- Email verification required
- One-time use token
- Audit trail of transfers
- Prevent transfer loops
- Rate limiting (max 5 transfers/day)
```

## DDoS Protection

### Multi-Layer Defense
```
Layer 1 - Network (Cloudflare):
- Anycast network
- 200+ PoPs globally
- 100+ Tbps capacity
- Automatic mitigation

Layer 2 - Application (WAF):
- Rate limiting by IP
- Geographic filtering
- Known attack signatures
- Custom rules

Layer 3 - Queue System:
- Virtual waiting room
- Controlled admission
- Prevent system overload
- Fair access

Layer 4 - Application:
- Request validation
- Input sanitization
- Resource limits
- Circuit breakers
```

### Rate Limiting
```
Limits by Endpoint:
- Search: 100 req/min per IP
- Event details: 200 req/min per IP
- Seat map: 50 req/min per IP
- Reserve seats: 10 req/min per user
- Purchase: 5 req/min per user

Limits by User Type:
- Anonymous: 100 req/hour
- Authenticated: 1000 req/hour
- Premium: 10,000 req/hour

Response:
HTTP 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704715200
```

## Security Monitoring

### SIEM (Security Information and Event Management)
```
Log Collection:
- Application logs
- Database audit logs
- Network traffic logs
- Authentication logs
- Payment logs

Security Events:
- Failed login attempts (>5 in 5 minutes)
- Privilege escalation attempts
- Unusual data access patterns
- SQL injection attempts
- XSS attempts
- DDoS attacks

Alerting:
- Real-time alerts for critical events
- Slack/PagerDuty integration
- Automated response for known threats
- Escalation to security team
```

### Vulnerability Management
```
Scanning:
- Weekly vulnerability scans
- Dependency scanning (Snyk)
- Container image scanning
- Infrastructure scanning

Patching:
- Critical: 24 hours
- High: 7 days
- Medium: 30 days
- Low: 90 days

Penetration Testing:
- Annual third-party pentest
- Quarterly internal pentest
- Bug bounty program
- Responsible disclosure policy
```

## Incident Response

### Incident Response Plan
```
Phases:
1. Detection: Identify security incident
2. Containment: Isolate affected systems
3. Eradication: Remove threat
4. Recovery: Restore normal operations
5. Lessons Learned: Post-mortem

Incident Severity:
- SEV1: Data breach, system compromise
- SEV2: Attempted breach, DDoS
- SEV3: Vulnerability discovered
- SEV4: Policy violation

Response Team:
- Security Lead
- Engineering Lead
- Legal Counsel
- PR/Communications
- Customer Support

Communication:
- Internal: Slack, incident channel
- External: Status page, email
- Regulatory: Report within 72 hours (GDPR)
```

### Data Breach Response
```
Immediate Actions:
1. Identify scope of breach
2. Contain breach
3. Preserve evidence
4. Notify security team
5. Assess impact

Notification:
- Affected users: Within 72 hours
- Regulators: Within 72 hours (GDPR)
- Law enforcement: If criminal
- Credit bureaus: If financial data

Remediation:
- Force password reset
- Revoke compromised tokens
- Patch vulnerability
- Enhance monitoring
- Post-mortem analysis
```

This comprehensive security framework ensures Ticketmaster protects user data, prevents fraud, and maintains trust while handling millions of transactions during high-traffic events.
