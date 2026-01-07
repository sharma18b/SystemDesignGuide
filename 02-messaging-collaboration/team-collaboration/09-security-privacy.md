# Team Collaboration Tool - Security and Privacy

## End-to-End Encryption Architecture

### Message Encryption Strategy
```
┌─────────────────────────────────────────────────────────────┐
│                 Encryption Layers                           │
├─────────────────┬─────────────────┬─────────────────────────┤
│ Transport Layer │ Application     │ End-to-End              │
│ (TLS 1.3)       │ Layer (AES-256) │ (Signal Protocol)       │
├─────────────────┼─────────────────┼─────────────────────────┤
│ • WebSocket WSS │ • Message       │ • Private Channels      │
│ • HTTPS API     │   Storage       │ • Sensitive Workspaces  │
│ • File Transfer │ • File Storage  │ • Compliance Mode       │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### Signal Protocol Implementation
```javascript
class EndToEndEncryption {
    constructor() {
        this.signalProtocol = new SignalProtocolStore();
        this.keyManager = new KeyManager();
        this.deviceManager = new DeviceManager();
    }
    
    async initializeUserEncryption(userId) {
        // Generate identity key pair
        const identityKeyPair = await this.signalProtocol.generateIdentityKeyPair();
        
        // Generate signed pre-key
        const signedPreKey = await this.signalProtocol.generateSignedPreKey(
            identityKeyPair.privKey,
            1 // key ID
        );
        
        // Generate one-time pre-keys
        const oneTimePreKeys = [];
        for (let i = 0; i < 100; i++) {
            const preKey = await this.signalProtocol.generatePreKey(i);
            oneTimePreKeys.push(preKey);
        }
        
        // Store keys locally
        await this.signalProtocol.storeIdentityKeyPair(identityKeyPair);
        await this.signalProtocol.storeSignedPreKey(1, signedPreKey);
        
        for (const preKey of oneTimePreKeys) {
            await this.signalProtocol.storePreKey(preKey.keyId, preKey);
        }
        
        // Upload public keys to server
        await this.uploadPublicKeys(userId, {
            identityKey: identityKeyPair.pubKey,
            signedPreKey: signedPreKey.keyPair.pubKey,
            oneTimePreKeys: oneTimePreKeys.map(k => k.keyPair.pubKey)
        });
        
        return identityKeyPair;
    }
    
    async encryptMessage(senderId, recipientId, message) {
        // Get recipient's public keys
        const recipientKeys = await this.getRecipientKeys(recipientId);
        
        // Create session if doesn't exist
        let sessionCipher = await this.signalProtocol.loadSession(recipientId);
        if (!sessionCipher) {
            sessionCipher = await this.createSession(senderId, recipientId, recipientKeys);
        }
        
        // Encrypt message
        const encryptedMessage = await sessionCipher.encrypt(
            JSON.stringify({
                content: message.content,
                timestamp: message.timestamp,
                messageType: message.type
            })
        );
        
        return {
            encryptedContent: encryptedMessage.body,
            messageType: encryptedMessage.type, // PreKeyWhisperMessage or WhisperMessage
            senderKeyId: senderId,
            recipientKeyId: recipientId
        };
    }
    
    async decryptMessage(senderId, recipientId, encryptedMessage) {
        const sessionCipher = await this.signalProtocol.loadSession(senderId);
        
        if (!sessionCipher) {
            throw new Error('No session found for sender');
        }
        
        let decryptedData;
        
        if (encryptedMessage.messageType === 3) { // PreKeyWhisperMessage
            decryptedData = await sessionCipher.decryptPreKeyWhisperMessage(
                encryptedMessage.encryptedContent
            );
        } else { // WhisperMessage
            decryptedData = await sessionCipher.decryptWhisperMessage(
                encryptedMessage.encryptedContent
            );
        }
        
        const message = JSON.parse(decryptedData);
        
        return {
            content: message.content,
            timestamp: message.timestamp,
            messageType: message.messageType,
            decryptedAt: new Date()
        };
    }
}
```

### File Encryption
```javascript
class FileEncryption {
    constructor() {
        this.chunkSize = 1024 * 1024; // 1MB chunks
        this.algorithm = 'AES-256-GCM';
    }
    
