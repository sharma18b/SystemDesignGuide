# Design Twitter - Database Design

## Database Selection Strategy

### Polyglot Persistence Approach
Twitter requires multiple database types to handle different data patterns:

- **Cassandra**: Tweet storage, timeline storage (high write throughput, time-series)
- **PostgreSQL**: User data, account information (ACID compliance, relational)
- **Redis**: Caching, social graph hot data (in-memory, fast lookups)
- **Elasticsearch**: Full-text search, trending topics (distributed search)
- **S3**: Media storage (object storage, durability)

## Core Database Schemas

### 1. User Database (PostgreSQL)

#### Users Table
```sql
CREATE TABLE users (
    user_id BIGINT PRIMARY KEY,
    username VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(50) NOT NULL,
    bio TEXT,
    location VARCHAR(100),
    website VARCHAR(255),
    profile_image_url VARCHAR(255),
    banner_image_url VARCHAR(255),
    verified BOOLEAN DEFAULT FALSE,
    protected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP,
    
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
    tweets_count INT DEFAULT 0,
    likes_count INT DEFAULT 0,
    lists_count INT DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    INDEX idx_followers_count (followers_count),
    INDEX idx_tweets_count (tweets_count)
);
```

#### User Settings Table
```sql
CREATE TABLE user_settings (
    user_id BIGINT PRIMARY KEY REFERENCES users(user_id),
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    private_account BOOLEAN DEFAULT FALSE,
    allow_dms_from VARCHAR(20) DEFAULT 'following',
    notification_preferences JSONB,
    privacy_settings JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 2. Tweet Database (Cassandra)

#### Tweets Table
```cql
CREATE TABLE tweets (
    tweet_id BIGINT,
    user_id BIGINT,
    text TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    reply_to_tweet_id BIGINT,
    reply_to_user_id BIGINT,
    retweet_of_tweet_id BIGINT,
    quote_tweet_id BIGINT,
    media_urls LIST<TEXT>,
    hashtags SET<TEXT>,
    mentions SET<BIGINT>,
    likes_count INT,
    retweets_count INT,
    replies_count INT,
    views_count INT,
    language VARCHAR,
    source VARCHAR,
    is_deleted BOOLEAN,
    PRIMARY KEY (tweet_id)
) WITH CLUSTERING ORDER BY (tweet_id DESC);

-- Secondary index for user tweets
CREATE INDEX ON tweets (user_id);
CREATE INDEX ON tweets (created_at);
```

#### User Timeline Table (Fan-out on Write)
```cql
CREATE TABLE user_timeline (
    user_id BIGINT,
    tweet_id BIGINT,
    created_at TIMESTAMP,
    author_id BIGINT,
    PRIMARY KEY (user_id, created_at, tweet_id)
) WITH CLUSTERING ORDER BY (created_at DESC, tweet_id DESC);

-- Stores pre-computed timeline for each user
-- Optimized for fast reads
-- Partition key: user_id (all tweets for a user in same partition)
-- Clustering key: created_at, tweet_id (sorted by time)
```

#### Author Timeline Table
```cql
CREATE TABLE author_timeline (
    author_id BIGINT,
    tweet_id BIGINT,
    created_at TIMESTAMP,
    PRIMARY KEY (author_id, created_at, tweet_id)
) WITH CLUSTERING ORDER BY (created_at DESC, tweet_id DESC);

-- Stores all tweets by a specific author
-- Used for user profile pages
```

### 3. Social Graph Database

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
Value: Set of follower user_ids
TTL: 1 hour

Key: following:{user_id}
Value: Set of following user_ids
TTL: 1 hour

Key: follow_count:{user_id}
Value: Hash {followers: count, following: count}
TTL: 5 minutes
```

### 4. Engagement Database (Cassandra)

#### Likes Table
```cql
CREATE TABLE likes (
    tweet_id BIGINT,
    user_id BIGINT,
    liked_at TIMESTAMP,
    PRIMARY KEY (tweet_id, user_id)
);

CREATE TABLE user_likes (
    user_id BIGINT,
    tweet_id BIGINT,
    liked_at TIMESTAMP,
    PRIMARY KEY (user_id, liked_at, tweet_id)
) WITH CLUSTERING ORDER BY (liked_at DESC, tweet_id DESC);
```

