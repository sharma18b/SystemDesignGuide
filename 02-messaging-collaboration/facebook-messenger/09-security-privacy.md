# Facebook Messenger - Security and Privacy

## End-to-End Encryption Architecture

### Encryption Protocol Design
- **Signal Protocol**: Industry-standard E2E encryption protocol
- **Double Ratchet Algorithm**: Forward secrecy and post-compromise security
- **X3DH Key Agreement**: Initial key exchange protocol
- **Curve25519**: Elliptic curve cryptography for key generation
- **AES-256-GCM**: Symmetric encryption for message content
- **HMAC-SHA256**: Message authentication codes

### Key Management System
```javascript
class E2EKeyManager {
  constructor(userId) {
    this.userId = userId;
    this.identityKeyPair = null;
    this.signedPreKey = null;
    this.oneTimePreKeys = [];
    this.sessionStore = new Map();
  }
  
  async generateIdentityKey() {
    this.identityKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey", "deriveBits"]
    );
    
    await this.storeIdentityKey(this.identityKeyPair);
    return this.identityKeyPair.publicKey;
  }
  
  async generatePreKeys(count = 100) {
    const preKeys = [];
    
    for (let i = 0; i < count; i++) {
      const keyPair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey", "deriveBits"]
      );
      
      preKeys.push({
        id: i,
        keyPair,
        publicKey: await this.exportKey(keyPair.publicKey)
      });
    }
    
    this.oneTimePreKeys = preKeys;
    await this.uploadPreKeysToServer(preKeys.map(pk => ({
      id: pk.id,
      publicKey: pk.publicKey
    })));
    
    return preKeys;
  }
  
  async establishSession(recipientId, preKeyBundle) {
    // X3DH key agreement protocol
    const sharedSecret = await this.performX3DH(preKeyBundle);
    
    // Initialize Double Ratchet
    const session = new DoubleRatchetSession(sharedSecret, recipientId);
    this.sessionStore.set(recipientId, session);
    
    return session;
  }
}
```

### Message Encryption Flow
```javascript
class SecureMessageService {
  async sendEncryptedMessage(recipientId, plaintext) {
    // Get or create session
    let session = this.keyManager.getSession(recipientId);
    if (!session) {
      const preKeyBundle = await this.fetchPreKeyBundle(recipientId);
      session = await this.keyManager.establishSession(recipientId, preKeyBundle);
    }
    
    // Encrypt message
    const encryptedMessage = await session.encrypt(plaintext);
    
    // Create message envelope
    const envelope = {
      senderId: this.userId,
      recipientId,
      type: 'encrypted',
      content: encryptedMessage.ciphertext,
      ephemeralKey: encryptedMessage.ephemeralKey,
      counter: encryptedMessage.counter,
      previousCounter: encryptedMessage.previousCounter
    };
    
    // Send encrypted envelope
    return this.messageService.sendMessage(envelope);
  }
  
  async decryptMessage(envelope) {
    const session = this.keyManager.getSession(envelope.senderId);
    if (!session) {
      throw new Error('No session found for sender');
    }
    
    // Decrypt message
    const plaintext = await session.decrypt({
      ciphertext: envelope.content,
      ephemeralKey: envelope.ephemeralKey,
      counter: envelope.counter,
      previousCounter: envelope.previousCounter
    });
    
    return {
      senderId: envelope.senderId,
      content: plaintext,
      timestamp: envelope.timestamp
    };
  }
}
```

## Authentication and Authorization

