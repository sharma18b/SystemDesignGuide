# Distributed Counter - Security and Privacy

## Authentication and Authorization

### API Authentication
```
Methods:

1. API Keys:
GET /api/v1/counters/page_views:article_123
Authorization: Bearer sk_live_abc123def456

Pros: Simple, stateless
Cons: Key theft risk, no fine-grained control

2. OAuth 2.0:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Pros: Standard, secure, token expiration
Cons: More complex setup

3. mTLS (Mutual TLS):
Client certificate authentication
Pros: Very secure, no passwords
Cons: Certificate management complexity

Recommendation: OAuth 2.0 for user access, API keys for service-to-service
```

### Authorization Model
```
Role-Based Access Control (RBAC):

Roles:
- Admin: Full access (create, read, update, delete)
- Writer: Increment, decrement, read
- Reader: Read only
- Auditor: Read + audit logs

Permissions:
{
  "user_id": "user_123",
  "role": "writer",
  "allowed_counters": [
    "page_views:article_*",
    "likes:post_*"
  ],
  "denied_counters": [
    "admin:*"
  ]
}

Implementation:
class AuthorizationService {
    boolean canIncrement(User user, String counterId) {
        if (user.role == Role.ADMIN) return true;
        if (user.role == Role.READER) return false;
        
        // Check pattern matching
        for (String pattern : user.allowedCounters) {
            if (matches(counterId, pattern)) {
                return !isDenied(counterId, user.deniedCounters);
            }
        }
        return false;
    }
}
```

## Rate Limiting and Abuse Prevention

### API Rate Limiting
```
Limits by Tier:

Free Tier:
- 1,000 requests/hour
- 10 counters max
- No batch operations

Pro Tier:
- 100,000 requests/hour
- 1,000 counters max
- Batch operations allowed

Enterprise Tier:
- Unlimited requests
- Unlimited counters
- Priority support

Implementation:
class RateLimiter {
    boolean allowRequest(String apiKey) {
        Tier tier = getTier(apiKey);
        String key = "rate_limit:" + apiKey;
        
        long count = redis.incr(key);
        if (count == 1) {
            redis.expire(key, 3600);
        }
        
        return count <= tier.hourlyLimit;
    }
}
```

### Abuse Detection
```
Patterns to Detect:

1. Excessive Increments:
   - >10K increments/second from single source
   - Likely bot or attack

2. Counter Flooding:
   - Creating millions of counters
   - Resource exhaustion attack

3. Suspicious Patterns:
   - Incrementing at exact intervals
   - Incrementing deleted counters
   - Incrementing non-existent counters

Detection:
class AbuseDetector {
    void detectAbuse(String userId, String counterId) {
        // Track increment rate
        String rateKey = "abuse:rate:" + userId;
        long rate = redis.incr(rateKey);
        redis.expire(rateKey, 1);
        
        if (rate > 10000) {
            alertSecurityTeam("High increment rate", userId);
            blockUser(userId, 3600);
        }
        
        // Track unique counters
        String counterKey = "abuse:counters:" + userId;
        redis.sadd(counterKey, counterId);
        redis.expire(counterKey, 3600);
        
        long uniqueCounters = redis.scard(counterKey);
        if (uniqueCounters > 10000) {
            alertSecurityTeam("Counter flooding", userId);
            blockUser(userId, 3600);
        }
    }
}
```

## Data Privacy

### PII in Counter IDs
```
Problem:
counter_id = "page_views:user_email:alice@example.com"
Exposes PII in counter ID

Solutions:

1. Hash User Identifiers:
counter_id = "page_views:user:" + hash(email)
Result: "page_views:user:a1b2c3d4e5f6"

2. Use Internal IDs:
counter_id = "page_views:user:" + user_id
Result: "page_views:user:12345"

3. Pseudonymization:
counter_id = "page_views:user:" + pseudonym
Maintain mapping separately

Implementation:
class PrivacyService {
    String createCounterId(String prefix, String userEmail) {
        String hashedEmail = sha256(userEmail + salt);
        return prefix + ":" + hashedEmail.substring(0, 16);
    }
}
```

### GDPR Compliance
```
Requirements:

1. Right to Access:
   - Provide user's counter data
   - Export in portable format

2. Right to Erasure:
   - Delete user's counters
   - Remove from aggregates

3. Data Minimization:
   - Don't store unnecessary data
   - Minimize retention period

4. Consent Management:
   - Track user consent
   - Respect opt-outs

Implementation:
class GDPRService {
    void exportUserData(String userId) {
        // Find all counters for user
        Set<String> counterIds = redis.keys("*:user:" + userId + ":*");
        
        Map<String, Long> data = new HashMap<>();
        for (String counterId : counterIds) {
            Long value = redis.get(counterId);
            data.put(counterId, value);
        }
        
        // Export as JSON
        return JSON.stringify(data);
    }
    
    void deleteUserData(String userId) {
        // Find and delete all user counters
        Set<String> counterIds = redis.keys("*:user:" + userId + ":*");
        
        for (String counterId : counterIds) {
            redis.del(counterId);
            auditLog("deleted", counterId, userId);
        }
    }
}
```

## Audit Logging

