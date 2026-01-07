# Security and Privacy for Google Docs

## Overview
A collaborative document editing system handles sensitive user data and requires comprehensive security measures to protect against unauthorized access, data breaches, and privacy violations.

## 1. Authentication and Authorization

### Multi-Factor Authentication (MFA)
```javascript
// Authentication flow
class AuthService {
  async authenticate(email, password) {
    // Step 1: Verify credentials
    const user = await this.verifyCredentials(email, password);
    if (!user) throw new Error('Invalid credentials');
    
    // Step 2: Check if MFA is enabled
    if (user.mfaEnabled) {
      const mfaToken = await this.generateMFAToken(user.id);
      return { requiresMFA: true, mfaToken };
    }
    
    // Step 3: Generate session token
    const sessionToken = await this.generateSessionToken(user.id);
    return { sessionToken };
  }
  
  async verifyMFA(mfaToken, code) {
    const isValid = await this.verifyTOTP(mfaToken, code);
    if (!isValid) throw new Error('Invalid MFA code');
    
    const userId = await this.getUserIdFromMFAToken(mfaToken);
    const sessionToken = await this.generateSessionToken(userId);
    return { sessionToken };
  }
}
```

### OAuth 2.0 Integration
```javascript
// OAuth flow for third-party integrations
{
  clientId: 'app_123',
  clientSecret: 'secret_456',
  redirectUri: 'https://app.example.com/callback',
  scopes: ['docs.read', 'docs.write', 'docs.share']
}

// Authorization endpoint
POST /oauth/authorize
{
  client_id: 'app_123',
  response_type: 'code',
  scope: 'docs.read docs.write',
  redirect_uri: 'https://app.example.com/callback'
}

// Token exchange
POST /oauth/token
{
  grant_type: 'authorization_code',
  code: 'auth_code_789',
  client_id: 'app_123',
  client_secret: 'secret_456'
}
```

### Session Management
```javascript
// Session token with expiration
{
  userId: 'user_123',
  sessionId: 'session_456',
  issuedAt: 1704672000000,
  expiresAt: 1704758400000,  // 24 hours
  refreshToken: 'refresh_789',
  deviceId: 'device_012',
  ipAddress: '192.168.1.1'
}

// Refresh token rotation
async function refreshSession(refreshToken) {
  const session = await this.validateRefreshToken(refreshToken);
  
  // Invalidate old refresh token
  await this.revokeRefreshToken(refreshToken);
  
  // Generate new tokens
  const newSessionToken = await this.generateSessionToken(session.userId);
  const newRefreshToken = await this.generateRefreshToken(session.userId);
  
  return { sessionToken: newSessionToken, refreshToken: newRefreshToken };
}
```

## 2. Access Control

### Role-Based Access Control (RBAC)
```javascript
// Permission matrix
const PERMISSIONS = {
  owner: ['read', 'write', 'comment', 'share', 'delete', 'change_permissions'],
  editor: ['read', 'write', 'comment', 'share'],
  commenter: ['read', 'comment'],
  viewer: ['read']
};

// Check permission
async function checkPermission(userId, documentId, action) {
  const role = await getUserRole(userId, documentId);
  const permissions = PERMISSIONS[role];
  
  if (!permissions.includes(action)) {
    throw new Error(`User does not have permission to ${action}`);
  }
  
  return true;
}
```

### Attribute-Based Access Control (ABAC)
```javascript
// Policy-based access control
{
  documentId: 'doc_123',
  policies: [
    {
      effect: 'allow',
      principal: { department: 'engineering' },
      action: ['read', 'write'],
      condition: {
        ipRange: '10.0.0.0/8',
        timeRange: { start: '09:00', end: '17:00' }
      }
    },
    {
      effect: 'deny',
      principal: { contractor: true },
      action: ['share', 'export']
    }
  ]
}

// Evaluate policy
async function evaluatePolicy(user, document, action) {
  const policies = await getDocumentPolicies(document.id);
  
  for (const policy of policies) {
    if (matchesPrincipal(user, policy.principal) &&
        policy.action.includes(action) &&
        evaluateCondition(policy.condition)) {
      return policy.effect === 'allow';
    }
  }
  
  return false; // Default deny
}
```