### Multi-Factor Authentication
```javascript
class MFAService {
  async enableTOTP(userId) {
    // Generate secret key
    const secret = this.generateTOTPSecret();
    
    // Store encrypted secret
    await this.storeEncryptedSecret(userId, secret);
    
    // Generate QR code for authenticator app
    const qrCode = await this.generateQRCode(userId, secret);
    
    return {
      secret,
      qrCode,
      backupCodes: await this.generateBackupCodes(userId)
    };
  }
  
  async verifyTOTP(userId, token) {
    const secret = await this.getDecryptedSecret(userId);
    const expectedToken = this.generateTOTPToken(secret);
    
    // Allow for time drift (±30 seconds)
    const validTokens = [
      this.generateTOTPToken(secret, -1),
      expectedToken,
      this.generateTOTPToken(secret, 1)
    ];
    
    return validTokens.includes(token);
  }
  
  async enableSMSAuth(userId, phoneNumber) {
    // Verify phone number ownership
    const verificationCode = this.generateSMSCode();
    await this.sendSMS(phoneNumber, `Verification code: ${verificationCode}`);
    
    // Store pending verification
    await this.storePendingVerification(userId, phoneNumber, verificationCode);
    
    return { success: true, message: 'Verification code sent' };
  }
}
```

### OAuth Integration
```javascript
class OAuthService {
  async authenticateWithFacebook(accessToken) {
    // Verify token with Facebook
    const fbUser = await this.verifyFacebookToken(accessToken);
    
    // Check if user exists
    let user = await this.userService.findByFacebookId(fbUser.id);
    
    if (!user) {
      // Create new user account
      user = await this.userService.createUser({
        facebookId: fbUser.id,
        email: fbUser.email,
        firstName: fbUser.first_name,
        lastName: fbUser.last_name,
        profilePicture: fbUser.picture?.data?.url
      });
    }
    
    // Generate JWT tokens
    const tokens = await this.generateTokens(user);
    
    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }
  
  async authenticateWithGoogle(idToken) {
    // Verify Google ID token
    const googleUser = await this.verifyGoogleToken(idToken);
    
    // Similar flow as Facebook
    let user = await this.userService.findByGoogleId(googleUser.sub);
    
    if (!user) {
      user = await this.userService.createUser({
        googleId: googleUser.sub,
        email: googleUser.email,
        firstName: googleUser.given_name,
        lastName: googleUser.family_name,
        profilePicture: googleUser.picture
      });
    }
    
    return this.generateTokens(user);
  }
}
```

## Data Privacy and Compliance

### GDPR Compliance Implementation
```javascript
class GDPRComplianceService {
  async exportUserData(userId) {
    // Collect all user data
    const userData = {
      profile: await this.userService.getProfile(userId),
      messages: await this.messageService.getUserMessages(userId),
      conversations: await this.conversationService.getUserConversations(userId),
      media: await this.mediaService.getUserMedia(userId),
      contacts: await this.contactService.getUserContacts(userId)
    };
    
    // Anonymize sensitive data
    const anonymizedData = this.anonymizeSensitiveData(userData);
    
    // Generate export file
    const exportFile = await this.generateExportFile(anonymizedData);
    
    // Log export request
    await this.auditLogger.log({
      action: 'data_export',
      userId,
      timestamp: Date.now(),
      fileSize: exportFile.size
    });
    
    return exportFile;
  }
  
  async deleteUserData(userId, deletionType = 'full') {
    const deletionPlan = await this.createDeletionPlan(userId, deletionType);
    
    try {
      // Start deletion transaction
      await this.database.beginTransaction();
      
      // Delete user messages
      if (deletionPlan.includeMessages) {
        await this.messageService.deleteUserMessages(userId);
      }
      
      // Delete media files
      if (deletionPlan.includeMedia) {
        await this.mediaService.deleteUserMedia(userId);
      }
      
      // Delete user profile
      if (deletionPlan.includeProfile) {
        await this.userService.deleteProfile(userId);
      }
      
      // Commit transaction
      await this.database.commitTransaction();
      
      // Log deletion
      await this.auditLogger.log({
        action: 'data_deletion',
        userId,
        deletionType,
        timestamp: Date.now()
      });
      
      return { success: true, deletedItems: deletionPlan.itemCount };
    } catch (error) {
      await this.database.rollbackTransaction();
      throw error;
    }
  }
}
```

