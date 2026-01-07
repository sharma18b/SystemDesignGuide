# Design Instagram - Database Design

## Database Selection Strategy

### Polyglot Persistence Approach
Instagram requires multiple database types for different data patterns:

- **Cassandra**: Post metadata, timelines, stories (high write, time-series)
- **PostgreSQL**: User accounts, relationships (ACID, relational)
- **Redis**: Caching, sessions, real-time data (in-memory, fast)
- **Elasticsearch**: Search, discovery (full-text, distributed)
- **S3**: Media storage (object storage, durability)

## Core Database Schemas

### 1. User Database (PostgreSQL)

#### Users Table
```sql
CREATE TABLE users (
    user_id BIGINT PRIMARY KEY,
    username VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    bio TEXT,
    website VARCHAR(255),
    profile_image_url VARCHAR(255),
    verified BOOLEAN DEFAULT FALSE,
    private_account BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_created_at (created_at)
);
```

#### User Stats Table
```sql
CREATE TABLE user_stats (
    user_id BIGINT PRIMARY KEY REFERENCES users(user_id),
    followers_count INT DEFAULT 0,
    following_count INT DEFAULT 0,
    posts_count INT DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    INDEX idx_followers_count (followers_count),
    INDEX idx_posts_count (posts_count)
);
```

### 2. Post Database (Cassandra)

#### Posts Table
```cql
CREATE TABLE posts (
    post_id BIGINT,
    user_id BIGINT,
    caption TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    location_id BIGINT,
    location_name TEXT,
    media_urls LIST<TEXT>,
    media_types LIST<TEXT>,
    hashtags SET<TEXT>,
    mentions SET<BIGINT>,
    likes_count INT,
    comments_count INT,
    shares_count INT,
    is_deleted BOOLEAN,
    PRIMARY KEY (post_id)
) WITH CLUSTERING ORDER BY (post_id DESC);

CREATE INDEX ON posts (user_id);
CREATE INDEX ON posts (created_at);
CREATE INDEX ON posts (location_id);
```

#### User Feed Table (Fan-out on Write)
```cql
CREATE TABLE user_feed (
    user_id BIGINT,
    post_id BIGINT,
    created_at TIMESTAMP,
    author_id BIGINT,
    PRIMARY KEY (user_id, created_at, post_id)
) WITH CLUSTERING ORDER BY (created_at DESC, post_id DESC);

-- Stores pre-computed feed for each user
-- Optimized for fast feed retrieval
-- Partition key: user_id
-- Clustering key: created_at, post_id (sorted by time)
```

#### User Posts Table
```cql
CREATE TABLE user_posts (
    user_id BIGINT,
    post_id BIGINT,
    created_at TIMESTAMP,
    PRIMARY KEY (user_id, created_at, post_id)
) WITH CLUSTERING ORDER BY (created_at DESC, post_id DESC);

-- Stores all posts by a specific user
-- Used for profile pages
```

### 3. Stories Database (Cassandra + Redis)

#### Stories Table (Cassandra)
```cql
CREATE TABLE stories (
    story_id BIGINT,
    user_id BIGINT,
    media_url TEXT,
    media_type TEXT,
    created_at TIMESTAMP,
    expires_at TIMESTAMP,
    views_count INT,
    is_deleted BOOLEAN,
    PRIMARY KEY (user_id, created_at, story_id)
) WITH CLUSTERING ORDER BY (created_at DESC, story_id DESC)
AND default_time_to_live = 86400;

-- TTL: 24 hours (86400 seconds)
-- Automatically deleted after expiration
```

#### Active Stories Cache (Redis)
```
Key: active_stories:{user_id}
Value: List of story_ids
TTL: 24 hours

Key: story:{story_id}
Value: JSON serialized story object
TTL: 24 hours

Key: story_views:{story_id}
Value: Set of viewer_user_ids
TTL: 24 hours
```

### 4. Social Graph Database