    async encryptFile(file, workspaceId, channelId) {
        // Generate file encryption key
        const fileKey = crypto.randomBytes(32); // 256-bit key
        const iv = crypto.randomBytes(16); // 128-bit IV
        
        // Encrypt file in chunks
        const encryptedChunks = [];
        const cipher = crypto.createCipher(this.algorithm, fileKey, { iv });
        
        for (let offset = 0; offset < file.size; offset += this.chunkSize) {
            const chunk = file.slice(offset, offset + this.chunkSize);
            const encryptedChunk = cipher.update(chunk);
            encryptedChunks.push(encryptedChunk);
        }
        
        const finalChunk = cipher.final();
        encryptedChunks.push(finalChunk);
        
        // Get authentication tag
        const authTag = cipher.getAuthTag();
        
        // Encrypt file key for each channel member
        const channelMembers = await this.getChannelMembers(channelId);
        const encryptedKeys = {};
        
        for (const memberId of channelMembers) {
            const memberPublicKey = await this.getUserPublicKey(memberId);
            encryptedKeys[memberId] = await this.encryptKeyForUser(fileKey, memberPublicKey);
        }
        
        return {
            encryptedFile: Buffer.concat(encryptedChunks),
            encryptedKeys: encryptedKeys,
            iv: iv.toString('base64'),
            authTag: authTag.toString('base64'),
            algorithm: this.algorithm
        };
    }
    
    async decryptFile(encryptedFileData, userId) {
        // Get user's encrypted file key
        const encryptedKey = encryptedFileData.encryptedKeys[userId];
        if (!encryptedKey) {
            throw new Error('User not authorized to decrypt file');
        }
        
        // Decrypt file key
        const userPrivateKey = await this.getUserPrivateKey(userId);
        const fileKey = await this.decryptKeyForUser(encryptedKey, userPrivateKey);
        
        // Decrypt file
        const iv = Buffer.from(encryptedFileData.iv, 'base64');
        const authTag = Buffer.from(encryptedFileData.authTag, 'base64');
        
        const decipher = crypto.createDecipher(encryptedFileData.algorithm, fileKey, { iv });
        decipher.setAuthTag(authTag);
        
        const decryptedChunks = [];
        const encryptedFile = encryptedFileData.encryptedFile;
        
        for (let offset = 0; offset < encryptedFile.length; offset += this.chunkSize) {
            const chunk = encryptedFile.slice(offset, offset + this.chunkSize);
            const decryptedChunk = decipher.update(chunk);
            decryptedChunks.push(decryptedChunk);
        }
        
        const finalChunk = decipher.final();
        decryptedChunks.push(finalChunk);
        
        return Buffer.concat(decryptedChunks);
    }
}
```

## Authentication and Authorization

### Multi-Factor Authentication
```javascript
class MFAManager {
    constructor() {
        this.totpGenerator = new TOTPGenerator();
        this.smsProvider = new SMSProvider();
        this.pushNotificationService = new PushNotificationService();
        this.hardwareKeyValidator = new HardwareKeyValidator();
    }
    
    async setupMFA(userId, methods) {
        const mfaConfig = {
            userId: userId,
            methods: {},
            backupCodes: this.generateBackupCodes(),
            createdAt: new Date()
        };
        
        for (const method of methods) {
            switch (method.type) {
                case 'totp':
                    mfaConfig.methods.totp = await this.setupTOTP(userId);
                    break;
                case 'sms':
                    mfaConfig.methods.sms = await this.setupSMS(userId, method.phoneNumber);
                    break;
                case 'push':
                    mfaConfig.methods.push = await this.setupPushNotification(userId, method.deviceId);
                    break;
                case 'hardware_key':
                    mfaConfig.methods.hardwareKey = await this.setupHardwareKey(userId, method.keyId);
                    break;
            }
        }
        
        await this.storeMFAConfig(userId, mfaConfig);
        
        return {
            backupCodes: mfaConfig.backupCodes,
            methods: Object.keys(mfaConfig.methods)
        };
    }
    
