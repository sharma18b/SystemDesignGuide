# Security and Privacy for Shopify Platform

*Estimated reading time: 20 minutes*

## Overview

Multi-tenant e-commerce platforms face unique security challenges around data isolation, access control, and compliance across millions of independent stores with varying security requirements.

## Multi-Tenant Security Architecture

### 1. Data Isolation and Access Control

**Row-Level Security Implementation**:
```python
class MultiTenantSecurity:
    def __init__(self):
        self.tenant_context = TenantContext()
        self.access_control = AccessControl()
    
    async def execute_tenant_query(self, query, params, user_context):
        # Automatically inject tenant filter
        tenant_id = user_context.tenant_id
        
        # Set session variable for RLS
        await self.db.execute(
            "SET app.current_tenant_id = $1", tenant_id
        )
        
        # Execute query with RLS enforcement
        result = await self.db.fetch(query, *params)
        
        return result
```

**Database-Level Isolation**:
```sql
-- Row Level Security policies
CREATE POLICY tenant_isolation_policy ON products
    USING (store_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_policy ON orders
    USING (store_id = current_setting('app.current_tenant_id')::UUID);

-- Prevent cross-tenant data access
CREATE FUNCTION prevent_cross_tenant_access()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.store_id != current_setting('app.current_tenant_id')::UUID THEN
        RAISE EXCEPTION 'Cross-tenant access denied';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_tenant_isolation
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION prevent_cross_tenant_access();
```

### 2. Authentication and Authorization

**Multi-Level Authentication**:
```python
class AuthenticationService:
    def __init__(self):
        self.jwt_service = JWTService()
        self.mfa_service = MFAService()
        self.session_manager = SessionManager()
    
    async def authenticate_merchant(self, credentials):
        # Step 1: Verify credentials
        user = await self.verify_credentials(
            credentials.email, credentials.password
        )
        
        if not user:
            await self.log_failed_login(credentials.email)
            raise AuthenticationError("Invalid credentials")
        
        # Step 2: Check MFA requirement
        if user.mfa_enabled:
            mfa_token = await self.mfa_service.generate_challenge(user.id)
            return {
                'status': 'mfa_required',
                'mfa_token': mfa_token,
                'user_id': user.id
            }
        
        # Step 3: Create session
        session = await self.create_authenticated_session(user)
        
        return {
            'status': 'authenticated',
            'access_token': session.access_token,
            'refresh_token': session.refresh_token,
            'expires_in': 3600
        }
    
    async def verify_mfa(self, user_id, mfa_token, mfa_code):
        # Verify MFA code
        valid = await self.mfa_service.verify_code(
            user_id, mfa_token, mfa_code
        )
        
        if not valid:
            raise AuthenticationError("Invalid MFA code")
        
        # Create session after successful MFA
        user = await self.get_user(user_id)
        session = await self.create_authenticated_session(user)
        
        return session
```

**Role-Based Access Control (RBAC)**:
```python
class RBACService:
    def __init__(self):
        self.roles = {
            'owner': {
                'permissions': ['*'],  # All permissions
                'description': 'Store owner with full access'
            },
            'admin': {
                'permissions': [
                    'products:*', 'orders:*', 'customers:*',
                    'settings:read', 'analytics:read'
                ],
                'description': 'Store administrator'
            },
            'staff': {
                'permissions': [
                    'products:read', 'products:write',
                    'orders:read', 'orders:write',
                    'customers:read'
                ],
                'description': 'Store staff member'
            },
            'developer': {
                'permissions': [
                    'api:read', 'api:write',
                    'webhooks:*', 'themes:*'
                ],
                'description': 'App developer'
            }
        }
    
    async def check_permission(self, user_id, store_id, permission):
        # Get user roles for store
        user_roles = await self.get_user_roles(user_id, store_id)
        
        # Check if any role grants permission
        for role in user_roles:
            role_permissions = self.roles[role]['permissions']
            
            if '*' in role_permissions:
                return True
            
            if self.permission_matches(permission, role_permissions):
                return True
        
        return False
    
    def permission_matches(self, required_permission, granted_permissions):
        resource, action = required_permission.split(':')
        
        for granted in granted_permissions:
            granted_resource, granted_action = granted.split(':')
            
            # Check wildcard matches
            if granted_resource == resource or granted_resource == '*':
                if granted_action == action or granted_action == '*':
                    return True
        
        return False
```

## API Security

### 1. API Authentication and Rate Limiting

