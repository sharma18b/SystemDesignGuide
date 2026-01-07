# Design Instagram - Variations and Follow-up Questions

## Common Variations

### 1. Design Instagram with Direct Messages

**Additional Requirements**:
- One-on-one private messaging
- Group conversations (up to 32 participants)
- Message encryption
- Media sharing in DMs
- Voice messages
- Video calls

**Architecture Changes**:
```
New Services:
- Message Service: Handle DM creation and delivery
- Conversation Service: Manage conversation metadata
- Encryption Service: End-to-end encryption
- Call Service: WebRTC for voice/video calls

Database Schema:
conversations (
  conversation_id BIGINT PRIMARY KEY,
  type VARCHAR(20), -- 'direct' or 'group'
  participants BIGINT[],
  created_at TIMESTAMP
)

messages (
  message_id BIGINT PRIMARY KEY,
  conversation_id BIGINT,
  sender_id BIGINT,
  encrypted_content TEXT,
  media_url TEXT,
  created_at TIMESTAMP
)

Real-time Delivery:
- WebSocket connections for instant delivery
- Push notifications for offline users
- Message queue for reliable delivery
```

### 2. Design Instagram Shopping

**Additional Requirements**:
- Product tagging in posts
- Shopping catalog
- Checkout flow
- Order management
- Payment processing

**Architecture Changes**:
```
New Services:
- Product Service: Manage product catalog
- Cart Service: Shopping cart management
- Order Service: Order processing
- Payment Service: Payment gateway integration

Database Schema:
products (
  product_id BIGINT PRIMARY KEY,
  merchant_id BIGINT,
  name VARCHAR(255),
  description TEXT,
  price DECIMAL(10,2),
  images TEXT[],
  inventory_count INT
)

orders (
  order_id BIGINT PRIMARY KEY,
  user_id BIGINT,
  products JSONB,
  total_amount DECIMAL(10,2),
  status VARCHAR(20),
  created_at TIMESTAMP
)

Integration:
- Stripe/PayPal for payments
- Inventory management
- Order fulfillment tracking
```

### 3. Design Instagram Reels (Short-Form Video)

**Additional Requirements**:
- 15-90 second videos
- Audio library and music
- Video effects and filters
- Algorithmic feed
- Remix/duet features

**Architecture Changes**:
```
New Services:
- Reels Service: Handle reel creation and delivery
- Audio Service: Music library and licensing
- Effects Service: Video effects and filters
- Recommendation Service: ML-based feed ranking

Video Processing:
- Vertical video format (9:16)
- Multiple quality levels
- Audio extraction and mixing
- Effect rendering
- Thumbnail generation

Feed Algorithm:
- Engagement prediction (likes, shares, watch time)
- User preferences and interests
- Content diversity
- Trending audio and effects
```

### 4. Design Instagram Live

**Additional Requirements**:
- Live video streaming
- Real-time comments
- Viewer count
- Recording and replay
- Multi-guest streaming

**Architecture Changes**:
```
New Services:
- Streaming Service: Handle live video ingestion
- Transcoding Service: Real-time transcoding
- CDN Integration: Distribute live streams

Technology Stack:
- RTMP for stream ingestion
- HLS/DASH for adaptive streaming
- WebRTC for low-latency delivery
- Media servers: Wowza, Ant Media Server

Scaling Considerations:
- 1M+ concurrent viewers per stream
- Low latency (<3 seconds)
- Adaptive bitrate streaming
- Geographic distribution via CDN
```

### 5. Design Instagram with Ads

**Additional Requirements**:
- Ad serving and targeting
- Sponsored posts in feed
- Advertiser dashboard
- Billing and payment
- Ad performance analytics

**Architecture Changes**:
```
New Services:
- Ad Service: Serve targeted ads
- Targeting Service: User segmentation
- Billing Service: Track impressions, clicks
- Campaign Management: Advertiser tools

Ad Insertion:
- Insert sponsored posts in feed (every 5th post)
- Target based on user interests, demographics
- Track impressions, clicks, conversions
- Real-time bidding for ad slots

Challenges:
- Ad relevance and quality
- User experience (not too many ads)
- Privacy concerns (data usage)
- Ad fraud detection
```

## Follow-up Questions and Answers

### Q1: "How would you handle a post going viral with millions of views?"

