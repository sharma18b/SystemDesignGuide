# Payment Service - Architecture

## High-Level Architecture

### Microservices Architecture Overview
```
┌─────────────────────────────────────────────────────────────────┐
│                    Client Applications                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   Web SDK   │ │ Mobile SDK  │ │  Server API │ │   Webhooks  ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │Rate Limiting│ │    Auth     │ │   Routing   │ │  Analytics  ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                   Core Payment Services                         │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │  Payment    │ │   Fraud     │ │  Gateway    │ │   Wallet    │ │
│ │ Processing  │ │ Detection   │ │  Routing    │ │  Service    │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │ Tokenization│ │ Settlement  │ │  Dispute    │ │ Compliance  │ │
│ │   Service   │ │  Service    │ │ Management  │ │   Service   │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     Data Layer                                  │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │ PostgreSQL  │ │   Redis     │ │   Kafka     │ │ Elasticsearch│ │
│ │(Transactions)│ │  (Cache)    │ │ (Events)    │ │ (Analytics) │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Core Payment Services

### Payment Processing Service
```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import asyncio

app = FastAPI()

class PaymentRequest(BaseModel):
    amount: int  # Amount in cents
    currency: str
    payment_method_id: str
    merchant_id: str
    customer_id: Optional[str] = None
    description: Optional[str] = None
    metadata: dict = {}

class PaymentProcessor:
    def __init__(self):
        self.gateway_router = GatewayRouter()
        self.fraud_detector = FraudDetector()
        self.tokenizer = PaymentTokenizer()
        
    async def process_payment(self, request: PaymentRequest) -> PaymentResult:
        """Main payment processing flow"""
        
        # 1. Fraud detection
        fraud_score = await self.fraud_detector.evaluate(request)
        if fraud_score.risk_level == 'high':
            return PaymentResult(
                status='declined',
                decline_reason='fraud_suspected',
                fraud_score=fraud_score.score
            )
        
        # 2. Route to appropriate gateway
        gateway = await self.gateway_router.select_gateway(
            merchant_id=request.merchant_id,
            amount=request.amount,
            currency=request.currency,
            payment_method=request.payment_method_id
        )
        
        # 3. Process payment
        try:
            gateway_response = await gateway.charge(
                amount=request.amount,
                currency=request.currency,
                payment_method=request.payment_method_id,
                idempotency_key=f"{request.merchant_id}:{request.payment_method_id}"
            )
            
            # 4. Store transaction record
            transaction = await self.store_transaction(
                request=request,
                gateway_response=gateway_response,
                fraud_score=fraud_score
            )
            
            return PaymentResult(
                status='succeeded',
                transaction_id=transaction.id,
                gateway_transaction_id=gateway_response.id,
                amount_charged=request.amount
            )
            
        except GatewayException as e:
            return PaymentResult(
                status='failed',
                error_code=e.code,
                error_message=e.message
            )

@app.post("/v1/payments")
async def create_payment(request: PaymentRequest):
    processor = PaymentProcessor()
    result = await processor.process_payment(request)
    
    if result.status == 'succeeded':
        return {"payment": result.to_dict()}
    else:
        raise HTTPException(
            status_code=400 if result.status == 'declined' else 500,
            detail=result.error_message
        )
