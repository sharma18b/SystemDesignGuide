# E-commerce Variations and Follow-ups

## Overview (2 mins)
E-commerce platforms come in various forms, each with unique challenges and requirements. Understanding these variations helps design systems that can adapt to different business models and scale appropriately.

## B2B vs B2C E-commerce (4 mins)

### B2C (Business-to-Consumer) Characteristics
```python
# B2C order processing - optimized for individual consumers
class B2COrderProcessor:
    def __init__(self):
        self.payment_methods = ['credit_card', 'debit_card', 'paypal', 'apple_pay']
        self.shipping_options = ['standard', 'express', 'overnight']
    
    def process_order(self, order_data):
        """B2C orders: small quantities, immediate payment"""
        # Typical B2C order
        order = {
            'user_id': order_data.user_id,
            'items': [
                {'product_id': 'LAPTOP-001', 'quantity': 1, 'price': 1299.99}
            ],
            'payment_method': 'credit_card',
            'shipping_address': order_data.shipping_address,
            'total_amount': 1299.99,
            'payment_terms': 'immediate',
            'approval_required': False
        }
        
        # Immediate payment processing
        payment_result = self.process_immediate_payment(order)
        
        if payment_result.success:
            return self.create_confirmed_order(order)
        else:
            raise PaymentFailedException()
    
    def get_pricing(self, product_id, user_id):
        """Simple pricing - same for all consumers"""
        base_price = self.product_service.get_base_price(product_id)
        
        # Apply general discounts
        discount = self.promotion_service.get_active_discount(product_id)
        
        return {
            'base_price': base_price,
            'discount': discount,
            'final_price': base_price * (1 - discount)
        }

# B2C Characteristics:
# - Small order quantities (1-10 items)
# - Immediate payment required
# - Standard pricing for all customers
# - Simple approval workflow
# - Focus on user experience and speed
```

### B2B (Business-to-Business) Characteristics
```python
# B2B order processing - complex business requirements
class B2BOrderProcessor:
    def __init__(self):
        self.payment_terms = ['net_30', 'net_60', 'net_90', 'immediate']
        self.approval_workflows = ApprovalWorkflowEngine()
    
    def process_order(self, order_data):
        """B2B orders: large quantities, complex approval, credit terms"""
        # Typical B2B order
        order = {
            'company_id': order_data.company_id,
            'buyer_id': order_data.buyer_id,
            'items': [
                {'product_id': 'LAPTOP-001', 'quantity': 100, 'unit_price': 1199.99},
                {'product_id': 'MONITOR-001', 'quantity': 100, 'unit_price': 299.99}
            ],
            'total_amount': 149999.00,
            'payment_terms': 'net_30',
            'purchase_order_number': 'PO-2024-001234',
            'approval_required': True,
            'shipping_instructions': 'Deliver to warehouse dock 3',
            'billing_contact': order_data.billing_contact
        }
        
        # Check credit limit
        credit_check = self.check_credit_limit(
            order_data.company_id, 
            order.total_amount
        )
        
        if not credit_check.approved:
            raise CreditLimitExceededException()
        
        # Require approval for large orders
        if order.total_amount > 10000:
            return self.submit_for_approval(order)
        else:
            return self.create_pending_order(order)
    
    def get_pricing(self, product_id, company_id):
        """Complex pricing with volume discounts and contracts"""
        base_price = self.product_service.get_base_price(product_id)
        
        # Check for contract pricing
        contract_price = self.contract_service.get_contract_price(
            company_id, product_id
        )
        
        if contract_price:
            return contract_price
        
        # Apply volume discounts
        volume_discount = self.calculate_volume_discount(company_id, product_id)
        
        return {
            'base_price': base_price,
            'volume_discount': volume_discount,
            'final_price': base_price * (1 - volume_discount),
            'payment_terms': self.get_payment_terms(company_id)
        }
    
    def calculate_volume_discount(self, company_id, product_id):
        """Volume-based pricing tiers"""
        annual_volume = self.get_annual_purchase_volume(company_id, product_id)
        
        if annual_volume >= 1000:
            return 0.15  # 15% discount
        elif annual_volume >= 500:
            return 0.10  # 10% discount
        elif annual_volume >= 100:
            return 0.05  # 5% discount
        else:
            return 0.0   # No discount

# B2B Characteristics:
# - Large order quantities (100-10,000 items)
# - Credit terms (Net 30/60/90 days)
# - Volume-based pricing
# - Complex approval workflows
# - Purchase order integration
# - Account management features
```

