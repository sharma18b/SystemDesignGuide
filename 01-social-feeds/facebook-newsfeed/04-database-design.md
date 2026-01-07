# Design Facebook Newsfeed - Database Design

## Database Selection Strategy

### Polyglot Persistence
- **MySQL**: User accounts, relationships (ACID, relational)
- **Cassandra**: Posts, feeds, comments (high write, time-series)
- **TAO**: Social graph (custom graph database)
- **Memcached**: Caching layer (in-memory, fast)
- **Haystack**: Photo storage (custom blob store)

## Core Database Schemas

### 1. User Database (MySQL)

```sql
CREATE TABLE users (
    user_id BIGINT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE,
    full_name VARCHAR(100),
    password_hash VARCHAR(255),
    profile_photo_url VARCHAR(255),
    cover_photo_url VARCHAR(255),
    bio TEXT,
    location VARCHAR(100),
    birthday DATE,
    gender VARCHAR(20),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_email (email),
    INDEX idx_username (username)
);

CREATE TABLE user_stats (
    user_id BIGINT PRIMARY KEY,
    friends_count INT DEFAULT 0,
    followers_count INT DEFAULT 0,
    posts_count INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Post Database (Cassandra)

```cql
CREATE TABLE posts (
    post_id BIGINT,
    user_id BIGINT,
    content TEXT,
    post_type VARCHAR(20),
    privacy VARCHAR(20),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    location_id BIGINT,
    media_urls LIST<TEXT>,
    tagged_users SET<BIGINT>,
    reactions_count INT,
    comments_count INT,
    shares_count INT,
    PRIMARY KEY (post_id)
);

CREATE TABLE user_feed (
    user_id BIGINT,
    post_id BIGINT,
    created_at TIMESTAMP,
    author_id BIGINT,
    PRIMARY KEY (user_id, created_at, post_id)
) WITH CLUSTERING ORDER BY (created_at DESC, post_id DESC);
```

### 3. Social Graph (TAO)

```
Objects:
- User
- Post
- Comment
- Page
- Group

Associations:
- FRIEND (User → User)
- LIKE (User → Page)
- MEMBER (User → Group)
- AUTHOR (User → Post)
- COMMENT (User → Post)

Queries:
assoc_get(user_id, FRIEND) → List of friends
assoc_count(user_id, FRIEND) → Friend count
assoc_get(post_id, COMMENT) → List of comments
```

### 4. Engagement Database (Cassandra)

```cql
CREATE TABLE reactions (
    post_id BIGINT,
    user_id BIGINT,
    reaction_type VARCHAR(20),
    created_at TIMESTAMP,
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE comments (
    comment_id BIGINT,
    post_id BIGINT,
    user_id BIGINT,
    text TEXT,
    parent_comment_id BIGINT,
    created_at TIMESTAMP,
    reactions_count INT,
    PRIMARY KEY (post_id, created_at, comment_id)
) WITH CLUSTERING ORDER BY (created_at DESC);
```

## Sharding Strategy

### Post Sharding
```
Sharding Key: post_id
Shards: 5000
Selection: post_id % 5000
```

### User Sharding
```
Sharding Key: user_id
Shards: 1000
Selection: user_id % 1000
```

### Feed Sharding
```
Sharding Key: user_id
Shards: 5000
Selection: user_id % 5000
```

## Caching Strategy

### Multi-Level Cache
```
L1 (Application): Recent posts, user sessions (1 min TTL)
L2 (Memcached): Feeds, profiles, social graph (5-60 min TTL)
L3 (CDN): Media files (24 hours - 7 days TTL)
```

### Cache Keys
```
Feed: feed:{user_id}:{page}
Post: post:{post_id}
User: user:{user_id}
Friends: friends:{user_id}
```

## Data Retention

```
Hot (0-30 days): NVMe SSD
Warm (30-365 days): SATA SSD
Cold (>365 days): S3 Glacier
```

This database design provides scalability and performance for Facebook's massive scale.