### Document-Level Encryption
```javascript
// Encrypt document content at rest
class EncryptionService {
  async encryptDocument(content, documentId) {
    // Generate data encryption key (DEK)
    const dek = await this.generateDEK();
    
    // Encrypt content with DEK
    const encryptedContent = await this.encrypt(content, dek);
    
    // Encrypt DEK with key encryption key (KEK)
    const kek = await this.getKEK(documentId);
    const encryptedDEK = await this.encrypt(dek, kek);
    
    return {
      encryptedContent,
      encryptedDEK,
      algorithm: 'AES-256-GCM',
      keyId: kek.id
    };
  }
  
  async decryptDocument(encryptedData) {
    // Decrypt DEK with KEK
    const kek = await this.getKEK(encryptedData.keyId);
    const dek = await this.decrypt(encryptedData.encryptedDEK, kek);
    
    // Decrypt content with DEK
    const content = await this.decrypt(encryptedData.encryptedContent, dek);
    
    return content;
  }
}
```

## 3. Data Protection

### Encryption in Transit
```javascript
// TLS 1.3 configuration
{
  protocol: 'TLSv1.3',
  cipherSuites: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256'
  ],
  certificateAuthority: 'Let\'s Encrypt',
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}

// WebSocket secure connection
const ws = new WebSocket('wss://docs.example.com/ws', {
  rejectUnauthorized: true,
  ca: [certificateAuthority]
});
```

### Encryption at Rest
```javascript
// Database encryption
{
  database: 'Spanner',
  encryption: {
    type: 'Google-managed',
    algorithm: 'AES-256',
    keyRotation: 'automatic',
    rotationPeriod: '90 days'
  }
}

// Customer-managed encryption keys (CMEK)
{
  keyManagement: 'Cloud KMS',
  keyRing: 'docs-encryption',
  key: 'docs-dek',
  rotationSchedule: '90 days',
  destroyScheduledDuration: '30 days'
}
```

### Data Loss Prevention (DLP)
```javascript
// Scan for sensitive data
class DLPService {
  async scanDocument(content) {
    const findings = [];
    
    // Check for PII
    if (this.containsSSN(content)) {
      findings.push({ type: 'SSN', severity: 'HIGH' });
    }
    
    if (this.containsCreditCard(content)) {
      findings.push({ type: 'CREDIT_CARD', severity: 'HIGH' });
    }
    
    if (this.containsEmail(content)) {
      findings.push({ type: 'EMAIL', severity: 'MEDIUM' });
    }
    
    // Take action based on findings
    if (findings.some(f => f.severity === 'HIGH')) {
      await this.notifyAdmin(findings);
      await this.restrictSharing(documentId);
    }
    
    return findings;
  }
  
  containsSSN(text) {
    const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g;
    return ssnPattern.test(text);
  }
  
  containsCreditCard(text) {
    const ccPattern = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
    return ccPattern.test(text);
  }
}
```

## 4. Audit Logging

### Comprehensive Audit Trail
```javascript
// Audit log entry
{
  eventId: 'event_123',
  timestamp: 1704672000000,
  userId: 'user_456',
  action: 'document.edit',
  resourceId: 'doc_789',
  resourceType: 'document',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  result: 'success',
  metadata: {
    operationType: 'insert',
    position: 150,
    length: 5,
    sessionId: 'session_012'
  }
}

// Audit events to track
const AUDIT_EVENTS = [
  'document.create',
  'document.read',
  'document.edit',
  'document.delete',
  'document.share',
  'document.export',
  'permission.grant',
  'permission.revoke',
  'user.login',
  'user.logout',
  'user.mfa_enable',
  'user.mfa_disable'
];
```

### Audit Log Storage
```sql
-- Audit logs table (append-only)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  user_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_id UUID,
  resource_type VARCHAR(50),
  ip_address INET,
  user_agent TEXT,
  result VARCHAR(20),
  metadata JSONB,
  INDEX idx_user_timestamp (user_id, timestamp DESC),
  INDEX idx_resource_timestamp (resource_id, timestamp DESC),
  INDEX idx_action_timestamp (action, timestamp DESC)
) PARTITION BY RANGE (timestamp);

-- Partition by month for efficient querying
CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

### Audit Log Analysis
```javascript
// Query audit logs
async function getAuditLogs(filters) {
  const query = `
    SELECT * FROM audit_logs
    WHERE user_id = $1
      AND timestamp >= $2
      AND timestamp <= $3
      AND action = ANY($4)
    ORDER BY timestamp DESC
    LIMIT $5
  `;
  
  return await db.query(query, [
    filters.userId,
    filters.startDate,
    filters.endDate,
    filters.actions,
    filters.limit
  ]);
}

