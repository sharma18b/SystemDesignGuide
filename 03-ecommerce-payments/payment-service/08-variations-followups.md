# Variations and Follow-up Questions for Payment Service

## Overview
Payment systems have numerous variations based on business models, geographic requirements, and regulatory constraints. This document explores common variations and typical follow-up questions in system design interviews.

## Business Model Variations

### 1. B2B vs B2C Payment Processing

**B2C Payment Service (Stripe-like):**
```python
class B2CPaymentProcessor:
    def __init__(self):
        self.fraud_threshold = 0.5  # Lower threshold for consumers
        self.max_transaction_amount = 10000  # $10K limit
        self.supported_methods = ['credit_card', 'debit_card', 'digital_wallet']
    
    async def process_consumer_payment(self, payment_request):
        # Quick fraud check for small amounts
        if payment_request.amount < 100:
            fraud_score = await self.basic_fraud_check(payment_request)
        else:
            fraud_score = await self.comprehensive_fraud_check(payment_request)
        
        if fraud_score > self.fraud_threshold:
            return PaymentResult(status="DECLINED", reason="FRAUD_RISK")
        
        # Process immediately for better UX
        return await self.charge_payment_gateway(payment_request)
```

**B2B Payment Service (Enterprise):**
```python
class B2BPaymentProcessor:
    def __init__(self):
        self.fraud_threshold = 0.3  # Higher threshold for businesses
        self.max_transaction_amount = 1000000  # $1M limit
        self.supported_methods = ['ach', 'wire_transfer', 'corporate_card']
        self.approval_workflows = ApprovalWorkflowEngine()
    
    async def process_business_payment(self, payment_request):
        # Multi-step approval for large amounts
        if payment_request.amount > 50000:
            approval_result = await self.approval_workflows.require_approval(
                payment_request, required_approvers=2
            )
            if not approval_result.approved:
                return PaymentResult(status="PENDING_APPROVAL")
        
        # Enhanced due diligence
        compliance_check = await self.compliance_service.verify_business(
            payment_request.payer_business_id
        )
        
        if not compliance_check.passed:
            return PaymentResult(status="COMPLIANCE_REVIEW_REQUIRED")
        
        return await self.process_with_settlement_delay(payment_request)
```

### 2. Marketplace vs Direct Payment Processing

**Marketplace Payment System (Uber/Airbnb-like):**
```python
class MarketplacePaymentSystem:
    def __init__(self):
        self.escrow_service = EscrowService()
        self.split_payment_engine = SplitPaymentEngine()
        self.dispute_resolution = DisputeResolutionService()
    
    async def process_marketplace_payment(self, booking_request):
        # Hold funds in escrow until service completion
        escrow_result = await self.escrow_service.hold_funds(
            amount=booking_request.total_amount,
            payer=booking_request.customer_id,
            duration_hours=booking_request.service_duration + 24
        )
        
        if not escrow_result.success:
            return PaymentResult(status="ESCROW_FAILED")
        
        # Schedule automatic release after service completion
        await self.schedule_fund_release(
            escrow_id=escrow_result.escrow_id,
            release_time=booking_request.service_end_time + timedelta(hours=24),
            splits=[
                {'recipient': booking_request.service_provider_id, 'percentage': 85},
                {'recipient': 'platform_fees', 'percentage': 15}
            ]
        )
        
        return PaymentResult(
            status="ESCROWED",
            escrow_id=escrow_result.escrow_id,
            release_schedule=booking_request.service_end_time + timedelta(hours=24)
        )
    
    async def handle_service_completion(self, booking_id):
        booking = await self.get_booking(booking_id)
        
        # Split payment between provider and platform
        split_result = await self.split_payment_engine.execute_split(
            escrow_id=booking.escrow_id,
            splits=booking.payment_splits
        )
        
        # Send notifications
        await self.notify_payment_completion(booking.customer_id, booking.provider_id)
        
        return split_result
```

**Direct Payment Processing:**
```python
class DirectPaymentProcessor:
    async def process_direct_payment(self, payment_request):
        # Simple direct charge to merchant account
        charge_result = await self.payment_gateway.charge(
            amount=payment_request.amount,
            payment_method=payment_request.payment_method,
            merchant_account=payment_request.merchant_id
        )
        
        if charge_result.success:
            # Immediate settlement to merchant
            await self.settlement_service.schedule_payout(
                merchant_id=payment_request.merchant_id,
                amount=charge_result.amount - self.calculate_fees(charge_result.amount),
                settlement_date=datetime.utcnow() + timedelta(days=2)
            )
        
        return PaymentResult(
            status="COMPLETED" if charge_result.success else "FAILED",
            transaction_id=charge_result.transaction_id
        )
```

