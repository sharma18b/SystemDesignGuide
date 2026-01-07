# Design Twitter - System Architecture

## High-Level Architecture Overview

### Architecture Principles
- **Microservices Architecture**: 100+ independent services
- **Event-Driven Design**: Asynchronous communication via message queues
- **Horizontal Scalability**: Scale services independently based on load
- **Multi-Region Deployment**: Active-active across 10+ regions globally
- **Fault Tolerance**: Circuit breakers, retries, graceful degradation
- **Read-Optimized**: Heavy caching and denormalization for read performance

### System Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │   iOS    │  │ Android  │  │   Web    │  │  Desktop │       │
│  │   App    │  │   App    │  │ Browser  │  │   App    │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
└───────┼─────────────┼─────────────┼─────────────┼──────────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
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
        ┌─────────────┴─────────────────────────────┐
        │                                           │
┌───────┴────────┐                    ┌─────────────┴──────────┐
│  Write Path    │                    │     Read Path          │
│  (Tweet Post)  │                    │  (Timeline Fetch)      │
└───────┬────────┘                    └─────────────┬──────────┘
        │                                           │
┌───────┴────────┐                    ┌─────────────┴──────────┐
│  Tweet Service │                    │  Timeline Service      │
└───────┬────────┘                    └─────────────┬──────────┘
        │                                           │
┌───────┴────────┐                    ┌─────────────┴──────────┐
│  Fan-out       │                    │  Timeline Cache        │
│  Service       │                    │  (Redis)               │
└───────┬────────┘                    └─────────────┬──────────┘
        │                                           │
┌───────┴────────┐                    ┌─────────────┴──────────┐
│  Message Queue │                    │  Timeline DB           │
│  (Kafka)       │                    │  (Cassandra)           │
└───────┬────────┘                    └────────────────────────┘
        │
