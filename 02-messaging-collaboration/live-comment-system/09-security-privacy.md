# Security and Privacy - Live Comment System

## Authentication and Authorization

### Multi-Factor Authentication System

**JWT-Based Authentication with MFA**:
```python
import jwt
import pyotp
import qrcode
from cryptography.fernet import Fernet
from datetime import datetime, timedelta

class SecureAuthenticationSystem:
    def __init__(self, secret_key, encryption_key):
        self.secret_key = secret_key
        self.cipher_suite = Fernet(encryption_key)
        self.token_expiry = timedelta(hours=1)
        self.refresh_token_expiry = timedelta(days=30)
        
    async def authenticate_user(self, username, password, mfa_token=None):
        """
        Comprehensive user authentication with MFA support
        """
        # Step 1: Validate username and password
        user = await self.validate_credentials(username, password)
        if not user:
            await self.log_failed_attempt(username, 'invalid_credentials')
            raise AuthenticationError("Invalid credentials")
        
        # Step 2: Check account status and security flags
        security_check = await self.perform_security_checks(user)
        if not security_check.is_valid:
            raise SecurityError(security_check.reason)
        
        # Step 3: MFA verification if enabled
        if user.mfa_enabled:
            if not mfa_token:
                return {
                    'status': 'mfa_required',
                    'mfa_methods': user.mfa_methods,
                    'temp_token': self.generate_temp_token(user.user_id)
                }
            
            mfa_valid = await self.verify_mfa_token(user.user_id, mfa_token)
            if not mfa_valid:
                await self.log_failed_attempt(username, 'invalid_mfa')
                raise AuthenticationError("Invalid MFA token")
        
        # Step 4: Generate secure tokens
        access_token = self.generate_access_token(user)
        refresh_token = self.generate_refresh_token(user)
        
        # Step 5: Update user session and security logs
        await self.create_user_session(user.user_id, access_token)
        await self.log_successful_login(user.user_id)
        
        return {
            'status': 'authenticated',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'expires_in': int(self.token_expiry.total_seconds()),
            'user_profile': self.sanitize_user_profile(user)
        }
    
    async def setup_mfa(self, user_id, mfa_method='totp'):
        """
        Set up multi-factor authentication for user
        """
        if mfa_method == 'totp':
            # Generate TOTP secret
            secret = pyotp.random_base32()
            
            # Create provisioning URI for QR code
            totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
                name=f"user_{user_id}",
                issuer_name="LiveComments"
            )
            
            # Generate QR code
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(totp_uri)
            qr.make(fit=True)
            
            # Store encrypted secret
            encrypted_secret = self.cipher_suite.encrypt(secret.encode())
            await self.store_mfa_secret(user_id, encrypted_secret, 'totp')
            
            return {
                'secret': secret,
                'qr_code_uri': totp_uri,
                'backup_codes': await self.generate_backup_codes(user_id)
            }
    
    def generate_access_token(self, user):
        """
        Generate secure JWT access token with claims
        """
        now = datetime.utcnow()
        payload = {
            'sub': str(user.user_id),
            'username': user.username,
            'email': user.email,
            'roles': user.roles,
            'permissions': user.permissions,
            'iat': now,
            'exp': now + self.token_expiry,
            'jti': str(uuid.uuid4()),  # JWT ID for token tracking
            'iss': 'live-comments-api',
            'aud': 'live-comments-client'
        }
        
        return jwt.encode(payload, self.secret_key, algorithm='HS256')
    
    async def verify_token(self, token):
        """
        Verify and decode JWT token with security checks
        """
        try:
            # Decode token
            payload = jwt.decode(
                token, 
                self.secret_key, 
                algorithms=['HS256'],
                audience='live-comments-client',
                issuer='live-comments-api'
            )
            
            # Check if token is blacklisted
            if await self.is_token_blacklisted(payload['jti']):
                raise TokenError("Token has been revoked")
            
            # Verify user still exists and is active
            user = await self.get_user_by_id(payload['sub'])
            if not user or user.status != 'active':
                raise TokenError("User account is inactive")
            
            return payload
            
        except jwt.ExpiredSignatureError:
            raise TokenError("Token has expired")
        except jwt.InvalidTokenError:
            raise TokenError("Invalid token")

# Role-based access control
class RoleBasedAccessControl:
    def __init__(self):
        self.permissions = {
            'user': [
                'comment:create',
                'comment:read',
                'comment:update_own',
                'comment:delete_own',
                'reaction:create',
                'reaction:read'
            ],
            'moderator': [
                'comment:moderate',
                'comment:delete_any',
                'user:warn',
                'user:timeout',
                'event:moderate'
            ],
            'admin': [
                'user:manage',
                'event:create',
                'event:manage',
                'system:configure',
                'analytics:view'
            ]
        }
    
    def check_permission(self, user_roles, required_permission):
        """
        Check if user has required permission
        """
        user_permissions = set()
        for role in user_roles:
            user_permissions.update(self.permissions.get(role, []))
        
        return required_permission in user_permissions
    
    def require_permission(self, permission):
        """
        Decorator to enforce permission requirements
        """
        def decorator(func):
            async def wrapper(*args, **kwargs):
                # Extract user from request context
                user = kwargs.get('current_user')
                if not user:
                    raise AuthorizationError("Authentication required")
                
                if not self.check_permission(user.roles, permission):
                    raise AuthorizationError(f"Permission {permission} required")
                
                return await func(*args, **kwargs)
            return wrapper
        return decorator
```