**API Key Management**:
```python
class APIKeyService:
    def __init__(self):
        self.key_store = SecureKeyStore()
        self.rate_limiter = RateLimiter()
    
    async def create_api_key(self, store_id, key_config):
        # Generate secure API key
        api_key = self.generate_secure_key()
        api_secret = self.generate_secure_secret()
        
        # Store hashed credentials
        key_record = {
            'store_id': store_id,
            'key_hash': self.hash_key(api_key),
            'secret_hash': self.hash_secret(api_secret),
            'permissions': key_config.permissions,
            'rate_limit': key_config.rate_limit,
            'ip_whitelist': key_config.ip_whitelist,
            'expires_at': key_config.expires_at,
            'created_at': datetime.utcnow()
        }
        
        await self.key_store.store(key_record)
        
        # Return unhashed credentials (only time they're visible)
        return {
            'api_key': api_key,
            'api_secret': api_secret,
            'warning': 'Store these securely. They cannot be retrieved again.'
        }
    
    async def validate_api_request(self, request):
        api_key = request.headers.get('X-Shopify-Access-Token')
        
        if not api_key:
            raise AuthenticationError("Missing API key")
        
        # Verify API key
        key_record = await self.key_store.get_by_hash(self.hash_key(api_key))
        
        if not key_record:
            raise AuthenticationError("Invalid API key")
        
        # Check expiration
        if key_record.expires_at and datetime.utcnow() > key_record.expires_at:
            raise AuthenticationError("API key expired")
        
        # Check IP whitelist
        if key_record.ip_whitelist:
            client_ip = request.client.host
            if client_ip not in key_record.ip_whitelist:
                raise AuthenticationError("IP not whitelisted")
        
        # Apply rate limiting
        await self.rate_limiter.check_limit(
            key_record.store_id, key_record.rate_limit
        )
        
        return key_record
```

**Advanced Rate Limiting**:
```python
class AdvancedRateLimiter:
    def __init__(self):
        self.redis = RedisClient()
        self.rate_limits = {
            'basic': {'requests_per_second': 2, 'burst': 10},
            'professional': {'requests_per_second': 10, 'burst': 50},
            'enterprise': {'requests_per_second': 100, 'burst': 500}
        }
    
    async def check_limit(self, store_id, plan_type):
        limits = self.rate_limits[plan_type]
        
        # Token bucket algorithm
        bucket_key = f"rate_limit:{store_id}"
        
        # Get current tokens
        current_tokens = await self.redis.get(bucket_key)
        if current_tokens is None:
            current_tokens = limits['burst']
        else:
            current_tokens = float(current_tokens)
        
        # Refill tokens based on time elapsed
        last_refill = await self.redis.get(f"{bucket_key}:last_refill")
        if last_refill:
            time_elapsed = time.time() - float(last_refill)
            tokens_to_add = time_elapsed * limits['requests_per_second']
            current_tokens = min(
                current_tokens + tokens_to_add,
                limits['burst']
            )
        
        # Check if request can be processed
        if current_tokens < 1:
            retry_after = 1 / limits['requests_per_second']
            raise RateLimitExceededError(
                f"Rate limit exceeded. Retry after {retry_after}s"
            )
        
        # Consume token
        current_tokens -= 1
        
        # Update bucket
        await self.redis.set(bucket_key, current_tokens, ex=60)
        await self.redis.set(f"{bucket_key}:last_refill", time.time(), ex=60)
        
        return {
            'remaining': int(current_tokens),
            'limit': limits['burst'],
            'reset': time.time() + (1 / limits['requests_per_second'])
        }
```

### 2. Webhook Security

**Webhook Signature Verification**:
```python
class WebhookSecurity:
    def __init__(self):
        self.hmac_service = HMACService()
    
    def sign_webhook_payload(self, payload, webhook_secret):
        # Generate HMAC signature
        signature = hmac.new(
            webhook_secret.encode('utf-8'),
            json.dumps(payload).encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return signature
    
    def verify_webhook_signature(self, payload, signature, webhook_secret):
        # Calculate expected signature
        expected_signature = self.sign_webhook_payload(payload, webhook_secret)
        
        # Constant-time comparison to prevent timing attacks
        return hmac.compare_digest(signature, expected_signature)
    
    async def deliver_webhook(self, webhook, event_data):
        # Prepare payload
        payload = {
            'id': str(uuid.uuid4()),
            'topic': webhook.topic,
            'created_at': datetime.utcnow().isoformat(),
            'data': event_data
        }
        
        # Sign payload
        signature = self.sign_webhook_payload(payload, webhook.secret)
        
        # Deliver with signature
        headers = {
            'Content-Type': 'application/json',
            'X-Shopify-Topic': webhook.topic,
            'X-Shopify-Hmac-Sha256': signature,
            'X-Shopify-Shop-Domain': webhook.store.domain,
            'X-Shopify-Webhook-Id': payload['id']
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    webhook.address,
                    json=payload,
                    headers=headers,
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    await self.log_webhook_success(webhook, payload)
                else:
                    await self.handle_webhook_failure(webhook, payload, response)
                    
        except Exception as e:
            await self.handle_webhook_error(webhook, payload, e)
```

