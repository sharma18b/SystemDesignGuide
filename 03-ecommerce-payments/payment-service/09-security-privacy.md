# Payment Service - Security and Privacy

## PCI DSS Level 1 Compliance

### The 12 PCI DSS Requirements

**Requirement 1: Install and maintain a firewall configuration**
```yaml
# Network security configuration
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: payment-processing-isolation
spec:
  podSelector:
    matchLabels:
      app: payment-processor
      pci-scope: "true"
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: api-gateway
          pci-authorized: "true"
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: payment-gateway
    ports:
    - protocol: TCP
      port: 443
  - to: []  # DNS only
    ports:
    - protocol: UDP
      port: 53
```

**Requirement 3: Protect stored cardholder data**
```python
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os

class PCICompliantEncryption:
    def __init__(self, master_key: str):
        self.master_key = master_key.encode()
        
    def derive_encryption_key(self, context: str, salt: bytes = None) -> bytes:
        """Derive encryption key using PBKDF2"""
        if salt is None:
            salt = os.urandom(16)
            
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt + context.encode(),
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(self.master_key))
        return key
    
    def encrypt_cardholder_data(self, card_data: dict) -> dict:
        """Encrypt sensitive cardholder data"""
        
        # Never store full PAN - use tokenization instead
        if 'number' in card_data:
            # Store only last 4 digits
            last_four = card_data['number'][-4:]
            # Hash full number for fingerprinting
            card_hash = hashlib.sha256(card_data['number'].encode()).hexdigest()
            
            # Remove full PAN from data
            encrypted_data = {k: v for k, v in card_data.items() if k != 'number'}
            encrypted_data['last_four'] = last_four
            encrypted_data['fingerprint'] = card_hash[:16]
        else:
            encrypted_data = card_data.copy()
        
        # Encrypt remaining sensitive data
        key = self.derive_encryption_key('cardholder_data')
        cipher = Fernet(key)
        
        sensitive_fields = ['exp_month', 'exp_year', 'cardholder_name']
        for field in sensitive_fields:
            if field in encrypted_data:
                encrypted_value = cipher.encrypt(str(encrypted_data[field]).encode())
                encrypted_data[field] = base64.urlsafe_b64encode(encrypted_value).decode()
        
        return encrypted_data

class CardDataTokenizer:
    def __init__(self, vault_service):
        self.vault = vault_service
        self.token_prefix = "tok_"
        
    async def tokenize_card(self, card_data: dict, merchant_id: str) -> str:
        """Replace card data with secure token"""
        
        # Generate cryptographically secure token
        token = self.token_prefix + secrets.token_urlsafe(32)
        
        # Store encrypted card data in separate, secured vault
        await self.vault.store_encrypted_card_data(
            token=token,
            card_data=card_data,
            merchant_id=merchant_id,
            encryption_context={'purpose': 'payment_processing'}
        )
        
        # Return token - no sensitive data leaves this function
        return token
    
    async def process_payment_with_token(
        self, 
        token: str, 
        amount: int, 
        merchant_id: str
    ) -> dict:
        """Process payment using token without exposing card data"""
        
        # Retrieve card data from vault (restricted access)
        card_data = await self.vault.retrieve_card_data(
            token=token,
            merchant_id=merchant_id,
            purpose='payment_processing'
        )
        
        # Process payment with gateway
        payment_result = await self.payment_gateway.charge(
            card_data=card_data,
            amount=amount,
            merchant_id=merchant_id
        )
        
        # Clear card data from memory immediately
        del card_data
        
        return {
            'success': payment_result.success,
            'transaction_id': payment_result.transaction_id,
            'status': payment_result.status
            # No card data in response
        }
```

