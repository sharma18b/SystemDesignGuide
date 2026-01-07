# Design Instagram - System Architecture

## High-Level Architecture Overview

### Architecture Principles
- **Microservices Architecture**: 150+ independent services
- **Event-Driven Design**: Asynchronous processing via message queues
- **Media-First Design**: Optimized for image and video delivery
- **Multi-Region Deployment**: Active-active across 15+ regions globally
- **CDN-Heavy**: 90%+ media served from CDN edge locations
- **Read-Optimized**: Aggressive caching for read-heavy workload (500:1 ratio)

### System Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│  │   iOS    │  │ Android  │  │   Web    │                     │
│  │   App    │  │   App    │  │ Browser  │                     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                     │
└───────┼─────────────┼─────────────┼──────────────────────────────┘
        │             │             │
        └─────────────┴─────────────┘
                      │
        ┌─────────────┴─────────────┐
        │   Global Load Balancer    │
        │   (GeoDNS + Anycast)      │
        └─────────────┬─────────────┘
                      │
        ┌─────────────┴─────────────┐
        │      API Gateway          │
        │  (Auth, Rate Limit, SSL)  │
        └─────────────┬─────────────┘
                      │
        ┌─────────────┴──────────────────────────────┐
        │                                            │
┌───────┴────────┐                    ┌──────────────┴──────────┐
│  Upload Path   │                    │     Feed Path           │
│  (Media Post)  │                    │  (Content Fetch)        │
└───────┬────────┘                    └──────────────┬──────────┘
        │                                           │
┌───────┴────────┐                    ┌──────────────┴──────────┐
│  Upload Service│                    │  Feed Service           │
└───────┬────────┘                    └──────────────┬──────────┘
        │                                           │
┌───────┴────────┐                    ┌──────────────┴──────────┐
│  Media         │                    │  Feed Cache             │
│  Processing    │                    │  (Redis)                │
└───────┬────────┘                    └──────────────┬──────────┘
        │                                           │
┌───────┴────────┐                    ┌──────────────┴──────────┐
│  S3 Storage    │                    │  Feed DB                │
│  + CDN         │                    │  (Cassandra)            │
└────────────────┘                    └─────────────────────────┘
```

## Core Services Architecture

### 1. Upload Service
**Responsibilities**:
- Handle photo and video uploads
- Generate pre-signed S3 URLs for direct upload
- Validate file types and sizes
- Trigger media processing pipeline
- Store metadata in database

**Upload Flow**:
```
1. Client requests upload URL
2. Upload Service generates pre-signed S3 URL
3. Client uploads directly to S3
4. S3 triggers Lambda/SNS notification
5. Media Processing Service processes file
6. Metadata stored in database
7. CDN cache warmed
8. User notified of completion
```

**Technology Stack**:
- Language: Go (high performance, concurrent)
- Storage: S3 for media files
- Database: PostgreSQL for metadata
- Queue: SQS for processing jobs
- Cache: Redis for upload status

### 2. Media Processing Service
**Responsibilities**:
- Image compression and resizing
- Video transcoding to multiple formats
- Generate thumbnails
- Apply filters and effects
- Extract metadata (EXIF, dimensions)
- Content moderation (NSFW detection)

**Processing Pipeline**:
```
┌─────────────────┐
│  S3 Upload      │
└────────┬────────┘
         │
┌────────┴────────┐
│  SQS Queue      │
└────────┬────────┘
         │
┌────────┴────────────────────────┐
│  Processing Workers (GPU)       │
│  - Image: Resize, Compress      │
│  - Video: Transcode, Thumbnail  │
│  - ML: NSFW, Face Detection     │
└────────┬────────────────────────┘
         │
┌────────┴────────┐
│  Store Processed│
│  Media in S3    │
└────────┬────────┘
         │
┌────────┴────────┐
│  Update Metadata│
│  in Database    │
└────────┬────────┘
         │
