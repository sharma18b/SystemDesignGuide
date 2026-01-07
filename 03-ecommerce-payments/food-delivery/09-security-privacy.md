# Security and Privacy for Food Delivery Service

## Authentication and Authorization

```python
class AuthService:
    async def authenticate_user(self, credentials):
        user = await self.validate_credentials(credentials)
        token = self.jwt.generate(user.id, expires_in=3600)
        return AuthResult(token=token, user_id=user.id)
    
    async def authorize_action(self, user_id, action, resource):
        permissions = await self.get_user_permissions(user_id)
        return action in permissions.get(resource, [])
```

## Data Privacy

### Location Data Protection
```python
class LocationPrivacy:
    async def anonymize_location(self, location):
        # Round to 3 decimal places (~100m accuracy)
        return {
            'lat': round(location.lat, 3),
            'lon': round(location.lon, 3)
        }
    
    async def delete_old_locations(self):
        # Delete location data older than 30 days
        await self.db.execute("""
            DELETE FROM driver_locations
            WHERE timestamp < NOW() - INTERVAL '30 days'
        """)
```

### PII Protection
```python
class PIIProtection:
    sensitive_fields = ['phone', 'email', 'address']
    
    async def mask_pii(self, data):
        return {
            'phone': data['phone'][-4:].rjust(len(data['phone']), '*'),
            'email': self.mask_email(data['email']),
            'address': self.mask_address(data['address'])
        }
```

## Payment Security

```python
class PaymentSecurity:
    async def process_payment(self, payment_data):
        # Tokenize card data
        token = await self.tokenization.tokenize(payment_data.card)
        
        # Process with token
        result = await self.payment_gateway.charge(
            token=token,
            amount=payment_data.amount
        )
        
        # Never store actual card numbers
        return result
```

## Fraud Detection

```python
class FraudDetection:
    async def detect_fraud(self, order):
        signals = []
        
        # Check for unusual patterns
        if await self.is_unusual_location(order):
            signals.append('unusual_location')
        
        if await self.is_high_frequency(order.customer_id):
            signals.append('high_frequency')
        
        if order.total > 200:
            signals.append('high_value')
        
        risk_score = len(signals) * 0.3
        
        if risk_score > 0.7:
            return FraudResult(action='BLOCK', score=risk_score)
        elif risk_score > 0.5:
            return FraudResult(action='REVIEW', score=risk_score)
        
        return FraudResult(action='ALLOW', score=risk_score)
```

## Driver Safety

```python
class DriverSafety:
    async def verify_driver(self, driver_id):
        # Background check
        background = await self.background_check_service.verify(driver_id)
        
        # License verification
        license = await self.dmv_service.verify_license(driver_id)
        
        return background.passed and license.valid
    
    async def track_driver_safety(self, driver_id):
        # Monitor for unsafe behavior
        recent_deliveries = await self.get_recent_deliveries(driver_id)
        
        for delivery in recent_deliveries:
            if delivery.speed_violations > 0:
                await self.flag_driver(driver_id, 'speeding')
```

## GDPR Compliance

```python
class GDPRCompliance:
    async def export_user_data(self, user_id):
        return {
            'profile': await self.get_user_profile(user_id),
            'orders': await self.get_user_orders(user_id),
            'locations': await self.get_user_locations(user_id)
        }
    
    async def delete_user_data(self, user_id):
        # Anonymize instead of delete for audit trail
        await self.db.execute("""
            UPDATE orders SET customer_id = 'anonymized'
            WHERE customer_id = $1
        """, user_id)
        
        await self.db.execute("""
            DELETE FROM customers WHERE customer_id = $1
        """, user_id)
```

## Audit Logging

```python
class AuditLogger:
    async def log_action(self, action):
        await self.db.insert_audit_log({
            'user_id': action.user_id,
            'action_type': action.type,
            'resource': action.resource,
            'timestamp': datetime.utcnow(),
            'ip_address': action.ip_address
        })
```

This security document covers comprehensive protection measures. The final document will provide interview tips.
