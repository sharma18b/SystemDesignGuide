# E-commerce Security and Privacy

## Overview (2 mins)
E-commerce platforms handle sensitive customer data, financial transactions, and business information, making security and privacy paramount. The platform must comply with multiple regulations while protecting against various attack vectors.

## Payment Security and PCI DSS Compliance (5 mins)

### PCI DSS Requirements Implementation
```python
# PCI DSS compliant payment processing
class PCICompliantPaymentProcessor:
    def __init__(self):
        self.encryption_service = AESEncryptionService()
        self.tokenization_service = TokenizationService()
        self.audit_logger = AuditLogger()
        self.access_control = AccessControlService()
    
    def process_payment(self, payment_data, user_context):
        """PCI DSS compliant payment processing"""
        # Requirement 1: Install and maintain firewall configuration
        if not self.validate_network_access(user_context.ip_address):
            raise SecurityException("Access denied from untrusted network")
        
        # Requirement 2: Do not use vendor-supplied defaults
        if self.uses_default_credentials():
            raise SecurityException("Default credentials detected")
        
        # Requirement 3: Protect stored cardholder data
        tokenized_card = self.tokenization_service.tokenize_card(
            card_number=payment_data.card_number,
            expiry=payment_data.expiry,
            cvv=payment_data.cvv
        )
        
        # Never store CVV (PCI DSS requirement)
        payment_request = {
            'card_token': tokenized_card.token,
            'amount': payment_data.amount,
            'currency': payment_data.currency,
            'merchant_id': self.merchant_id,
            # CVV used only for this transaction, not stored
            'cvv': payment_data.cvv
        }
        
        # Requirement 4: Encrypt transmission of cardholder data
        encrypted_request = self.encryption_service.encrypt_tls(payment_request)
        
        # Requirement 10: Track and monitor all access to network resources
        self.audit_logger.log_payment_attempt({
            'user_id': user_context.user_id,
            'ip_address': user_context.ip_address,
            'timestamp': datetime.utcnow(),
            'amount': payment_data.amount,
            'card_last_four': payment_data.card_number[-4:],
            'transaction_id': self.generate_transaction_id()
        })
        
        try:
            # Process with payment gateway
            result = self.payment_gateway.process_payment(encrypted_request)
            
            # Log successful transaction
            self.audit_logger.log_payment_success({
                'transaction_id': result.transaction_id,
                'amount': payment_data.amount,
                'timestamp': datetime.utcnow()
            })
            
            return result
            
        except PaymentException as e:
            # Log failed transaction
            self.audit_logger.log_payment_failure({
                'error': str(e),
                'timestamp': datetime.utcnow(),
                'user_id': user_context.user_id
            })
            raise e
    
    def store_payment_method(self, user_id, card_data):
        """Securely store payment method with tokenization"""
        # Validate user access
        if not self.access_control.can_store_payment_method(user_id):
            raise UnauthorizedException("User cannot store payment methods")
        
        # Tokenize sensitive data
        card_token = self.tokenization_service.tokenize_card(card_data.card_number)
        
        # Store only non-sensitive data
        payment_method = {
            'user_id': user_id,
            'card_token': card_token.token,
            'card_last_four': card_data.card_number[-4:],
            'card_brand': self.detect_card_brand(card_data.card_number),
            'expiry_month': card_data.expiry_month,
            'expiry_year': card_data.expiry_year,
            'billing_address_id': card_data.billing_address_id,
            'created_at': datetime.utcnow()
        }
        
        # Never store full PAN, CVV, or PIN
        return self.payment_method_repository.create(payment_method)

# PCI DSS 12 Requirements:
# 1. Install and maintain firewall configuration
# 2. Do not use vendor-supplied defaults for system passwords
# 3. Protect stored cardholder data
# 4. Encrypt transmission of cardholder data across open networks
# 5. Protect all systems against malware
# 6. Develop and maintain secure systems and applications
# 7. Restrict access to cardholder data by business need-to-know
# 8. Identify and authenticate access to system components
# 9. Restrict physical access to cardholder data
# 10. Track and monitor all access to network resources
# 11. Regularly test security systems and processes
# 12. Maintain a policy that addresses information security
```

