# Uber Backend - Security and Privacy

## Authentication and Authorization

### 1. User Authentication
**Multi-Factor Authentication (MFA)**:
```
Primary Authentication:
- Phone number verification (SMS OTP)
- Email verification
- Social login (Google, Facebook, Apple)

Secondary Authentication:
- Biometric (Face ID, Touch ID)
- PIN code
- Security questions

Session Management:
- JWT tokens with 1-hour expiration
- Refresh tokens with 30-day expiration
- Device fingerprinting
- Automatic logout after 30 days of inactivity
```

**Implementation**:
```
Login Flow:
1. User enters phone number
2. Server sends 6-digit OTP via SMS
3. User enters OTP
4. Server validates OTP
5. Generate JWT access token + refresh token
6. Store session in Redis with device info
7. Return tokens to client

Token Structure:
{
  "user_id": "uuid",
  "user_type": "RIDER",
  "device_id": "device_uuid",
  "issued_at": 1704715200,
  "expires_at": 1704718800,
  "permissions": ["ride:request", "payment:view"]
}

Security Measures:
- Rate limit OTP requests (5 per hour per phone)
- OTP expires after 5 minutes
- Maximum 3 OTP attempts
- Block phone number after 10 failed attempts
- Detect and block virtual phone numbers
```

### 2. Authorization and Access Control
**Role-Based Access Control (RBAC)**:
```
Roles:
- RIDER: Request rides, view history, manage payments
- DRIVER: Accept rides, update location, view earnings
- ADMIN: Manage users, view analytics, configure system
- SUPPORT: View trips, issue refunds, resolve disputes

Permissions:
- ride:request, ride:cancel, ride:view
- driver:accept, driver:location, driver:earnings
- payment:process, payment:refund
- admin:users, admin:analytics, admin:config

Implementation:
- JWT contains user role and permissions
- API Gateway validates permissions before routing
- Service-level authorization checks
- Audit logging of all permission checks
```

**API Authorization**:
```
Authorization Header:
Authorization: Bearer {JWT_TOKEN}

Permission Check:
1. Extract JWT from Authorization header
2. Validate JWT signature and expiration
3. Extract user_id and permissions
4. Check if user has required permission
5. Allow or deny request

Example:
POST /v1/rides/request
Required Permission: ride:request
User Permissions: [ride:request, ride:cancel, payment:view]
Result: ALLOWED

POST /v1/admin/users
Required Permission: admin:users
User Permissions: [ride:request, ride:cancel]
Result: DENIED (403 Forbidden)
```

## Data Encryption

### 1. Encryption at Rest
**Database Encryption**:
```
PostgreSQL:
- Transparent Data Encryption (TDE)
- AES-256 encryption for all data at rest
- Encrypted backups
- Key rotation every 90 days

Sensitive Fields (Additional Encryption):
- Payment card numbers: Tokenized + encrypted
- SSN/Tax IDs: AES-256 with separate key
- Driver license numbers: AES-256 with separate key
- Phone numbers: Hashed for lookup, encrypted for storage

Implementation:
-- Encrypted column example
CREATE TABLE payment_methods (
    payment_method_id UUID PRIMARY KEY,
    user_id UUID,
    card_token VARCHAR(255), -- Tokenized by Stripe
    card_encrypted BYTEA, -- Encrypted card details
    encryption_key_id VARCHAR(50)
);

-- Encryption function
SELECT pgp_sym_encrypt(
    'sensitive_data',
    encryption_key,
    'cipher-algo=aes256'
);
```

**File Storage Encryption**:
```
S3 Encryption:
- Server-side encryption (SSE-S3)
- AES-256 encryption
- Encrypted in transit (TLS)
- Encrypted at rest

Profile Images:
- Encrypted with S3 SSE
- Signed URLs for access (1-hour expiration)
- CloudFront for delivery with HTTPS

Trip Receipts:
- Encrypted PDFs
- Access controlled by user authentication
- Automatic deletion after 7 years
```

### 2. Encryption in Transit
**TLS/SSL Configuration**:
```
TLS Version: TLS 1.3 (minimum TLS 1.2)
Cipher Suites:
- TLS_AES_256_GCM_SHA384
- TLS_CHACHA20_POLY1305_SHA256
- TLS_AES_128_GCM_SHA256

Certificate Management:
- Let's Encrypt for automatic renewal
- Certificate pinning in mobile apps
- HSTS (HTTP Strict Transport Security)
- Certificate transparency monitoring

API Gateway Configuration:
server {
    listen 443 ssl http2;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    add_header Strict-Transport-Security "max-age=31536000" always;
}
```