### B2B vs B2C Comparison Table
| Aspect | B2C | B2B |
|--------|-----|-----|
| Order Size | 1-10 items | 100-10,000 items |
| Payment | Immediate | Credit terms (Net 30-90) |
| Pricing | Fixed pricing | Volume discounts, contracts |
| Approval | None | Multi-level approval |
| Users | Individual consumers | Multiple buyers per company |
| Catalog | Public catalog | Custom catalogs per company |
| Shipping | Home delivery | Bulk shipping to warehouses |
| Support | Self-service | Dedicated account managers |

## Marketplace vs Single-Vendor Platforms (4 mins)

### Single-Vendor Platform (Amazon Retail)
```python
# Single vendor - Amazon owns inventory
class SingleVendorPlatform:
    def __init__(self):
        self.inventory_service = InventoryService()
        self.fulfillment_service = FulfillmentService()
    
    def list_products(self, category=None):
        """All products owned by single entity"""
        products = self.product_service.get_products(
            category=category,
            owner='amazon'
        )
        
        # Single inventory source
        for product in products:
            product.inventory = self.inventory_service.get_stock(product.id)
            product.fulfillment = 'amazon_fulfillment'
        
        return products
    
    def process_order(self, order_data):
        """Simplified order processing - single seller"""
        order = Order(
            items=order_data.items,
            seller='amazon',
            fulfillment_method='amazon_fulfillment'
        )
        
        # Single payment to Amazon
        payment = self.process_payment(
            amount=order.total_amount,
            recipient='amazon'
        )
        
        # Single fulfillment workflow
        fulfillment = self.fulfillment_service.create_shipment(order)
        
        return {
            'order_id': order.id,
            'payment_id': payment.id,
            'tracking_number': fulfillment.tracking_number
        }

# Advantages:
# - Consistent customer experience
# - Simplified inventory management
# - Single fulfillment process
# - Better quality control
# - Unified customer service
```

### Marketplace Platform (Amazon Marketplace)
```python
# Multi-vendor marketplace - complex seller management
class MarketplacePlatform:
    def __init__(self):
        self.seller_service = SellerService()
        self.payment_splitting_service = PaymentSplittingService()
        self.dispute_service = DisputeService()
    
    def list_products(self, category=None):
        """Products from multiple sellers"""
        products = self.product_service.get_products(category=category)
        
        # Multiple inventory sources
        for product in products:
            product.offers = []
            sellers = self.seller_service.get_sellers_for_product(product.id)
            
            for seller in sellers:
                offer = {
                    'seller_id': seller.id,
                    'seller_name': seller.business_name,
                    'seller_rating': seller.rating,
                    'price': seller.get_price(product.id),
                    'inventory': seller.get_inventory(product.id),
                    'fulfillment_method': seller.fulfillment_method,
                    'shipping_time': seller.get_shipping_time(product.id)
                }
                product.offers.append(offer)
            
            # Sort by price, rating, fulfillment speed
            product.offers.sort(key=lambda x: (x['price'], -x['seller_rating']))
        
        return products
    
    def process_order(self, order_data):
        """Complex order processing - multiple sellers"""
        # Group items by seller
        seller_orders = self.group_items_by_seller(order_data.items)
        
        order_results = []
        
        for seller_id, items in seller_orders.items():
            seller_order = {
                'seller_id': seller_id,
                'items': items,
                'subtotal': sum(item.price * item.quantity for item in items)
            }
            
            # Calculate marketplace fees
            marketplace_fee = seller_order['subtotal'] * 0.15  # 15% commission
            seller_payout = seller_order['subtotal'] - marketplace_fee
            
            # Split payment
            payment_split = self.payment_splitting_service.create_split(
                total_amount=seller_order['subtotal'],
                splits=[
                    {'recipient': 'marketplace', 'amount': marketplace_fee},
                    {'recipient': seller_id, 'amount': seller_payout}
                ]
            )
            
            # Create seller-specific order
            seller_order_result = self.create_seller_order(seller_order)
            order_results.append(seller_order_result)
        
        return {
            'marketplace_order_id': self.generate_order_id(),
            'seller_orders': order_results,
            'total_amount': sum(result['amount'] for result in order_results)
        }
    
    def handle_seller_onboarding(self, seller_application):
        """Complex seller verification and onboarding"""
        verification_steps = [
            self.verify_business_documents(seller_application),
            self.check_tax_information(seller_application),
            self.validate_bank_account(seller_application),
            self.perform_background_check(seller_application),
            self.review_product_catalog(seller_application)
        ]
        
        if all(step.passed for step in verification_steps):
            seller = self.create_seller_account(seller_application)
            self.setup_seller_dashboard(seller)
            return seller
        else:
            failed_steps = [step.name for step in verification_steps if not step.passed]
            raise SellerVerificationFailedException(failed_steps)

# Marketplace Challenges:
# - Seller verification and onboarding
# - Payment splitting and escrow
# - Inventory management across sellers
# - Quality control and dispute resolution
# - Complex fulfillment coordination
# - Seller performance monitoring
```