```

### Gateway Routing Service
```python
class GatewayRouter:
    def __init__(self):
        self.gateways = {
            'stripe': StripeGateway(),
            'paypal': PayPalGateway(),
            'adyen': AdyenGateway(),
            'square': SquareGateway()
        }
        self.routing_rules = GatewayRoutingRules()
        
    async def select_gateway(
        self, 
        merchant_id: str, 
        amount: int, 
        currency: str,
        payment_method: str
    ) -> PaymentGateway:
        """Select optimal gateway based on routing rules"""
        
        # Get merchant preferences
        merchant_config = await self.get_merchant_config(merchant_id)
        
        # Apply routing rules
        candidates = []
        
        for gateway_name, gateway in self.gateways.items():
            # Check if gateway supports currency
            if not gateway.supports_currency(currency):
                continue
                
            # Check if gateway supports payment method
            if not gateway.supports_payment_method(payment_method):
                continue
                
            # Calculate routing score
            score = await self.calculate_routing_score(
                gateway_name=gateway_name,
                merchant_config=merchant_config,
                amount=amount,
                currency=currency
            )
            
            candidates.append((gateway_name, gateway, score))
        
        if not candidates:
            raise NoSuitableGatewayException(
                f"No gateway available for {currency} {payment_method}"
            )
        
        # Sort by score (highest first)
        candidates.sort(key=lambda x: x[2], reverse=True)
        
        # Return best gateway
        return candidates[0][1]
    
    async def calculate_routing_score(
        self,
        gateway_name: str,
        merchant_config: dict,
        amount: int,
        currency: str
    ) -> float:
        """Calculate routing score for gateway selection"""
        
        score = 0.0
        
        # Merchant preference (40% weight)
        if gateway_name in merchant_config.get('preferred_gateways', []):
            score += 40.0
        
        # Success rate (30% weight)
        success_rate = await self.get_gateway_success_rate(gateway_name, currency)
        score += success_rate * 30.0
        
        # Cost optimization (20% weight)
        gateway_fee = await self.get_gateway_fee(gateway_name, amount, currency)
        cost_score = max(0, 100 - (gateway_fee * 100))  # Lower fee = higher score
        score += cost_score * 0.2
        
        # Latency (10% weight)
        avg_latency = await self.get_gateway_latency(gateway_name)
        latency_score = max(0, 100 - avg_latency)  # Lower latency = higher score
        score += latency_score * 0.1
        
        return score
```

### Fraud Detection Service
```python
import numpy as np
from sklearn.ensemble import IsolationForest
import joblib

class FraudDetector:
    def __init__(self):
        self.ml_model = joblib.load('fraud_detection_model.pkl')
        self.rule_engine = FraudRuleEngine()
        self.velocity_checker = VelocityChecker()
        
    async def evaluate(self, payment_request: PaymentRequest) -> FraudScore:
        """Comprehensive fraud evaluation"""
        
        # Extract features for ML model
        features = await self.extract_features(payment_request)
        
        # ML-based scoring
        ml_score = self.ml_model.predict_proba([features])[0][1]
        
        # Rule-based checks
        rule_violations = await self.rule_engine.check_rules(payment_request)
        
        # Velocity checks
        velocity_result = await self.velocity_checker.check_velocity(
            customer_id=payment_request.customer_id,
            amount=payment_request.amount
        )
        
        # Combine scores
        final_score = self.combine_scores(
            ml_score=ml_score,
            rule_violations=rule_violations,
            velocity_violations=velocity_result.violations
        )
        
        return FraudScore(
            score=final_score,
            risk_level=self.get_risk_level(final_score),
            ml_score=ml_score,
            rule_violations=rule_violations,
            velocity_violations=velocity_result.violations
        )
    
    async def extract_features(self, payment_request: PaymentRequest) -> List[float]:
        """Extract features for ML fraud detection"""
        
        features = []
        
        # Transaction features
        features.append(float(payment_request.amount))
        features.append(len(payment_request.description or ''))
        
        # Time-based features
        current_time = datetime.utcnow()
        features.append(current_time.hour)
        features.append(current_time.weekday())
        
        # Customer features
        if payment_request.customer_id:
            customer_stats = await self.get_customer_stats(payment_request.customer_id)
            features.extend([
                customer_stats.avg_transaction_amount,
                customer_stats.transaction_count,
                customer_stats.days_since_first_transaction
            ])
        else:
            features.extend([0.0, 0.0, 0.0])  # Guest checkout
        
        # Merchant features
        merchant_stats = await self.get_merchant_stats(payment_request.merchant_id)
        features.extend([
            merchant_stats.avg_transaction_amount,
            merchant_stats.chargeback_rate,
            merchant_stats.refund_rate
        ])
        
        return features
```

### Tokenization Service
```python
from cryptography.fernet import Fernet
import secrets
import hashlib