### Tokenization and Encryption
```python
class SecurityService:
    def __init__(self):
        self.key_management = KeyManagementService()
        self.hsm = HardwareSecurityModule()
    
    def tokenize_sensitive_data(self, sensitive_data, data_type):
        """Replace sensitive data with non-sensitive tokens"""
        if data_type == 'credit_card':
            # Format-preserving tokenization for credit cards
            token = self.generate_format_preserving_token(
                sensitive_data,
                preserve_last_four=True
            )
        elif data_type == 'ssn':
            # Random tokenization for SSN
            token = self.generate_random_token(length=11, format='XXX-XX-XXXX')
        else:
            token = self.generate_uuid_token()
        
        # Store mapping in secure token vault
        self.token_vault.store_mapping(
            token=token,
            original_value=sensitive_data,
            data_type=data_type,
            created_at=datetime.utcnow()
        )
        
        return token
    
    def encrypt_at_rest(self, data, classification='confidential'):
        """Encrypt data for storage"""
        # Get appropriate encryption key based on data classification
        encryption_key = self.key_management.get_encryption_key(classification)
        
        # Use AES-256-GCM for authenticated encryption
        encrypted_data = self.hsm.encrypt_aes_gcm(
            plaintext=data,
            key=encryption_key,
            additional_data=self.get_additional_auth_data()
        )
        
        return {
            'encrypted_data': encrypted_data.ciphertext,
            'nonce': encrypted_data.nonce,
            'tag': encrypted_data.tag,
            'key_id': encryption_key.key_id,
            'algorithm': 'AES-256-GCM'
        }
    
    def encrypt_in_transit(self, data, destination):
        """Encrypt data for transmission"""
        # Use TLS 1.3 for transport encryption
        tls_context = ssl.create_default_context()
        tls_context.minimum_version = ssl.TLSVersion.TLSv1_3
        
        # Additional application-layer encryption for sensitive data
        if self.is_sensitive_data(data):
            app_encrypted = self.encrypt_with_recipient_key(data, destination)
            return app_encrypted
        
        return data
```

## Fraud Detection and Prevention (4 mins)

