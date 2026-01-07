# API Rate Limiter - Variations and Follow-up Questions

## Common Variations

### 1. Distributed Rate Limiter Across Multiple Data Centers
**Question**: "How would you design a rate limiter that works consistently across multiple geographic regions?"

**Key Considerations**:
- Cross-region latency (100-300ms)
- Network partitions
- Clock synchronization
- Data consistency

**Solution Approach**:
```
Option 1: Global Counter (Strong Consistency)
- Single global Redis cluster
- All regions check same counter
- Pros: 100% accurate
- Cons: High latency (100-300ms)

Option 2: Regional Counters (Eventual Consistency)
- Each region has local counter
- Quota divided among regions
- Periodic sync and rebalancing
- Pros: Low latency (<5ms)
- Cons: 95-99% accurate

Option 3: Hybrid (Recommended)
- Local enforcement (fast path)
- Global coordination (slow path)
- Adaptive quota allocation
- Pros: Balance of speed and accuracy

Implementation:
1. Allocate quota per region (e.g., 40% US, 30% EU, 30% Asia)
2. Each region enforces locally
3. Background sync every 10 seconds
4. Rebalance quotas based on usage patterns
5. Handle edge cases (one region exhausts quota early)
```

### 2. Hierarchical Rate Limiting
**Question**: "How would you implement rate limiting at multiple levels (user, organization, API key, endpoint)?"

**Solution**:
```
Hierarchy:
Global Limit (10M req/s)
  └─ Organization Limit (100K req/s)
      └─ User Limit (1K req/s)
          └─ API Key Limit (100 req/s)
              └─ Endpoint Limit (10 req/s)

Algorithm:
1. Check all applicable limits (bottom-up)
2. Apply most restrictive limit
3. Increment all counters
4. Return decision

Example:
Request from user_123, org_456, endpoint /api/users

Checks:
✓ Global: 8M/10M (allow)
✓ Org 456: 80K/100K (allow)
✓ User 123: 950/1000 (allow)
✗ Endpoint /api/users: 11/10 (deny)

Result: Deny (endpoint limit exceeded)

Optimization:
- Cache limit hierarchy
- Short-circuit on first failure
- Batch counter updates
```

### 3. Dynamic Rate Limiting Based on System Load
**Question**: "How would you adjust rate limits dynamically based on backend system health?"

**Solution**:
```
Adaptive Rate Limiting:

System Health Metrics:
- CPU utilization
- Memory usage
- Database connection pool
- Response time (P99)
- Error rate

Adjustment Algorithm:
if system_health < 50%:
    rate_limit = base_limit * 0.5  # Reduce by 50%
elif system_health < 70%:
    rate_limit = base_limit * 0.75  # Reduce by 25%
elif system_health > 90%:
    rate_limit = base_limit * 1.2  # Increase by 20%
else:
    rate_limit = base_limit

Implementation:
1. Monitor system health every 10 seconds
2. Calculate health score (0-100)
3. Adjust rate limits proportionally
4. Propagate changes to all rate limiters
5. Gradual adjustment (avoid oscillation)

Circuit Breaker Integration:
- Open: Reduce limits to 10%
- Half-Open: Reduce limits to 50%
- Closed: Normal limits
```

### 4. Rate Limiting with Priorities
**Question**: "How would you implement rate limiting that prioritizes premium users over free users?"

**Solution**:
```
Priority Tiers:
1. Enterprise (highest priority)
2. Premium
3. Free (lowest priority)

Weighted Fair Queuing:
- Enterprise: 50% of capacity
- Premium: 30% of capacity
- Free: 20% of capacity

Implementation:
class PriorityRateLimiter:
    def check_limit(self, user):
        tier = user.tier
        
        # Check tier-specific limit
        if not self.check_tier_limit(tier):
            # Tier limit exceeded
            if tier == 'free':
                return deny()
            elif tier == 'premium':
                # Try to borrow from free tier
                if self.borrow_capacity('free'):
                    return allow()
                return deny()
            elif tier == 'enterprise':
                # Try to borrow from premium or free
                if self.borrow_capacity('premium', 'free'):
                    return allow()
                return deny()
        
        return allow()

Benefits:
- Premium users rarely hit limits
- Free users absorb overflow
- Fair resource allocation
- Revenue protection
```