class PaymentTokenizer:
    def __init__(self):
        self.encryption_key = Fernet.generate_key()
        self.cipher = Fernet(self.encryption_key)
        self.vault_storage = VaultStorage()
        
    async def tokenize_payment_method(
        self, 
        payment_method_data: dict,
        customer_id: str
    ) -> str:
        """Tokenize sensitive payment method data"""
        
        # Generate unique token
        token = f"pm_{secrets.token_urlsafe(32)}"
        
        # Create fingerprint for deduplication
        fingerprint = self.create_fingerprint(payment_method_data)
        
        # Check for existing token with same fingerprint
        existing_token = await self.vault_storage.find_by_fingerprint(
            customer_id=customer_id,
            fingerprint=fingerprint
        )
        
        if existing_token:
            return existing_token
        
        # Encrypt sensitive data
        encrypted_data = self.cipher.encrypt(
            json.dumps(payment_method_data).encode()
        )
        
        # Store in vault
        await self.vault_storage.store(
            token=token,
            customer_id=customer_id,
            encrypted_data=encrypted_data,
            fingerprint=fingerprint,
            created_at=datetime.utcnow()
        )
        
        return token
    
    def create_fingerprint(self, payment_method_data: dict) -> str:
        """Create fingerprint for payment method deduplication"""
        
        if payment_method_data['type'] == 'card':
            # Use last 4 digits + expiry for cards
            last_four = payment_method_data['number'][-4:]
            expiry = f"{payment_method_data['exp_month']}/{payment_method_data['exp_year']}"
            fingerprint_data = f"card:{last_four}:{expiry}"
        elif payment_method_data['type'] == 'bank_account':
            # Use last 4 digits of account number
            last_four = payment_method_data['account_number'][-4:]
            routing = payment_method_data['routing_number']
            fingerprint_data = f"bank:{last_four}:{routing}"
        else:
            # Generic fingerprint for other methods
            fingerprint_data = f"{payment_method_data['type']}:{payment_method_data.get('identifier', '')}"
        
        return hashlib.sha256(fingerprint_data.encode()).hexdigest()
    
    async def detokenize(self, token: str, customer_id: str) -> dict:
        """Retrieve payment method data from token"""
        
        # Retrieve from vault
        vault_record = await self.vault_storage.retrieve(
            token=token,
            customer_id=customer_id
        )
        
        if not vault_record:
            raise InvalidTokenException(f"Token {token} not found")
        
        # Decrypt data
        decrypted_data = self.cipher.decrypt(vault_record.encrypted_data)
        payment_method_data = json.loads(decrypted_data.decode())
        
        return payment_method_data
```

## Data Architecture

### Database Design
```sql
-- Transactions table (main payment records)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    customer_id UUID,
    amount INTEGER NOT NULL, -- Amount in cents
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL,
    gateway_name VARCHAR(50) NOT NULL,
    gateway_transaction_id VARCHAR(100),
    payment_method_token VARCHAR(100),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    fraud_score DECIMAL(5,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_amount CHECK (amount > 0),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled'))
);