### Real-time Fraud Detection System
```python
class FraudDetectionService:
    def __init__(self):
        self.ml_model = FraudDetectionModel()
        self.rule_engine = FraudRuleEngine()
        self.risk_scorer = RiskScoringService()
        self.device_fingerprinting = DeviceFingerprintingService()
    
    def evaluate_transaction_risk(self, transaction_data, user_context):
        """Real-time fraud evaluation"""
        risk_signals = self.collect_risk_signals(transaction_data, user_context)
        
        # Rule-based checks (fast, deterministic)
        rule_score = self.rule_engine.evaluate_rules(risk_signals)
        
        # Machine learning model (more sophisticated)
        ml_score = self.ml_model.predict_fraud_probability(risk_signals)
        
        # Combine scores
        final_risk_score = self.combine_risk_scores(rule_score, ml_score)
        
        # Make decision based on risk score
        decision = self.make_fraud_decision(final_risk_score, transaction_data)
        
        # Log for model training and audit
        self.log_fraud_evaluation({
            'transaction_id': transaction_data.transaction_id,
            'risk_score': final_risk_score,
            'decision': decision,
            'signals': risk_signals,
            'timestamp': datetime.utcnow()
        })
        
        return decision
    
    def collect_risk_signals(self, transaction_data, user_context):
        """Collect various risk indicators"""
        signals = {}
        
        # Transaction-based signals
        signals['transaction_amount'] = transaction_data.amount
        signals['transaction_time'] = transaction_data.timestamp.hour
        signals['payment_method'] = transaction_data.payment_method
        signals['shipping_address_match'] = self.check_address_match(
            transaction_data.billing_address,
            transaction_data.shipping_address
        )
        
        # User behavior signals
        user_history = self.get_user_transaction_history(user_context.user_id)
        signals['avg_transaction_amount'] = user_history.avg_amount
        signals['transaction_frequency'] = user_history.frequency
        signals['account_age_days'] = (datetime.utcnow() - user_context.account_created).days
        
        # Device and location signals
        device_info = self.device_fingerprinting.get_device_info(user_context)
        signals['device_fingerprint'] = device_info.fingerprint
        signals['is_new_device'] = device_info.is_new_device
        signals['ip_address'] = user_context.ip_address
        signals['geolocation'] = self.get_geolocation(user_context.ip_address)
        signals['velocity_check'] = self.check_velocity(user_context.user_id)
        
        # Network and technical signals
        signals['tor_usage'] = self.check_tor_usage(user_context.ip_address)
        signals['proxy_usage'] = self.check_proxy_usage(user_context.ip_address)
        signals['browser_fingerprint'] = user_context.browser_fingerprint
        
        return signals
    
    def make_fraud_decision(self, risk_score, transaction_data):
        """Make fraud decision based on risk score"""
        if risk_score >= 0.9:
            return {
                'decision': 'BLOCK',
                'reason': 'High fraud risk',
                'risk_score': risk_score,
                'recommended_action': 'Block transaction and flag account'
            }
        elif risk_score >= 0.7:
            return {
                'decision': 'CHALLENGE',
                'reason': 'Medium fraud risk',
                'risk_score': risk_score,
                'recommended_action': 'Require additional authentication',
                'challenge_methods': ['sms_otp', 'email_verification', 'security_questions']
            }
        elif risk_score >= 0.3:
            return {
                'decision': 'MONITOR',
                'reason': 'Low-medium fraud risk',
                'risk_score': risk_score,
                'recommended_action': 'Allow but monitor closely'
            }
        else:
            return {
                'decision': 'ALLOW',
                'reason': 'Low fraud risk',
                'risk_score': risk_score,
                'recommended_action': 'Process normally'
            }
    
    def handle_fraud_challenge(self, transaction_id, challenge_response):
        """Handle additional authentication challenges"""
        transaction = self.get_transaction(transaction_id)
        
        if challenge_response.method == 'sms_otp':
            if self.verify_sms_otp(transaction.user_id, challenge_response.otp):
                return self.approve_transaction(transaction_id)
            else:
                return self.block_transaction(transaction_id, 'Failed OTP verification')
        
        elif challenge_response.method == 'email_verification':
            if self.verify_email_token(transaction.user_id, challenge_response.token):
                return self.approve_transaction(transaction_id)
            else:
                return self.block_transaction(transaction_id, 'Failed email verification')
```

### Fraud Rule Engine
```python
class FraudRuleEngine:
    def __init__(self):
        self.rules = self.load_fraud_rules()
    
    def load_fraud_rules(self):
        """Load configurable fraud detection rules"""
        return [
            # Velocity rules
            {
                'name': 'high_velocity_transactions',
                'condition': lambda signals: signals.get('transactions_last_hour', 0) > 10,
                'risk_score': 0.8,
                'description': 'More than 10 transactions in last hour'
            },
            
            # Amount-based rules
            {
                'name': 'unusually_high_amount',
                'condition': lambda signals: (
                    signals.get('transaction_amount', 0) > 
                    signals.get('avg_transaction_amount', 0) * 10
                ),
                'risk_score': 0.6,
                'description': 'Transaction amount 10x higher than user average'
            },
            
            # Geographic rules
            {
                'name': 'impossible_travel',
                'condition': lambda signals: self.check_impossible_travel(signals),
                'risk_score': 0.9,
                'description': 'Transaction from impossible geographic location'
            },
            
            # Device rules
            {
                'name': 'new_device_high_amount',
                'condition': lambda signals: (
                    signals.get('is_new_device', False) and 
                    signals.get('transaction_amount', 0) > 1000
                ),
                'risk_score': 0.5,
                'description': 'High amount transaction from new device'
            },
            
            # Time-based rules
            {
                'name': 'unusual_time',
                'condition': lambda signals: (
                    signals.get('transaction_time', 12) < 6 or 
                    signals.get('transaction_time', 12) > 23
                ),
                'risk_score': 0.3,
                'description': 'Transaction at unusual hours'
            }
        ]
    
    def evaluate_rules(self, signals):
        """Evaluate all fraud rules against transaction signals"""
        triggered_rules = []
        total_risk_score = 0
        
        for rule in self.rules:
            try:
                if rule['condition'](signals):
                    triggered_rules.append(rule['name'])
                    total_risk_score += rule['risk_score']
            except Exception as e:
                # Log rule evaluation error but continue
                logger.error(f"Error evaluating rule {rule['name']}: {e}")
        
        # Normalize risk score to 0-1 range
        normalized_score = min(total_risk_score, 1.0)
        
        return {
            'risk_score': normalized_score,
            'triggered_rules': triggered_rules,
            'rule_count': len(triggered_rules)
        }
```

