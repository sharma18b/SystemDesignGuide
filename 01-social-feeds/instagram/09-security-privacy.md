# Design Instagram - Security and Privacy

## Authentication and Authorization

### User Authentication

#### Multi-Factor Authentication (MFA)
```
Authentication Flow:
1. User enters username and password
2. System validates credentials
3. If MFA enabled, send verification code
4. User enters code from authenticator app or SMS
5. System validates code and issues JWT token

MFA Methods:
- Authenticator apps (Google Authenticator, Authy)
- SMS verification codes
- Email verification codes
- Backup codes (one-time use)

Implementation:
- Store MFA secret encrypted in database
- Use TOTP (Time-based One-Time Password)
- 30-second time window
- Rate limit MFA attempts (5 per 15 minutes)
```

#### Password Security
```
Password Requirements:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

Password Storage:
- Hash with bcrypt (cost factor: 12)
- Salt per password (random 16-byte salt)
- Never store plaintext passwords
- Rotate hashing algorithm periodically

Password Reset:
- Send reset link to verified email
- Token expires in 1 hour
- One-time use token
- Invalidate all sessions on password change
```

#### Session Management
```
JWT Token Structure:
{
  "user_id": 123456789,
  "username": "johndoe",
  "verified": true,
  "iat": 1704672000,
  "exp": 1704675600,
  "jti": "unique_token_id"
}

Token Security:
- Sign with RS256 (asymmetric encryption)
- Short expiration (1 hour for access token)
- Refresh token (30 days, stored in database)
- Rotate refresh tokens on use
- Revoke tokens on logout or suspicious activity

Session Storage:
- Store active sessions in Redis
- Track device, IP, location, user agent
- Allow users to view and revoke sessions
- Automatic session expiration
```

### Authorization and Access Control

#### Role-Based Access Control (RBAC)
```
User Roles:
- Regular User: Post photos, follow users, like/comment
- Verified User: Blue checkmark, higher rate limits
- Business Account: Analytics, ads, shopping
- Moderator: Content moderation, user suspension
- Admin: Full system access, user management

Permissions:
- post:create, post:delete, post:edit
- user:follow, user:block, user:mute
- admin:suspend_user, admin:delete_post
- moderator:review_content, moderator:flag_spam

Implementation:
- Store roles and permissions in database
- Check permissions on every API request
- Cache permissions in Redis
- Audit log for all permission checks
```

#### Content Privacy Controls
```
Privacy Levels:
1. Public: Anyone can see and interact
2. Private: Only approved followers can see
3. Close Friends: Selected users only (for stories)

Implementation:
- Check privacy settings before serving content
- Filter feeds based on follow relationships
- Respect block and mute lists
- Handle private accounts in search results
```

## Data Encryption

### Encryption at Rest
```
Database Encryption:
- AES-256 encryption for all data at rest
- Transparent Data Encryption (TDE)
- Encrypted backups and snapshots
- Key rotation every 90 days

File Storage Encryption:
- S3 server-side encryption (SSE-S3)
- Encrypt media files before upload
- Encrypted object storage
- Separate encryption keys per region

Key Management:
- AWS KMS for key management
- Hardware Security Modules (HSM)
- Key hierarchy (master key → data keys)
- Audit logging for key usage
```

### Encryption in Transit
```
TLS Configuration:
- TLS 1.3 for all connections
- Strong cipher suites only
- Perfect Forward Secrecy (PFS)
- HSTS (HTTP Strict Transport Security)
- Certificate pinning for mobile apps

API Security:
- HTTPS only (no HTTP)
- TLS certificate from trusted CA
- Automatic certificate renewal
- Monitor certificate expiration
```

### End-to-End Encryption (for DMs)
```
E2E Encryption Protocol:
- Signal Protocol for messaging
- Double Ratchet algorithm
- X3DH key agreement protocol
- Forward secrecy and post-compromise security

Key Management:
- Identity keys stored on device
- Pre-keys uploaded to server
- Session keys derived per conversation
- Key verification via safety numbers

Implementation:
- Encrypt message on sender device
- Server routes encrypted envelope
- Decrypt on recipient device
- Server cannot read message content
```

## Privacy Compliance

### GDPR Compliance
```
Data Subject Rights:
1. Right to Access:
   - Provide data export in JSON format
   - Include all posts, stories, comments, likes
   - Deliver within 30 days

2. Right to Deletion:
   - Delete account and all associated data
   - 30-day grace period before permanent deletion
   - Propagate deletion across all systems
   - Remove from backups within 90 days

3. Right to Rectification:
   - Allow users to update profile information
   - Correct inaccurate data
   - Update privacy settings

4. Right to Portability:
   - Export data in machine-readable format
   - Allow transfer to other platforms
   - Include all user-generated content

5. Right to Object:
   - Opt-out of data processing for marketing
   - Opt-out of personalized ads
   - Opt-out of data sharing with third parties

Implementation:
- Data export API endpoint
- Async deletion pipeline
- Audit logging for all data access
- Consent management system
- Privacy policy updates with user notification
```

### CCPA Compliance
```
California Consumer Privacy Act:
1. Right to Know:
   - Disclose data collection practices
   - Provide categories of data collected
   - Explain data usage purposes

2. Right to Delete:
   - Delete personal information on request
   - Exceptions for legal obligations

3. Right to Opt-Out:
   - Opt-out of data sale to third parties
   - "Do Not Sell My Personal Information" link

4. Non-Discrimination:
   - Cannot discriminate for exercising rights
   - Same service quality for all users

Implementation:
- Privacy dashboard for users
- Opt-out mechanism for data sale
- Transparent data collection disclosure
- Regular privacy audits
```