### 3. Subscription vs One-time Payments

**Subscription Payment Engine:**
```python
class SubscriptionPaymentEngine:
    def __init__(self):
        self.billing_scheduler = BillingScheduler()
        self.dunning_management = DunningManagement()
        self.proration_calculator = ProrationCalculator()
    
    async def create_subscription(self, subscription_request):
        subscription = await self.db.create_subscription({
            'customer_id': subscription_request.customer_id,
            'plan_id': subscription_request.plan_id,
            'billing_cycle': subscription_request.billing_cycle,
            'next_billing_date': self.calculate_next_billing_date(
                subscription_request.billing_cycle
            ),
            'status': 'active'
        })
        
        # Schedule recurring billing
        await self.billing_scheduler.schedule_recurring_charge(
            subscription_id=subscription.id,
            amount=subscription_request.plan_amount,
            frequency=subscription_request.billing_cycle,
            payment_method_id=subscription_request.payment_method_id
        )
        
        return subscription
    
    async def process_recurring_billing(self, subscription_id):
        subscription = await self.get_subscription(subscription_id)
        
        try:
            charge_result = await self.charge_subscription(subscription)
            
            if charge_result.success:
                await self.update_next_billing_date(subscription_id)
                await self.send_billing_success_notification(subscription.customer_id)
            else:
                # Start dunning process for failed payments
                await self.dunning_management.handle_failed_payment(
                    subscription_id, charge_result.failure_reason
                )
        
        except PaymentFailedException as e:
            await self.handle_subscription_payment_failure(subscription_id, e)
    
    async def handle_plan_change(self, subscription_id, new_plan_id):
        subscription = await self.get_subscription(subscription_id)
        old_plan = await self.get_plan(subscription.plan_id)
        new_plan = await self.get_plan(new_plan_id)
        
        # Calculate prorated amount
        proration = self.proration_calculator.calculate_proration(
            old_plan, new_plan, subscription.current_period_start,
            subscription.current_period_end, datetime.utcnow()
        )
        
        if proration.amount > 0:
            # Charge difference immediately
            await self.charge_proration(subscription.customer_id, proration.amount)
        elif proration.amount < 0:
            # Credit account for overpayment
            await self.credit_account(subscription.customer_id, abs(proration.amount))
        
        # Update subscription
        await self.update_subscription_plan(subscription_id, new_plan_id)
```

## Geographic and Regulatory Variations

### 1. Multi-Currency Support

**Currency Conversion Service:**
```python
class MultiCurrencyPaymentProcessor:
    def __init__(self):
        self.exchange_rate_service = ExchangeRateService()
        self.currency_validator = CurrencyValidator()
        self.settlement_accounts = SettlementAccountManager()
    
    async def process_cross_currency_payment(self, payment_request):
        # Validate currency support
        if not self.currency_validator.is_supported(payment_request.currency):
            return PaymentResult(status="UNSUPPORTED_CURRENCY")
        
        # Get real-time exchange rate
        exchange_rate = await self.exchange_rate_service.get_rate(
            from_currency=payment_request.currency,
            to_currency=payment_request.settlement_currency
        )
        
        # Calculate amounts with FX spread
        fx_spread = 0.025  # 2.5% spread
        settlement_amount = payment_request.amount * exchange_rate * (1 - fx_spread)
        
        # Process payment in original currency
        charge_result = await self.payment_gateway.charge(
            amount=payment_request.amount,
            currency=payment_request.currency,
            payment_method=payment_request.payment_method
        )
        
        if charge_result.success:
            # Convert and settle in merchant's preferred currency
            await self.settlement_accounts.credit_account(
                merchant_id=payment_request.merchant_id,
                amount=settlement_amount,
                currency=payment_request.settlement_currency,
                fx_rate=exchange_rate,
                original_amount=payment_request.amount,
                original_currency=payment_request.currency
            )
        
        return PaymentResult(
            status="SUCCESS" if charge_result.success else "FAILED",
            settlement_amount=settlement_amount,
            settlement_currency=payment_request.settlement_currency,
            fx_rate=exchange_rate
        )
```

### 2. Regional Compliance Variations