-- Indexes for performance
CREATE INDEX idx_transactions_merchant_id ON transactions(merchant_id);
CREATE INDEX idx_transactions_customer_id ON transactions(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_status ON transactions(status) WHERE status IN ('pending', 'failed');

-- Payment methods vault (tokenized)
CREATE TABLE payment_methods_vault (
    token VARCHAR(100) PRIMARY KEY,
    customer_id UUID NOT NULL,
    encrypted_data BYTEA NOT NULL,
    fingerprint VARCHAR(64) NOT NULL,
    payment_method_type VARCHAR(20) NOT NULL,
    last_four VARCHAR(4),
    expires_at DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(customer_id, fingerprint)
);

-- Fraud detection features
CREATE TABLE fraud_features (
    transaction_id UUID PRIMARY KEY REFERENCES transactions(id),
    features JSONB NOT NULL,
    ml_score DECIMAL(5,4),
    rule_violations TEXT[],
    risk_level VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Event Streaming Architecture
```python
from kafka import KafkaProducer, KafkaConsumer
import json

class PaymentEventPublisher:
    def __init__(self):
        self.producer = KafkaProducer(
            bootstrap_servers=['kafka-1:9092', 'kafka-2:9092'],
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            key_serializer=lambda k: k.encode('utf-8') if k else None
        )
        
    async def publish_payment_event(self, event_type: str, transaction: Transaction):
        """Publish payment events to Kafka"""
        
        event_data = {
            'event_type': event_type,
            'transaction_id': transaction.id,
            'merchant_id': transaction.merchant_id,
            'amount': transaction.amount,
            'currency': transaction.currency,
            'status': transaction.status,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Use merchant_id as partition key for ordering
        self.producer.send(
            topic='payment-events',
            key=transaction.merchant_id,
            value=event_data
        )
        
        # Flush to ensure delivery
        self.producer.flush()

class PaymentEventConsumer:
    def __init__(self):
        self.consumer = KafkaConsumer(
            'payment-events',
            bootstrap_servers=['kafka-1:9092', 'kafka-2:9092'],
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            group_id='payment-analytics'
        )
        
    async def process_events(self):
        """Process payment events for analytics and notifications"""
        
        for message in self.consumer:
            event_data = message.value
            
            try:
                if event_data['event_type'] == 'payment.succeeded':
                    await self.handle_payment_success(event_data)
                elif event_data['event_type'] == 'payment.failed':
                    await self.handle_payment_failure(event_data)
                elif event_data['event_type'] == 'payment.disputed':
                    await self.handle_payment_dispute(event_data)
                    
            except Exception as e:
                logger.error(f"Error processing event: {e}")
                # Send to dead letter queue for manual review
                await self.send_to_dlq(message)
```

## Security Architecture

### API Security
```python
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

security = HTTPBearer()

class APIKeyValidator:
    def __init__(self):
        self.api_keys_cache = {}
        
    async def validate_api_key(
        self, 
        credentials: HTTPAuthorizationCredentials = Security(security)
    ) -> dict:
        """Validate API key and return merchant context"""
        
        api_key = credentials.credentials
        
        # Check cache first
        if api_key in self.api_keys_cache:
            return self.api_keys_cache[api_key]
        
        # Validate against database
        merchant_data = await self.get_merchant_by_api_key(api_key)
        
        if not merchant_data:
            raise HTTPException(
                status_code=401,
                detail="Invalid API key"
            )
        
        if not merchant_data['active']:
            raise HTTPException(
                status_code=403,
                detail="API key suspended"
            )
        
        # Cache for 5 minutes
        self.api_keys_cache[api_key] = merchant_data
        asyncio.create_task(self.expire_cache_entry(api_key, 300))
        
        return merchant_data

# Dependency for protected endpoints
async def get_current_merchant(
    merchant_data: dict = Depends(APIKeyValidator().validate_api_key)
) -> dict:
    return merchant_data

@app.post("/v1/payments")
async def create_payment(
    request: PaymentRequest,
    merchant: dict = Depends(get_current_merchant)
):
    # Merchant context available from API key validation
    request.merchant_id = merchant['id']
    
    processor = PaymentProcessor()
    return await processor.process_payment(request)
```

### Encryption and Key Management
```python
import boto3
from cryptography.fernet import Fernet

class KeyManagementService:
    def __init__(self):
        self.kms_client = boto3.client('kms')
        self.key_aliases = {
            'payment_data': 'alias/payment-service-encryption',
            'pii_data': 'alias/payment-service-pii',
            'audit_logs': 'alias/payment-service-audit'
        }
        
    async def encrypt_sensitive_data(self, data: str, context: str) -> dict:
        """Encrypt sensitive data using AWS KMS"""
        
        key_alias = self.key_aliases.get(context, self.key_aliases['payment_data'])
        
        response = self.kms_client.encrypt(
            KeyId=key_alias,
            Plaintext=data.encode(),
            EncryptionContext={
                'service': 'payment-service',
                'context': context,
                'timestamp': str(int(datetime.utcnow().timestamp()))
            }
        )
        
        return {
            'encrypted_data': base64.b64encode(response['CiphertextBlob']).decode(),
            'key_id': response['KeyId']
        }
    
    async def decrypt_sensitive_data(self, encrypted_data: str, context: str) -> str:
        """Decrypt sensitive data using AWS KMS"""
        
        ciphertext_blob = base64.b64decode(encrypted_data.encode())
        
        response = self.kms_client.decrypt(
            CiphertextBlob=ciphertext_blob,
            EncryptionContext={
                'service': 'payment-service',
                'context': context
            }
        )
        
        return response['Plaintext'].decode()
```

*Reading Time: ~20 minutes*