#### Followers Table (Cassandra)
```cql
CREATE TABLE followers (
    user_id BIGINT,
    follower_id BIGINT,
    followed_at TIMESTAMP,
    PRIMARY KEY (user_id, follower_id)
);

-- Query: Get all followers of user X
-- SELECT follower_id FROM followers WHERE user_id = X;
```

#### Following Table (Cassandra)
```cql
CREATE TABLE following (
    user_id BIGINT,
    following_id BIGINT,
    followed_at TIMESTAMP,
    PRIMARY KEY (user_id, following_id)
);

-- Query: Get all users that user X follows
-- SELECT following_id FROM following WHERE user_id = X;
```

#### Social Graph Cache (Redis)
```
Key: followers:{user_id}
Value: Set of follower_ids
TTL: 1 hour

Key: following:{user_id}
Value: Set of following_ids
TTL: 1 hour

Key: follow_count:{user_id}
Value: Hash {followers: count, following: count}
TTL: 5 minutes
```

### 5. Engagement Database (Cassandra)

#### Likes Table
```cql
CREATE TABLE likes (
    post_id BIGINT,
    user_id BIGINT,
    liked_at TIMESTAMP,
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE user_likes (
    user_id BIGINT,
    post_id BIGINT,
    liked_at TIMESTAMP,
    PRIMARY KEY (user_id, liked_at, post_id)
) WITH CLUSTERING ORDER BY (liked_at DESC, post_id DESC);
```

#### Comments Table
```cql
CREATE TABLE comments (
    comment_id BIGINT,
    post_id BIGINT,
    user_id BIGINT,
    text TEXT,
    created_at TIMESTAMP,
    parent_comment_id BIGINT,
    likes_count INT,
    is_deleted BOOLEAN,
    PRIMARY KEY (post_id, created_at, comment_id)
) WITH CLUSTERING ORDER BY (created_at DESC, comment_id DESC);

CREATE INDEX ON comments (user_id);
```

### 6. Media Metadata Database (PostgreSQL)

#### Media Table
```sql
CREATE TABLE media (
    media_id BIGINT PRIMARY KEY,
    post_id BIGINT,
    user_id BIGINT,
    media_type VARCHAR(20), -- 'photo' or 'video'
    original_url VARCHAR(255),
    compressed_url VARCHAR(255),
    thumbnail_url VARCHAR(255),
    width INT,
    height INT,
    file_size BIGINT,
    duration INT, -- for videos
    format VARCHAR(10),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    INDEX idx_post_id (post_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);
```

## Database Sharding Strategy

### Post Database Sharding
```
Sharding Key: post_id
Number of Shards: 2000 shards
Shard Selection: post_id % 2000

Benefits:
- Even distribution of posts
- No hot shards
- Easy to add more shards

Challenges:
- User timeline queries require scatter-gather
- Range queries across shards difficult
```

### User Database Sharding
```
Sharding Key: user_id
Number of Shards: 200 shards
Shard Selection: user_id % 200

Benefits:
- All user data in single shard
- Fast user profile queries
- Easy referential integrity

Challenges:
- Celebrity users may create hot shards
- Uneven distribution if user_ids not random
```

### Feed Database Sharding
```
Sharding Key: user_id
Number of Shards: 2000 shards
Shard Selection: user_id % 2000

Benefits:
- All feed data for user in single shard
- Fast feed queries
- Easy pagination

Challenges:
- Write amplification during fan-out
- Storage overhead for pre-computed feeds
```

## Indexing Strategy

### Primary Indexes
```sql
-- User lookups
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- Post lookups
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at);
CREATE INDEX idx_posts_location_id ON posts(location_id);

-- Feed queries
CREATE INDEX idx_user_feed_user_created ON user_feed(user_id, created_at);

-- Social graph
CREATE INDEX idx_followers_user_id ON followers(user_id);
CREATE INDEX idx_following_user_id ON following(user_id);
```

### Secondary Indexes
```sql
-- Search and discovery
CREATE INDEX idx_posts_hashtags ON posts USING GIN(hashtags);
CREATE INDEX idx_posts_mentions ON posts USING GIN(mentions);

-- Analytics
CREATE INDEX idx_posts_likes_count ON posts(likes_count);
CREATE INDEX idx_posts_comments_count ON posts(comments_count);
```