**European PSD2 Compliance:**
```python
class PSD2CompliantProcessor:
    def __init__(self):
        self.sca_service = StrongCustomerAuthentication()
        self.open_banking_api = OpenBankingAPI()
        self.consent_manager = ConsentManager()
    
    async def process_psd2_payment(self, payment_request):
        # Check if SCA is required
        if self.requires_sca(payment_request):
            sca_result = await self.sca_service.initiate_authentication(
                customer_id=payment_request.customer_id,
                amount=payment_request.amount,
                merchant=payment_request.merchant_id
            )
            
            if not sca_result.authenticated:
                return PaymentResult(
                    status="SCA_REQUIRED",
                    sca_challenge_url=sca_result.challenge_url
                )
        
        # For open banking payments
        if payment_request.payment_method == 'open_banking':
            consent = await self.consent_manager.get_valid_consent(
                customer_id=payment_request.customer_id,
                bank_id=payment_request.bank_id
            )
            
            if not consent:
                return PaymentResult(
                    status="CONSENT_REQUIRED",
                    consent_url=await self.generate_consent_url(payment_request)
                )
            
            return await self.open_banking_api.initiate_payment(
                consent_id=consent.id,
                payment_request=payment_request
            )
        
        return await self.standard_card_processing(payment_request)
    
    def requires_sca(self, payment_request):
        # SCA exemptions under PSD2
        if payment_request.amount < 30:  # Low value exemption
            return False
        
        if self.is_trusted_merchant(payment_request.merchant_id):
            return False
        
        if self.is_recurring_payment(payment_request):
            return False
        
        return True
```

**Indian UPI Integration:**
```python
class UPIPaymentProcessor:
    def __init__(self):
        self.upi_gateway = UPIGateway()
        self.virtual_address_service = VirtualAddressService()
    
    async def process_upi_payment(self, payment_request):
        # Validate UPI ID format
        if not self.validate_upi_id(payment_request.upi_id):
            return PaymentResult(status="INVALID_UPI_ID")
        
        # Generate payment request
        upi_request = await self.upi_gateway.create_payment_request(
            payer_upi=payment_request.payer_upi_id,
            payee_upi=payment_request.payee_upi_id,
            amount=payment_request.amount,
            reference=payment_request.reference,
            note=payment_request.note
        )
        
        # UPI payments are typically push-based
        return PaymentResult(
            status="PENDING",
            upi_request_id=upi_request.id,
            qr_code=upi_request.qr_code,
            deep_link=upi_request.deep_link
        )
    
    async def handle_upi_callback(self, callback_data):
        # Process UPI payment status callback
        payment_status = callback_data.get('status')
        upi_request_id = callback_data.get('request_id')
        
        if payment_status == 'SUCCESS':
            await self.complete_upi_payment(upi_request_id)
        elif payment_status == 'FAILED':
            await self.fail_upi_payment(upi_request_id, callback_data.get('error'))
        
        return {"status": "acknowledged"}
```

## Payment Method Variations

### 1. Digital Wallet Integration

**Apple Pay/Google Pay Processing:**
```python
class DigitalWalletProcessor:
    def __init__(self):
        self.apple_pay_processor = ApplePayProcessor()
        self.google_pay_processor = GooglePayProcessor()
        self.tokenization_service = TokenizationService()
    
    async def process_wallet_payment(self, wallet_payment_request):
        wallet_type = wallet_payment_request.wallet_type
        
        if wallet_type == 'apple_pay':
            # Decrypt Apple Pay token
            decrypted_data = await self.apple_pay_processor.decrypt_payment_data(
                wallet_payment_request.payment_data
            )
            
            # Validate merchant certificate
            if not self.apple_pay_processor.validate_merchant_cert(
                wallet_payment_request.merchant_id
            ):
                return PaymentResult(status="INVALID_MERCHANT")
            
        elif wallet_type == 'google_pay':
            # Verify Google Pay signature
            if not self.google_pay_processor.verify_signature(
                wallet_payment_request.payment_data
            ):
                return PaymentResult(status="INVALID_SIGNATURE")
            
            decrypted_data = await self.google_pay_processor.decrypt_payment_data(
                wallet_payment_request.payment_data
            )
        
        # Process using decrypted card data
        return await self.process_card_payment(decrypted_data)
```

### 2. Buy Now, Pay Later (BNPL) Integration