// Detect suspicious activity
async function detectAnomalies(userId) {
  // Check for unusual access patterns
  const recentLogins = await this.getRecentLogins(userId);
  const unusualLocations = this.detectUnusualLocations(recentLogins);
  
  // Check for bulk operations
  const recentActions = await this.getRecentActions(userId);
  const bulkOperations = this.detectBulkOperations(recentActions);
  
  if (unusualLocations.length > 0 || bulkOperations.length > 0) {
    await this.alertSecurityTeam(userId, { unusualLocations, bulkOperations });
  }
}
```

## 5. Compliance

### GDPR Compliance
```javascript
// Right to access
async function exportUserData(userId) {
  const data = {
    profile: await getUserProfile(userId),
    documents: await getUserDocuments(userId),
    comments: await getUserComments(userId),
    auditLogs: await getUserAuditLogs(userId)
  };
  
  return JSON.stringify(data, null, 2);
}

// Right to erasure
async function deleteUserData(userId) {
  // Anonymize audit logs
  await db.update('audit_logs', {
    user_id: 'DELETED_USER',
    where: { user_id: userId }
  });
  
  // Transfer document ownership
  const documents = await getUserDocuments(userId);
  for (const doc of documents) {
    await transferOwnership(doc.id, 'SYSTEM_USER');
  }
  
  // Delete user profile
  await db.delete('users', { id: userId });
}

// Data portability
async function exportDocuments(userId, format) {
  const documents = await getUserDocuments(userId);
  const exported = [];
  
  for (const doc of documents) {
    const content = await exportDocument(doc.id, format);
    exported.push({ id: doc.id, title: doc.title, content });
  }
  
  return exported;
}
```

### HIPAA Compliance
```javascript
// PHI (Protected Health Information) handling
class PHIHandler {
  async createDocument(content, metadata) {
    // Encrypt PHI
    const encrypted = await this.encrypt(content);
    
    // Enable audit logging
    await this.enableAuditLogging(metadata.documentId);
    
    // Set access controls
    await this.setAccessControls(metadata.documentId, {
      minimumRole: 'authorized_personnel',
      requireMFA: true,
      ipWhitelist: metadata.allowedIPs
    });
    
    // Set retention policy
    await this.setRetentionPolicy(metadata.documentId, {
      retentionPeriod: '7 years',
      autoDelete: true
    });
    
    return { documentId: metadata.documentId, encrypted };
  }
  
  async accessDocument(userId, documentId) {
    // Verify authorization
    await this.verifyAuthorization(userId, documentId);
    
    // Log access
    await this.logAccess(userId, documentId, 'PHI_ACCESS');
    
    // Decrypt and return
    const encrypted = await this.getDocument(documentId);
    return await this.decrypt(encrypted);
  }
}
```

### SOC 2 Compliance
```javascript
// Security controls
const SECURITY_CONTROLS = {
  // Access control
  CC6.1: 'Logical access controls',
  CC6.2: 'Authentication mechanisms',
  CC6.3: 'Authorization mechanisms',
  
  // System operations
  CC7.1: 'System monitoring',
  CC7.2: 'System capacity',
  CC7.3: 'System backup',
  
  // Change management
  CC8.1: 'Change management process',
  
  // Risk mitigation
  CC9.1: 'Risk assessment',
  CC9.2: 'Risk mitigation'
};

// Continuous monitoring
async function monitorSecurityControls() {
  const results = [];
  
  // Check access controls
  results.push(await this.checkAccessControls());
  
  // Check encryption
  results.push(await this.checkEncryption());
  
  // Check audit logging
  results.push(await this.checkAuditLogging());
  
  // Check backup and recovery
  results.push(await this.checkBackupRecovery());
  
  // Generate compliance report
  return this.generateComplianceReport(results);
}
```

## 6. Threat Protection

### Rate Limiting
```javascript
// Rate limiter
class RateLimiter {
  constructor() {
    this.limits = {
      'document.create': { requests: 100, window: 3600 },  // 100/hour
      'document.edit': { requests: 1000, window: 60 },     // 1000/minute
      'document.share': { requests: 50, window: 3600 },    // 50/hour
      'api.request': { requests: 10000, window: 3600 }     // 10k/hour
    };
  }
  
  async checkLimit(userId, action) {
    const key = `ratelimit:${userId}:${action}`;
    const limit = this.limits[action];
    
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, limit.window);
    }
    
    if (count > limit.requests) {
      throw new Error('Rate limit exceeded');
    }
    
    return { remaining: limit.requests - count };
  }
}
```

### DDoS Protection
```javascript
// DDoS mitigation strategy
{
  cloudflare: {
    ddosProtection: true,
    rateLimiting: true,
    botManagement: true,
    waf: true
  },
  
  applicationLayer: {
    connectionLimits: 10000,  // Per IP
    requestTimeout: 30000,    // 30 seconds
    bodySize: 10485760,       // 10MB
    slowlorisProtection: true
  },
  
  networkLayer: {
    synFloodProtection: true,
    udpFloodProtection: true,
    icmpFloodProtection: true
  }
}
```

### XSS and CSRF Protection
```javascript
// Content Security Policy
const CSP_HEADER = `
  default-src 'self';
  script-src 'self' 'nonce-${nonce}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' wss://docs.example.com;
  frame-ancestors 'none';
`;