## Data Privacy and GDPR Compliance (4 mins)

### GDPR Implementation
```python
class GDPRComplianceService:
    def __init__(self):
        self.data_mapper = PersonalDataMapper()
        self.consent_manager = ConsentManager()
        self.audit_logger = AuditLogger()
    
    def handle_data_subject_request(self, request_type, user_id, request_data):
        """Handle GDPR data subject requests"""
        # Verify user identity
        if not self.verify_user_identity(user_id, request_data.identity_proof):
            raise IdentityVerificationException("Cannot verify user identity")
        
        # Log the request
        self.audit_logger.log_gdpr_request({
            'request_type': request_type,
            'user_id': user_id,
            'timestamp': datetime.utcnow(),
            'ip_address': request_data.ip_address
        })
        
        if request_type == 'access':
            return self.handle_data_access_request(user_id)
        elif request_type == 'portability':
            return self.handle_data_portability_request(user_id)
        elif request_type == 'rectification':
            return self.handle_data_rectification_request(user_id, request_data)
        elif request_type == 'erasure':
            return self.handle_data_erasure_request(user_id)
        elif request_type == 'restriction':
            return self.handle_processing_restriction_request(user_id)
        else:
            raise InvalidRequestException(f"Unknown request type: {request_type}")
    
    def handle_data_access_request(self, user_id):
        """Right of access - provide all personal data"""
        personal_data = {}
        
        # Collect data from all systems
        data_sources = self.data_mapper.get_data_sources_for_user(user_id)
        
        for source in data_sources:
            try:
                source_data = source.extract_personal_data(user_id)
                personal_data[source.name] = source_data
            except Exception as e:
                logger.error(f"Error extracting data from {source.name}: {e}")
                personal_data[source.name] = {'error': 'Data extraction failed'}
        
        # Include consent history
        personal_data['consent_history'] = self.consent_manager.get_consent_history(user_id)
        
        # Include processing activities
        personal_data['processing_activities'] = self.get_processing_activities(user_id)
        
        # Generate portable format
        return self.generate_data_export(personal_data, format='json')
    
    def handle_data_erasure_request(self, user_id):
        """Right to be forgotten - delete personal data"""
        # Check if erasure is legally possible
        legal_check = self.check_erasure_legality(user_id)
        if not legal_check.can_erase:
            return {
                'status': 'rejected',
                'reason': legal_check.reason,
                'legal_basis': legal_check.legal_basis
            }
        
        # Get all data locations
        data_locations = self.data_mapper.get_all_data_locations(user_id)
        
        erasure_results = []
        
        for location in data_locations:
            try:
                if location.can_be_erased:
                    result = location.erase_personal_data(user_id)
                    erasure_results.append({
                        'location': location.name,
                        'status': 'erased',
                        'timestamp': datetime.utcnow()
                    })
                else:
                    # Anonymize instead of delete
                    result = location.anonymize_personal_data(user_id)
                    erasure_results.append({
                        'location': location.name,
                        'status': 'anonymized',
                        'reason': location.retention_reason,
                        'timestamp': datetime.utcnow()
                    })
            except Exception as e:
                erasure_results.append({
                    'location': location.name,
                    'status': 'failed',
                    'error': str(e),
                    'timestamp': datetime.utcnow()
                })
        
        # Update user account status
        self.mark_account_as_erased(user_id)
        
        return {
            'status': 'completed',
            'erasure_results': erasure_results,
            'completion_date': datetime.utcnow()
        }
    
    def manage_consent(self, user_id, consent_data):
        """Manage user consent for data processing"""
        consent_record = {
            'user_id': user_id,
            'processing_purposes': consent_data.purposes,
            'consent_given': consent_data.consent_given,
            'consent_method': consent_data.method,  # 'explicit', 'opt_in', 'legitimate_interest'
            'timestamp': datetime.utcnow(),
            'ip_address': consent_data.ip_address,
            'user_agent': consent_data.user_agent,
            'consent_version': consent_data.privacy_policy_version
        }
        
        # Store consent record
        self.consent_manager.store_consent(consent_record)
        
        # Update processing permissions
        for purpose in consent_data.purposes:
            self.update_processing_permission(user_id, purpose, consent_data.consent_given)
        
        return consent_record
    
    def check_processing_lawfulness(self, user_id, processing_purpose):
        """Check if data processing is lawful under GDPR"""
        # Check consent
        consent = self.consent_manager.get_current_consent(user_id, processing_purpose)
        if consent and consent.is_valid:
            return {'lawful': True, 'basis': 'consent'}
        
        # Check legitimate interest
        if self.has_legitimate_interest(processing_purpose):
            return {'lawful': True, 'basis': 'legitimate_interest'}
        
        # Check contractual necessity
        if self.is_contractually_necessary(user_id, processing_purpose):
            return {'lawful': True, 'basis': 'contract'}
        
        # Check legal obligation
        if self.is_legal_obligation(processing_purpose):
            return {'lawful': True, 'basis': 'legal_obligation'}
        
        return {'lawful': False, 'basis': None}
```