### Marketplace vs Single-Vendor Comparison
| Aspect | Single-Vendor | Marketplace |
|--------|---------------|-------------|
| Inventory | Centralized | Distributed across sellers |
| Payment | Single recipient | Payment splitting required |
| Quality Control | Direct control | Seller management needed |
| Fulfillment | Unified process | Multiple fulfillment methods |
| Customer Service | Single point | Coordination with sellers |
| Revenue Model | Product margins | Commission-based |
| Complexity | Lower | Higher |
| Scalability | Limited by inventory | Unlimited through sellers |

## Subscription Commerce (4 mins)

### Subscription Model Implementation
```python
# Subscription-based e-commerce platform
class SubscriptionCommerceService:
    def __init__(self):
        self.billing_service = RecurringBillingService()
        self.subscription_service = SubscriptionService()
        self.inventory_service = InventoryService()
    
    def create_subscription(self, subscription_data):
        """Create recurring subscription"""
        subscription = {
            'user_id': subscription_data.user_id,
            'plan_id': subscription_data.plan_id,
            'billing_cycle': subscription_data.billing_cycle,  # monthly, quarterly, annual
            'start_date': datetime.utcnow(),
            'status': 'active',
            'payment_method': subscription_data.payment_method,
            'shipping_address': subscription_data.shipping_address,
            'preferences': subscription_data.preferences
        }
        
        # Calculate next billing date
        subscription['next_billing_date'] = self.calculate_next_billing_date(
            subscription['start_date'],
            subscription['billing_cycle']
        )
        
        # Create initial order
        initial_order = self.create_subscription_order(subscription)
        
        # Schedule recurring billing
        self.billing_service.schedule_recurring_payment(
            subscription_id=subscription['id'],
            amount=subscription_data.amount,
            billing_cycle=subscription['billing_cycle'],
            payment_method=subscription['payment_method']
        )
        
        return subscription
    
    def process_recurring_order(self, subscription_id):
        """Process monthly/recurring subscription order"""
        subscription = self.subscription_service.get_subscription(subscription_id)
        
        if subscription.status != 'active':
            return {'status': 'skipped', 'reason': 'subscription_inactive'}
        
        # Customize order based on preferences and history
        order_items = self.generate_subscription_items(subscription)
        
        # Check inventory availability
        inventory_check = self.inventory_service.check_availability(order_items)
        if not inventory_check.all_available:
            # Handle out-of-stock items
            order_items = self.handle_out_of_stock_items(
                order_items, 
                inventory_check.unavailable_items,
                subscription.preferences
            )
        
        # Process payment
        payment_result = self.billing_service.charge_subscription(
            subscription_id=subscription_id,
            amount=self.calculate_order_total(order_items)
        )
        
        if payment_result.success:
            # Create and fulfill order
            order = self.create_order(
                subscription_id=subscription_id,
                items=order_items,
                payment_id=payment_result.payment_id
            )
            
            # Update next billing date
            self.update_next_billing_date(subscription_id)
            
            return {'status': 'success', 'order_id': order.id}
        else:
            # Handle payment failure
            return self.handle_payment_failure(subscription_id, payment_result)
    
    def handle_payment_failure(self, subscription_id, payment_result):
        """Handle failed subscription payments"""
        subscription = self.subscription_service.get_subscription(subscription_id)
        
        # Retry logic
        retry_count = subscription.payment_retry_count or 0
        
        if retry_count < 3:
            # Schedule retry in 3 days
            self.billing_service.schedule_payment_retry(
                subscription_id=subscription_id,
                retry_date=datetime.utcnow() + timedelta(days=3),
                retry_count=retry_count + 1
            )
            
            # Send payment failure notification
            self.notification_service.send_payment_failure_notice(subscription)
            
            return {'status': 'retry_scheduled', 'retry_count': retry_count + 1}
        else:
            # Cancel subscription after 3 failed attempts
            self.subscription_service.cancel_subscription(
                subscription_id=subscription_id,
                reason='payment_failure'
            )
            
            return {'status': 'subscription_cancelled', 'reason': 'payment_failure'}
    
    def generate_subscription_items(self, subscription):
        """Generate items based on subscription preferences and history"""
        plan = self.get_subscription_plan(subscription.plan_id)
        
        if plan.type == 'curated_box':
            # Curated selection based on preferences
            items = self.curation_service.generate_curated_items(
                user_preferences=subscription.preferences,
                previous_orders=self.get_previous_orders(subscription.id),
                budget=plan.monthly_budget
            )
        elif plan.type == 'replenishment':
            # Automatic replenishment of consumables
            items = self.replenishment_service.calculate_replenishment_items(
                user_id=subscription.user_id,
                consumption_history=self.get_consumption_history(subscription.user_id)
            )
        else:
            # Fixed subscription items
            items = plan.default_items
        
        return items

# Subscription Commerce Challenges:
# - Recurring billing and payment failures
# - Inventory planning for subscriptions
# - Personalization and curation
# - Churn prediction and retention
# - Subscription lifecycle management
# - Dunning management (failed payment recovery)
```