**BNPL Service Integration:**
```python
class BNPLProcessor:
    def __init__(self):
        self.bnpl_providers = {
            'klarna': KlarnaAPI(),
            'afterpay': AfterpayAPI(),
            'affirm': AffirmAPI()
        }
        self.credit_check_service = CreditCheckService()
    
    async def process_bnpl_application(self, bnpl_request):
        provider = bnpl_request.provider
        bnpl_api = self.bnpl_providers[provider]
        
        # Pre-qualification check
        credit_score = await self.credit_check_service.get_score(
            customer_id=bnpl_request.customer_id
        )
        
        if credit_score < 600:
            return BNPLResult(status="DECLINED", reason="CREDIT_SCORE_TOO_LOW")
        
        # Create BNPL session with provider
        bnpl_session = await bnpl_api.create_session(
            customer_info=bnpl_request.customer_info,
            purchase_amount=bnpl_request.amount,
            merchant_id=bnpl_request.merchant_id
        )
        
        if bnpl_session.approved:
            # Set up installment schedule
            installments = await self.create_installment_schedule(
                bnpl_session.id,
                bnpl_request.amount,
                bnpl_request.installment_count
            )
            
            return BNPLResult(
                status="APPROVED",
                session_id=bnpl_session.id,
                installments=installments,
                first_payment_date=installments[0].due_date
            )
        
        return BNPLResult(status="DECLINED", reason=bnpl_session.decline_reason)
```

## Common Follow-up Questions

### 1. Handling Payment Failures

**Question: "How would you handle payment failures and retries?"**

```python
class PaymentRetryHandler:
    def __init__(self):
        self.retry_policies = {
            'network_error': {'max_retries': 3, 'backoff': 'exponential'},
            'insufficient_funds': {'max_retries': 0, 'backoff': None},
            'card_declined': {'max_retries': 1, 'backoff': 'linear'},
            'gateway_timeout': {'max_retries': 5, 'backoff': 'exponential'}
        }
    
    async def handle_payment_failure(self, payment_request, error):
        error_type = self.classify_error(error)
        retry_policy = self.retry_policies.get(error_type)
        
        if not retry_policy or payment_request.retry_count >= retry_policy['max_retries']:
            await self.send_failure_notification(payment_request)
            return PaymentResult(status="PERMANENTLY_FAILED")
        
        # Calculate retry delay
        delay = self.calculate_retry_delay(
            payment_request.retry_count,
            retry_policy['backoff']
        )
        
        # Schedule retry
        await self.schedule_payment_retry(payment_request, delay)
        
        return PaymentResult(status="RETRY_SCHEDULED", retry_delay=delay)
    
    def calculate_retry_delay(self, retry_count, backoff_type):
        if backoff_type == 'exponential':
            return min(300, 2 ** retry_count)  # Max 5 minutes
        elif backoff_type == 'linear':
            return 30 * (retry_count + 1)  # 30s, 60s, 90s...
        return 30  # Default 30 seconds
```

### 2. Handling Chargebacks and Disputes

**Question: "How would you implement chargeback management?"**

```python
class ChargebackManager:
    def __init__(self):
        self.dispute_analyzer = DisputeAnalyzer()
        self.evidence_collector = EvidenceCollector()
        self.representment_service = RepresentmentService()
    
    async def handle_chargeback_notification(self, chargeback_data):
        chargeback = await self.create_chargeback_record(chargeback_data)
        
        # Analyze dispute reason and likelihood of winning
        analysis = await self.dispute_analyzer.analyze_chargeback(chargeback)
        
        if analysis.recommended_action == 'ACCEPT':
            # Accept the chargeback (low chance of winning)
            await self.accept_chargeback(chargeback.id)
            await self.notify_merchant_chargeback_accepted(chargeback)
        
        elif analysis.recommended_action == 'DISPUTE':
            # Collect evidence for representment
            evidence = await self.evidence_collector.collect_evidence(
                transaction_id=chargeback.transaction_id,
                dispute_reason=chargeback.reason_code
            )
            
            # Submit representment
            representment_result = await self.representment_service.submit_representment(
                chargeback_id=chargeback.id,
                evidence=evidence
            )
            
            await self.notify_merchant_representment_submitted(
                chargeback, representment_result
            )
        
        return {"status": "processed", "action": analysis.recommended_action}
    
    async def collect_evidence(self, transaction_id, dispute_reason):
        evidence = {}
        
        # Transaction details
        evidence['transaction_receipt'] = await self.get_transaction_receipt(transaction_id)
        evidence['authorization_proof'] = await self.get_authorization_proof(transaction_id)
        
        # Customer communication
        if dispute_reason in ['product_not_received', 'service_not_provided']:
            evidence['delivery_confirmation'] = await self.get_delivery_confirmation(transaction_id)
            evidence['customer_communication'] = await self.get_customer_emails(transaction_id)
        
        # Fraud prevention
        if dispute_reason == 'fraudulent':
            evidence['avs_response'] = await self.get_avs_response(transaction_id)
            evidence['cvv_response'] = await self.get_cvv_response(transaction_id)
            evidence['device_fingerprint'] = await self.get_device_fingerprint(transaction_id)
        
        return evidence
```