**End-to-End Encryption (E2E)**:
```
Use Cases:
- Driver-rider messaging
- Support chat conversations
- Sensitive document uploads

Implementation:
1. Generate key pair for each user
2. Exchange public keys
3. Encrypt messages with recipient's public key
4. Decrypt with recipient's private key
5. Server cannot read message content

Signal Protocol:
- Perfect forward secrecy
- Deniable authentication
- Asynchronous messaging support
```

## PCI DSS Compliance

### Payment Card Industry Data Security Standard
**Compliance Requirements**:
```
Level 1 Compliance (>6M transactions/year):
- Annual on-site security assessment
- Quarterly network scans
- Maintain secure network
- Protect cardholder data
- Maintain vulnerability management program
- Implement strong access control measures
- Regularly monitor and test networks
- Maintain information security policy

Implementation:
1. Tokenization:
   - Never store actual card numbers
   - Use Stripe/Braintree tokens
   - Tokens stored in separate database

2. Network Segmentation:
   - Payment services in isolated network
   - Firewall rules restrict access
   - No direct internet access

3. Access Control:
   - Minimum necessary access
   - Multi-factor authentication
   - Audit logging of all access

4. Monitoring:
   - Real-time fraud detection
   - Anomaly detection
   - Security event logging
   - Quarterly vulnerability scans
```

**Payment Data Handling**:
```
Card Data Flow:
1. User enters card in mobile app
2. App sends directly to Stripe (not Uber servers)
3. Stripe returns token
4. Uber stores token (not card number)
5. For payments, Uber sends token to Stripe
6. Stripe processes payment

Data Storage:
✓ Store: Token, last 4 digits, expiry month/year, brand
✗ Never Store: Full card number, CVV, PIN

Audit Trail:
- Log all payment attempts
- Log all token usage
- Log all refunds
- Retain logs for 7 years
```

## Privacy and Data Protection

### 1. GDPR Compliance (Europe)
**User Rights**:
```
Right to Access:
- API endpoint: GET /v1/users/me/data
- Returns all user data in JSON format
- Includes trips, payments, ratings, location history
- Response within 30 days

Right to Erasure (Right to be Forgotten):
- API endpoint: DELETE /v1/users/me
- Anonymize user data (keep for analytics)
- Delete personal identifiers
- Retain financial data for 7 years (legal requirement)
- Complete deletion within 30 days

Right to Data Portability:
- Export user data in machine-readable format (JSON, CSV)
- Include all trips, payments, preferences
- Provide download link valid for 7 days

Right to Rectification:
- Allow users to update personal information
- Verify changes with email/SMS confirmation
- Audit trail of all changes
```

**Data Minimization**:
```
Collect Only Necessary Data:
- Location: Only during active trip
- Contacts: Only if user enables sharing
- Photos: Only profile picture (optional)
- Payment: Only necessary for transactions

Data Retention:
- Active user data: Indefinite
- Inactive user data (>2 years): Anonymize
- Trip data: 2 years, then archive
- Location data: 90 days, then delete
- Logs: 1 year, then delete
- Financial data: 7 years (legal requirement)
```

### 2. CCPA Compliance (California)
**Consumer Rights**:
```
Right to Know:
- Disclose categories of personal information collected
- Disclose sources of information
- Disclose business purpose for collection
- Disclose third parties with whom data is shared

Right to Delete:
- Delete personal information upon request
- Exceptions for legal obligations
- Confirm deletion within 45 days

Right to Opt-Out:
- Opt-out of data sale (Uber doesn't sell data)
- Opt-out of targeted advertising
- Opt-out of location tracking (except during trips)

Do Not Sell My Personal Information:
- Prominent link in app and website
- Easy opt-out process
- Respect opt-out for 12 months
```

### 3. Location Privacy
**Location Data Handling**:
```
Collection:
- Collect location only when app is active
- Request permission before collection
- Explain why location is needed
- Allow users to deny location access

Storage:
- Store location data for 90 days
- Anonymize after 90 days
- Aggregate for analytics
- Delete on user request

Sharing:
- Share with driver only during active trip
- Share with rider only during active trip
- Never share with third parties
- Never use for advertising

User Controls:
- Enable/disable location tracking
- View location history
- Delete location history
- Download location data
```

## Fraud Detection and Prevention

### 1. Payment Fraud Detection
**Real-time Fraud Scoring**:
```
Fraud Signals:
- New payment method used
- High-value transaction
- Unusual trip pattern
- Mismatched billing address
- VPN/proxy usage
- Device fingerprint mismatch
- Velocity checks (multiple cards in short time)

ML Model:
- Features: 100+ signals
- Model: Gradient Boosting (XGBoost)
- Training: Daily on last 90 days of data
- Inference: <50ms per transaction

Fraud Score:
- 0-30: Low risk (auto-approve)
- 31-70: Medium risk (additional verification)
- 71-100: High risk (block transaction)

Actions:
- Low risk: Process payment
- Medium risk: Require 3D Secure verification
- High risk: Block payment, flag account
```