**Requirement 4: Encrypt transmission of cardholder data**
```python
import ssl
import asyncio
from aiohttp import ClientSession, TCPConnector

class SecurePaymentGatewayClient:
    def __init__(self):
        # Configure TLS 1.3 with strong cipher suites
        self.ssl_context = ssl.create_default_context()
        self.ssl_context.minimum_version = ssl.TLSVersion.TLSv1_2
        self.ssl_context.set_ciphers('ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS')
        
        # Certificate pinning for payment gateways
        self.ssl_context.check_hostname = True
        self.ssl_context.verify_mode = ssl.CERT_REQUIRED
        
    async def send_payment_request(self, gateway_url: str, payment_data: dict) -> dict:
        """Send payment request with end-to-end encryption"""
        
        connector = TCPConnector(ssl=self.ssl_context)
        
        async with ClientSession(connector=connector) as session:
            # Add additional encryption layer for sensitive data
            encrypted_payload = await self.encrypt_payment_payload(payment_data)
            
            async with session.post(
                gateway_url,
                json=encrypted_payload,
                headers={
                    'Content-Type': 'application/json',
                    'X-Encryption-Version': '1.0',
                    'User-Agent': 'PaymentService/1.0'
                },
                timeout=30
            ) as response:
                
                if response.status == 200:
                    encrypted_response = await response.json()
                    return await self.decrypt_payment_response(encrypted_response)
                else:
                    raise PaymentGatewayException(f"Gateway error: {response.status}")
    
    async def encrypt_payment_payload(self, payment_data: dict) -> dict:
        """Add application-level encryption on top of TLS"""
        
        # Use gateway's public key for encryption
        gateway_public_key = await self.get_gateway_public_key()
        
        # Encrypt sensitive fields
        sensitive_data = {
            'card_number': payment_data.get('card_number'),
            'cvv': payment_data.get('cvv'),
            'exp_date': payment_data.get('exp_date')
        }
        
        encrypted_sensitive = self.rsa_encrypt(
            json.dumps(sensitive_data),
            gateway_public_key
        )
        
        # Return payload with encrypted sensitive data
        return {
            'amount': payment_data['amount'],
            'currency': payment_data['currency'],
            'merchant_id': payment_data['merchant_id'],
            'encrypted_card_data': encrypted_sensitive,
            'timestamp': int(time.time())
        }
```

## Advanced Fraud Detection