## Caching Strategy

### Multi-Level Cache Architecture
```
L1 Cache (Application Memory):
- Recent posts (last 1000 posts)
- User sessions
- TTL: 1 minute

L2 Cache (Redis Cluster):
- User feeds (last 100 posts)
- User profiles
- Post metadata
- Social graph
- TTL: 5-60 minutes

L3 Cache (CDN):
- Media files (images, videos)
- TTL: 24 hours - 7 days
```

### Cache Keys Design
```
Post Cache:
Key: post:{post_id}
Value: JSON serialized post object
TTL: 1 hour

Feed Cache:
Key: feed:{user_id}:{page}
Value: List of post_ids
TTL: 5 minutes

User Cache:
Key: user:{user_id}
Value: JSON serialized user object
TTL: 30 minutes

Media Cache:
Key: media:{media_id}
Value: Media metadata
TTL: 24 hours

Social Graph Cache:
Key: followers:{user_id}
Value: Set of follower_ids
TTL: 1 hour
```

### Cache Invalidation Strategy
```
Write-Through Cache:
- Update database first
- Then update cache
- Ensures consistency

Cache-Aside Pattern:
- Check cache first
- If miss, query database
- Update cache with result

Time-Based Expiration:
- Set appropriate TTL
- Shorter TTL for frequently changing data

Event-Based Invalidation:
- Invalidate cache on write operations
- Use pub/sub for cache invalidation
```

## Data Consistency Model

### Strong Consistency
- User authentication and authorization
- Follow/unfollow operations
- Account settings
- Payment transactions

### Eventual Consistency
- Feed delivery (5-10 second lag acceptable)
- Follower/following counts
- Like and comment counts
- Story views
- Trending hashtags

### Conflict Resolution
```
Last-Write-Wins (LWW):
- Use timestamp to resolve conflicts
- Simple but may lose updates

Vector Clocks:
- Track causality between updates
- Complex but preserves all updates

Application-Level Resolution:
- Custom logic based on business rules
- Example: Merge like counts by summing
```

## Data Retention and Archival

### Hot Data (Active)
- **Storage**: NVMe SSD
- **Retention**: Last 30 days
- **Access Pattern**: High read/write
- **Cost**: High

### Warm Data (Recent)
- **Storage**: SATA SSD
- **Retention**: 30 days - 1 year
- **Access Pattern**: Medium read, low write
- **Cost**: Medium

### Cold Data (Archive)
- **Storage**: S3 Glacier
- **Retention**: >1 year
- **Access Pattern**: Rare access
- **Cost**: Low

### Data Lifecycle Policy
```
Day 0-30: Hot storage (NVMe SSD)
Day 31-365: Warm storage (SATA SSD)
Day 366+: Cold storage (S3 Glacier)

Deleted posts: Soft delete with 30-day grace period
Stories: Auto-delete after 24 hours
User data: Retain for 90 days after account deletion
```

## Backup and Disaster Recovery

### Backup Strategy
```
Continuous Replication:
- Real-time replication to secondary region
- RPO: <1 hour

Snapshot Backups:
- Hourly snapshots for last 24 hours
- Daily snapshots for last 30 days
- Weekly snapshots for last 1 year

Point-in-Time Recovery:
- Restore to any point in last 7 days
- Transaction log replay
```

### Disaster Recovery Plan
```
RTO (Recovery Time Objective): 4 hours
RPO (Recovery Point Objective): 1 hour

Failover Process:
1. Detect primary region failure (10 minutes)
2. Promote secondary region to primary (30 minutes)
3. Update DNS to point to new primary (10 minutes)
4. Verify system health (30 minutes)
5. Resume normal operations (2 hours)
```

This comprehensive database design provides the foundation for building a scalable, reliable, and performant data layer for Instagram, handling billions of photos and videos with high availability and consistency.