**Answer**:
```
Detection:
- Monitor engagement velocity (likes/views per minute)
- Threshold: >50K engagements per minute = viral

Actions:
1. Increase cache TTL (5 min → 1 hour)
2. Pre-warm CDN cache globally
3. Scale up read replicas
4. Enable aggressive caching at all levels
5. Rate limit writes to prevent overload
6. Use separate infrastructure for viral content

Optimization:
- Serve from CDN edge locations (90% hit rate)
- Use stale-while-revalidate caching
- Implement request coalescing
- Add circuit breakers
- Monitor cache hit rate and database load
```

### Q2: "How do you ensure image quality while minimizing storage?"

**Answer**:
```
Image Optimization Strategy:
1. Compression:
   - JPEG quality 85 (imperceptible loss)
   - WebP for modern browsers (30% smaller)
   - Progressive JPEG for faster rendering

2. Multiple Sizes:
   - Original: 2MB (4000×3000)
   - Feed: 200KB (1080×1080)
   - Thumbnail: 20KB (150×150)
   - Profile: 50KB (320×320)

3. Deduplication:
   - Perceptual hashing (pHash)
   - Detect duplicate uploads
   - Store once, reference multiple times
   - 20% storage savings

4. Lifecycle Management:
   - Hot: 0-30 days (NVMe SSD)
   - Warm: 30-365 days (SATA SSD)
   - Cold: >365 days (S3 Glacier)

Result: 90% storage reduction (2MB → 200KB) with minimal quality loss
```

### Q3: "How would you implement the Explore page recommendation algorithm?"

**Answer**:
```
Recommendation System:
1. Collaborative Filtering:
   - Find similar users based on engagement patterns
   - Recommend posts liked by similar users
   - User-user similarity matrix

2. Content-Based Filtering:
   - Analyze post content (hashtags, captions, visual features)
   - Recommend similar content to user's interests
   - Image similarity using CNN embeddings

3. Hybrid Approach:
   - Combine collaborative and content-based
   - Use ML model to weight different signals
   - Gradient boosting or neural network

Features:
- User engagement history (likes, saves, shares)
- Post content (hashtags, location, visual features)
- Author information (verified, follower count)
- Recency (prefer recent posts)
- Diversity (avoid filter bubble)
- Trending signals (viral posts)

Architecture:
Offline:
- Train ML models on historical data
- Compute user embeddings
- Generate candidate posts (10K per user)

Online:
- Fetch candidate posts from cache
- Score and rank in real-time
- Apply business rules (diversity, freshness)
- Return top 50 posts

Challenges:
- Cold start problem (new users)
- Filter bubble (echo chamber)
- Computational cost (real-time scoring)
- A/B testing and experimentation
```

### Q4: "How do you handle copyright infringement and DMCA takedowns?"

**Answer**:
```
Copyright Protection System:
1. Content ID Matching:
   - Hash-based matching for images
   - Audio fingerprinting for videos
   - Visual similarity detection using ML

2. Automated Detection:
   - Compare uploads against copyright database
   - Block or flag infringing content
   - Notify user of violation

3. DMCA Takedown Process:
   - Copyright holder submits takedown request
   - Verify request authenticity
   - Remove content within 24 hours
   - Notify user of removal
   - Counter-notification process

4. Repeat Infringer Policy:
   - Track copyright violations per user
   - Warning after 1st violation
   - Temporary suspension after 2nd
   - Permanent ban after 3rd

Implementation:
- Content ID database (100M+ copyrighted works)
- ML models for visual similarity
- Automated takedown workflow
- Appeal process for false positives
- Transparency report for takedowns
```

### Q5: "How would you implement story expiration after 24 hours?"

**Answer**:
```
Story Expiration Strategy:
1. S3 Lifecycle Policy:
   - Set 24-hour TTL on story objects
   - Automatic deletion by S3
   - No manual cleanup needed

2. Redis TTL:
   - Store story metadata in Redis
   - Set 24-hour TTL
   - Automatic expiration

3. Database Cleanup:
   - Mark stories as expired in database
   - Background job for cleanup
   - Run every hour

4. CDN Cache Invalidation:
   - Invalidate CDN cache after 24 hours
   - Prevent serving expired stories
   - Use cache headers (max-age: 86400)

Implementation:
Story Upload:
1. Upload to S3 with 24h lifecycle policy
2. Store metadata in Redis (TTL: 24h)
3. Store in database with expires_at timestamp
4. Publish event to Kafka

Story Fetch:
1. Check Redis for active stories
2. If miss, query database (expires_at > NOW())
3. If expired, return 404
4. Cache result in Redis

Cleanup Job:
1. Run every hour
2. Query expired stories (expires_at < NOW())
3. Delete from database
4. Invalidate CDN cache
5. Update user stats

Challenges:
- Clock skew across servers
- Eventual consistency
- CDN cache invalidation delay
- User timezone considerations
```