### Data Retention Policies
```javascript
class DataRetentionService {
  constructor() {
    this.retentionPolicies = {
      messages: { duration: '10 years', exceptions: ['legal_hold'] },
      media: { duration: '5 years', exceptions: ['user_request'] },
      logs: { duration: '2 years', exceptions: ['security_incident'] },
      analytics: { duration: '3 years', exceptions: [] }
    };
  }
  
  async applyRetentionPolicies() {
    for (const [dataType, policy] of Object.entries(this.retentionPolicies)) {
      await this.cleanupExpiredData(dataType, policy);
    }
  }
  
  async cleanupExpiredData(dataType, policy) {
    const cutoffDate = this.calculateCutoffDate(policy.duration);
    
    // Find expired data
    const expiredItems = await this.findExpiredData(dataType, cutoffDate, policy.exceptions);
    
    // Delete in batches to avoid performance impact
    const batchSize = 1000;
    for (let i = 0; i < expiredItems.length; i += batchSize) {
      const batch = expiredItems.slice(i, i + batchSize);
      await this.deleteBatch(dataType, batch);
      
      // Add delay between batches
      await this.sleep(100);
    }
    
    // Log cleanup activity
    await this.auditLogger.log({
      action: 'data_cleanup',
      dataType,
      itemsDeleted: expiredItems.length,
      timestamp: Date.now()
    });
  }
}
```

## Spam and Abuse Prevention

### Content Moderation System
```javascript
class ContentModerationService {
  constructor() {
    this.mlModels = {
      textClassifier: new TextClassificationModel(),
      imageClassifier: new ImageClassificationModel(),
      spamDetector: new SpamDetectionModel()
    };
  }
  
  async moderateMessage(message) {
    const moderationResults = {
      textAnalysis: null,
      imageAnalysis: null,
      spamScore: null,
      overallScore: 0,
      action: 'allow'
    };
    
    // Analyze text content
    if (message.content) {
      moderationResults.textAnalysis = await this.mlModels.textClassifier.classify(message.content);
      moderationResults.spamScore = await this.mlModels.spamDetector.getSpamScore(message);
    }
    
    // Analyze image content
    if (message.mediaAttachments) {
      for (const attachment of message.mediaAttachments) {
        if (attachment.type.startsWith('image/')) {
          const imageAnalysis = await this.mlModels.imageClassifier.classify(attachment.url);
          moderationResults.imageAnalysis = imageAnalysis;
        }
      }
    }
    
    // Calculate overall risk score
    moderationResults.overallScore = this.calculateRiskScore(moderationResults);
    
    // Determine action
    if (moderationResults.overallScore > 0.9) {
      moderationResults.action = 'block';
    } else if (moderationResults.overallScore > 0.7) {
      moderationResults.action = 'review';
    } else if (moderationResults.overallScore > 0.5) {
      moderationResults.action = 'flag';
    }
    
    return moderationResults;
  }
  
  async handleModerationAction(message, moderationResult) {
    switch (moderationResult.action) {
      case 'block':
        await this.blockMessage(message);
        await this.notifyUser(message.senderId, 'message_blocked');
        break;
        
      case 'review':
        await this.queueForHumanReview(message, moderationResult);
        break;
        
      case 'flag':
        await this.flagMessage(message, moderationResult);
        break;
        
      default:
        // Allow message through
        break;
    }
  }
}
```

### Rate Limiting and Abuse Detection
```javascript
class AbuseDetectionService {
  constructor() {
    this.rateLimits = {
      messages: { window: 60, limit: 100 }, // 100 messages per minute
      mediaUploads: { window: 300, limit: 10 }, // 10 uploads per 5 minutes
      groupCreation: { window: 3600, limit: 5 } // 5 groups per hour
    };
  }
  
  async checkRateLimit(userId, action) {
    const limit = this.rateLimits[action];
    if (!limit) return { allowed: true };
    
    const key = `rate_limit:${userId}:${action}`;
    const current = await this.redis.get(key) || 0;
    
    if (current >= limit.limit) {
      return {
        allowed: false,
        resetTime: await this.redis.ttl(key),
        limit: limit.limit
      };
    }
    
    // Increment counter
    await this.redis.multi()
      .incr(key)
      .expire(key, limit.window)
      .exec();
    
    return { allowed: true, remaining: limit.limit - current - 1 };
  }
  
  async detectAbusePatterns(userId) {
    const patterns = await Promise.all([
      this.checkSpamPattern(userId),
      this.checkHarassmentPattern(userId),
      this.checkAccountCreationPattern(userId)
    ]);
    
    const abuseScore = patterns.reduce((score, pattern) => score + pattern.score, 0);
    
    if (abuseScore > 0.8) {
      await this.takeAbuseAction(userId, 'suspend', patterns);
    } else if (abuseScore > 0.6) {
      await this.takeAbuseAction(userId, 'restrict', patterns);
    } else if (abuseScore > 0.4) {
      await this.takeAbuseAction(userId, 'warn', patterns);
    }
    
    return { abuseScore, patterns };
  }
}
```