┌────────┴────────┐
│  Warm CDN Cache │
└─────────────────┘
```

**Image Processing**:
- Original: Store as-is (2MB average)
- Feed: 1080×1080, 200KB (JPEG, quality 85)
- Thumbnail: 150×150, 20KB
- Profile: 320×320, 50KB
- Format: JPEG for photos, MP4 for videos

**Video Processing**:
- Original: Store as-is (20MB average)
- 1080p: H.264, 5MB
- 720p: H.264, 2MB
- 480p: H.264, 1MB
- Thumbnail: First frame, 100KB
- Format: MP4 with H.264 codec

### 3. Feed Service
**Responsibilities**:
- Generate personalized home feed
- Rank posts using ML algorithms
- Handle pagination and infinite scroll
- Merge different content types (posts, stories, ads)
- Cache feed results

**Feed Generation Strategy**:
```
Hybrid Approach:
1. Regular Users (<10K followers):
   - Fan-out on write (push model)
   - Pre-compute feed when post is created
   - Store in Cassandra partitioned by user_id

2. Celebrity Users (>1M followers):
   - Fan-out on read (pull model)
   - Fetch posts on-demand
   - Merge with pre-computed feed
   - Cache aggressively

3. Feed Ranking:
   - Fetch candidate posts (1000+)
   - Score using ML model
   - Rank by score
   - Apply business rules (diversity, freshness)
   - Return top 20 posts
```

**Ranking Algorithm**:
```
Score = f(
  recency (time since post),
  engagement (likes, comments, shares),
  user affinity (interaction history with author),
  content type (photo, video, carousel),
  media quality (resolution, clarity),
  hashtag relevance,
  location relevance
)

ML Model:
- Input: User features + Post features
- Output: Engagement probability (0-1)
- Training: Offline on historical data
- Serving: Real-time feature computation
```

### 4. Story Service
**Responsibilities**:
- Handle story uploads and viewing
- Manage 24-hour expiration
- Track story views and analytics
- Handle story replies
- Manage story highlights

**Story Architecture**:
```
Story Upload:
1. Upload to S3 with 24h lifecycle policy
2. Store metadata in Redis (TTL: 24h)
3. Publish event to Kafka
4. Fan-out to followers (push notification)

Story Viewing:
1. Fetch active stories from Redis
2. If miss, query database
3. Check if already viewed
4. Increment view count
5. Mark as viewed for user
6. Return story with analytics

Story Expiration:
1. S3 lifecycle policy deletes after 24h
2. Redis TTL expires keys
3. Background job cleans database
4. CDN cache invalidation
```

### 5. Social Graph Service
**Responsibilities**:
- Manage follow/unfollow relationships
- Get followers and following lists
- Suggest users to follow
- Handle private account approvals
- Manage blocked and muted users

**Graph Storage**:
```
Following Relationship (Cassandra):
CREATE TABLE following (
  user_id BIGINT,
  following_id BIGINT,
  followed_at TIMESTAMP,
  PRIMARY KEY (user_id, following_id)
);

Followers Relationship (Cassandra):
CREATE TABLE followers (
  user_id BIGINT,
  follower_id BIGINT,
  followed_at TIMESTAMP,
  PRIMARY KEY (user_id, follower_id)
);

Cache (Redis):
Key: followers:{user_id}
Value: Set of follower_ids
TTL: 1 hour

Key: following:{user_id}
Value: Set of following_ids
TTL: 1 hour
```

### 6. Engagement Service
**Responsibilities**:
- Handle likes, comments, shares
- Update engagement counts
- Manage comment threads
- Handle mentions and tags
- Send engagement notifications

**Engagement Flow**:
```
Like Post:
1. Client sends like request
2. Engagement Service validates
3. Write to database (async)
4. Update like count (eventual consistency)
5. Publish event to Kafka
6. Notification Service sends notification
7. Update cache
8. Return success to client

Comment on Post:
1. Client sends comment
2. Validate content (spam, profanity)
3. Store comment in database
4. Update comment count
5. Publish event to Kafka
6. Notification Service notifies post author
7. Return comment to client
```

### 7. Search and Discovery Service
**Responsibilities**:
- Index posts, users, hashtags, locations
- Full-text search
- Autocomplete suggestions
- Trending hashtags
- Explore page recommendations

**Search Architecture**:
```
Indexing Pipeline:
Post Created → Kafka → Indexing Worker → Elasticsearch

Search Query:
Client → Search Service → Elasticsearch → Results

Index Structure:
- Posts Index: 60TB (recent 6 months)
- Users Index: 20TB
- Hashtags Index: 10TB
- Locations Index: 10TB