#### Retweets Table
```cql
CREATE TABLE retweets (
    tweet_id BIGINT,
    user_id BIGINT,
    retweeted_at TIMESTAMP,
    PRIMARY KEY (tweet_id, user_id)
);

CREATE TABLE user_retweets (
    user_id BIGINT,
    tweet_id BIGINT,
    retweeted_at TIMESTAMP,
    PRIMARY KEY (user_id, retweeted_at, tweet_id)
) WITH CLUSTERING ORDER BY (retweeted_at DESC, tweet_id DESC);
```

## Database Sharding Strategy

### Tweet Database Sharding
```
Sharding Key: tweet_id
Number of Shards: 1000 shards
Shard Selection: tweet_id % 1000

Benefits:
- Even distribution of tweets across shards
- No hot shards (tweets distributed randomly)
- Easy to add more shards (consistent hashing)

Challenges:
- Range queries across shards difficult
- User timeline queries require scatter-gather
```

### User Database Sharding
```
Sharding Key: user_id
Number of Shards: 100 shards
Shard Selection: user_id % 100

Benefits:
- All user data in single shard
- Fast user profile queries
- Easy to maintain referential integrity

Challenges:
- Celebrity users may create hot shards
- Uneven distribution if user_ids not random
```

### Timeline Database Sharding
```
Sharding Key: user_id
Number of Shards: 1000 shards
Shard Selection: user_id % 1000

Benefits:
- All timeline data for user in single shard
- Fast timeline queries (no joins)
- Easy pagination

Challenges:
- Write amplification during fan-out
- Storage overhead for pre-computed timelines
```

## Indexing Strategy

### Primary Indexes
```sql
-- User lookups
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- Tweet lookups
CREATE INDEX idx_tweets_user_id ON tweets(user_id);
CREATE INDEX idx_tweets_created_at ON tweets(created_at);

-- Timeline queries
CREATE INDEX idx_user_timeline_user_created ON user_timeline(user_id, created_at);

-- Social graph
CREATE INDEX idx_followers_user_id ON followers(user_id);
CREATE INDEX idx_following_user_id ON following(user_id);
```

### Secondary Indexes
```sql
-- Search and discovery
CREATE INDEX idx_tweets_hashtags ON tweets USING GIN(hashtags);
CREATE INDEX idx_tweets_mentions ON tweets USING GIN(mentions);

-- Analytics
CREATE INDEX idx_tweets_likes_count ON tweets(likes_count);
CREATE INDEX idx_tweets_retweets_count ON tweets(retweets_count);
```

## Caching Strategy

### Multi-Level Cache Architecture
```
L1 Cache (Application Memory):
- Recent tweets (last 1000 tweets)
- User sessions
- TTL: 1 minute

L2 Cache (Redis Cluster):
- User timelines (last 200 tweets)
- User profiles
- Tweet details
- Social graph (followers/following)
- TTL: 5-60 minutes

L3 Cache (Database Query Cache):
- Query result caching
- Materialized views
```

### Cache Keys Design
```
Tweet Cache:
Key: tweet:{tweet_id}
Value: JSON serialized tweet object
TTL: 1 hour

Timeline Cache:
Key: timeline:{user_id}:{page}
Value: List of tweet_ids
TTL: 5 minutes

User Cache:
Key: user:{user_id}
Value: JSON serialized user object
TTL: 30 minutes

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
- Set appropriate TTL based on data freshness requirements
- Shorter TTL for frequently changing data

Event-Based Invalidation:
- Invalidate cache on write operations
- Use pub/sub for cache invalidation across servers
```

## Data Consistency Model

### Strong Consistency
- User authentication and authorization
- Account balance and billing
- Follow/unfollow operations
- Tweet deletion

### Eventual Consistency
- Timeline delivery (acceptable delay: 5 seconds)
- Follower/following counts
- Like and retweet counts
- Trending topics

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

Deleted tweets: Soft delete with 30-day grace period
User data: Retain for 90 days after account deletion (compliance)
```

## Backup and Disaster Recovery

### Backup Strategy
```
Continuous Replication:
- Real-time replication to secondary region
- RPO: <15 minutes

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
RTO (Recovery Time Objective): 2 hours
RPO (Recovery Point Objective): 15 minutes

Failover Process:
1. Detect primary region failure (5 minutes)
2. Promote secondary region to primary (10 minutes)
3. Update DNS to point to new primary (5 minutes)
4. Verify system health (15 minutes)
5. Resume normal operations (1 hour)
```

This comprehensive database design provides the foundation for building a scalable, reliable, and performant data layer for Twitter, handling billions of tweets and timeline requests with high availability and consistency.
