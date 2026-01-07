# Design YouTube/Netflix - Database Design

## PostgreSQL Schema

### Videos Table
```sql
CREATE TABLE videos (
    video_id BIGINT PRIMARY KEY,
    channel_id BIGINT NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    duration INT,
    view_count BIGINT DEFAULT 0,
    like_count INT DEFAULT 0,
    dislike_count INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    upload_date TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20),
    INDEX idx_channel_date (channel_id, upload_date),
    INDEX idx_views (view_count DESC)
);
```

### Video Files Table
```sql
CREATE TABLE video_files (
    file_id BIGINT PRIMARY KEY,
    video_id BIGINT NOT NULL,
    resolution VARCHAR(10),
    format VARCHAR(10),
    bitrate INT,
    file_url VARCHAR(500),
    file_size BIGINT,
    INDEX idx_video_resolution (video_id, resolution)
);
```

### Channels Table
```sql
CREATE TABLE channels (
    channel_id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(100),
    description TEXT,
    subscriber_count BIGINT DEFAULT 0,
    video_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Watch History Table (Cassandra)
```cql
CREATE TABLE watch_history (
    user_id BIGINT,
    video_id BIGINT,
    watched_at TIMESTAMP,
    watch_duration INT,
    completed BOOLEAN,
    PRIMARY KEY (user_id, watched_at, video_id)
) WITH CLUSTERING ORDER BY (watched_at DESC);
```

## Sharding Strategy
- **Videos**: Shard by video_id (1000 shards)
- **Watch History**: Shard by user_id (5000 shards)
- **Channels**: Shard by channel_id (500 shards)

## Caching Strategy
```
Video Metadata: Redis (1 hour TTL)
Trending Videos: Redis (5 min TTL)
Channel Info: Redis (1 day TTL)
User Preferences: Redis (1 hour TTL)
```

This database design supports YouTube/Netflix's video streaming platform.