### Data Anonymization and Pseudonymization
```python
class DataAnonymizationService:
    def __init__(self):
        self.k_anonymity_threshold = 5
        self.l_diversity_threshold = 3
    
    def anonymize_user_data(self, user_data, anonymization_level='high'):
        """Anonymize personal data while preserving utility"""
        if anonymization_level == 'high':
            return self.full_anonymization(user_data)
        elif anonymization_level == 'medium':
            return self.pseudonymization(user_data)
        else:
            return self.basic_anonymization(user_data)
    
    def full_anonymization(self, user_data):
        """Full anonymization - irreversible"""
        anonymized = {}
        
        # Remove direct identifiers
        direct_identifiers = ['name', 'email', 'phone', 'ssn', 'address']
        for field in direct_identifiers:
            if field in user_data:
                del user_data[field]
        
        # Generalize quasi-identifiers
        if 'age' in user_data:
            anonymized['age_group'] = self.generalize_age(user_data['age'])
        
        if 'zip_code' in user_data:
            anonymized['region'] = self.generalize_location(user_data['zip_code'])
        
        if 'income' in user_data:
            anonymized['income_bracket'] = self.generalize_income(user_data['income'])
        
        # Add noise to sensitive attributes
        if 'purchase_amount' in user_data:
            anonymized['purchase_amount'] = self.add_differential_privacy_noise(
                user_data['purchase_amount']
            )
        
        return anonymized
    
    def pseudonymization(self, user_data):
        """Pseudonymization - reversible with key"""
        pseudonymized = user_data.copy()
        
        # Replace identifiers with pseudonyms
        if 'user_id' in user_data:
            pseudonymized['user_id'] = self.generate_pseudonym(user_data['user_id'])
        
        if 'email' in user_data:
            pseudonymized['email'] = self.generate_pseudonym(user_data['email'])
        
        # Encrypt sensitive fields
        sensitive_fields = ['name', 'phone', 'address']
        for field in sensitive_fields:
            if field in user_data:
                pseudonymized[field] = self.encrypt_field(user_data[field])
        
        return pseudonymized
```

## Security Monitoring and Incident Response (3 mins)