### Subscription Analytics and Metrics
```python
class SubscriptionAnalytics:
    def calculate_key_metrics(self, time_period):
        """Calculate subscription business metrics"""
        return {
            # Revenue Metrics
            'monthly_recurring_revenue': self.calculate_mrr(time_period),
            'annual_recurring_revenue': self.calculate_arr(time_period),
            'average_revenue_per_user': self.calculate_arpu(time_period),
            
            # Customer Metrics
            'customer_acquisition_cost': self.calculate_cac(time_period),
            'customer_lifetime_value': self.calculate_clv(time_period),
            'churn_rate': self.calculate_churn_rate(time_period),
            'retention_rate': self.calculate_retention_rate(time_period),
            
            # Growth Metrics
            'net_revenue_retention': self.calculate_nrr(time_period),
            'gross_revenue_retention': self.calculate_grr(time_period),
            'subscription_growth_rate': self.calculate_growth_rate(time_period)
        }
    
    def calculate_churn_rate(self, time_period):
        """Monthly churn rate calculation"""
        start_subscribers = self.get_active_subscribers(time_period.start)
        churned_subscribers = self.get_churned_subscribers(time_period)
        
        return churned_subscribers / start_subscribers * 100
```

## International Expansion Challenges (4 mins)

### Multi-Currency and Localization
```python
class InternationalEcommerceService:
    def __init__(self):
        self.currency_service = CurrencyService()
        self.tax_service = TaxService()
        self.localization_service = LocalizationService()
        self.compliance_service = ComplianceService()
    
    def get_localized_product(self, product_id, country_code, currency):
        """Localize product for specific market"""
        base_product = self.product_service.get_product(product_id)
        
        # Currency conversion
        localized_price = self.currency_service.convert_price(
            base_product.price,
            from_currency='USD',
            to_currency=currency,
            country=country_code
        )
        
        # Regional pricing adjustments
        regional_multiplier = self.get_regional_pricing_multiplier(country_code)
        final_price = localized_price * regional_multiplier
        
        # Localized content
        localized_content = self.localization_service.get_localized_content(
            product_id=product_id,
            language=self.get_country_language(country_code)
        )
        
        # Compliance checks
        compliance_status = self.compliance_service.check_product_compliance(
            product_id=product_id,
            country=country_code
        )
        
        return {
            'product_id': product_id,
            'title': localized_content.title,
            'description': localized_content.description,
            'price': {
                'amount': final_price,
                'currency': currency,
                'formatted': self.format_currency(final_price, currency, country_code)
            },
            'availability': {
                'available': compliance_status.allowed,
                'restrictions': compliance_status.restrictions
            },
            'shipping': self.get_shipping_options(product_id, country_code),
            'taxes': self.calculate_taxes(final_price, country_code)
        }
    
    def process_international_order(self, order_data):
        """Handle international order with customs and duties"""
        order = self.create_base_order(order_data)
        
        # Calculate international shipping
        shipping_cost = self.calculate_international_shipping(
            items=order.items,
            destination_country=order_data.shipping_address.country,
            shipping_method=order_data.shipping_method
        )
        
        # Calculate customs duties and taxes
        customs_info = self.calculate_customs_duties(
            items=order.items,
            destination_country=order_data.shipping_address.country,
            order_value=order.subtotal
        )
        
        # Generate customs documentation
        customs_docs = self.generate_customs_documentation(order, customs_info)
        
        # Update order totals
        order.shipping_cost = shipping_cost
        order.duties_and_taxes = customs_info.total_duties
        order.total_amount = order.subtotal + shipping_cost + customs_info.total_duties
        
        # Process payment in local currency
        payment_result = self.process_international_payment(
            amount=order.total_amount,
            currency=order_data.currency,
            payment_method=order_data.payment_method,
            country=order_data.billing_address.country
        )
        
        return {
            'order_id': order.id,
            'total_amount': order.total_amount,
            'currency': order_data.currency,
            'customs_documentation': customs_docs,
            'estimated_delivery': self.calculate_international_delivery_time(
                order_data.shipping_address.country
            )
        }
    
    def handle_regional_compliance(self, country_code):
        """Handle region-specific compliance requirements"""
        compliance_rules = {
            'EU': {
                'gdpr_required': True,
                'vat_calculation': 'destination_based',
                'cookie_consent': True,
                'right_to_be_forgotten': True
            },
            'US': {
                'sales_tax': 'state_based',
                'ccpa_compliance': True,  # California
                'ada_compliance': True
            },
            'CN': {
                'icp_license_required': True,
                'data_localization': True,
                'content_restrictions': True
            },
            'IN': {
                'gst_calculation': True,
                'fdi_compliance': True,
                'local_payment_methods': ['upi', 'paytm', 'razorpay']
            }
        }
        
        return compliance_rules.get(country_code, {})

# International Challenges:
# - Multi-currency pricing and conversion
# - Tax calculation (VAT, GST, sales tax)
# - Customs duties and import regulations
# - Payment method localization
# - Language and cultural localization
# - Regulatory compliance (GDPR, CCPA, etc.)
# - Cross-border logistics
# - Customer service in multiple time zones
```