### Data Retention Policies
```
Retention Periods:
- Active posts: Indefinite (until user deletes)
- Deleted posts: 30-day soft delete, then permanent
- Stories: 24 hours (auto-delete)
- User accounts: 30-day grace period after deletion
- Access logs: 90 days
- Audit logs: 7 years (compliance)
- Backup data: 90 days

Automated Cleanup:
- Cron jobs for data deletion
- Cascade deletes across all systems
- Verify deletion completion
- Audit trail for deletions
```

## Content Moderation and Safety

### Automated Content Moderation
```
ML-Based Detection:
1. NSFW Content Detection:
   - Image classification models
   - Video frame analysis
   - Blur sensitive media by default
   - Age-restricted content

2. Hate Speech Detection:
   - NLP models for toxic content
   - Multi-language support
   - Context-aware detection
   - Human review for borderline cases

3. Spam Detection:
   - Train on labeled spam data
   - Features: content similarity, posting frequency
   - Real-time scoring (0-1 scale)
   - Auto-hide if score >0.9

4. Copyright Infringement:
   - Content ID matching
   - Visual similarity detection
   - Audio fingerprinting
   - DMCA takedown process

Implementation:
- Real-time content scanning on upload
- Async processing for heavy ML models
- Queue flagged content for human review
- Feedback loop to improve models
```

### Human Moderation
```
Moderation Workflow:
1. User reports content
2. Automated triage (ML scoring)
3. Queue for human review
4. Moderator reviews and decides
5. Action taken (remove, warn, suspend)
6. User notified of decision
7. Appeal process available

Moderator Tools:
- Content review dashboard
- Context information (user history, reports)
- Action buttons (remove, warn, suspend)
- Escalation to senior moderators
- Audit trail for all actions

Moderation Policies:
- Violence and threats
- Hate speech and harassment
- Sexual content and nudity
- Spam and manipulation
- Misinformation and fake news
- Copyright and trademark violations
- Self-harm and suicide
- Child safety
```

### User Safety Features
```
Blocking and Muting:
- Block: Prevent user from seeing your content
- Mute: Hide user's content from your feed
- Restrict: Limit interactions without blocking
- Close Friends: Share stories with selected users

Reporting:
- Report posts, users, comments, stories
- Categories: spam, abuse, harassment, etc.
- Attach screenshots and context
- Track report status
- Feedback on action taken

Comment Controls:
- Filter offensive comments
- Hide comments from specific users
- Disable comments on posts
- Pin comments
- Limit comments to followers only

Safety Mode:
- Auto-hide comments from suspicious accounts
- Filter DM requests
- Limit who can tag you
- Limit who can mention you
```

## API Security

### Rate Limiting
```
Rate Limit Tiers:
Free Tier:
- 50 posts per hour
- 100 stories per hour
- 200 feed requests per hour
- 100 search requests per hour

Premium Tier:
- 100 posts per hour
- 200 stories per hour
- 500 feed requests per hour
- 300 search requests per hour

Implementation:
- Token bucket algorithm
- Redis for distributed rate limiting
- Per-user and per-IP limits
- Graceful degradation (return 429)
```

### API Authentication
```
OAuth 2.0 Flow:
1. App requests authorization
2. User grants permission
3. App receives authorization code
4. App exchanges code for access token
5. App uses token for API requests

Token Types:
- Access Token: Short-lived (1 hour)
- Refresh Token: Long-lived (30 days)
- API Key: For server-to-server

Scopes:
- basic: Read profile information
- public_content: Read public posts
- follower_list: Access follower lists
- comments: Post comments
- relationships: Follow/unfollow users
- likes: Like posts
```

### Input Validation
```
Validation Rules:
- Caption: Max 2,200 characters, UTF-8 encoded
- Username: 4-30 characters, alphanumeric + underscore + period
- Email: Valid email format, max 255 characters
- URL: Valid URL format, HTTPS only
- Media: Max 8MB images, 100MB videos

Sanitization:
- Escape HTML special characters
- Remove SQL injection attempts
- Strip malicious scripts
- Validate file types and content
- Check for malware in uploads

Implementation:
- Server-side validation (never trust client)
- Whitelist allowed characters
- Reject invalid input with clear error
- Log validation failures for monitoring
```

## Security Monitoring and Incident Response

### Security Monitoring
```
Monitoring Metrics:
- Failed login attempts
- Unusual API usage patterns
- Suspicious account activity
- Data access patterns
- Permission changes
- Configuration changes

Alerting:
- Real-time alerts for critical events
- Anomaly detection with ML
- Threshold-based alerts
- Integration with PagerDuty
- Escalation policies

Audit Logging:
- Log all authentication attempts
- Log all data access
- Log all permission changes
- Log all admin actions
- Retain logs for 7 years
```

### Incident Response
```
Incident Response Plan:
1. Detection: Automated monitoring and alerts
2. Triage: Assess severity and impact
3. Containment: Isolate affected systems
4. Investigation: Root cause analysis
5. Remediation: Fix vulnerability
6. Recovery: Restore normal operations
7. Post-Mortem: Document lessons learned

Security Incident Types:
- Data breach
- Account compromise
- DDoS attack
- Malware infection
- Insider threat
- API abuse

Response Team:
- Security engineers
- DevOps engineers
- Legal team
- PR/Communications
- Executive leadership
```

### Vulnerability Management
```
Security Practices:
- Regular security audits
- Penetration testing (quarterly)
- Bug bounty program
- Dependency scanning
- Code security reviews
- Security training for engineers

Vulnerability Disclosure:
- Responsible disclosure policy
- Bug bounty rewards ($100-$50,000)
- 90-day disclosure timeline
- Coordinated disclosure with researchers
- Public security advisories
```

This comprehensive security and privacy framework ensures Instagram protects user data, complies with regulations, and maintains trust while providing a safe platform for photo and video sharing.
