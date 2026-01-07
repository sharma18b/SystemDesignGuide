# Payment Service - Database Design

## Database Architecture Overview

### Multi-Database Strategy
```
┌─────────────────────────────────────────────────────────────────┐
│                    Application Services                         │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    Data Access Layer                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │ Transaction │ │    Cache    │ │   Search    │ │   Stream    ││
│  │    ORM      │ │   Client    │ │   Client    │ │   Client    ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     Database Layer                              │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │ PostgreSQL  │ │    Redis    │ │Elasticsearch│ │    Kafka    │ │
│ │(ACID Trans) │ │  (Cache)    │ │(Analytics)  │ │  (Events)   │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Core Transaction Schema (PostgreSQL)

### Transactions Table
```sql
-- Main transactions table with ACID compliance
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    customer_id UUID,
    
    -- Financial data
    amount BIGINT NOT NULL CHECK (amount > 0), -- Amount in smallest currency unit
    currency VARCHAR(3) NOT NULL,
    fee_amount BIGINT DEFAULT 0,
    net_amount BIGINT GENERATED ALWAYS AS (amount - fee_amount) STORED,
    
    -- Transaction metadata
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_method_type VARCHAR(20) NOT NULL,
    payment_method_token VARCHAR(100),
    
    -- Gateway information
    gateway_name VARCHAR(50) NOT NULL,
    gateway_transaction_id VARCHAR(100),
    gateway_response JSONB,
    
    -- Risk and compliance
    fraud_score DECIMAL(5,4),
    risk_level VARCHAR(10),
    compliance_status VARCHAR(20) DEFAULT 'pending',
    
    -- Audit trail
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_status CHECK (
        status IN ('pending', 'authorized', 'captured', 'succeeded', 
                  'failed', 'cancelled', 'refunded', 'disputed')
    ),
    CONSTRAINT valid_risk_level CHECK (
        risk_level IN ('low', 'medium', 'high') OR risk_level IS NULL
    )
);

-- Performance indexes
CREATE INDEX idx_transactions_merchant_created ON transactions(merchant_id, created_at DESC);
CREATE INDEX idx_transactions_customer ON transactions(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_transactions_status ON transactions(status) WHERE status IN ('pending', 'failed');
CREATE INDEX idx_transactions_gateway ON transactions(gateway_name, gateway_transaction_id);
CREATE INDEX idx_transactions_amount_currency ON transactions(currency, amount);

-- Partial index for high-risk transactions
CREATE INDEX idx_transactions_high_risk ON transactions(created_at DESC) 
WHERE risk_level = 'high' OR fraud_score > 0.8;
```

### Payment Methods Vault
```sql
-- Secure storage for tokenized payment methods
CREATE TABLE payment_methods_vault (
    token VARCHAR(100) PRIMARY KEY,
    customer_id UUID NOT NULL,
    merchant_id UUID NOT NULL,
    
    -- Encrypted payment data
    encrypted_data BYTEA NOT NULL,
    encryption_key_id VARCHAR(100) NOT NULL,
    
    -- Metadata for identification
    payment_method_type VARCHAR(20) NOT NULL,
    fingerprint VARCHAR(64) NOT NULL,
    last_four VARCHAR(4),
    brand VARCHAR(20), -- Visa, Mastercard, etc.
    
    -- Expiration and lifecycle
    expires_at DATE,
    is_active BOOLEAN DEFAULT true,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Unique constraint to prevent duplicates
    UNIQUE(customer_id, fingerprint)
);

-- Indexes for payment methods
CREATE INDEX idx_payment_methods_customer ON payment_methods_vault(customer_id, is_active);
CREATE INDEX idx_payment_methods_merchant ON payment_methods_vault(merchant_id);
CREATE INDEX idx_payment_methods_expires ON payment_methods_vault(expires_at) 
WHERE expires_at IS NOT NULL AND is_active = true;
```

### Refunds and Disputes
```sql
-- Refunds table
CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    
    -- Refund details
    amount BIGINT NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL,
    reason VARCHAR(100),
    
    -- Processing information
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    gateway_refund_id VARCHAR(100),
    
    -- Audit
    requested_by UUID, -- User who requested refund
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_refund_status CHECK (
        status IN ('pending', 'succeeded', 'failed', 'cancelled')
    )
);