    async verifyMFA(userId, method, token) {
        const mfaConfig = await this.getMFAConfig(userId);
        
        if (!mfaConfig.methods[method]) {
            throw new Error(`MFA method ${method} not configured`);
        }
        
        let isValid = false;
        
        switch (method) {
            case 'totp':
                isValid = this.totpGenerator.verify(token, mfaConfig.methods.totp.secret);
                break;
            case 'sms':
                isValid = await this.verifySMSToken(userId, token);
                break;
            case 'push':
                isValid = await this.verifyPushToken(userId, token);
                break;
            case 'hardware_key':
                isValid = await this.hardwareKeyValidator.verify(userId, token);
                break;
            case 'backup_code':
                isValid = await this.verifyBackupCode(userId, token);
                break;
        }
        
        if (isValid) {
            await this.logMFASuccess(userId, method);
        } else {
            await this.logMFAFailure(userId, method);
        }
        
        return isValid;
    }
}
```

### Role-Based Access Control (RBAC)
```javascript
class RBACManager {
    constructor() {
        this.permissions = {
            // Workspace permissions
            'workspace.admin': ['workspace.manage', 'workspace.delete', 'workspace.billing'],
            'workspace.member': ['channel.create', 'channel.join', 'message.send'],
            'workspace.guest': ['message.send', 'file.view'],
            
            // Channel permissions
            'channel.admin': ['channel.manage', 'channel.delete', 'member.manage'],
            'channel.member': ['message.send', 'file.upload', 'message.react'],
            'channel.viewer': ['message.view', 'file.view'],
            
            // Message permissions
            'message.admin': ['message.delete', 'message.moderate'],
            'message.owner': ['message.edit', 'message.delete_own'],
            
            // File permissions
            'file.admin': ['file.delete', 'file.manage_permissions'],
            'file.owner': ['file.edit', 'file.delete_own', 'file.share']
        };
    }
    