## Data Encryption and Privacy

### End-to-End Encryption for Sensitive Comments

**Message Encryption System**:
```python
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
import os

class EndToEndEncryption:
    def __init__(self):
        self.key_size = 2048
        self.symmetric_key_size = 32  # 256 bits for AES
        
    async def generate_user_keypair(self, user_id):
        """
        Generate RSA keypair for user
        """
        # Generate private key
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=self.key_size
        )
        
        # Get public key
        public_key = private_key.public_key()
        
        # Serialize keys
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        
        # Store public key in database, return private key to user
        await self.store_public_key(user_id, public_pem)
        
        return {
            'private_key': private_pem.decode('utf-8'),
            'public_key': public_pem.decode('utf-8'),
            'key_id': str(uuid.uuid4())
        }
    
    async def encrypt_comment(self, comment_content, recipient_public_keys):
        """
        Encrypt comment for multiple recipients
        """
        # Generate random symmetric key for this message
        symmetric_key = os.urandom(self.symmetric_key_size)
        iv = os.urandom(16)  # 128-bit IV for AES
        
        # Encrypt comment content with AES
        cipher = Cipher(
            algorithms.AES(symmetric_key),
            modes.CBC(iv)
        )
        encryptor = cipher.encryptor()
        
        # Pad content to block size
        padded_content = self.pad_content(comment_content.encode('utf-8'))
        encrypted_content = encryptor.update(padded_content) + encryptor.finalize()
        
        # Encrypt symmetric key for each recipient
        encrypted_keys = {}
        for user_id, public_key_pem in recipient_public_keys.items():
            public_key = serialization.load_pem_public_key(public_key_pem.encode())
            
            encrypted_key = public_key.encrypt(
                symmetric_key,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None
                )
            )
            encrypted_keys[user_id] = encrypted_key.hex()
        
        return {
            'encrypted_content': encrypted_content.hex(),
            'iv': iv.hex(),
            'encrypted_keys': encrypted_keys,
            'encryption_algorithm': 'AES-256-CBC',
            'key_algorithm': 'RSA-2048-OAEP'
        }
    
    async def decrypt_comment(self, encrypted_data, user_private_key):
        """
        Decrypt comment using user's private key
        """
        try:
            # Load private key
            private_key = serialization.load_pem_private_key(
                user_private_key.encode(),
                password=None
            )
            
            # Decrypt symmetric key
            encrypted_symmetric_key = bytes.fromhex(
                encrypted_data['encrypted_keys'][user_id]
            )
            
            symmetric_key = private_key.decrypt(
                encrypted_symmetric_key,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None
                )
            )
            
            # Decrypt content
            iv = bytes.fromhex(encrypted_data['iv'])
            encrypted_content = bytes.fromhex(encrypted_data['encrypted_content'])
            
            cipher = Cipher(
                algorithms.AES(symmetric_key),
                modes.CBC(iv)
            )
            decryptor = cipher.decryptor()
            
            padded_content = decryptor.update(encrypted_content) + decryptor.finalize()
            content = self.unpad_content(padded_content)
            
            return content.decode('utf-8')
            
        except Exception as e:
            raise DecryptionError(f"Failed to decrypt comment: {str(e)}")

# Database encryption for sensitive data
class DatabaseEncryption:
    def __init__(self, encryption_key):
        self.cipher_suite = Fernet(encryption_key)
        
    def encrypt_sensitive_field(self, data):
        """
        Encrypt sensitive database fields
        """
        if data is None:
            return None
        
        return self.cipher_suite.encrypt(str(data).encode()).decode()
    
    def decrypt_sensitive_field(self, encrypted_data):
        """
        Decrypt sensitive database fields
        """
        if encrypted_data is None:
            return None
        
        return self.cipher_suite.decrypt(encrypted_data.encode()).decode()

# Encrypted database schema
encrypted_schema = """
-- Users table with encrypted PII
CREATE TABLE users (
    user_id UUID PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email_encrypted TEXT NOT NULL,  -- Encrypted email
    display_name VARCHAR(100) NOT NULL,
    phone_encrypted TEXT,           -- Encrypted phone number
    created_at TIMESTAMP DEFAULT NOW()
);

-- Comments with optional encryption
CREATE TABLE comments (
    comment_id UUID PRIMARY KEY,
    event_id UUID NOT NULL,
    user_id UUID NOT NULL,
    content_encrypted TEXT,         -- Encrypted content for private comments
    content_hash VARCHAR(64),       -- Hash for duplicate detection
    encryption_metadata JSONB,     -- Encryption algorithm and key info
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
"""
```