### Machine Learning Fraud Models
```python
import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import joblib

class AdvancedFraudDetection:
    def __init__(self):
        # Load pre-trained models
        self.isolation_forest = joblib.load('models/anomaly_detection_model.pkl')
        self.random_forest = joblib.load('models/fraud_classification_model.pkl')
        self.feature_scaler = joblib.load('models/feature_scaler.pkl')
        
        # Risk thresholds
        self.risk_thresholds = {
            'low': 0.2,
            'medium': 0.5,
            'high': 0.8,
            'critical': 0.95
        }
        
    async def comprehensive_fraud_analysis(
        self, 
        transaction: dict,
        merchant_context: dict,
        customer_history: dict
    ) -> dict:
        """Multi-layered fraud detection analysis"""
        
        # Extract comprehensive feature set
        features = await self.extract_fraud_features(
            transaction, merchant_context, customer_history
        )
        
        # Normalize features
        normalized_features = self.feature_scaler.transform([features])
        
        # Anomaly detection (unsupervised)
        anomaly_score = self.isolation_forest.decision_function(normalized_features)[0]
        is_anomaly = self.isolation_forest.predict(normalized_features)[0] == -1
        
        # Fraud classification (supervised)
        fraud_probability = self.random_forest.predict_proba(normalized_features)[0][1]
        
        # Velocity checks
        velocity_violations = await self.check_velocity_patterns(transaction)
        
        # Device fingerprinting
        device_risk = await self.analyze_device_fingerprint(transaction.get('device_info'))
        
        # Geolocation analysis
        geo_risk = await self.analyze_geolocation_risk(
            transaction.get('ip_address'),
            customer_history.get('usual_locations', [])
        )
        
        # Combine all risk signals
        combined_risk_score = self.calculate_combined_risk_score(
            fraud_probability=fraud_probability,
            anomaly_score=anomaly_score,
            velocity_violations=velocity_violations,
            device_risk=device_risk,
            geo_risk=geo_risk
        )
        
        return {
            'risk_score': combined_risk_score,
            'risk_level': self.get_risk_level(combined_risk_score),
            'fraud_probability': fraud_probability,
            'is_anomaly': is_anomaly,
            'risk_factors': {
                'velocity_violations': velocity_violations,
                'device_risk': device_risk,
                'geo_risk': geo_risk,
                'anomaly_detected': is_anomaly
            },
            'recommendation': self.get_fraud_recommendation(combined_risk_score),
            'required_actions': self.get_required_actions(combined_risk_score)
        }
    
    async def extract_fraud_features(
        self, 
        transaction: dict,
        merchant_context: dict,
        customer_history: dict
    ) -> list:
        """Extract comprehensive feature set for fraud detection"""
        
        features = []
        
        # Transaction features
        features.extend([
            float(transaction['amount']),
            len(transaction.get('description', '')),
            transaction.get('hour_of_day', 0),
            transaction.get('day_of_week', 0),
            1 if transaction.get('is_weekend') else 0,
            1 if transaction.get('is_holiday') else 0
        ])
        
        # Customer behavioral features
        if customer_history:
            features.extend([
                customer_history.get('avg_transaction_amount', 0),
                customer_history.get('transaction_count', 0),
                customer_history.get('days_since_first_transaction', 0),
                customer_history.get('failed_payment_rate', 0),
                customer_history.get('chargeback_rate', 0),
                len(customer_history.get('used_payment_methods', [])),
                len(customer_history.get('shipping_addresses', []))
            ])
        else:
            features.extend([0] * 7)  # New customer
        
        # Merchant risk features
        features.extend([
            merchant_context.get('avg_transaction_amount', 0),
            merchant_context.get('chargeback_rate', 0),
            merchant_context.get('refund_rate', 0),
            merchant_context.get('days_since_registration', 0),
            merchant_context.get('risk_score', 0.5)
        ])
        
        # Payment method features
        payment_method = transaction.get('payment_method', {})
        features.extend([
            1 if payment_method.get('type') == 'credit' else 0,
            1 if payment_method.get('type') == 'debit' else 0,
            1 if payment_method.get('is_prepaid') else 0,
            payment_method.get('issuer_risk_score', 0.5),
            1 if payment_method.get('country') != merchant_context.get('country') else 0
        ])
        
        return features
    
    async def check_velocity_patterns(self, transaction: dict) -> list:
        """Check for suspicious velocity patterns"""
        
        violations = []
        customer_id = transaction.get('customer_id')
        
        if not customer_id:
            return violations
        
        # Check transaction frequency
        recent_transactions = await self.get_recent_transactions(
            customer_id, 
            hours=1
        )
        
        if len(recent_transactions) > 5:
            violations.append('high_frequency_transactions')
        
        # Check amount velocity
        total_amount_1h = sum(t['amount'] for t in recent_transactions)
        if total_amount_1h > 10000:  # $100 in 1 hour
            violations.append('high_amount_velocity')
        
        # Check failed attempts
        failed_attempts = [t for t in recent_transactions if t['status'] == 'failed']
        if len(failed_attempts) > 3:
            violations.append('multiple_failed_attempts')
        
        # Check geographic velocity
        locations = [t.get('location') for t in recent_transactions if t.get('location')]
        if len(set(locations)) > 2:
            violations.append('impossible_travel')
        
        return violations
    
    def calculate_combined_risk_score(
        self,
        fraud_probability: float,
        anomaly_score: float,
        velocity_violations: list,
        device_risk: dict,
        geo_risk: dict
    ) -> float:
        """Combine multiple risk signals into final score"""
        
        # Base score from ML models (60% weight)
        base_score = fraud_probability * 0.6
        
        # Anomaly detection (20% weight)
        anomaly_contribution = (1 - (anomaly_score + 1) / 2) * 0.2
        
        # Velocity violations (10% weight)
        velocity_score = min(len(velocity_violations) * 0.25, 1.0) * 0.1
        
        # Device risk (5% weight)
        device_score = device_risk.get('risk_score', 0) * 0.05
        
        # Geographic risk (5% weight)
        geo_score = geo_risk.get('risk_score', 0) * 0.05
        
        combined_score = (
            base_score + 
            anomaly_contribution + 
            velocity_score + 
            device_score + 
            geo_score
        )
        
        return min(combined_score, 1.0)
```

