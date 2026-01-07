# Design Reddit - Security and Privacy

## Authentication
- OAuth 2.0 + JWT tokens
- Password hashing: bcrypt (cost 12)
- 2FA: Optional authenticator apps
- Session management: Redis with TTL

## Authorization
- Subreddit moderators: Hierarchical permissions
- Post visibility: Public, private subreddits
- User blocking: Prevent interactions
- Shadow banning: Hide content from spammers

## Data Encryption
- At rest: AES-256 for all data
- In transit: TLS 1.3 for all connections
- Passwords: bcrypt with salt
- API keys: Encrypted in database

## Privacy Compliance
- GDPR: Data export, deletion, portability
- CCPA: Opt-out of data sale
- Data retention: 90 days after deletion
- Anonymization: Remove PII from analytics

## Content Moderation
- AutoModerator: Automated rule enforcement
- Mod queue: Human review of flagged content
- User reports: Community-driven moderation
- Admin tools: Site-wide moderation

### Moderation Actions
- Remove: Hide rule-breaking content
- Ban: Temporary or permanent
- Mute: Prevent mod mail
- Approve: Override AutoModerator
- Lock: Prevent new comments

## Anti-Spam
- Rate limiting: 10 posts per hour
- Karma threshold: Min karma to post
- Account age: Min 7 days old
- ML detection: Spam classifier (0-1 score)
- Shadow banning: Hide spam without notification

## Vote Manipulation Prevention
- Rate limiting: Max 1000 votes per hour
- Vote fuzzing: Add random noise to counts
- IP tracking: Detect multiple accounts
- ML detection: Identify bot patterns
- Delayed counting: Batch updates every 5s

## API Security
- Rate limiting: Token bucket algorithm
- API keys: Required for third-party apps
- OAuth scopes: Limited permissions
- Input validation: Sanitize all inputs

## Security Monitoring
- Failed login attempts
- Unusual voting patterns
- Suspicious account creation
- API abuse detection
- Automated alerts

## Incident Response
- Detection: Automated monitoring
- Triage: Assess severity
- Containment: Isolate affected systems
- Investigation: Root cause analysis
- Remediation: Fix vulnerability
- Post-mortem: Document lessons

This security framework ensures Reddit protects users and maintains community integrity.
