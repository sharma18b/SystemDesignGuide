# Design Reddit - Database Design

## PostgreSQL Schema

### Posts Table
```sql
CREATE TABLE posts (
    post_id BIGINT PRIMARY KEY,
    subreddit_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    title VARCHAR(300) NOT NULL,
    content TEXT,
    post_type VARCHAR(20),
    url VARCHAR(2000),
    score INT DEFAULT 0,
    upvotes INT DEFAULT 0,
    downvotes INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_subreddit_created (subreddit_id, created_at),
    INDEX idx_subreddit_score (subreddit_id, score)
);
```

### Comments Table
```sql
CREATE TABLE comments (
    comment_id BIGINT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    parent_comment_id BIGINT,
    user_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    score INT DEFAULT 0,
    upvotes INT DEFAULT 0,
    downvotes INT DEFAULT 0,
    depth INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_post_parent (post_id, parent_comment_id),
    INDEX idx_post_score (post_id, score DESC)
);
```

### Votes Table
```sql
CREATE TABLE votes (
    vote_id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    target_id BIGINT NOT NULL,
    target_type VARCHAR(20),
    vote_value INT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE KEY unique_vote (user_id, target_id, target_type)
);
```

### Subreddits Table
```sql
CREATE TABLE subreddits (
    subreddit_id BIGINT PRIMARY KEY,
    name VARCHAR(21) UNIQUE NOT NULL,
    title VARCHAR(100),
    description TEXT,
    subscriber_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_name (name),
    INDEX idx_subscribers (subscriber_count DESC)
);
```

## Sharding Strategy
- **Posts**: Shard by subreddit_id (500 shards)
- **Comments**: Shard by post_id (500 shards)
- **Votes**: Shard by user_id (100 shards)

## Caching Strategy
```
Hot Posts: Redis (1 hour TTL)
Comment Trees: Redis (30 min TTL)
Vote Counts: Redis (5 min TTL)
Subreddit Info: Redis (1 day TTL)
```

## Indexing
- Composite indexes on (subreddit_id, created_at)
- Composite indexes on (subreddit_id, score)
- Full-text indexes on title and content

This database design supports Reddit's threaded discussions and voting system.