## Privacy Compliance and Data Protection

### GDPR and Privacy Regulation Compliance

**Data Privacy Management System**:
```python
class PrivacyComplianceSystem:
    def __init__(self, database, audit_logger):
        self.db = database
        self.audit = audit_logger
        
    async def handle_data_subject_request(self, request_type, user_id, requester_info):
        """
        Handle GDPR data subject requests (access, portability, erasure)
        """
        # Verify request authenticity
        verification_result = await self.verify_data_subject_identity(
            user_id, requester_info
        )
        if not verification_result.is_verified:
            raise PrivacyError("Identity verification failed")
        
        # Log the request for audit trail
        await self.audit.log_privacy_request(request_type, user_id, requester_info)
        
        if request_type == 'access':
            return await self.export_user_data(user_id)
        elif request_type == 'portability':
            return await self.export_portable_data(user_id)
        elif request_type == 'erasure':
            return await self.erase_user_data(user_id)
        else:
            raise PrivacyError(f"Unsupported request type: {request_type}")
    
    async def export_user_data(self, user_id):
        """
        Export all user data for GDPR access request
        """
        user_data = {
            'request_id': str(uuid.uuid4()),
            'user_id': user_id,
            'export_date': datetime.utcnow().isoformat(),
            'data_categories': {}
        }
        
        # Personal information
        user_profile = await self.db.get_user_profile(user_id)
        user_data['data_categories']['profile'] = {
            'username': user_profile.username,
            'email': user_profile.email,
            'display_name': user_profile.display_name,
            'created_at': user_profile.created_at.isoformat(),
            'last_login': user_profile.last_login.isoformat() if user_profile.last_login else None
        }
        
        # Comments and interactions
        comments = await self.db.get_user_comments(user_id)
        user_data['data_categories']['comments'] = [
            {
                'comment_id': comment.comment_id,
                'event_id': comment.event_id,
                'content': comment.content,
                'created_at': comment.created_at.isoformat(),
                'like_count': comment.like_count,
                'reply_count': comment.reply_count
            }
            for comment in comments
        ]
        
        # Reactions and likes
        reactions = await self.db.get_user_reactions(user_id)
        user_data['data_categories']['reactions'] = [
            {
                'comment_id': reaction.comment_id,
                'reaction_type': reaction.reaction_type,
                'created_at': reaction.created_at.isoformat()
            }
            for reaction in reactions
        ]
        
        # Session and activity logs
        activity_logs = await self.db.get_user_activity_logs(user_id)
        user_data['data_categories']['activity'] = [
            {
                'activity_type': log.activity_type,
                'timestamp': log.timestamp.isoformat(),
                'ip_address': self.anonymize_ip(log.ip_address),
                'user_agent': log.user_agent
            }
            for log in activity_logs
        ]
        
        return user_data
    
    async def erase_user_data(self, user_id):
        """
        Implement right to erasure (right to be forgotten)
        """
        erasure_plan = {
            'user_id': user_id,
            'erasure_id': str(uuid.uuid4()),
            'started_at': datetime.utcnow().isoformat(),
            'steps': []
        }
        
        try:
            # Step 1: Anonymize comments (preserve for community value)
            comments_anonymized = await self.anonymize_user_comments(user_id)
            erasure_plan['steps'].append({
                'step': 'anonymize_comments',
                'status': 'completed',
                'count': comments_anonymized
            })
            
            # Step 2: Delete personal data
            await self.db.delete_user_profile(user_id)
            erasure_plan['steps'].append({
                'step': 'delete_profile',
                'status': 'completed'
            })
            
            # Step 3: Delete authentication data
            await self.db.delete_user_auth_data(user_id)
            erasure_plan['steps'].append({
                'step': 'delete_auth_data',
                'status': 'completed'
            })
            
            # Step 4: Delete activity logs
            logs_deleted = await self.db.delete_user_activity_logs(user_id)
            erasure_plan['steps'].append({
                'step': 'delete_activity_logs',
                'status': 'completed',
                'count': logs_deleted
            })
            
            # Step 5: Remove from caches
            await self.clear_user_from_caches(user_id)
            erasure_plan['steps'].append({
                'step': 'clear_caches',
                'status': 'completed'
            })
            
            erasure_plan['completed_at'] = datetime.utcnow().isoformat()
            erasure_plan['status'] = 'completed'
            
        except Exception as e:
            erasure_plan['status'] = 'failed'
            erasure_plan['error'] = str(e)
            raise PrivacyError(f"Data erasure failed: {str(e)}")
        
        # Log erasure for compliance audit
        await self.audit.log_data_erasure(erasure_plan)
        
        return erasure_plan
    
    async def anonymize_user_comments(self, user_id):
        """
        Anonymize user comments while preserving community value
        """
        # Replace user info with anonymous placeholder
        anonymous_user_data = {
            'username': f'anonymous_user_{hash(user_id) % 10000}',
            'display_name': 'Anonymous User',
            'avatar_url': None
        }
        
        # Update comments to reference anonymous user
        comments_updated = await self.db.anonymize_comments(user_id, anonymous_user_data)
        
        return comments_updated

# Data retention and cleanup
class DataRetentionManager:
    def __init__(self, database):
        self.db = database
        self.retention_policies = {
            'comments': timedelta(days=365 * 5),      # 5 years
            'activity_logs': timedelta(days=90),       # 90 days
            'session_data': timedelta(days=30),        # 30 days
            'audit_logs': timedelta(days=365 * 7),     # 7 years (compliance)
            'deleted_user_data': timedelta(days=30)    # 30 days backup
        }
    
    async def cleanup_expired_data(self):
        """
        Automated cleanup of expired data based on retention policies
        """
        cleanup_results = {}
        
        for data_type, retention_period in self.retention_policies.items():
            cutoff_date = datetime.utcnow() - retention_period
            
            if data_type == 'comments':
                # Soft delete old comments
                deleted_count = await self.db.soft_delete_old_comments(cutoff_date)
            elif data_type == 'activity_logs':
                deleted_count = await self.db.delete_old_activity_logs(cutoff_date)
            elif data_type == 'session_data':
                deleted_count = await self.db.delete_expired_sessions(cutoff_date)
            elif data_type == 'audit_logs':
                # Archive instead of delete for compliance
                archived_count = await self.db.archive_old_audit_logs(cutoff_date)
                deleted_count = archived_count
            
            cleanup_results[data_type] = {
                'cutoff_date': cutoff_date.isoformat(),
                'records_processed': deleted_count
            }
        
        return cleanup_results
```

