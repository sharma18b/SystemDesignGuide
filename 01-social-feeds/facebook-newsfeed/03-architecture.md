# Design Facebook Newsfeed - System Architecture

## High-Level Architecture Overview

### Architecture Principles
- **Microservices Architecture**: 200+ independent services
- **Event-Driven Design**: Asynchronous communication via message queues
- **ML-First Approach**: Machine learning for feed ranking and personalization
- **Multi-Region Deployment**: Active-active across 20+ regions globally
- **Read-Optimized**: Aggressive caching for read-heavy workload (200:1 ratio)
- **Real-time Updates**: WebSocket connections for live feed updates

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
│  Write Path    │                    │     Read Path           │
│  (Post Create) │                    │  (Feed Fetch)           │
└───────┬────────┘                    └──────────────┬──────────┘
        │                                           │
┌───────┴────────┐                    ┌──────────────┴──────────┐
│  Post Service  │                    │  Feed Service           │
└───────┬────────┘                    └──────────────┬──────────┘
        │                                           │
┌───────┴────────┐                    ┌──────────────┴──────────┐
│  Fan-out       │                    │  Ranking Service        │
│  Service       │                    │  (ML Models)            │
└───────┬────────┘                    └──────────────┬──────────┘
        │                                           │
┌───────┴────────┐                    ┌──────────────┴──────────┐
│  Message Queue │                    │  Feed Cache             │
│  (Kafka)       │                    │  (Redis)                │
└───────┬────────┘                    └──────────────┬──────────┘
        │                                           │
