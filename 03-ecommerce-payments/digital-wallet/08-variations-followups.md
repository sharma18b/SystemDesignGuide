# Digital Wallet - Variations and Follow-ups

**Reading Time**: 20 minutes

## Platform Variations

### 1. Mobile-First Wallet (Apple Pay, Google Pay)

**Key Characteristics:**
```
Focus Areas:
├── NFC contactless payments
├── Biometric authentication
├── Secure Element integration
├── Wearable support (Watch)
└── Offline transaction capability

Technical Differences:
- Platform-specific APIs (PassKit, Google Pay API)
- Hardware security (Secure Enclave, TEE)
- Deep OS integration
- Limited web presence
```

**Architecture Adjustments:**
```
Additional Components:
├── Device Attestation Service
├── Secure Element Provisioning
├── NFC Transaction Handler
├── Wearable Sync Service
└── Offline Transaction Manager

Security Enhancements:
- Hardware-backed key storage
- Biometric template storage
- Device binding
- Jailbreak/root detection
```

### 2. Web-Based Wallet (PayPal, Venmo)

**Key Characteristics:**
```
Focus Areas:
├── Browser-based payments
├── Email-linked accounts
├── Social features (Venmo feed)
├── P2P transfers
└── Merchant checkout integration

Technical Differences:
- No NFC support
- Software-based security
- Cross-platform consistency
- Social graph integration
```

**Architecture Adjustments:**
```
Additional Components:
├── OAuth Integration
├── Social Feed Service
├── Email Payment Service
├── Checkout SDK
└── Browser Extension

Security Considerations:
- 2FA mandatory
- Device fingerprinting
- Session management
- CSRF protection
```

### 3. Cryptocurrency Wallet (Coinbase Wallet, MetaMask)

**Key Characteristics:**
```
Focus Areas:
├── Blockchain integration
├── Private key management
├── Multi-currency support
├── DeFi integration
└── NFT storage

Technical Differences:
- Blockchain nodes
- Smart contract interaction
- Gas fee calculation
- Decentralized architecture
```

**Architecture Adjustments:**
```
Additional Components:
├── Blockchain Node Service
├── Smart Contract Service
├── Gas Fee Estimator
├── DeFi Protocol Integration
└── NFT Metadata Service

Security Enhancements:
- Seed phrase generation
- Hardware wallet support
- Multi-signature wallets
- Cold storage integration
```

## Regional Variations

### 1. US Market

**Regulatory Requirements:**
```
Compliance:
├── FinCEN (Financial Crimes Enforcement Network)
├── State money transmitter licenses
├── CFPB (Consumer Financial Protection Bureau)
├── OFAC sanctions screening
└── Patriot Act compliance

KYC/AML:
- SSN verification
- Address verification
- Transaction monitoring
- SAR filing (Suspicious Activity Reports)
```

**Payment Methods:**
```
Popular Methods:
├── Credit/Debit cards (Visa, Mastercard, Amex)
├── ACH bank transfers
├── PayPal integration
├── Apple Pay / Google Pay
└── Venmo integration

Transaction Limits:
- Daily: $5,000
- Per transaction: $1,000
- Monthly: $20,000
```

### 2. European Market

**Regulatory Requirements:**
```
Compliance:
├── PSD2 (Payment Services Directive 2)
├── GDPR (Data privacy)
├── SCA (Strong Customer Authentication)
├── EMI license (E-Money Institution)
└── Local regulations per country

SCA Requirements:
- Two-factor authentication
- Biometric + device possession
- Exemptions for low-risk transactions
- Transaction risk analysis
```

**Payment Methods:**
```
Popular Methods:
├── SEPA bank transfers
├── Credit/Debit cards
├── iDEAL (Netherlands)
├── Giropay (Germany)
└── Bancontact (Belgium)

Transaction Limits:
- Daily: €3,000
- Per transaction: €500 (SCA exempt)
- Monthly: €15,000
```

### 3. Asian Market

**Regulatory Requirements:**
```
Compliance:
├── Local payment licenses
├── Data localization laws
├── Cross-border restrictions
├── Real-name verification
└── Government reporting

China Specific:
- PBOC (People's Bank of China) approval
- Data stored in China
- Government access requirements
- Real-name registration
```

**Payment Methods:**
```
Popular Methods:
├── QR code payments (dominant)
├── WeChat Pay integration
├── Alipay integration
├── UnionPay cards
└── Local bank transfers

Transaction Limits:
- Daily: ¥50,000 (~$7,000)
- Per transaction: ¥10,000
- Monthly: ¥200,000
```

## Feature Variations