**Fraud Prevention Measures**:
```
Payment Verification:
- 3D Secure (3DS) for high-risk transactions
- CVV verification for all card payments
- Address verification (AVS)
- Device fingerprinting
- Behavioral biometrics

Account Monitoring:
- Detect account takeover attempts
- Monitor for unusual activity
- Flag rapid payment method changes
- Detect stolen credit cards

Chargeback Management:
- Automated dispute response
- Evidence collection (GPS, receipts)
- Chargeback rate monitoring
- Proactive refunds for legitimate issues
```

### 2. Trip Fraud Detection
**Fraudulent Trip Patterns**:
```
Detection Signals:
- GPS spoofing (impossible speeds, teleportation)
- Route manipulation (unnecessary detours)
- Fake trips (driver and rider collude)
- Rating manipulation (fake 5-star ratings)
- Promo code abuse (multiple accounts)

ML Model:
- Anomaly detection on trip patterns
- Graph analysis for collusion detection
- Time-series analysis for GPS data
- Natural language processing for reviews

Actions:
- Flag suspicious trips for review
- Suspend accounts pending investigation
- Refund riders for fraudulent trips
- Terminate drivers for repeated fraud
```

## Security Monitoring and Incident Response

### 1. Security Monitoring
**SIEM (Security Information and Event Management)**:
```
Log Collection:
- Application logs
- Database audit logs
- Network traffic logs
- Authentication logs
- API access logs

Security Events:
- Failed login attempts
- Privilege escalation attempts
- Unusual data access patterns
- SQL injection attempts
- DDoS attacks

Alerting:
- Real-time alerts for critical events
- Slack/PagerDuty integration
- Automated response for known threats
- Escalation to security team
```

**Vulnerability Management**:
```
Scanning:
- Weekly vulnerability scans
- Dependency scanning (Snyk, Dependabot)
- Container image scanning
- Infrastructure as Code scanning

Patching:
- Critical vulnerabilities: 24 hours
- High vulnerabilities: 7 days
- Medium vulnerabilities: 30 days
- Low vulnerabilities: 90 days

Penetration Testing:
- Annual third-party penetration test
- Quarterly internal penetration test
- Bug bounty program
- Responsible disclosure policy
```

### 2. Incident Response
**Incident Response Plan**:
```
Phases:
1. Detection: Identify security incident
2. Containment: Isolate affected systems
3. Eradication: Remove threat
4. Recovery: Restore normal operations
5. Lessons Learned: Post-mortem analysis

Incident Severity:
- SEV1: Data breach, system compromise
- SEV2: Attempted breach, DDoS attack
- SEV3: Vulnerability discovered
- SEV4: Policy violation

Response Team:
- Security Lead
- Engineering Lead
- Legal Counsel
- PR/Communications
- Customer Support

Communication:
- Internal: Slack, email, incident channel
- External: Status page, email to affected users
- Regulatory: Report within 72 hours (GDPR)
```

**Data Breach Response**:
```
Immediate Actions:
1. Identify scope of breach
2. Contain breach (isolate systems)
3. Preserve evidence
4. Notify security team
5. Assess impact

Notification:
- Affected users: Within 72 hours
- Regulators: Within 72 hours (GDPR)
- Law enforcement: If criminal activity
- Credit bureaus: If SSN/financial data

Remediation:
- Force password reset for affected users
- Revoke compromised tokens
- Patch vulnerability
- Enhance monitoring
- Conduct post-mortem
```

## Secure Development Practices

### 1. Secure SDLC
**Development Process**:
```
Code Review:
- Mandatory peer review for all code
- Security-focused review for sensitive code
- Automated security scanning (SonarQube)
- OWASP Top 10 checklist

Testing:
- Unit tests with security test cases
- Integration tests for auth/authz
- Penetration testing before release
- Fuzz testing for input validation

Deployment:
- Automated security checks in CI/CD
- Container image scanning
- Infrastructure as Code security scanning
- Gradual rollout with monitoring
```

**Security Training**:
```
Developer Training:
- Annual security awareness training
- OWASP Top 10 training
- Secure coding practices
- Incident response procedures

Certifications:
- Certified Secure Software Lifecycle Professional (CSSLP)
- Certified Information Systems Security Professional (CISSP)
- AWS Certified Security Specialty
```

This comprehensive security and privacy framework ensures Uber protects user data, complies with regulations, and maintains trust while operating at global scale.