## Security Monitoring and Incident Response

### Real-Time Security Monitoring

**Security Event Detection System**:
```python
class SecurityMonitoringSystem:
    def __init__(self, redis_client, alert_manager):
        self.redis = redis_client
        self.alerts = alert_manager
        self.threat_patterns = self.load_threat_patterns()
        
    async def monitor_user_activity(self, user_id, activity_data):
        """
        Real-time monitoring of user activity for security threats
        """
        # Rate limiting detection
        await self.check_rate_limiting_violations(user_id, activity_data)
        
        # Suspicious behavior detection
        await self.detect_suspicious_behavior(user_id, activity_data)
        
        # Credential stuffing detection
        if activity_data['type'] == 'login_attempt':
            await self.detect_credential_stuffing(user_id, activity_data)
        
        # Content-based threat detection
        if activity_data['type'] == 'comment_submission':
            await self.detect_malicious_content(user_id, activity_data)
    
    async def check_rate_limiting_violations(self, user_id, activity_data):
        """
        Detect rate limiting violations and potential abuse
        """
        activity_type = activity_data['type']
        current_time = datetime.utcnow()
        
        # Define rate limits
        rate_limits = {
            'comment_submission': {'count': 60, 'window': 60},    # 60 per minute
            'login_attempt': {'count': 5, 'window': 300},         # 5 per 5 minutes
            'reaction': {'count': 100, 'window': 60}              # 100 per minute
        }
        
        if activity_type in rate_limits:
            limit_config = rate_limits[activity_type]
            window_key = f"rate_limit:{user_id}:{activity_type}:{current_time.minute}"
            
            # Increment counter
            current_count = await self.redis.incr(window_key)
            await self.redis.expire(window_key, limit_config['window'])
            
            # Check if limit exceeded
            if current_count > limit_config['count']:
                await self.handle_rate_limit_violation(user_id, activity_type, current_count)
    
    async def detect_suspicious_behavior(self, user_id, activity_data):
        """
        Detect patterns indicating suspicious or malicious behavior
        """
        suspicious_indicators = []
        
        # Multiple IP addresses in short time
        ip_addresses = await self.get_recent_user_ips(user_id, minutes=30)
        if len(ip_addresses) > 5:
            suspicious_indicators.append('multiple_ips')
        
        # Unusual activity hours
        current_hour = datetime.utcnow().hour
        user_typical_hours = await self.get_user_typical_activity_hours(user_id)
        if current_hour not in user_typical_hours:
            suspicious_indicators.append('unusual_hours')
        
        # Rapid sequential actions
        recent_actions = await self.get_recent_user_actions(user_id, seconds=10)
        if len(recent_actions) > 20:
            suspicious_indicators.append('rapid_actions')
        
        # Geographic anomaly
        current_location = await self.get_ip_geolocation(activity_data['ip_address'])
        typical_locations = await self.get_user_typical_locations(user_id)
        if self.is_geographic_anomaly(current_location, typical_locations):
            suspicious_indicators.append('geographic_anomaly')
        
        # If multiple indicators, flag for investigation
        if len(suspicious_indicators) >= 2:
            await self.flag_suspicious_activity(user_id, suspicious_indicators, activity_data)
    
    async def detect_malicious_content(self, user_id, activity_data):
        """
        Detect malicious content in comments
        """
        content = activity_data.get('content', '')
        
        # Check against known threat patterns
        for pattern_name, pattern_regex in self.threat_patterns.items():
            if re.search(pattern_regex, content, re.IGNORECASE):
                await self.handle_malicious_content_detection(
                    user_id, pattern_name, content, activity_data
                )
        
        # Check for suspicious URLs
        urls = self.extract_urls(content)
        for url in urls:
            threat_level = await self.check_url_reputation(url)
            if threat_level == 'malicious':
                await self.handle_malicious_url_detection(user_id, url, activity_data)
    
    def load_threat_patterns(self):
        """
        Load regex patterns for threat detection
        """
        return {
            'phishing_attempt': r'(click here|verify account|suspended|urgent action)',
            'spam_content': r'(buy now|limited time|act fast|guaranteed)',
            'malware_indicators': r'(download.*exe|install.*now|free.*software)',
            'social_engineering': r'(send me|give me|share your|tell me your)'
        }
    
    async def handle_security_incident(self, incident_type, user_id, details):
        """
        Handle detected security incidents
        """
        incident_id = str(uuid.uuid4())
        
        incident_data = {
            'incident_id': incident_id,
            'type': incident_type,
            'user_id': user_id,
            'severity': self.calculate_incident_severity(incident_type, details),
            'details': details,
            'detected_at': datetime.utcnow().isoformat(),
            'status': 'open'
        }
        
        # Store incident
        await self.db.create_security_incident(incident_data)
        
        # Automated response based on severity
        if incident_data['severity'] == 'critical':
            await self.execute_critical_incident_response(user_id, incident_data)
        elif incident_data['severity'] == 'high':
            await self.execute_high_severity_response(user_id, incident_data)
        
        # Alert security team
        await self.alerts.send_security_alert(incident_data)
        
        return incident_id

# Automated incident response
class IncidentResponseSystem:
    def __init__(self, user_manager, session_manager):
        self.user_manager = user_manager
        self.session_manager = session_manager
        
    async def execute_critical_incident_response(self, user_id, incident_data):
        """
        Automated response for critical security incidents
        """
        # Immediately suspend user account
        await self.user_manager.suspend_user_account(
            user_id, 
            reason="Critical security incident detected",
            incident_id=incident_data['incident_id']
        )
        
        # Terminate all active sessions
        await self.session_manager.terminate_all_user_sessions(user_id)
        
        # Block IP address temporarily
        ip_address = incident_data['details'].get('ip_address')
        if ip_address:
            await self.block_ip_address(ip_address, duration_hours=24)
        
        # Notify user via secure channel
        await self.send_security_notification(user_id, incident_data)
    
    async def execute_high_severity_response(self, user_id, incident_data):
        """
        Automated response for high severity incidents
        """
        # Require additional authentication
        await self.user_manager.require_additional_auth(user_id)
        
        # Limit user actions temporarily
        await self.user_manager.apply_temporary_restrictions(
            user_id,
            restrictions=['comment_creation', 'media_upload'],
            duration_hours=1
        )
        
        # Flag for manual review
        await self.flag_for_manual_review(user_id, incident_data)
```

This comprehensive security and privacy implementation ensures the live comment system meets enterprise-grade security requirements while maintaining compliance with privacy regulations like GDPR.