-- Disputes table
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    
    -- Dispute details
    dispute_type VARCHAR(50) NOT NULL, -- chargeback, inquiry, etc.
    reason_code VARCHAR(20),
    amount BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL,
    
    -- Status and timeline
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    due_date DATE,
    
    -- Evidence and documentation
    evidence JSONB DEFAULT '{}',
    merchant_response TEXT,
    
    -- Gateway information
    gateway_dispute_id VARCHAR(100),
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_dispute_status CHECK (
        status IN ('open', 'under_review', 'won', 'lost', 'warning_closed')
    )
);
```

## Merchant and Customer Schema

### Merchants Table
```sql
-- Merchant accounts
CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Business information
    business_name VARCHAR(200) NOT NULL,
    legal_name VARCHAR(200),
    business_type VARCHAR(50), -- corporation, llc, sole_proprietorship
    tax_id VARCHAR(50),
    
    -- Contact information
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    website VARCHAR(255),
    
    -- Address
    address JSONB NOT NULL,
    
    -- Account status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    verification_status VARCHAR(20) DEFAULT 'unverified',
    
    -- Processing configuration
    processing_config JSONB DEFAULT '{}',
    fee_structure JSONB DEFAULT '{}',
    
    -- Risk and limits
    risk_level VARCHAR(10) DEFAULT 'medium',
    daily_limit BIGINT,
    monthly_limit BIGINT,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_merchant_status CHECK (
        status IN ('pending', 'active', 'suspended', 'closed')
    )
);

-- API keys for merchant authentication
CREATE TABLE merchant_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    
    -- Key information
    key_hash VARCHAR(128) NOT NULL UNIQUE, -- Hashed API key
    key_prefix VARCHAR(20) NOT NULL, -- First few chars for identification
    
    -- Permissions and scope
    permissions TEXT[] DEFAULT '{}',
    environment VARCHAR(20) NOT NULL DEFAULT 'live', -- live, test
    
    -- Status and lifecycle
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    
    CONSTRAINT valid_environment CHECK (environment IN ('live', 'test'))
);
```

### Customers Table
```sql
-- Customer records
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    
    -- Customer identification
    external_customer_id VARCHAR(100), -- Merchant's customer ID
    email VARCHAR(255),
    phone VARCHAR(20),
    
    -- Personal information (encrypted)
    encrypted_pii BYTEA,
    encryption_key_id VARCHAR(100),
    
    -- Risk assessment
    risk_score DECIMAL(5,4) DEFAULT 0.0,
    risk_level VARCHAR(10) DEFAULT 'low',
    
    -- Behavioral data
    total_transactions INTEGER DEFAULT 0,
    total_amount BIGINT DEFAULT 0,
    first_transaction_at TIMESTAMP WITH TIME ZONE,
    last_transaction_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint per merchant
    UNIQUE(merchant_id, external_customer_id)
);
```

## Analytics and Reporting Schema

### Transaction Analytics
```sql
-- Daily transaction summaries for reporting
CREATE TABLE daily_transaction_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    
    -- Date and currency
    summary_date DATE NOT NULL,
    currency VARCHAR(3) NOT NULL,
    
    -- Volume metrics
    transaction_count INTEGER NOT NULL DEFAULT 0,
    successful_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    refunded_count INTEGER NOT NULL DEFAULT 0,
    
    -- Amount metrics
    gross_amount BIGINT NOT NULL DEFAULT 0,
    fee_amount BIGINT NOT NULL DEFAULT 0,
    net_amount BIGINT NOT NULL DEFAULT 0,
    refunded_amount BIGINT NOT NULL DEFAULT 0,
    
    -- Performance metrics
    success_rate DECIMAL(5,4) GENERATED ALWAYS AS (
        CASE WHEN transaction_count > 0 
        THEN successful_count::DECIMAL / transaction_count 
        ELSE 0 END
    ) STORED,
    
    -- Risk metrics
    high_risk_count INTEGER DEFAULT 0,
    fraud_count INTEGER DEFAULT 0,
    dispute_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(merchant_id, summary_date, currency)
);