### 1. P2P-Focused Wallet (Venmo, Cash App)

**Additional Features:**
```
Social Features:
├── Public transaction feed
├── Friend network
├── Emoji reactions
├── Comments on transactions
└── Split bill functionality

Architecture Additions:
├── Social Graph Service
├── Feed Generation Service
├── Friend Recommendation Engine
├── Activity Stream
└── Privacy Controls
```

**Database Schema Additions:**
```sql
CREATE TABLE social_connections (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    friend_id BIGINT NOT NULL,
    status VARCHAR(20), -- pending, accepted, blocked
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

CREATE TABLE transaction_feed (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL,
    visibility VARCHAR(20), -- public, friends, private
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Merchant-Focused Wallet (Square Cash, Stripe)

**Additional Features:**
```
Merchant Tools:
├── Payment links
├── Invoicing
├── Recurring billing
├── Merchant dashboard
└── Settlement reports

Architecture Additions:
├── Merchant Portal Service
├── Invoice Service
├── Recurring Billing Engine
├── Settlement Service
└── Reporting Service
```

**Database Schema Additions:**
```sql
CREATE TABLE merchants (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    business_name VARCHAR(255),
    business_type VARCHAR(50),
    tax_id VARCHAR(50),
    settlement_account_id BIGINT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE invoices (
    id BIGSERIAL PRIMARY KEY,
    merchant_id BIGINT NOT NULL,
    customer_email VARCHAR(255),
    amount DECIMAL(15, 2),
    status VARCHAR(20), -- draft, sent, paid, overdue
    due_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Investment Wallet (Robinhood, Acorns)

**Additional Features:**
```
Investment Features:
├── Stock trading
├── Cryptocurrency trading
├── Round-up savings
├── Portfolio management
└── Market data

Architecture Additions:
├── Trading Engine
├── Market Data Service
├── Portfolio Service
├── Round-up Service
└── Investment Analytics
```

**Database Schema Additions:**
```sql
CREATE TABLE portfolios (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    total_value DECIMAL(15, 2),
    cash_balance DECIMAL(15, 2),
    invested_amount DECIMAL(15, 2),
    returns DECIMAL(15, 2),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE holdings (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL,
    asset_type VARCHAR(20), -- stock, crypto, etf
    asset_symbol VARCHAR(10),
    quantity DECIMAL(15, 8),
    average_cost DECIMAL(15, 2),
    current_value DECIMAL(15, 2),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## Follow-up Questions

### 1. Loyalty and Rewards Integration

**Question:** "How would you integrate loyalty programs?"

**Answer:**
```
Architecture:
├── Loyalty Service
│   ├── Points calculation
│   ├── Tier management
│   ├── Rewards catalog
│   └── Redemption engine
├── Partner Integration
│   ├── Merchant API
│   ├── Points sync
│   └── Offer distribution
└── Gamification
    ├── Badges
    ├── Challenges
    └── Leaderboards

Database Schema:
CREATE TABLE loyalty_accounts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    points_balance INT DEFAULT 0,
    tier VARCHAR(20), -- bronze, silver, gold, platinum
    lifetime_points INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE loyalty_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    transaction_id BIGINT,
    points_earned INT,
    points_redeemed INT,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

Points Calculation:
- Base: 1 point per $1 spent
- Tier multipliers: Bronze 1x, Silver 1.5x, Gold 2x, Platinum 3x
- Category bonuses: Groceries 2x, Gas 3x, Dining 2x
- Partner bonuses: Specific merchants 5x
```

### 2. Multi-Currency Support

**Question:** "How would you handle multiple currencies?"

**Answer:**
```
Architecture:
├── Currency Service
│   ├── Exchange rate provider
│   ├── Rate caching
│   ├── Conversion engine
│   └── Fee calculation
├── Multi-Currency Wallet
│   ├── Currency balances
│   ├── Auto-conversion
│   └── Manual conversion
└── Settlement
    ├── Currency routing
    └── FX settlement

Database Schema:
CREATE TABLE currency_balances (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    currency CHAR(3) NOT NULL,
    available_balance DECIMAL(15, 2) DEFAULT 0,
    pending_balance DECIMAL(15, 2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, currency)
);

CREATE TABLE exchange_rates (
    id BIGSERIAL PRIMARY KEY,
    from_currency CHAR(3) NOT NULL,
    to_currency CHAR(3) NOT NULL,
    rate DECIMAL(15, 8) NOT NULL,
    provider VARCHAR(50),
    valid_from TIMESTAMP NOT NULL,
    valid_to TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

Conversion Logic:
- Real-time rates from provider (e.g., XE, OANDA)
- Cache rates for 1 minute
- Add spread: 1-2% markup
- Display total cost before conversion
- Support 30+ major currencies
```

### 3. Subscription Management

**Question:** "How would you handle recurring subscriptions?"

**Answer:**
```
Architecture:
├── Subscription Service
│   ├── Subscription management
│   ├── Billing scheduler
│   ├── Retry logic
│   └── Cancellation handling
├── Notification Service
│   ├── Upcoming charge alerts
│   ├── Failed payment alerts
│   └── Cancellation confirmations
└── Analytics
    ├── Subscription metrics
    └── Churn analysis

Database Schema:
CREATE TABLE subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    merchant_id VARCHAR(100),
    merchant_name VARCHAR(255),
    amount DECIMAL(15, 2),
    currency CHAR(3),
    frequency VARCHAR(20), -- daily, weekly, monthly, yearly
    payment_method_id BIGINT,
    status VARCHAR(20), -- active, paused, cancelled
    next_billing_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    cancelled_at TIMESTAMP
);

CREATE TABLE subscription_payments (
    id BIGSERIAL PRIMARY KEY,
    subscription_id BIGINT NOT NULL,
    transaction_id BIGINT,
    amount DECIMAL(15, 2),
    status VARCHAR(20), -- success, failed, pending
    retry_count INT DEFAULT 0,
    scheduled_date DATE,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

Billing Logic:
- Schedule job runs daily at 2 AM
- Process subscriptions due today
- Retry failed payments: Day 1, 3, 7
- Notify user before charging
- Auto-cancel after 3 failed attempts
```

### 4. Fraud Prevention Enhancement

**Question:** "How would you improve fraud detection?"

**Answer:**
```
Advanced Techniques:
├── Device Intelligence
│   ├── Device fingerprinting
│   ├── Behavioral biometrics
│   ├── Location tracking
│   └── Network analysis
├── Graph Analysis
│   ├── Transaction networks
│   ├── Account linking
│   ├── Mule account detection
│   └── Ring detection
├── Real-Time Scoring
│   ├── Ensemble models
│   ├── Feature engineering
│   ├── Online learning
│   └── A/B testing
└── Manual Review
    ├── Review queue
    ├── Case management
    └── Analyst tools

ML Features:
- Transaction velocity (1h, 24h, 7d)
- Amount deviation from average
- Geographic distance from last transaction
- Device change frequency
- Time since account creation
- Historical fraud rate
- Merchant risk score
- Network analysis features

Model Architecture:
- Gradient Boosting (XGBoost)
- Neural Networks (LSTM for sequences)
- Ensemble of 5 models
- Real-time inference < 100ms
- Batch retraining weekly
- Online learning for new patterns
```

### 5. Offline Payment Support

**Question:** "How would you enable offline payments?"

**Answer:**
```
Architecture:
├── Offline Token Cache
│   ├── Pre-generated tokens
│   ├── Cryptographic verification
│   ├── Limited use tokens
│   └── Sync on reconnect
├── Transaction Queue
│   ├── Local storage
│   ├── Pending transactions
│   └── Conflict resolution
└── Risk Management
    ├── Transaction limits
    ├── Velocity checks
    └── Fraud scoring

Implementation:
1. Pre-generate 10 single-use tokens
2. Store encrypted on device
3. Use token for offline transaction
4. Queue transaction locally
5. Sync when connection restored
6. Verify and settle transaction

Constraints:
- Max 5 offline transactions
- Max $100 per transaction
- Max $500 total offline
- 24-hour expiry
- Sync required within 48 hours

Security:
- Cryptographic verification (no server)
- Device attestation
- Biometric required
- Token single-use
- Fraud check on sync
```

## Interview Discussion Points

**Q: How would you expand to new markets?**
```
Considerations:
1. Regulatory compliance (licenses, KYC)
2. Local payment methods
3. Currency support
4. Language localization
5. Data residency requirements
6. Partner integrations
7. Fraud patterns (region-specific)
```

**Q: How would you add cryptocurrency support?**
```
Architecture Changes:
1. Blockchain node integration
2. Wallet address management
3. Gas fee estimation
4. Multi-currency support
5. Exchange rate provider
6. Regulatory compliance (varies by region)
```

**Q: How would you handle chargebacks?**
```
Process:
1. Chargeback notification from network
2. Freeze disputed amount
3. Gather evidence (transaction details, receipts)
4. Submit response to network
5. Await decision (30-90 days)
6. Refund or release funds
7. Update fraud models
```

---
*Estimated Reading Time: 20 minutes*