### Comprehensive Audit Trail
```
Events to Log:
- Counter creation/deletion
- Increment/decrement operations
- Configuration changes
- Access attempts (success/failure)
- Rate limit violations
- Abuse detection alerts

Log Format:
{
  "timestamp": "2024-01-08T10:00:00Z",
  "event_type": "increment",
  "counter_id": "page_views:article_123",
  "user_id": "user_123",
  "api_key": "sk_***456",
  "delta": 1,
  "old_value": 1234567,
  "new_value": 1234568,
  "ip_address": "203.0.113.42",
  "user_agent": "Mozilla/5.0...",
  "result": "success"
}

Storage:
- Write to separate audit database
- Immutable (append-only)
- Long retention (1 year+)
- Indexed for fast queries

Implementation:
class AuditLogger {
    void logIncrement(String counterId, String userId, 
                     long delta, long oldValue, long newValue) {
        AuditLog log = new AuditLog();
        log.timestamp = Instant.now();
        log.eventType = "increment";
        log.counterId = counterId;
        log.userId = userId;
        log.delta = delta;
        log.oldValue = oldValue;
        log.newValue = newValue;
        log.ipAddress = getClientIP();
        log.result = "success";
        
        auditDatabase.insert(log);
    }
}
```

## Encryption

### Data at Rest
```
Encryption Methods:

1. Database Encryption:
   - Transparent Data Encryption (TDE)
   - Encrypt entire database
   - No application changes

2. Field-Level Encryption:
   - Encrypt sensitive counter IDs
   - Decrypt on read
   - More granular control

3. Disk Encryption:
   - LUKS (Linux)
   - BitLocker (Windows)
   - OS-level encryption

Implementation:
class EncryptionService {
    String encryptCounterId(String counterId) {
        SecretKey key = getEncryptionKey();
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key);
        byte[] encrypted = cipher.doFinal(counterId.getBytes());
        return Base64.encode(encrypted);
    }
    
    String decryptCounterId(String encrypted) {
        SecretKey key = getEncryptionKey();
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key);
        byte[] decrypted = cipher.doFinal(Base64.decode(encrypted));
        return new String(decrypted);
    }
}
```

### Data in Transit
```
TLS Configuration:

Minimum TLS 1.2:
- Disable TLS 1.0, 1.1
- Use strong cipher suites
- Perfect forward secrecy

Certificate Management:
- Use CA-signed certificates
- Rotate annually
- Monitor expiration
- Automate renewal

Implementation:
# Nginx configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
ssl_prefer_server_ciphers on;
ssl_certificate /path/to/cert.pem;
ssl_certificate_key /path/to/key.pem;
```

## Input Validation

### Counter ID Validation
```
Rules:
- Max length: 255 characters
- Allowed characters: a-z, A-Z, 0-9, :, _, -
- No SQL injection patterns
- No script injection patterns

Implementation:
class InputValidator {
    boolean isValidCounterId(String counterId) {
        if (counterId == null || counterId.isEmpty()) {
            return false;
        }
        
        if (counterId.length() > 255) {
            return false;
        }
        
        // Check allowed characters
        if (!counterId.matches("^[a-zA-Z0-9:_-]+$")) {
            return false;
        }
        
        // Check for injection patterns
        if (containsSQLInjection(counterId)) {
            return false;
        }
        
        return true;
    }
    
    boolean containsSQLInjection(String input) {
        String[] patterns = {"'", "\"", ";", "--", "/*", "*/", "xp_", "sp_"};
        for (String pattern : patterns) {
            if (input.contains(pattern)) {
                return true;
            }
        }
        return false;
    }
}
```

### Delta Validation
```
Rules:
- Must be numeric
- Range: -1,000,000 to 1,000,000
- No overflow attacks

Implementation:
class DeltaValidator {
    boolean isValidDelta(long delta) {
        if (delta < -1000000 || delta > 1000000) {
            throw new ValidationException("Delta out of range");
        }
        return true;
    }
    
    long safeIncrement(long current, long delta) {
        // Check for overflow
        if (delta > 0 && current > Long.MAX_VALUE - delta) {
            throw new OverflowException("Counter overflow");
        }
        
        // Check for underflow
        if (delta < 0 && current < Long.MIN_VALUE - delta) {
            throw new UnderflowException("Counter underflow");
        }
        
        return current + delta;
    }
}
```

## Incident Response

### Security Incident Procedures
```
1. Detection:
   - Monitor audit logs
   - Alert on suspicious activity
   - Automated threat detection

2. Containment:
   - Block malicious API keys
   - Rate limit suspicious IPs
   - Isolate affected counters

3. Investigation:
   - Analyze audit logs
   - Identify attack vector
   - Assess damage

4. Recovery:
   - Restore from backups
   - Rotate API keys
   - Apply security patches

5. Post-Mortem:
   - Document incident
   - Update procedures
   - Implement preventive measures

Runbook:
# Block API key
redis.set("blocked:api_key:sk_abc123", "true", "EX", 86400)

# Block IP address
iptables -A INPUT -s 198.51.100.42 -j DROP

# Restore counter from backup
redis.set("counter:page_views:article_123", backup_value)
```

This comprehensive security approach ensures the counter system is protected against threats while maintaining compliance with privacy regulations.