// CSRF token validation
async function validateCSRFToken(req) {
  const token = req.headers['x-csrf-token'];
  const sessionToken = req.cookies.session;
  
  const expectedToken = await this.generateCSRFToken(sessionToken);
  
  if (token !== expectedToken) {
    throw new Error('Invalid CSRF token');
  }
}

// Input sanitization
function sanitizeInput(input) {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'u', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'title']
  });
}
```

## 7. Incident Response

### Security Incident Workflow
```javascript
// Incident detection
async function detectIncident() {
  const alerts = [
    await this.checkUnauthorizedAccess(),
    await this.checkDataExfiltration(),
    await this.checkBruteForceAttacks(),
    await this.checkMalwareDetection()
  ];
  
  const incidents = alerts.filter(a => a.severity === 'HIGH');
  
  if (incidents.length > 0) {
    await this.triggerIncidentResponse(incidents);
  }
}

// Incident response
async function handleIncident(incident) {
  // 1. Contain
  await this.containIncident(incident);
  
  // 2. Investigate
  const analysis = await this.investigateIncident(incident);
  
  // 3. Remediate
  await this.remediateIncident(incident, analysis);
  
  // 4. Notify
  await this.notifyStakeholders(incident);
  
  // 5. Document
  await this.documentIncident(incident, analysis);
}
```

### Breach Notification
```javascript
// GDPR breach notification (72 hours)
async function notifyBreach(breach) {
  // Assess severity
  const severity = await this.assessBreachSeverity(breach);
  
  if (severity === 'HIGH') {
    // Notify supervisory authority
    await this.notifyAuthority(breach);
    
    // Notify affected users
    const affectedUsers = await this.getAffectedUsers(breach);
    await this.notifyUsers(affectedUsers, breach);
    
    // Public disclosure
    await this.publicDisclosure(breach);
  }
  
  // Document breach
  await this.documentBreach(breach);
}
```

## 8. Privacy Features

### Anonymous Editing
```javascript
// Anonymous user session
{
  sessionId: 'anon_123',
  documentId: 'doc_456',
  permissions: ['read', 'comment'],
  expiresAt: 1704672000000,
  ipAddress: '192.168.1.1',  // For abuse prevention
  createdAt: 1704668400000
}

// Convert to registered user
async function convertAnonymousUser(sessionId, userId) {
  const session = await getAnonymousSession(sessionId);
  
  // Transfer comments and edits
  await transferComments(session.sessionId, userId);
  await transferEdits(session.sessionId, userId);
  
  // Invalidate anonymous session
  await invalidateSession(sessionId);
}
```

### Data Minimization
```javascript
// Collect only necessary data
const USER_DATA = {
  required: ['email', 'name'],
  optional: ['avatar', 'timezone', 'language'],
  prohibited: ['ssn', 'credit_card', 'health_info']
};

// Automatic data deletion
async function scheduleDataDeletion(userId) {
  // Delete inactive accounts after 2 years
  const lastActivity = await getLastActivity(userId);
  const inactiveDays = (Date.now() - lastActivity) / (1000 * 60 * 60 * 24);
  
  if (inactiveDays > 730) {
    await scheduleAccountDeletion(userId, 30); // 30 days notice
  }
  
  // Delete old audit logs after 7 years
  await deleteOldAuditLogs(userId, 7 * 365);
}
```

## Summary

Security and privacy measures:
- **Authentication**: MFA, OAuth 2.0, session management
- **Authorization**: RBAC, ABAC, document-level encryption
- **Data Protection**: TLS 1.3, AES-256 encryption, DLP
- **Audit Logging**: Comprehensive audit trail, anomaly detection
- **Compliance**: GDPR, HIPAA, SOC 2 compliance
- **Threat Protection**: Rate limiting, DDoS protection, XSS/CSRF prevention
- **Incident Response**: Detection, containment, notification
- **Privacy**: Anonymous editing, data minimization, automatic deletion

Security is not an afterthought but a fundamental requirement for a collaborative document editing system handling sensitive user data.