-- Indexes for analytics queries
CREATE INDEX idx_daily_summaries_merchant_date ON daily_transaction_summaries(merchant_id, summary_date DESC);
CREATE INDEX idx_daily_summaries_date ON daily_transaction_summaries(summary_date DESC);
```

## Caching Strategy (Redis)

### Cache Key Patterns
```python
# Redis cache key patterns and TTL strategy
class PaymentCacheKeys:
    # Merchant data (1 hour TTL)
    MERCHANT_CONFIG = "merchant:config:{merchant_id}"
    MERCHANT_LIMITS = "merchant:limits:{merchant_id}"
    
    # Payment method tokens (24 hours TTL)
    PAYMENT_METHOD = "pm:token:{token}"
    CUSTOMER_PAYMENT_METHODS = "customer:pm:{customer_id}"
    
    # Fraud detection (15 minutes TTL)
    FRAUD_SCORE = "fraud:score:{transaction_id}"
    VELOCITY_CHECK = "velocity:{customer_id}:{timeframe}"
    
    # Gateway routing (30 minutes TTL)
    GATEWAY_HEALTH = "gateway:health:{gateway_name}"
    ROUTING_RULES = "routing:rules:{merchant_id}"
    
    # Rate limiting (1 hour sliding window)
    RATE_LIMIT = "rate_limit:{api_key}:{endpoint}:{window}"

class PaymentCache:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.default_ttl = 3600  # 1 hour
    
    async def cache_merchant_config(self, merchant_id: str, config: dict):
        """Cache merchant configuration"""
        key = PaymentCacheKeys.MERCHANT_CONFIG.format(merchant_id=merchant_id)
        await self.redis.setex(key, 3600, json.dumps(config))
    
    async def get_merchant_config(self, merchant_id: str) -> Optional[dict]:
        """Retrieve cached merchant configuration"""
        key = PaymentCacheKeys.MERCHANT_CONFIG.format(merchant_id=merchant_id)
        cached_data = await self.redis.get(key)
        return json.loads(cached_data) if cached_data else None
    
    async def cache_payment_method(self, token: str, payment_method: dict):
        """Cache decrypted payment method data"""
        key = PaymentCacheKeys.PAYMENT_METHOD.format(token=token)
        await self.redis.setex(key, 86400, json.dumps(payment_method))  # 24 hours
    
    async def increment_velocity_counter(
        self, 
        customer_id: str, 
        timeframe: str, 
        amount: int
    ):
        """Increment velocity counters for fraud detection"""
        count_key = f"velocity:{customer_id}:{timeframe}:count"
        amount_key = f"velocity:{customer_id}:{timeframe}:amount"
        
        pipe = self.redis.pipeline()
        pipe.incr(count_key)
        pipe.incrbyfloat(amount_key, amount)
        
        # Set expiration based on timeframe
        ttl = {'hour': 3600, 'day': 86400, 'week': 604800}.get(timeframe, 3600)
        pipe.expire(count_key, ttl)
        pipe.expire(amount_key, ttl)
        
        await pipe.execute()