### Security Monitoring System
```python
class SecurityMonitoringService:
    def __init__(self):
        self.siem = SecurityInformationEventManagement()
        self.threat_intelligence = ThreatIntelligenceService()
        self.incident_response = IncidentResponseService()
    
    def monitor_security_events(self):
        """Continuous security monitoring"""
        security_rules = [
            # Authentication anomalies
            {
                'name': 'multiple_failed_logins',
                'query': 'event_type:login_failed AND count > 5 AND timeframe:5m',
                'severity': 'medium',
                'action': 'lock_account'
            },
            
            # Suspicious transactions
            {
                'name': 'high_risk_transaction',
                'query': 'event_type:transaction AND fraud_score > 0.8',
                'severity': 'high',
                'action': 'block_transaction'
            },
            
            # Data access anomalies
            {
                'name': 'unusual_data_access',
                'query': 'event_type:data_access AND access_pattern:anomalous',
                'severity': 'high',
                'action': 'alert_security_team'
            },
            
            # Infrastructure attacks
            {
                'name': 'sql_injection_attempt',
                'query': 'event_type:web_request AND payload:sql_injection',
                'severity': 'critical',
                'action': 'block_ip'
            }
        ]
        
        for rule in security_rules:
            events = self.siem.query_events(rule['query'])
            if events:
                self.handle_security_alert(rule, events)
    
    def handle_security_alert(self, rule, events):
        """Handle detected security events"""
        alert = {
            'rule_name': rule['name'],
            'severity': rule['severity'],
            'event_count': len(events),
            'timestamp': datetime.utcnow(),
            'events': events
        }
        
        # Automatic response
        if rule['action'] == 'block_ip':
            for event in events:
                self.firewall.block_ip(event.source_ip)
        elif rule['action'] == 'lock_account':
            for event in events:
                self.account_service.lock_account(event.user_id)
        
        # Alert security team for high/critical severity
        if rule['severity'] in ['high', 'critical']:
            self.incident_response.create_incident(alert)
            self.notification_service.alert_security_team(alert)
        
        return alert
    
    def perform_security_audit(self):
        """Regular security audit"""
        audit_results = {
            'access_review': self.audit_user_access(),
            'permission_review': self.audit_permissions(),
            'encryption_review': self.audit_encryption_status(),
            'vulnerability_scan': self.perform_vulnerability_scan(),
            'compliance_check': self.check_compliance_status()
        }
        
        return audit_results
```

### Incident Response Plan
```python
class IncidentResponseService:
    def __init__(self):
        self.severity_levels = {
            'critical': {'response_time': 15, 'escalation_time': 30},  # minutes
            'high': {'response_time': 60, 'escalation_time': 120},
            'medium': {'response_time': 240, 'escalation_time': 480},
            'low': {'response_time': 1440, 'escalation_time': 2880}  # 24/48 hours
        }
    
    def create_incident(self, security_alert):
        """Create security incident"""
        incident = {
            'incident_id': self.generate_incident_id(),
            'severity': security_alert['severity'],
            'title': f"Security Alert: {security_alert['rule_name']}",
            'description': self.generate_incident_description(security_alert),
            'status': 'open',
            'created_at': datetime.utcnow(),
            'assigned_to': self.get_on_call_security_engineer(),
            'affected_systems': self.identify_affected_systems(security_alert),
            'response_plan': self.get_response_plan(security_alert['rule_name'])
        }
        
        # Start incident response timer
        self.start_response_timer(incident)
        
        return incident
    
    def execute_incident_response(self, incident_id):
        """Execute incident response plan"""
        incident = self.get_incident(incident_id)
        
        response_steps = [
            'contain_threat',
            'assess_impact',
            'collect_evidence',
            'remediate_vulnerability',
            'restore_services',
            'document_lessons_learned'
        ]
        
        for step in response_steps:
            try:
                result = getattr(self, step)(incident)
                self.update_incident_progress(incident_id, step, result)
            except Exception as e:
                self.log_incident_error(incident_id, step, str(e))
                if incident['severity'] == 'critical':
                    self.escalate_incident(incident_id)
        
        return self.close_incident(incident_id)
```

## Key Security Metrics and KPIs

### Security Dashboard Metrics
```python
SECURITY_METRICS = {
    'authentication': {
        'failed_login_rate': '< 5%',
        'account_lockout_rate': '< 1%',
        'mfa_adoption_rate': '> 95%'
    },
    'fraud_detection': {
        'fraud_detection_rate': '> 99%',
        'false_positive_rate': '< 2%',
        'transaction_review_time': '< 30 seconds'
    },
    'data_protection': {
        'encryption_coverage': '100%',
        'data_breach_incidents': '0',
        'gdpr_request_response_time': '< 30 days'
    },
    'incident_response': {
        'mean_time_to_detection': '< 15 minutes',
        'mean_time_to_response': '< 1 hour',
        'incident_resolution_time': '< 24 hours'
    }
}
```