    async checkPermission(userId, resource, action, context = {}) {
        // Get user's roles for the resource
        const userRoles = await this.getUserRoles(userId, resource, context);
        
        // Check if any role grants the required permission
        for (const role of userRoles) {
            const rolePermissions = this.permissions[role] || [];
            
            if (rolePermissions.includes(action)) {
                // Additional context-based checks
                if (await this.checkContextualPermissions(userId, resource, action, context)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    async checkContextualPermissions(userId, resource, action, context) {
        // Time-based restrictions
        if (context.timeRestricted) {
            const currentHour = new Date().getHours();
            const allowedHours = context.allowedHours || [9, 10, 11, 12, 13, 14, 15, 16, 17];
            
            if (!allowedHours.includes(currentHour)) {
                return false;
            }
        }
        
        // IP-based restrictions
        if (context.ipRestricted && context.userIP) {
            const allowedIPs = await this.getAllowedIPs(userId);
            if (!allowedIPs.includes(context.userIP)) {
                return false;
            }
        }
        
        // Device-based restrictions
        if (context.deviceRestricted && context.deviceId) {
            const allowedDevices = await this.getAllowedDevices(userId);
            if (!allowedDevices.includes(context.deviceId)) {
                return false;
            }
        }
        
        // Resource-specific checks
        if (action === 'message.edit' && context.messageId) {
            const message = await this.getMessage(context.messageId);
            
            // Can only edit own messages within time limit
            if (message.userId !== userId) {
                return false;
            }
            
            const editTimeLimit = 15 * 60 * 1000; // 15 minutes
            if (Date.now() - message.createdAt.getTime() > editTimeLimit) {
                return false;
            }
        }
        
        return true;
    }
}
```

## Data Loss Prevention (DLP)

### Content Scanning and Classification
```javascript
class DLPManager {
    constructor() {
        this.contentClassifier = new ContentClassifier();
        this.piiDetector = new PIIDetector();
        this.sensitiveDataPatterns = {
            'ssn': /\b\d{3}-\d{2}-\d{4}\b/g,
            'credit_card': /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
            'email': /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
            'phone': /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
            'api_key': /\b[A-Za-z0-9]{32,}\b/g,
            'aws_access_key': /\bAKIA[0-9A-Z]{16}\b/g
        };
    }
    
    async scanContent(content, context) {
        const scanResult = {
            classification: 'public',
            detectedPatterns: [],
            riskScore: 0,
            action: 'allow',
            recommendations: []
        };
        
        // Pattern-based detection
        for (const [type, pattern] of Object.entries(this.sensitiveDataPatterns)) {
            const matches = content.match(pattern);
            if (matches) {
                scanResult.detectedPatterns.push({
                    type: type,
                    matches: matches.length,
                    confidence: 0.9,
                    locations: this.getMatchLocations(content, pattern)
                });
            }
        }
        
        // ML-based classification
        const mlResult = await this.contentClassifier.classify(content);
        if (mlResult.confidence > 0.7) {
            scanResult.detectedPatterns.push({
                type: mlResult.category,
                confidence: mlResult.confidence,
                details: mlResult.details
            });
        }
        
        // PII detection
        const piiResult = await this.piiDetector.detect(content);
        if (piiResult.found) {
            scanResult.detectedPatterns.push({
                type: 'pii',
                confidence: piiResult.confidence,
                entities: piiResult.entities
            });
        }
        
        // Calculate risk score
        scanResult.riskScore = this.calculateRiskScore(scanResult.detectedPatterns, context);
        
        // Determine action
        scanResult.action = this.determineAction(scanResult.riskScore, context);
        
        // Generate recommendations
        scanResult.recommendations = this.generateRecommendations(scanResult);
        
        return scanResult;
    }
    
    determineAction(riskScore, context) {
        const workspace = context.workspace;
        const channel = context.channel;
        
        // High-risk content
        if (riskScore > 0.8) {
            if (workspace.dlpPolicy === 'strict') {
                return 'block';
            } else {
                return 'quarantine';
            }
        }
        
        // Medium-risk content
        if (riskScore > 0.6) {
            if (channel.type === 'public') {
                return 'warn';
            } else {
                return 'flag';
            }
        }
        
        // Low-risk content
        if (riskScore > 0.3) {
            return 'log';
        }
        
        return 'allow';
    }
    
    async handleDLPViolation(violation, content, context) {
        switch (violation.action) {
            case 'block':
                await this.blockContent(content, violation);
                await this.notifyUser(context.userId, 'content_blocked', violation);
                await this.notifyAdmins(context.workspaceId, 'dlp_violation', violation);
                break;
                
            case 'quarantine':
                await this.quarantineContent(content, violation);
                await this.requestApproval(content, context, violation);
                break;
                
            case 'warn':
                await this.warnUser(context.userId, violation);
                await this.logViolation(violation, context);
                break;
                
            case 'flag':
                await this.flagContent(content, violation);
                await this.logViolation(violation, context);
                break;
                
            case 'log':
                await this.logViolation(violation, context);
                break;
        }
    }
}
```

## Privacy Controls

### Data Minimization and Retention
```javascript
class PrivacyManager {
    constructor() {
        this.retentionPolicies = {
            'messages': {
                'default': '1-year',
                'compliance': '7-years',
                'temporary': '30-days'
            },
            'files': {
                'default': '3-years',
                'compliance': '7-years',
                'temporary': '90-days'
            },
            'audit_logs': {
                'default': '2-years',
                'compliance': '10-years'
            }
        };
    }
    
    async applyDataMinimization(dataType, data, context) {
        switch (dataType) {
            case 'user_profile':
                return this.minimizeUserProfile(data, context);
            case 'message':
                return this.minimizeMessage(data, context);
            case 'file_metadata':
                return this.minimizeFileMetadata(data, context);
            case 'audit_log':
                return this.minimizeAuditLog(data, context);
        }
    }
    
    minimizeUserProfile(profile, context) {
        const minimized = {
            user_id: profile.user_id,
            display_name: profile.display_name,
            status: profile.status
        };
        
        // Include additional fields based on context
        if (context.includeContactInfo) {
            minimized.email = profile.email;
        }
        
        if (context.includeWorkInfo) {
            minimized.title = profile.title;
            minimized.department = profile.department;
        }
        
        // Never include sensitive fields in minimized data
        // Excluded: password_hash, mfa_secret, personal_phone, etc.
        
        return minimized;
    }
    
    async scheduleDataDeletion(dataType, dataId, createdAt, policy = 'default') {
        const retentionPeriod = this.retentionPolicies[dataType][policy];
        const deletionDate = this.calculateDeletionDate(createdAt, retentionPeriod);
        
        // Schedule deletion job
        await this.scheduleJob('data-deletion', {
            dataType: dataType,
            dataId: dataId,
            scheduledFor: deletionDate,
            policy: policy
        });
        
        return deletionDate;
    }
    
    async handleDataSubjectRequest(requestType, userId, requestData) {
        switch (requestType) {
            case 'data_export':
                return await this.exportUserData(userId, requestData.format);
            case 'data_deletion':
                return await this.deleteUserData(userId, requestData.scope);
            case 'data_portability':
                return await this.portUserData(userId, requestData.destination);
            case 'data_rectification':
                return await this.rectifyUserData(userId, requestData.corrections);
        }
    }
    
    async exportUserData(userId, format = 'json') {
        const userData = {
            profile: await this.getUserProfile(userId),
            messages: await this.getUserMessages(userId),
            files: await this.getUserFiles(userId),
            channels: await this.getUserChannels(userId),
            workspaces: await this.getUserWorkspaces(userId)
        };
        
        // Anonymize references to other users
        userData.messages = userData.messages.map(msg => ({
            ...msg,
            mentions: msg.mentions.map(m => ({ type: 'user', anonymized: true }))
        }));
        
        // Generate export package
        const exportPackage = {
            exportId: this.generateExportId(),
            userId: userId,
            exportedAt: new Date(),
            format: format,
            data: userData
        };
        
        // Create downloadable archive
        const archivePath = await this.createExportArchive(exportPackage);
        
        return {
            exportId: exportPackage.exportId,
            downloadUrl: archivePath,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        };
    }
}
```

## Security Monitoring

### Real-time Threat Detection
```javascript
class SecurityMonitor {
    constructor() {
        this.anomalyDetector = new AnomalyDetector();
        this.threatIntelligence = new ThreatIntelligenceService();
        this.behaviorAnalyzer = new BehaviorAnalyzer();
    }
    
    async monitorUserActivity(userId, activity) {
        const securityEvents = [];
        
        // Detect unusual login patterns
        if (activity.type === 'login') {
            const loginAnomaly = await this.detectLoginAnomaly(userId, activity);
            if (loginAnomaly.score > 0.7) {
                securityEvents.push({
                    type: 'suspicious_login',
                    severity: 'medium',
                    details: loginAnomaly
                });
            }
        }
        
        // Detect data exfiltration attempts
        if (activity.type === 'file_download' || activity.type === 'bulk_export') {
            const exfiltrationRisk = await this.assessExfiltrationRisk(userId, activity);
            if (exfiltrationRisk.score > 0.8) {
                securityEvents.push({
                    type: 'potential_data_exfiltration',
                    severity: 'high',
                    details: exfiltrationRisk
                });
            }
        }
        
        // Detect privilege escalation attempts
        if (activity.type === 'permission_change') {
            const escalationRisk = await this.detectPrivilegeEscalation(userId, activity);
            if (escalationRisk.detected) {
                securityEvents.push({
                    type: 'privilege_escalation_attempt',
                    severity: 'high',
                    details: escalationRisk
                });
            }
        }
        
        // Process security events
        for (const event of securityEvents) {
            await this.handleSecurityEvent(event, userId, activity);
        }
        
        return securityEvents;
    }
    
    async detectLoginAnomaly(userId, loginActivity) {
        const userProfile = await this.getUserBehaviorProfile(userId);
        const anomalyScore = 0;
        
        // Check geographic anomaly
        const geoAnomaly = await this.checkGeographicAnomaly(
            userId, 
            loginActivity.location
        );
        anomalyScore += geoAnomaly.score * 0.3;
        
        // Check time-based anomaly
        const timeAnomaly = await this.checkTimeAnomaly(
            userId, 
            loginActivity.timestamp
        );
        anomalyScore += timeAnomaly.score * 0.2;
        
        // Check device anomaly
        const deviceAnomaly = await this.checkDeviceAnomaly(
            userId, 
            loginActivity.device
        );
        anomalyScore += deviceAnomaly.score * 0.3;
        
        // Check IP reputation
        const ipReputation = await this.threatIntelligence.checkIP(
            loginActivity.ipAddress
        );
        if (ipReputation.malicious) {
            anomalyScore += 0.5;
        }
        
        return {
            score: Math.min(anomalyScore, 1.0),
            factors: {
                geographic: geoAnomaly,
                temporal: timeAnomaly,
                device: deviceAnomaly,
                ipReputation: ipReputation
            }
        };
    }
    
    async handleSecurityEvent(event, userId, activity) {
        // Log security event
        await this.logSecurityEvent(event, userId, activity);
        
        // Take immediate action based on severity
        switch (event.severity) {
            case 'critical':
                await this.suspendUser(userId, 'security_incident');
                await this.notifySecurityTeam(event, 'immediate');
                break;
                
            case 'high':
                await this.requireAdditionalAuth(userId);
                await this.notifySecurityTeam(event, 'urgent');
                break;
                
            case 'medium':
                await this.flagUserForReview(userId);
                await this.notifySecurityTeam(event, 'normal');
                break;
                
            case 'low':
                await this.logForAnalysis(event);
                break;
        }
        
        // Update user risk score
        await this.updateUserRiskScore(userId, event);
    }
}
```

## Compliance and Audit

### Comprehensive Audit Logging
```javascript
class AuditLogger {
    constructor() {
        this.auditEvents = {
            'user_login': { retention: '7-years', pii: true },
            'message_sent': { retention: '3-years', pii: false },
            'file_uploaded': { retention: '7-years', pii: false },
            'permission_changed': { retention: '10-years', pii: true },
            'data_exported': { retention: '10-years', pii: true },
            'admin_action': { retention: '10-years', pii: true }
        };
    }
    
    async logEvent(eventType, userId, details, context = {}) {
        const auditEvent = {
            eventId: this.generateEventId(),
            eventType: eventType,
            userId: userId,
            timestamp: new Date(),
            details: this.sanitizeDetails(details),
            context: {
                ipAddress: this.hashIP(context.ipAddress),
                userAgent: this.sanitizeUserAgent(context.userAgent),
                sessionId: context.sessionId,
                workspaceId: context.workspaceId,
                requestId: context.requestId
            },
            metadata: {
                version: '1.0',
                source: 'team-collaboration-api',
                environment: process.env.NODE_ENV
            }
        };
        
        // Add digital signature for tamper detection
        auditEvent.signature = await this.signEvent(auditEvent);
        
        // Store in immutable audit log
        await this.storeAuditEvent(auditEvent);
        
        // Real-time compliance monitoring
        await this.checkComplianceRules(auditEvent);
        
        // Schedule retention cleanup
        const eventConfig = this.auditEvents[eventType];
        if (eventConfig) {
            await this.scheduleRetentionCleanup(
                auditEvent.eventId, 
                eventConfig.retention
            );
        }
        
        return auditEvent.eventId;
    }
    
    async generateComplianceReport(workspaceId, framework, timeRange) {
        const auditEvents = await this.getAuditEvents(workspaceId, timeRange);
        
        switch (framework) {
            case 'GDPR':
                return this.generateGDPRReport(auditEvents);
            case 'HIPAA':
                return this.generateHIPAAReport(auditEvents);
            case 'SOX':
                return this.generateSOXReport(auditEvents);
            case 'ISO27001':
                return this.generateISO27001Report(auditEvents);
        }
    }
    
    generateGDPRReport(auditEvents) {
        return {
            dataProcessingActivities: this.analyzeDataProcessing(auditEvents),
            consentManagement: this.analyzeConsentEvents(auditEvents),
            dataSubjectRights: this.analyzeDataSubjectRequests(auditEvents),
            dataBreaches: this.identifyPotentialBreaches(auditEvents),
            crossBorderTransfers: this.analyzeCrossBorderTransfers(auditEvents),
            retentionCompliance: this.checkRetentionCompliance(auditEvents),
            accessControls: this.analyzeAccessControls(auditEvents)
        };
    }
}
```