### Real-time Risk Scoring
```python
import asyncio
from dataclasses import dataclass
from typing import Dict, List

@dataclass
class RiskSignal:
    signal_type: str
    risk_score: float
    confidence: float
    details: dict

class RealTimeFraudScoring:
    def __init__(self):
        self.risk_engines = {
            'ml_model': MLFraudEngine(),
            'rule_engine': RuleBasedEngine(),
            'velocity_engine': VelocityEngine(),
            'device_engine': DeviceFingerprintEngine(),
            'network_engine': NetworkAnalysisEngine()
        }
        
    async def score_transaction_realtime(
        self, 
        transaction: dict,
        timeout_ms: int = 100
    ) -> dict:
        """Score transaction with sub-100ms latency requirement"""
        
        start_time = asyncio.get_event_loop().time()
        
        # Run all risk engines in parallel
        tasks = []
        for engine_name, engine in self.risk_engines.items():
            task = asyncio.create_task(
                self.run_risk_engine_with_timeout(
                    engine, transaction, timeout_ms // len(self.risk_engines)
                )
            )
            tasks.append((engine_name, task))
        
        # Collect results as they complete
        risk_signals = []
        for engine_name, task in tasks:
            try:
                signal = await task
                if signal:
                    risk_signals.append(signal)
            except asyncio.TimeoutError:
                # Log timeout but continue with other signals
                logger.warning(f"Risk engine {engine_name} timed out")
                continue
        
        # Calculate final risk score
        final_score = self.aggregate_risk_signals(risk_signals)
        
        processing_time = (asyncio.get_event_loop().time() - start_time) * 1000
        
        return {
            'risk_score': final_score['score'],
            'risk_level': final_score['level'],
            'processing_time_ms': processing_time,
            'signals_processed': len(risk_signals),
            'recommendation': final_score['recommendation']
        }
    
    async def run_risk_engine_with_timeout(
        self, 
        engine, 
        transaction: dict, 
        timeout_ms: int
    ) -> RiskSignal:
        """Run individual risk engine with timeout"""
        
        try:
            return await asyncio.wait_for(
                engine.analyze(transaction),
                timeout=timeout_ms / 1000
            )
        except asyncio.TimeoutError:
            return None
    
    def aggregate_risk_signals(self, signals: List[RiskSignal]) -> dict:
        """Aggregate multiple risk signals into final score"""
        
        if not signals:
            return {'score': 0.0, 'level': 'low', 'recommendation': 'approve'}
        
        # Weighted average based on confidence
        total_weight = sum(signal.confidence for signal in signals)
        weighted_score = sum(
            signal.risk_score * signal.confidence 
            for signal in signals
        ) / total_weight if total_weight > 0 else 0
        
        # Determine risk level and recommendation
        if weighted_score >= 0.8:
            level = 'critical'
            recommendation = 'block'
        elif weighted_score >= 0.6:
            level = 'high'
            recommendation = 'review'
        elif weighted_score >= 0.3:
            level = 'medium'
            recommendation = 'monitor'
        else:
            level = 'low'
            recommendation = 'approve'
        
        return {
            'score': weighted_score,
            'level': level,
            'recommendation': recommendation,
            'signal_count': len(signals)
        }
```

## Data Privacy and GDPR Compliance