## Data Protection and Privacy

### 1. Encryption at Rest and in Transit

**Data Encryption Service**:
```python
class DataEncryptionService:
    def __init__(self):
        self.kms = KeyManagementService()
        self.encryption_algorithm = 'AES-256-GCM'
    
    async def encrypt_sensitive_data(self, data, store_id):
        # Get store-specific encryption key
        encryption_key = await self.kms.get_data_key(store_id)
        
        # Generate initialization vector
        iv = os.urandom(16)
        
        # Encrypt data
        cipher = Cipher(
            algorithms.AES(encryption_key),
            modes.GCM(iv),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        
        ciphertext = encryptor.update(data.encode()) + encryptor.finalize()
        
        # Return encrypted data with metadata
        return {
            'ciphertext': base64.b64encode(ciphertext).decode(),
            'iv': base64.b64encode(iv).decode(),
            'tag': base64.b64encode(encryptor.tag).decode(),
            'algorithm': self.encryption_algorithm,
            'key_id': encryption_key.id
        }
    
    async def decrypt_sensitive_data(self, encrypted_data):
        # Get encryption key
        encryption_key = await self.kms.get_key(encrypted_data['key_id'])
        
        # Decode components
        ciphertext = base64.b64decode(encrypted_data['ciphertext'])
        iv = base64.b64decode(encrypted_data['iv'])
        tag = base64.b64decode(encrypted_data['tag'])
        
        # Decrypt data
        cipher = Cipher(
            algorithms.AES(encryption_key),
            modes.GCM(iv, tag),
            backend=default_backend()
        )
        decryptor = cipher.decryptor()
        
        plaintext = decryptor.update(ciphertext) + decryptor.finalize()
        
        return plaintext.decode()
```

**TLS Configuration**:
```python
class TLSConfiguration:
    def __init__(self):
        self.cert_manager = CertificateManager()
    
    def get_tls_config(self):
        return {
            'min_version': 'TLSv1.2',
            'cipher_suites': [
                'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
                'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
                'TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256'
            ],
            'hsts_enabled': True,
            'hsts_max_age': 31536000,  # 1 year
            'certificate_pinning': True
        }
    
    async def setup_custom_domain_ssl(self, store_id, domain):
        # Provision SSL certificate
        certificate = await self.cert_manager.provision_certificate(
            domain,
            validation_method='DNS'
        )
        
        # Configure automatic renewal
        await self.cert_manager.enable_auto_renewal(certificate)
        
        return certificate
```

### 2. PII and GDPR Compliance

**Personal Data Management**:
```python
class PersonalDataManager:
    def __init__(self):
        self.consent_manager = ConsentManager()
        self.data_retention = DataRetentionPolicy()
        self.anonymization = AnonymizationService()
    
    async def collect_customer_data(self, customer_data, consent):
        # Verify consent before collection
        if not consent.data_collection_consent:
            raise ConsentRequiredError("Data collection consent required")
        
        # Classify data by sensitivity
        classified_data = self.classify_personal_data(customer_data)
        
        # Encrypt sensitive fields
        for field, classification in classified_data.items():
            if classification == 'sensitive':
                customer_data[field] = await self.encrypt_field(
                    customer_data[field]
                )
        
        # Store with retention policy
        retention_period = self.data_retention.get_retention_period(
            data_type='customer_data'
        )
        
        await self.store_with_retention(
            customer_data,
            retention_period,
            consent
        )
    
    async def handle_data_subject_request(self, request_type, customer_id):
        if request_type == 'access':
            # Right to access
            return await self.export_customer_data(customer_id)
        
        elif request_type == 'rectification':
            # Right to rectification
            return await self.update_customer_data(
                customer_id, request.corrections
            )
        
        elif request_type == 'erasure':
            # Right to be forgotten
            return await self.erase_customer_data(customer_id)
        
        elif request_type == 'portability':
            # Right to data portability
            return await self.export_portable_data(customer_id)
        
        elif request_type == 'restriction':
            # Right to restriction of processing
            return await self.restrict_processing(customer_id)
    
    async def erase_customer_data(self, customer_id):
        # Anonymize personal data
        await self.anonymization.anonymize_customer(customer_id)
        
        # Retain order records for legal compliance (7 years)
        await self.retain_anonymized_orders(customer_id)
        
        # Delete marketing data
        await self.delete_marketing_data(customer_id)
        
        # Log erasure for audit
        await self.log_data_erasure(customer_id)
```

## Security Monitoring and Incident Response

### 1. Security Monitoring