## Mobile Commerce Considerations (2 mins)

### Mobile-First Design Patterns
```python
class MobileCommerceOptimizations:
    def optimize_for_mobile(self):
        """Mobile-specific optimizations"""
        return {
            # Performance Optimizations
            'image_optimization': {
                'webp_format': True,
                'lazy_loading': True,
                'responsive_images': True,
                'compression_ratio': 0.8
            },
            
            # User Experience
            'touch_optimizations': {
                'minimum_touch_target': '44px',
                'swipe_gestures': True,
                'pull_to_refresh': True,
                'infinite_scroll': True
            },
            
            # Checkout Optimizations
            'mobile_checkout': {
                'guest_checkout': True,
                'autofill_support': True,
                'mobile_payments': ['apple_pay', 'google_pay', 'samsung_pay'],
                'one_click_checkout': True,
                'address_autocomplete': True
            },
            
            # Offline Capabilities
            'offline_features': {
                'cart_persistence': True,
                'wishlist_sync': True,
                'offline_browsing': True,
                'background_sync': True
            }
        }
```

## Follow-up Questions and Extensions

### Common Interview Follow-ups
1. **"How would you handle flash sales with limited inventory?"**
   - Queue-based order processing
   - Inventory pre-allocation
   - Rate limiting and bot detection

2. **"How would you implement a recommendation engine?"**
   - Collaborative filtering
   - Content-based recommendations
   - Real-time vs batch processing
   - A/B testing for recommendations

3. **"How would you handle returns and refunds?"**
   - Return authorization system
   - Inventory restocking workflow
   - Refund processing and reconciliation
   - Return fraud detection

4. **"How would you scale to support 1 million concurrent users?"**
   - Horizontal scaling strategies
   - Database sharding and replication
   - CDN and caching layers
   - Load balancing and auto-scaling

5. **"How would you implement search autocomplete?"**
   - Trie data structure
   - Elasticsearch suggestions
   - Caching popular searches
   - Personalized suggestions