Search Features:
- Full-text search
- Fuzzy matching
- Autocomplete (prefix search)
- Filters (date, location, user)
- Ranking by relevance and engagement
```

### 8. Notification Service
**Responsibilities**:
- Send push notifications
- In-app notifications
- Email notifications
- Notification preferences
- Notification batching

**Notification Types**:
- Like on post
- Comment on post
- New follower
- Mention in post/comment
- Story reply
- Live video from followed user

**Notification Pipeline**:
```
Event → Kafka → Notification Worker → Filter by Preferences →
Push Service (APNs/FCM) → Device

Batching:
- Group similar notifications (10 likes → "X and 9 others liked")
- Delay non-urgent notifications (5 minutes)
- Send digest for high-volume users
```

### 9. Recommendation Service
**Responsibilities**:
- Suggest users to follow
- Recommend posts for Explore page
- Suggest hashtags
- Recommend locations
- Personalized content discovery

**Recommendation Algorithm**:
```
Collaborative Filtering:
- Find similar users based on follow graph
- Recommend users followed by similar users

Content-Based Filtering:
- Analyze user's liked posts
- Recommend similar content

Hybrid Approach:
- Combine collaborative and content-based
- Use ML model to weight signals
- Apply business rules (diversity, freshness)

Features:
- User engagement history
- Follow graph
- Content preferences (hashtags, locations)
- Demographic information
- Time of day, day of week
```

## Data Flow Diagrams

### Photo Upload Flow
```
1. User selects photo in app
2. App requests upload URL from Upload Service
3. Upload Service generates pre-signed S3 URL
4. App uploads photo directly to S3
5. S3 triggers SNS notification
6. Media Processing Service picks up job
7. Process: Resize, compress, generate thumbnails
8. Store processed images in S3
9. Update metadata in database
10. Warm CDN cache
11. Publish event to Kafka
12. Fan-out Service distributes to followers
13. Notification Service sends notifications
14. Return success to user
```

### Feed Fetch Flow
```
1. User opens app and requests feed
2. API Gateway authenticates request
3. Feed Service checks cache (Redis)
4. If cache hit: Return cached feed
5. If cache miss:
   a. Get list of users they follow
   b. Fetch recent posts from Timeline DB
   c. Merge celebrity posts (pull model)
   d. Fetch post metadata and media URLs
   e. Rank posts using ML model
   f. Apply business rules
   g. Cache result (TTL: 5 minutes)
6. Return feed to client
7. Client fetches media from CDN
```

## Technology Stack

### Programming Languages
- **Backend Services**: Go (high performance), Python (ML)
- **Media Processing**: C++ (image/video processing)
- **ML Models**: Python (TensorFlow, PyTorch)
- **Scripts**: Python (automation, data analysis)

### Databases
- **Post Metadata**: Cassandra (time-series, high write)
- **User Data**: PostgreSQL (relational, ACID)
- **Social Graph**: Redis + Cassandra
- **Feed Storage**: Cassandra (timeline data)
- **Analytics**: ClickHouse (OLAP)

### Caching
- **Application Cache**: Redis Cluster (50TB)
- **CDN**: CloudFront / Cloudflare (90% hit rate)
- **Browser Cache**: HTTP caching headers

### Message Queue
- **Event Streaming**: Apache Kafka (high throughput)
- **Task Queue**: Amazon SQS (job processing)
- **Pub/Sub**: Redis Pub/Sub (real-time updates)

### Storage
- **Object Storage**: Amazon S3 (media files)
- **Block Storage**: EBS (database volumes)
- **Archival**: S3 Glacier (old content)

### Search
- **Full-text Search**: Elasticsearch (distributed)
- **Autocomplete**: Redis (sorted sets)

### ML Infrastructure
- **Training**: TensorFlow on GPU clusters
- **Serving**: TensorFlow Serving
- **Feature Store**: Feast
- **Experiment Tracking**: MLflow

### Monitoring
- **Metrics**: Prometheus + Grafana
- **Logging**: ELK Stack
- **Tracing**: Jaeger
- **Alerting**: PagerDuty

### Infrastructure
- **Container Orchestration**: Kubernetes
- **Service Mesh**: Istio
- **Load Balancing**: NGINX, HAProxy
- **DNS**: Route 53 (GeoDNS)

This architecture provides a scalable, reliable, and performant foundation for building an Instagram-like platform capable of handling billions of photos and videos with real-time delivery and high availability.