### 5. Rate Limiting for Batch Operations
**Question**: "How would you rate limit batch API requests (e.g., bulk upload of 1000 items)?"

**Solution**:
```
Approaches:

Option 1: Count as Single Request
- Simple but unfair
- 1 batch = 1 request
- Allows abuse

Option 2: Count Each Item
- Fair but complex
- 1000 items = 1000 requests
- May exceed limit immediately

Option 3: Weighted Counting (Recommended)
- Balance fairness and usability
- Cost = base_cost + (items * item_cost)
- Example: 1 + (1000 * 0.1) = 101 requests

Implementation:
def calculate_cost(request):
    if request.is_batch:
        base_cost = 1
        item_cost = 0.1
        total_cost = base_cost + (request.item_count * item_cost)
        return min(total_cost, max_batch_cost)
    else:
        return 1

# Check if user has enough quota
if user.remaining_quota >= calculate_cost(request):
    allow_request()
else:
    deny_request()

Limits:
- Max batch size: 10,000 items
- Max cost per batch: 1000 requests
- Prevents abuse while allowing legitimate use
```

## Advanced Follow-up Questions

### 6. Rate Limiting with Quotas and Billing
**Question**: "How would you integrate rate limiting with a billing system where users pay for API calls?"

**Solution**:
```
Quota Management:
- Prepaid quota (e.g., 1M requests/month)
- Pay-as-you-go (e.g., $0.001 per request)
- Overage charges (e.g., 2x price after quota)

Implementation:
class BillingRateLimiter:
    def check_limit(self, user):
        quota = self.get_user_quota(user)
        usage = self.get_current_usage(user)
        
        if usage < quota.included:
            # Within prepaid quota
            return allow()
        elif usage < quota.included + quota.overage_limit:
            # Overage allowed, charge extra
            self.charge_overage(user, quota.overage_rate)
            return allow()
        else:
            # Hard limit reached
            return deny_with_upgrade_prompt()
    
    def charge_overage(self, user, rate):
        # Async billing event
        billing_queue.publish({
            'user_id': user.id,
            'charge_amount': rate,
            'timestamp': now()
        })

Quota Reset:
- Monthly: Reset on 1st of month
- Rolling: Reset 30 days from first request
- Flexible: User chooses reset date

Notifications:
- 80% quota used: Warning email
- 90% quota used: Urgent email
- 100% quota used: Upgrade prompt
```

### 7. Rate Limiting for WebSocket Connections
**Question**: "How would you rate limit WebSocket connections and messages?"

**Solution**:
```
Two-Level Rate Limiting:

Level 1: Connection Rate Limiting
- Limit new connections per user
- Prevent connection spam
- Example: 10 connections per minute

Level 2: Message Rate Limiting
- Limit messages per connection
- Prevent message spam
- Example: 100 messages per second

Implementation:
class WebSocketRateLimiter:
    def on_connection(self, user):
        # Check connection rate limit
        if not self.check_connection_limit(user):
            return reject_connection()
        
        # Track active connections
        self.increment_connection_count(user)
        return accept_connection()
    
    def on_message(self, user, connection):
        # Check message rate limit
        if not self.check_message_limit(user, connection):
            # Throttle message
            return send_rate_limit_warning()
        
        # Process message
        return process_message()
    
    def on_disconnect(self, user):
        # Decrement connection count
        self.decrement_connection_count(user)

Challenges:
- Long-lived connections
- Burst messages
- Reconnection storms
- Fair allocation across connections
```

### 8. Rate Limiting with Machine Learning
**Question**: "How would you use ML to detect and prevent abuse patterns?"