┌───────┴────────────────────────────────────────────┐
│                 Data Layer                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Tweet   │  │  User    │  │  Social  │        │
│  │  DB      │  │  DB      │  │  Graph   │        │
│  │(Cassandra│  │(Postgres)│  │  DB      │        │
│  └──────────┘  └──────────┘  └──────────┘        │
└────────────────────────────────────────────────────┘
```

## Core Services Architecture

### 1. Tweet Service
**Responsibilities**:
- Create, read, update, delete tweets
- Validate tweet content and media
- Generate unique tweet IDs (Snowflake algorithm)
- Store tweets in database
- Publish tweet events to message queue

**Technology Stack**:
- Language: Java/Go for high performance
- Framework: Spring Boot / gRPC
- Database: Cassandra (partitioned by tweet_id)
- Cache: Redis for recent tweets
- Message Queue: Kafka for event publishing

**API Endpoints**:
```
POST   /api/v1/tweets              - Create tweet
GET    /api/v1/tweets/:id          - Get tweet by ID
DELETE /api/v1/tweets/:id          - Delete tweet
PUT    /api/v1/tweets/:id          - Edit tweet
POST   /api/v1/tweets/:id/like     - Like tweet
POST   /api/v1/tweets/:id/retweet  - Retweet
```

### 2. Timeline Service
**Responsibilities**:
- Generate personalized home timelines
- Fetch user timelines
- Merge and rank tweets from multiple sources
- Handle pagination and cursor-based navigation
- Cache timeline results

**Timeline Generation Strategies**:

**Fan-out on Write (Push Model)**:
```
When user posts tweet:
1. Get list of all followers
2. Insert tweet into each follower's timeline
3. Pre-compute timelines for fast reads

Pros: Fast reads, simple implementation
Cons: Slow writes for celebrity users, storage overhead
Use for: Regular users (<10K followers)
```

**Fan-out on Read (Pull Model)**:
```
When user requests timeline:
1. Get list of users they follow
2. Fetch recent tweets from each user
3. Merge and sort tweets by timestamp
4. Cache result

Pros: Fast writes, no storage overhead
Cons: Slow reads, complex merge logic
Use for: Celebrity users (>1M followers)
```

**Hybrid Approach**:
```
Regular users: Fan-out on write
Celebrity users: Fan-out on read
Medium users (10K-1M): Mixed approach

Timeline = Pre-computed timeline + Celebrity tweets (fetched on-demand)
```

### 3. Fan-out Service
**Responsibilities**:
- Distribute tweets to followers' timelines
- Handle fan-out for regular users
- Rate limit fan-out for celebrity users
- Batch timeline writes for efficiency
- Handle fan-out failures and retries

**Fan-out Architecture**:
```
┌─────────────────┐
│  Tweet Posted   │
└────────┬────────┘
         │
┌────────┴────────┐
│  Fan-out Worker │
│  (Kafka Consumer)│
└────────┬────────┘
         │
┌────────┴────────────────────────┐
│  Get Followers from Social Graph│
└────────┬────────────────────────┘
         │
┌────────┴────────┐
│  Batch Writes   │
│  (1000 per batch)│
└────────┬────────┘
         │
┌────────┴────────┐
│  Timeline DB    │
│  Write          │
└─────────────────┘
```

**Fan-out Optimization**:
- Batch writes: 1000 timeline inserts per batch
- Parallel processing: 100 workers processing fan-out
- Rate limiting: Max 10K fan-outs per second per user
- Celebrity handling: Skip fan-out for users with >1M followers
- Async processing: Non-blocking fan-out via message queue

### 4. User Service
**Responsibilities**:
- User registration and authentication
- Profile management (name, bio, avatar)
- User settings and preferences
- Account verification and suspension
- User search and discovery

**Database Schema**:
```sql
users (
  user_id BIGINT PRIMARY KEY,
  username VARCHAR(15) UNIQUE,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  display_name VARCHAR(50),
  bio TEXT,
  profile_image_url VARCHAR(255),
  verified BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

user_stats (
  user_id BIGINT PRIMARY KEY,
  followers_count INT,
  following_count INT,
  tweets_count INT,
  likes_count INT,
  updated_at TIMESTAMP
)
```

### 5. Social Graph Service
**Responsibilities**:
- Manage follow/unfollow relationships
- Get followers and following lists
- Check if user A follows user B
- Suggest users to follow
- Handle blocking and muting

**Graph Storage**:
```
Following Relationship:
Key: user_id
Value: Set of user_ids they follow

Followers Relationship:
Key: user_id
Value: Set of user_ids who follow them

Technology: Redis (for hot data) + Cassandra (for persistence)
```

**API Design**:
```
POST   /api/v1/users/:id/follow      - Follow user
DELETE /api/v1/users/:id/follow      - Unfollow user
GET    /api/v1/users/:id/followers   - Get followers
GET    /api/v1/users/:id/following   - Get following
GET    /api/v1/users/:id/follows/:target_id - Check relationship
```

### 6. Media Service
**Responsibilities**:
- Upload and process images/videos
- Generate multiple image sizes (thumbnail, medium, large)
- Transcode videos to multiple formats
- Store media in object storage (S3)
- Serve media via CDN
- Handle media deletion

**Media Processing Pipeline**:
```
┌─────────────────┐
│  Client Upload  │
└────────┬────────┘
         │
┌────────┴────────┐
│  Upload Service │
│  (Pre-signed URL)│
└────────┬────────┘
         │
┌────────┴────────┐
│  S3 Upload      │
└────────┬────────┘
         │
┌────────┴────────┐
│  S3 Event       │
│  Trigger        │
└────────┬────────┘
         │
┌────────┴────────┐
│  Processing     │
│  Lambda/Worker  │
└────────┬────────┘
         │
┌────────┴────────────────────┐
│  Image: Resize, Compress    │
│  Video: Transcode, Thumbnail│
└────────┬────────────────────┘
         │
┌────────┴────────┐
│  Store Processed│
│  Media in S3    │
└────────┬────────┘
         │
┌────────┴────────┐
│  Update Media   │
│  Metadata DB    │
└─────────────────┘
```

### 7. Search Service
**Responsibilities**:
- Index tweets for full-text search
- Search tweets by keywords, hashtags, users
- Autocomplete for search queries
- Trending topics computation
- Real-time index updates

**Search Architecture**:
```
┌─────────────────┐
│  Tweet Posted   │
└────────┬────────┘
         │
┌────────┴────────┐
│  Kafka Stream   │
└────────┬────────┘
         │
┌────────┴────────┐
│  Index Worker   │
└────────┬────────┘
         │
┌────────┴────────┐
│  Elasticsearch  │
│  Cluster        │
└─────────────────┘

Search Query Flow:
Client → API Gateway → Search Service → Elasticsearch → Results
```

**Index Structure**:
```json
{
  "tweet_id": "123456789",
  "user_id": "987654321",
  "username": "johndoe",
  "text": "Hello world #greeting",
  "hashtags": ["greeting"],
  "mentions": ["@janedoe"],
  "created_at": "2026-01-08T10:00:00Z",
  "likes_count": 42,
  "retweets_count": 10,
  "language": "en"
}
```

### 8. Notification Service
**Responsibilities**:
- Send push notifications to mobile devices
- Send email notifications
- In-app notification badges
- Notification preferences management
- Batch notifications to reduce spam

**Notification Types**:
- New follower
- Tweet liked
- Tweet retweeted
- Mentioned in tweet
- Reply to tweet
- Direct message (out of scope)

**Notification Pipeline**:
```
Event → Kafka → Notification Worker → Filter by Preferences → 
Push Service (APNs/FCM) → Device
```

### 9. Trending Service
**Responsibilities**:
- Compute trending hashtags in real-time
- Detect trending topics and events
- Personalized trending based on location
- Trending tweets and moments
- Spam and bot detection for trends

**Trending Algorithm**:
```
Trending Score = (Tweet Count × Recency Factor) / Time Window

Components:
- Tweet Count: Number of tweets with hashtag
- Recency Factor: Exponential decay (recent tweets weighted higher)
- Time Window: Sliding window of 1 hour
- Velocity: Rate of increase in tweet count

Implementation:
- Count-Min Sketch for approximate counting
- Sliding window with 5-minute buckets
- Top-K algorithm for ranking (Heap)
- Update frequency: Every 5 minutes
```

## Data Flow Diagrams

### Tweet Posting Flow
```
1. User posts tweet via mobile app
2. API Gateway authenticates request
3. Tweet Service validates content
4. Generate unique tweet_id (Snowflake)
5. Store tweet in Cassandra
6. Publish tweet event to Kafka
7. Fan-out Service consumes event
8. Get followers from Social Graph Service
9. Write tweet to followers' timelines (batch)
10. Update user stats (tweet count)
11. Index tweet in Elasticsearch
12. Send notifications to mentioned users
13. Return success response to client
```

### Timeline Fetch Flow
```
1. User requests home timeline
2. API Gateway authenticates request
3. Timeline Service checks cache (Redis)
4. If cache hit: Return cached timeline
5. If cache miss:
   a. Get list of users they follow
   b. Fetch recent tweets from Timeline DB
   c. Merge celebrity tweets (pull model)
   d. Rank and sort tweets
   e. Cache result in Redis (TTL: 5 minutes)
6. Return timeline to client
```

## Technology Stack

### Programming Languages
- **Backend Services**: Java (Spring Boot), Go (high-performance services)
- **Real-time Processing**: Scala (Spark Streaming)
- **Scripts**: Python (data analysis, ML)

### Databases
- **Tweet Storage**: Cassandra (wide-column, high write throughput)
- **User Data**: PostgreSQL (relational, ACID compliance)
- **Social Graph**: Redis (in-memory, fast lookups) + Cassandra (persistence)
- **Timeline Storage**: Cassandra (time-series data)

### Caching
- **Application Cache**: Redis Cluster (10TB capacity)
- **CDN**: CloudFront / Cloudflare (media delivery)
- **Browser Cache**: HTTP caching headers

### Message Queue
- **Event Streaming**: Apache Kafka (high throughput, durability)
- **Task Queue**: RabbitMQ (job processing)

### Search
- **Full-text Search**: Elasticsearch (distributed search)
- **Autocomplete**: Redis (sorted sets)

### Storage
- **Object Storage**: Amazon S3 (media files)
- **Block Storage**: EBS (database volumes)

### Monitoring and Observability
- **Metrics**: Prometheus + Grafana
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **Tracing**: Jaeger (distributed tracing)
- **Alerting**: PagerDuty

### Infrastructure
- **Container Orchestration**: Kubernetes
- **Service Mesh**: Istio
- **Load Balancing**: NGINX, HAProxy
- **DNS**: Route 53 (GeoDNS)

This architecture provides a scalable, reliable, and performant foundation for building a Twitter-like platform capable of handling hundreds of millions of users with real-time tweet delivery and high availability.