```

## Database Optimization

### Partitioning Strategy
```sql
-- Partition transactions table by month for better performance
CREATE TABLE transactions_2024_01 PARTITION OF transactions
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE transactions_2024_02 PARTITION OF transactions
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Automated partition creation function
CREATE OR REPLACE FUNCTION create_monthly_partition(table_name TEXT, start_date DATE)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    end_date DATE;
BEGIN
    partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');
    end_date := start_date + INTERVAL '1 month';
    
    EXECUTE format('CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                   partition_name, table_name, start_date, end_date);
    
    -- Create indexes on partition
    EXECUTE format('CREATE INDEX %I ON %I (merchant_id, created_at DESC)',
                   'idx_' || partition_name || '_merchant_created', partition_name);
END;
$$ LANGUAGE plpgsql;
```

### Query Optimization
```sql
-- Materialized view for merchant analytics
CREATE MATERIALIZED VIEW merchant_monthly_stats AS
SELECT 
    merchant_id,
    DATE_TRUNC('month', created_at) as month,
    currency,
    COUNT(*) as transaction_count,
    COUNT(*) FILTER (WHERE status = 'succeeded') as successful_count,
    SUM(amount) FILTER (WHERE status = 'succeeded') as total_amount,
    AVG(amount) FILTER (WHERE status = 'succeeded') as avg_amount,
    COUNT(*) FILTER (WHERE risk_level = 'high') as high_risk_count
FROM transactions
WHERE created_at >= CURRENT_DATE - INTERVAL '2 years'
GROUP BY merchant_id, DATE_TRUNC('month', created_at), currency;

-- Refresh materialized view daily
CREATE INDEX idx_merchant_monthly_stats ON merchant_monthly_stats(merchant_id, month DESC);

-- Automated refresh job
SELECT cron.schedule('refresh-merchant-stats', '0 2 * * *', 
    'REFRESH MATERIALIZED VIEW CONCURRENTLY merchant_monthly_stats;');
```

## Data Consistency and ACID

### Transaction Isolation
```python
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from contextlib import asynccontextmanager

class PaymentTransactionManager:
    def __init__(self, connection_string: str):
        self.engine = create_engine(connection_string)
        self.Session = sessionmaker(bind=self.engine)
    
    @asynccontextmanager
    async def payment_transaction(self, isolation_level='READ_COMMITTED'):
        """Context manager for payment transactions with proper isolation"""
        session = self.Session()
        
        try:
            # Set isolation level
            await session.execute(text(f"SET TRANSACTION ISOLATION LEVEL {isolation_level}"))
            
            yield session
            await session.commit()
            
        except Exception as e:
            await session.rollback()
            raise PaymentTransactionException(f"Transaction failed: {e}")
        finally:
            session.close()
    
    async def process_payment_with_refund_protection(
        self,
        transaction_data: dict,
        refund_data: Optional[dict] = None
    ):
        """Process payment with atomic refund handling"""
        
        async with self.payment_transaction('SERIALIZABLE') as session:
            # Create main transaction
            transaction = await session.execute(
                text("""
                    INSERT INTO transactions 
                    (merchant_id, amount, currency, status, payment_method_token)
                    VALUES (:merchant_id, :amount, :currency, 'pending', :token)
                    RETURNING id
                """),
                transaction_data
            )
            
            transaction_id = transaction.scalar()
            
            # Process refund if provided
            if refund_data:
                await session.execute(
                    text("""
                        INSERT INTO refunds
                        (transaction_id, amount, currency, reason, status)
                        VALUES (:transaction_id, :amount, :currency, :reason, 'pending')
                    """),
                    {**refund_data, 'transaction_id': transaction_id}
                )
            
            # Update merchant balance atomically
            await session.execute(
                text("""
                    UPDATE merchant_balances 
                    SET available_balance = available_balance + :amount
                    WHERE merchant_id = :merchant_id
                """),
                {
                    'merchant_id': transaction_data['merchant_id'],
                    'amount': transaction_data['amount']
                }
            )
            
            return transaction_id
```

*Reading Time: ~20 minutes*