**Threat Detection System**:
```python
class ThreatDetectionSystem:
    def __init__(self):
        self.anomaly_detector = AnomalyDetector()
        self.threat_intelligence = ThreatIntelligence()
        self.alert_manager = AlertManager()
    
    async def monitor_security_events(self):
        # Monitor various security events
        events = await self.collect_security_events()
        
        for event in events:
            # Check against threat intelligence
            threat_level = await self.threat_intelligence.assess_threat(event)
            
            if threat_level == 'high':
                await self.handle_high_threat(event)
            elif threat_level == 'medium':
                await self.handle_medium_threat(event)
            
            # Detect anomalies
            if await self.anomaly_detector.is_anomalous(event):
                await self.investigate_anomaly(event)
    
    async def handle_high_threat(self, event):
        # Immediate action for high threats
        if event.type == 'brute_force_attack':
            await self.block_ip_address(event.source_ip)
            await self.lock_affected_accounts(event.target_accounts)
        
        elif event.type == 'sql_injection_attempt':
            await self.block_request_pattern(event.pattern)
            await self.alert_security_team(event)
        
        elif event.type == 'data_exfiltration':
            await self.suspend_api_access(event.api_key)
            await self.trigger_incident_response(event)
        
        # Log and alert
        await self.log_security_incident(event)
        await self.alert_manager.send_critical_alert(event)
```

### 2. Incident Response

**Automated Incident Response**:
```python
class IncidentResponseSystem:
    def __init__(self):
        self.incident_manager = IncidentManager()
        self.forensics = ForensicsService()
        self.communication = CommunicationService()
    
    async def handle_security_incident(self, incident):
        # Create incident record
        incident_id = await self.incident_manager.create_incident(incident)
        
        # Immediate containment
        await self.contain_incident(incident)
        
        # Collect forensic evidence
        evidence = await self.forensics.collect_evidence(incident)
        
        # Assess impact
        impact = await self.assess_incident_impact(incident)
        
        # Notify affected parties
        if impact.customers_affected:
            await self.notify_affected_customers(incident, impact)
        
        if impact.requires_regulatory_notification:
            await self.notify_regulators(incident, impact)
        
        # Remediation
        await self.remediate_incident(incident, evidence)
        
        # Post-incident review
        await self.schedule_post_incident_review(incident_id)
    
    async def contain_incident(self, incident):
        if incident.type == 'data_breach':
            # Isolate affected systems
            await self.isolate_systems(incident.affected_systems)
            
            # Revoke compromised credentials
            await self.revoke_credentials(incident.compromised_credentials)
            
            # Enable enhanced monitoring
            await self.enable_enhanced_monitoring(incident.affected_stores)
        
        elif incident.type == 'ddos_attack':
            # Enable DDoS protection
            await self.enable_ddos_protection()
            
            # Scale infrastructure
            await self.emergency_scale_up()
```

## Compliance and Audit

### 1. Compliance Framework

**Multi-Jurisdiction Compliance**:
```python
class ComplianceFramework:
    def __init__(self):
        self.compliance_rules = {
            'GDPR': GDPRCompliance(),
            'CCPA': CCPACompliance(),
            'PCI_DSS': PCIDSSCompliance(),
            'SOC2': SOC2Compliance()
        }
    
    async def ensure_compliance(self, store_id, jurisdiction):
        store = await self.get_store(store_id)
        
        # Determine applicable regulations
        applicable_regulations = self.get_applicable_regulations(
            store.country, jurisdiction
        )
        
        # Check compliance for each regulation
        compliance_status = {}
        
        for regulation in applicable_regulations:
            compliance_checker = self.compliance_rules[regulation]
            status = await compliance_checker.check_compliance(store)
            compliance_status[regulation] = status
        
        return compliance_status
```

### 2. Audit Logging

**Comprehensive Audit Trail**:
```python
class AuditLoggingService:
    def __init__(self):
        self.audit_store = AuditStore()
        self.log_retention = 7 * 365  # 7 years
    
    async def log_audit_event(self, event):
        audit_record = {
            'event_id': str(uuid.uuid4()),
            'timestamp': datetime.utcnow(),
            'store_id': event.store_id,
            'user_id': event.user_id,
            'action': event.action,
            'resource_type': event.resource_type,
            'resource_id': event.resource_id,
            'changes': event.changes,
            'ip_address': event.ip_address,
            'user_agent': event.user_agent,
            'result': event.result
        }
        
        # Store in immutable audit log
        await self.audit_store.append(audit_record)
        
        # Set retention policy
        await self.audit_store.set_retention(
            audit_record['event_id'],
            days=self.log_retention
        )
```

This comprehensive security and privacy framework ensures multi-tenant e-commerce platforms maintain the highest standards of data protection, access control, and regulatory compliance.