### Personal Data Management
```python
from enum import Enum
from dataclasses import dataclass
from typing import List, Optional

class DataCategory(Enum):
    PAYMENT_DATA = "payment_data"
    PERSONAL_INFO = "personal_info"
    BEHAVIORAL_DATA = "behavioral_data"
    TECHNICAL_DATA = "technical_data"

@dataclass
class DataRetentionPolicy:
    category: DataCategory
    retention_days: int
    legal_basis: str
    can_be_deleted: bool

class GDPRComplianceManager:
    def __init__(self):
        self.retention_policies = {
            DataCategory.PAYMENT_DATA: DataRetentionPolicy(
                category=DataCategory.PAYMENT_DATA,
                retention_days=2555,  # 7 years for financial records
                legal_basis="legal_obligation",
                can_be_deleted=False
            ),
            DataCategory.PERSONAL_INFO: DataRetentionPolicy(
                category=DataCategory.PERSONAL_INFO,
                retention_days=1095,  # 3 years
                legal_basis="legitimate_interest",
                can_be_deleted=True
            ),
            DataCategory.BEHAVIORAL_DATA: DataRetentionPolicy(
                category=DataCategory.BEHAVIORAL_DATA,
                retention_days=730,  # 2 years
                legal_basis="consent",
                can_be_deleted=True
            )
        }
    
    async def handle_data_subject_request(
        self,
        request_type: str,
        customer_id: str,
        merchant_id: str
    ) -> dict:
        """Handle GDPR data subject rights requests"""
        
        if request_type == "access":
            return await self.export_customer_data(customer_id, merchant_id)
        elif request_type == "deletion":
            return await self.delete_customer_data(customer_id, merchant_id)
        elif request_type == "portability":
            return await self.export_portable_data(customer_id, merchant_id)
        elif request_type == "rectification":
            return await self.update_customer_data(customer_id, merchant_id)
        else:
            raise ValueError(f"Unsupported request type: {request_type}")
    
    async def export_customer_data(self, customer_id: str, merchant_id: str) -> dict:
        """Export all customer data for access request"""
        
        customer_data = {}
        
        # Personal information
        personal_info = await self.get_customer_personal_info(customer_id, merchant_id)
        customer_data['personal_information'] = personal_info
        
        # Payment methods (tokenized data only)
        payment_methods = await self.get_customer_payment_methods(customer_id, merchant_id)
        customer_data['payment_methods'] = [
            {
                'id': pm['token'],
                'type': pm['type'],
                'last_four': pm['last_four'],
                'brand': pm['brand'],
                'created_at': pm['created_at']
            }
            for pm in payment_methods
        ]
        
        # Transaction history
        transactions = await self.get_customer_transactions(customer_id, merchant_id)
        customer_data['transactions'] = [
            {
                'id': tx['id'],
                'amount': tx['amount'],
                'currency': tx['currency'],
                'status': tx['status'],
                'created_at': tx['created_at'],
                'description': tx['description']
            }
            for tx in transactions
        ]
        
        # Behavioral data (if consent given)
        if await self.has_behavioral_data_consent(customer_id):
            behavioral_data = await self.get_customer_behavioral_data(customer_id)
            customer_data['behavioral_data'] = behavioral_data
        
        # Create secure download link
        download_url = await self.create_secure_data_export(customer_data, customer_id)
        
        return {
            'status': 'completed',
            'download_url': download_url,
            'expires_at': datetime.utcnow() + timedelta(days=30),
            'data_categories': list(customer_data.keys())
        }
    
    async def delete_customer_data(self, customer_id: str, merchant_id: str) -> dict:
        """Handle right to be forgotten request"""
        
        deletion_summary = {
            'deleted_categories': [],
            'retained_categories': [],
            'deletion_date': datetime.utcnow()
        }
        
        # Check what can be deleted based on retention policies
        for category, policy in self.retention_policies.items():
            if policy.can_be_deleted:
                await self.delete_data_category(customer_id, merchant_id, category)
                deletion_summary['deleted_categories'].append(category.value)
            else:
                # Anonymize instead of delete for legal obligations
                await self.anonymize_data_category(customer_id, merchant_id, category)
                deletion_summary['retained_categories'].append({
                    'category': category.value,
                    'reason': policy.legal_basis,
                    'retention_until': datetime.utcnow() + timedelta(days=policy.retention_days)
                })
        
        return {
            'status': 'completed',
            'summary': deletion_summary
        }
    
    async def anonymize_data_category(
        self, 
        customer_id: str, 
        merchant_id: str, 
        category: DataCategory
    ):
        """Anonymize data that cannot be deleted due to legal obligations"""
        
        if category == DataCategory.PAYMENT_DATA:
            # Anonymize transaction records while preserving financial data
            await self.database.execute("""
                UPDATE transactions 
                SET 
                    customer_id = NULL,
                    metadata = jsonb_build_object(
                        'anonymized', true,
                        'anonymized_at', NOW()
                    )
                WHERE customer_id = $1 AND merchant_id = $2
            """, customer_id, merchant_id)
            
            # Anonymize payment methods
            await self.database.execute("""
                UPDATE payment_methods_vault
                SET 
                    customer_id = NULL,
                    encrypted_data = 'ANONYMIZED'::bytea
                WHERE customer_id = $1 AND merchant_id = $2
            """, customer_id, merchant_id)
```

*Reading Time: ~20 minutes*