### 3. Real-time Fraud Detection

**Question: "How would you implement real-time fraud detection?"**

```python
class RealtimeFraudDetection:
    def __init__(self):
        self.ml_model = FraudMLModel()
        self.rule_engine = FraudRuleEngine()
        self.velocity_checker = VelocityChecker()
        self.device_profiler = DeviceProfiler()
    
    async def analyze_transaction(self, transaction):
        # Parallel analysis for speed
        analysis_tasks = [
            self.ml_model.predict_fraud_probability(transaction),
            self.rule_engine.evaluate_rules(transaction),
            self.velocity_checker.check_velocity_limits(transaction),
            self.device_profiler.analyze_device_risk(transaction)
        ]
        
        ml_score, rule_violations, velocity_risk, device_risk = await asyncio.gather(
            *analysis_tasks
        )
        
        # Combine scores with weights
        final_score = (
            ml_score * 0.4 +
            len(rule_violations) * 0.1 +
            velocity_risk * 0.3 +
            device_risk * 0.2
        )
        
        # Determine action based on score
        if final_score > 0.9:
            action = "DECLINE"
        elif final_score > 0.7:
            action = "REVIEW"
        elif final_score > 0.5:
            action = "CHALLENGE"  # Require additional authentication
        else:
            action = "APPROVE"
        
        return FraudAnalysisResult(
            score=final_score,
            action=action,
            contributing_factors={
                'ml_score': ml_score,
                'rule_violations': rule_violations,
                'velocity_risk': velocity_risk,
                'device_risk': device_risk
            }
        )
```

### 4. PCI DSS Compliance Implementation

**Question: "How would you ensure PCI DSS compliance?"**

```python
class PCIComplianceManager:
    def __init__(self):
        self.tokenization_service = TokenizationService()
        self.encryption_service = EncryptionService()
        self.audit_logger = AuditLogger()
        self.access_controller = AccessController()
    
    async def process_card_data_securely(self, card_data):
        # Log access to card data
        await self.audit_logger.log_card_data_access(
            user_id=card_data.processed_by,
            action="PROCESS_PAYMENT",
            timestamp=datetime.utcnow()
        )
        
        # Validate access permissions
        if not await self.access_controller.has_card_data_access(card_data.processed_by):
            raise UnauthorizedCardDataAccessError()
        
        # Tokenize card number immediately
        card_token = await self.tokenization_service.tokenize_card(
            card_number=card_data.card_number,
            expiry=card_data.expiry
        )
        
        # Encrypt sensitive data
        encrypted_cvv = await self.encryption_service.encrypt(card_data.cvv)
        
        # Store only tokenized/encrypted data
        secure_card_data = {
            'card_token': card_token,
            'encrypted_cvv': encrypted_cvv,
            'last_four': card_data.card_number[-4:],
            'expiry_month': card_data.expiry_month,
            'expiry_year': card_data.expiry_year
        }
        
        # Clear original card data from memory
        card_data.clear_sensitive_data()
        
        return secure_card_data
    
    async def setup_pci_network_segmentation(self):
        # Network segmentation configuration
        network_config = {
            'cardholder_data_environment': {
                'subnets': ['10.0.1.0/24'],
                'firewall_rules': [
                    {'source': 'web_tier', 'destination': 'app_tier', 'port': 443},
                    {'source': 'app_tier', 'destination': 'db_tier', 'port': 5432}
                ],
                'intrusion_detection': True,
                'log_monitoring': True
            },
            'non_cde_environment': {
                'subnets': ['10.0.2.0/24'],
                'access_to_cde': False
            }
        }
        
        return network_config
```

This document covers the major variations and follow-up questions commonly encountered in payment system design interviews. The final file will provide comprehensive interview tips and discussion points.