## Security Monitoring and Incident Response

### Security Event Logging
```javascript
class SecurityAuditLogger {
  async logSecurityEvent(event) {
    const auditEntry = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      eventType: event.type,
      userId: event.userId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      details: event.details,
      severity: event.severity || 'info',
      source: event.source || 'application'
    };
    
    // Store in secure audit log
    await this.auditDatabase.insert('security_events', auditEntry);
    
    // Send to SIEM system
    await this.siemClient.sendEvent(auditEntry);
    
    // Trigger alerts for high-severity events
    if (auditEntry.severity === 'critical' || auditEntry.severity === 'high') {
      await this.alertingService.sendAlert(auditEntry);
    }
    
    return auditEntry.id;
  }
  
  async detectAnomalousActivity(userId) {
    const recentEvents = await this.getRecentEvents(userId, 24); // Last 24 hours
    
    const anomalies = [
      this.detectUnusualLoginLocations(recentEvents),
      this.detectRapidPasswordChanges(recentEvents),
      this.detectMassMessageSending(recentEvents),
      this.detectUnusualDeviceAccess(recentEvents)
    ];
    
    const anomalyScore = anomalies.reduce((score, anomaly) => score + anomaly.score, 0);
    
    if (anomalyScore > 0.7) {
      await this.triggerSecurityReview(userId, anomalies);
    }
    
    return { anomalyScore, anomalies };
  }
}
```

### Incident Response Automation
```javascript
class IncidentResponseService {
  async handleSecurityIncident(incident) {
    // Classify incident severity
    const severity = this.classifyIncidentSeverity(incident);
    
    // Create incident ticket
    const ticket = await this.createIncidentTicket(incident, severity);
    
    // Automatic containment actions
    if (severity === 'critical') {
      await this.executeCriticalIncidentResponse(incident);
    }
    
    // Notify security team
    await this.notifySecurityTeam(ticket);
    
    // Start investigation workflow
    await this.startInvestigationWorkflow(ticket);
    
    return ticket;
  }
  
  async executeCriticalIncidentResponse(incident) {
    const actions = [];
    
    // Suspend affected accounts
    if (incident.affectedUsers) {
      for (const userId of incident.affectedUsers) {
        await this.userService.suspendAccount(userId, 'security_incident');
        actions.push(`Suspended user ${userId}`);
      }
    }
    
    // Block suspicious IP addresses
    if (incident.suspiciousIPs) {
      for (const ip of incident.suspiciousIPs) {
        await this.firewallService.blockIP(ip, '24h');
        actions.push(`Blocked IP ${ip}`);
      }
    }
    
    // Revoke authentication tokens
    if (incident.compromisedTokens) {
      for (const token of incident.compromisedTokens) {
        await this.authService.revokeToken(token);
        actions.push(`Revoked token ${token}`);
      }
    }
    
    // Log containment actions
    await this.auditLogger.log({
      action: 'incident_containment',
      incidentId: incident.id,
      actions,
      timestamp: Date.now()
    });
    
    return actions;
  }
}
```

This comprehensive security and privacy framework provides the foundation for building a secure messaging platform that protects user data and prevents abuse while maintaining compliance with privacy regulations.