### Q6: "How do you handle spam and bot accounts?"

**Answer**:
```
Spam Detection System:
1. Rate Limiting:
   - Max 50 posts per hour
   - Max 200 follows per hour
   - Max 100 comments per hour
   - Exponential backoff for violations

2. ML-Based Detection:
   - Train models on labeled spam data
   - Features: post frequency, content similarity, account age
   - Real-time scoring (0-1, >0.9 = likely spam)
   - Automated actions based on score

3. Behavioral Analysis:
   - Detect automated patterns
   - Unusual activity spikes
   - Coordinated behavior across accounts
   - Fake engagement rings

4. Content Analysis:
   - Duplicate content detection
   - Malicious link detection
   - Inappropriate content filtering
   - Hashtag spam detection

Actions:
- Shadow ban (hide from feeds)
- Rate limit aggressively
- Require CAPTCHA verification
- Suspend account temporarily
- Permanent ban for severe violations

Implementation:
- Real-time scoring on every action
- Queue flagged accounts for human review
- Feedback loop to improve models
- Transparency in enforcement
```

### Q7: "How would you implement photo filters and effects?"

**Answer**:
```
Filter System Architecture:
1. Client-Side Processing:
   - Apply filters in mobile app
   - Real-time preview
   - GPU acceleration
   - Upload processed image

2. Server-Side Processing:
   - Apply filters on server
   - Consistent results across devices
   - More powerful processing
   - Higher latency

3. Hybrid Approach (Chosen):
   - Client applies filter for preview
   - Server re-applies for consistency
   - Store both original and filtered

Filter Implementation:
- Image manipulation library (ImageMagick, Pillow)
- GPU acceleration for complex filters
- Pre-defined filter presets
- Custom filter parameters

Popular Filters:
- Brightness/Contrast adjustment
- Saturation/Hue shift
- Blur/Sharpen
- Vintage/Retro effects
- Black and white
- Vignette

Storage:
- Store original image
- Store filtered image
- Allow filter changes later
- Regenerate on demand

Performance:
- Cache filtered images
- Pre-compute popular filters
- Lazy loading for less popular filters
```

### Q8: "How do you handle data privacy and GDPR compliance?"

**Answer**:
```
GDPR Compliance:
1. Right to Access:
   - Provide data export in JSON format
   - Include all posts, stories, comments, likes
   - Deliver within 30 days

2. Right to Deletion:
   - Delete account and all associated data
   - 30-day grace period before permanent deletion
   - Propagate deletion across all systems
   - Remove from backups within 90 days

3. Right to Portability:
   - Export data in machine-readable format
   - Allow transfer to other platforms
   - Include all user-generated content

4. Consent Management:
   - Explicit consent for data collection
   - Granular privacy settings
   - Opt-out of data sharing
   - Cookie consent

Implementation:
- Data export API endpoint
- Async deletion pipeline
- Audit logging for all data access
- Consent management system
- Privacy policy updates with user notification

Challenges:
- Distributed data across multiple databases
- Backup and archive deletion
- Third-party integrations
- Compliance across regions
- User education on privacy
```

## Edge Cases

### 1. User Uploads Same Photo Multiple Times
**Challenge**: Wasted storage and bandwidth
**Solution**: Perceptual hashing, deduplication, store once

### 2. Celebrity Posts Photo and Immediately Deletes
**Challenge**: Already in millions of feeds
**Solution**: Lazy deletion with tombstone markers, background cleanup

### 3. User Changes Username
**Challenge**: Update username across all systems
**Solution**: Use user_id as primary key, username as display name

### 4. Video Upload Fails Mid-Upload
**Challenge**: Partial upload, wasted bandwidth
**Solution**: Resumable uploads, chunked upload, retry logic

### 5. Story Appears After 24 Hours
**Challenge**: CDN cache not invalidated
**Solution**: Aggressive cache invalidation, short TTL, eventual consistency

This comprehensive guide covers common variations and follow-up questions for designing Instagram, providing detailed answers and implementation strategies.