┌───────┴────────────────────────────────────────────┴──────────┐
│                     Data Layer                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  Post    │  │  User    │  │  Social  │  │  Feed    │     │
│  │  DB      │  │  DB      │  │  Graph   │  │  DB      │     │
│  │(Cassandra│  │(MySQL)   │  │  (TAO)   │  │(Cassandra│     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
└────────────────────────────────────────────────────────────────┘
```

## Core Services Architecture

### 1. Post Service
**Responsibilities**:
- Create, read, update, delete posts
- Validate post content and privacy settings
- Generate unique post IDs
- Store posts in database
- Publish post events to message queue

**Post Creation Flow**:
```
1. Client sends post request
2. Post Service validates content
3. Generate unique post_id (Snowflake)
4. Store post in Cassandra
5. Publish event to Kafka
6. Fan-out Service picks up event
7. Return success to client
```

**Technology Stack**:
- Language: C++ (high performance)
- Database: Cassandra (partitioned by post_id)
- Cache: Memcached for recent posts
- Message Queue: Kafka for event publishing

### 2. Feed Service
**Responsibilities**:
- Generate personalized newsfeeds
- Fetch posts from multiple sources (friends, pages, groups)
- Merge and rank posts using ML models
- Handle pagination and infinite scroll
- Cache feed results

**Feed Generation Strategy**:
```
Hybrid Approach:
1. Regular Users (<1000 friends):
   - Fan-out on write (push model)
   - Pre-compute feeds
   - Store in feed table

2. Power Users (>1000 friends):
   - Fan-out on read (pull model)
   - Fetch posts on-demand
   - Merge and rank in real-time

3. Celebrity Content:
   - Pull-based for users with >100K friends
   - Cache aggressively
   - Separate infrastructure

Feed Ranking:
- Fetch candidate posts (1000+)
- Score using ML model
- Rank by predicted engagement
- Apply business rules (diversity, freshness)
- Return top 20 posts
```

### 3. Ranking Service
**Responsibilities**:
- Score posts using ML models
- Predict user engagement probability
- Apply personalization signals
- Handle A/B testing experiments
- Serve models at scale

**Ranking Algorithm**:
```
Score = f(
  affinity (user-author relationship strength),
  weight (post type: photo, video, link),
  time_decay (recency of post),
  engagement (likes, comments, shares),
  content_quality (spam score, clickbait detection),
  diversity (avoid showing similar content),
  user_preferences (past interactions)
)

ML Model:
- Input: User features + Post features + Context features
- Output: Engagement probability (0-1)
- Model: Gradient Boosted Decision Trees (GBDT)
- Training: Offline on historical data
- Serving: Real-time feature computation
- Update Frequency: Daily model retraining
```

### 4. Fan-out Service
**Responsibilities**:
- Distribute posts to followers' feeds
- Handle fan-out for regular users
- Rate limit fan-out for power users
- Batch feed writes for efficiency
- Handle fan-out failures and retries

**Fan-out Architecture**:
```
┌─────────────────┐
│  Post Created   │
└────────┬────────┘
         │
┌────────┴────────┐
│  Kafka Consumer │
└────────┬────────┘
         │
┌────────┴────────────────────────┐
│  Get Friends from Social Graph  │
└────────┬────────────────────────┘
         │
┌────────┴────────┐
│  Batch Writes   │
│  (1000 per batch)│
└────────┬────────┘
         │
┌────────┴────────┐
│  Feed DB Write  │
└─────────────────┘
```

**Fan-out Optimization**:
- Batch writes: 1,000 feed inserts per batch
- Parallel processing: 500 workers
- Rate limiting: Max 50K fan-outs per second per post
- Celebrity handling: Skip fan-out for users with >100K friends
- Async processing: Non-blocking via Kafka

### 5. Social Graph Service (TAO)
**Responsibilities**:
- Manage friend relationships
- Get friends and followers lists
- Check relationship status
- Handle friend requests
- Manage privacy settings

**TAO (The Associations and Objects)**:
Facebook's distributed graph database

**Graph Storage**:
```
Objects:
- Users, Posts, Comments, Pages, Groups

Associations:
- Friend relationships
- Page likes
- Group memberships
- Post authorship

Query Examples:
- Get all friends of user X
- Get all pages user X likes
- Check if user X is friends with user Y
- Get mutual friends between X and Y

Technology:
- Distributed graph database
- MySQL backend with caching layer
- Memcached for hot data
- Async replication across regions
```

### 6. Notification Service
**Responsibilities**:
- Send push notifications
- In-app notifications
- Email notifications
- Notification preferences
- Notification batching and aggregation

**Notification Types**:
- Friend posted
- Someone liked your post
- Someone commented on your post
- Someone shared your post
- Friend request
- Tagged in post
- Mentioned in comment

**Notification Pipeline**:
```
Event → Kafka → Notification Worker → Filter by Preferences →
Aggregate Similar Notifications → Push Service (APNs/FCM) → Device
```

### 7. Ad Service
**Responsibilities**:
- Serve targeted ads in feed
- Ad ranking and auction
- Track impressions and clicks
- Billing and payment
- Ad quality scoring

**Ad Insertion**:
```
Feed Generation:
1. Generate organic feed (20 posts)
2. Identify ad slots (every 5th position)
3. Fetch candidate ads (100+)
4. Rank ads by bid × quality × relevance
5. Insert top ads into feed
6. Track impressions

Ad Targeting:
- Demographics (age, gender, location)
- Interests (pages liked, groups joined)
- Behavior (past clicks, purchases)
- Lookalike audiences
- Custom audiences
```

### 8. Content Moderation Service
**Responsibilities**:
- Automated content scanning
- ML-based detection (hate speech, NSFW)
- Queue flagged content for human review
- Handle user reports
- Apply moderation actions

**Moderation Pipeline**:
```
Post Created → Content Scanner → ML Models →
High Risk: Queue for Human Review
Medium Risk: Show with warning
Low Risk: Show normally

ML Models:
- Hate speech detection
- NSFW content detection
- Spam detection
- Misinformation detection
- Violence detection
```

### 9. Search Service
**Responsibilities**:
- Index posts, users, pages, groups
- Full-text search
- Autocomplete suggestions
- Trending topics
- Search ranking

**Search Architecture**:
```
Indexing:
Post Created → Kafka → Indexing Worker → Elasticsearch

Search Query:
Client → Search Service → Elasticsearch → Ranking → Results

Index Structure:
- Posts Index: 150TB
- Users Index: 30TB
- Pages Index: 10TB
- Groups Index: 10TB
```

## Data Flow Diagrams

### Post Creation Flow
```
1. User creates post in app
2. API Gateway authenticates request
3. Post Service validates content
4. Generate unique post_id (Snowflake)
5. Store post in Cassandra
6. Publish event to Kafka
7. Fan-out Service consumes event
8. Get friends from Social Graph (TAO)
9. Write post to friends' feeds (batch)
10. Update user stats
11. Index post in Elasticsearch
12. Send notifications to mentioned users
13. Return success to client
```

### Feed Fetch Flow
```
1. User opens app and requests feed
2. API Gateway authenticates request
3. Feed Service checks cache (Memcached)
4. If cache hit: Return cached feed
5. If cache miss:
   a. Get list of friends from TAO
   b. Fetch recent posts from Feed DB
   c. Merge celebrity posts (pull model)
   d. Fetch post metadata
   e. Score posts using Ranking Service
   f. Apply business rules
   g. Insert ads
   h. Cache result (TTL: 5 minutes)
6. Return feed to client
```

## Technology Stack

### Programming Languages
- **Backend Services**: C++ (performance-critical), Python (ML), Java
- **ML Models**: Python (PyTorch, TensorFlow)
- **Scripts**: Python (automation)

### Databases
- **Post Storage**: Cassandra (time-series, high write)
- **User Data**: MySQL (relational, ACID)
- **Social Graph**: TAO (graph database)
- **Feed Storage**: Cassandra (timeline data)
- **Analytics**: Presto (OLAP)

### Caching
- **Application Cache**: Memcached (100TB)
- **CDN**: Akamai / CloudFront (90% hit rate)

### Message Queue
- **Event Streaming**: Apache Kafka (high throughput)
- **Task Queue**: Custom queue system

### Storage
- **Object Storage**: Haystack (custom photo storage)
- **Video Storage**: Custom video infrastructure

### Search
- **Full-text Search**: Elasticsearch
- **Typeahead**: Custom Unicorn system

### ML Infrastructure
- **Training**: PyTorch on GPU clusters
- **Serving**: FBLearner Flow
- **Feature Store**: Custom feature store
- **Experiment Platform**: Custom A/B testing

### Monitoring
- **Metrics**: ODS (Operational Data Store)
- **Logging**: Scribe (log aggregation)
- **Tracing**: Canopy (distributed tracing)
- **Alerting**: Custom alerting system

### Infrastructure
- **Container Orchestration**: Tupperware (custom)
- **Service Mesh**: Custom service mesh
- **Load Balancing**: Custom load balancers
- **DNS**: Custom DNS infrastructure

This architecture provides a scalable, reliable, and performant foundation for building a Facebook-like newsfeed system capable of handling billions of users with sophisticated ML-based ranking and real-time updates.