**Solution**:
```
ML-Based Anomaly Detection:

Features:
- Request rate (requests per second)
- Request patterns (endpoints, timing)
- Geographic distribution
- User agent diversity
- Success/error ratio
- Payload characteristics

Model:
- Isolation Forest (anomaly detection)
- LSTM (sequence prediction)
- Clustering (behavior grouping)

Implementation:
class MLRateLimiter:
    def check_limit(self, user, request):
        # Traditional rate limiting
        if not self.check_static_limit(user):
            return deny()
        
        # ML-based anomaly detection
        features = self.extract_features(user, request)
        anomaly_score = self.ml_model.predict(features)
        
        if anomaly_score > threshold:
            # Suspicious behavior
            self.flag_for_review(user)
            self.apply_stricter_limits(user)
            return allow_with_monitoring()
        
        return allow()
    
    def extract_features(self, user, request):
        return {
            'request_rate': self.get_request_rate(user),
            'endpoint_diversity': self.get_endpoint_diversity(user),
            'geographic_spread': self.get_geo_spread(user),
            'time_pattern': self.get_time_pattern(user),
            'error_rate': self.get_error_rate(user)
        }

Actions:
- Low risk (score < 0.3): Normal limits
- Medium risk (0.3-0.7): Reduced limits, monitoring
- High risk (> 0.7): Strict limits, CAPTCHA, manual review
```

### 9. Rate Limiting for GraphQL APIs
**Question**: "How would you rate limit GraphQL queries with varying complexity?"

**Solution**:
```
Query Complexity Calculation:

Simple Query (cost = 1):
query {
  user(id: 123) {
    name
    email
  }
}

Complex Query (cost = 1000):
query {
  users(limit: 100) {  # 100 users
    posts(limit: 10) {  # 10 posts each = 1000 posts
      comments(limit: 10) {  # 10 comments each = 10,000 comments
        author {
          name
        }
      }
    }
  }
}

Complexity Calculation:
cost = base_cost + sum(field_costs * multipliers)

Implementation:
class GraphQLRateLimiter:
    def calculate_complexity(self, query):
        complexity = 0
        
        for field in query.fields:
            field_cost = self.get_field_cost(field)
            multiplier = field.arguments.get('limit', 1)
            complexity += field_cost * multiplier
            
            # Recursive for nested fields
            if field.has_children:
                child_complexity = self.calculate_complexity(field.children)
                complexity += child_complexity * multiplier
        
        return complexity
    
    def check_limit(self, user, query):
        complexity = self.calculate_complexity(query)
        
        if complexity > user.max_query_complexity:
            return deny_with_error("Query too complex")
        
        if not self.check_quota(user, complexity):
            return deny_with_error("Rate limit exceeded")
        
        self.consume_quota(user, complexity)
        return allow()

Limits:
- Max query complexity: 10,000
- Quota: 1,000,000 complexity points per hour
- Prevents expensive queries from exhausting quota
```

### 10. Rate Limiting During Migrations
**Question**: "How would you handle rate limiting during a system migration or upgrade?"

**Solution**:
```
Migration Strategy:

Phase 1: Dual Write
- Write to both old and new systems
- Read from old system
- Validate consistency

Phase 2: Dual Read
- Write to both systems
- Read from new system (with fallback)
- Monitor for issues

Phase 3: Cutover
- Write to new system only
- Read from new system
- Decommission old system

Rate Limiting During Migration:
class MigrationRateLimiter:
    def check_limit(self, user):
        try:
            # Try new system first
            result = self.new_rate_limiter.check(user)
            
            # Dual write for validation
            self.old_rate_limiter.check(user)
            
            return result
        except NewSystemError:
            # Fallback to old system
            logger.warning("New system failed, using old")
            return self.old_rate_limiter.check(user)
    
    def validate_consistency(self):
        # Compare counters between systems
        for user in sample_users:
            old_count = self.old_rate_limiter.get_count(user)
            new_count = self.new_rate_limiter.get_count(user)
            
            if abs(old_count - new_count) > threshold:
                alert("Inconsistency detected")

Rollback Plan:
- Keep old system running for 30 days
- Monitor error rates and latency
- Quick rollback if issues detected
- Gradual traffic shift (10% → 50% → 100%)
```

These variations and follow-ups demonstrate deep understanding of rate limiting challenges and solutions in real-world scenarios.
