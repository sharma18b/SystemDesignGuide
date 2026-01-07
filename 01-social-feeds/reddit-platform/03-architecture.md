# Design Reddit - System Architecture

## High-Level Architecture

```
[Clients] → [Load Balancer] → [API Gateway] → [Services]
                                                    ↓
                                    [Post Service, Comment Service,
                                     Vote Service, Subreddit Service]
                                                    ↓
                                    [PostgreSQL, Redis, Elasticsearch]
```

## Core Services

### 1. Post Service
- Create, read, update, delete posts
- Store in PostgreSQL (partitioned by subreddit)
- Cache hot posts in Redis
- Publish events to Kafka

### 2. Comment Service
- Threaded comment storage
- Nested comment retrieval
- Comment tree caching
- Real-time comment updates

### 3. Vote Service
- Handle upvotes/downvotes
- Update karma scores
- Prevent vote manipulation
- Cache vote counts

### 4. Ranking Service
- Hot algorithm: `score = (ups - downs) / (age + 2)^1.5`
- Best algorithm: Wilson confidence interval
- Controversial: `(ups + downs)^(min(ups,downs)/(ups+downs))`
- Cache rankings (5 min TTL)

### 5. Subreddit Service
- Create and manage subreddits
- Moderator permissions
- Subreddit settings
- Community rules

### 6. Search Service
- Elasticsearch for full-text search
- Index posts and comments
- Autocomplete suggestions
- Faceted search

## Technology Stack
- **Backend**: Python (Flask/Django)
- **Database**: PostgreSQL (posts, comments, users)
- **Cache**: Redis (rankings, hot data)
- **Search**: Elasticsearch
- **Queue**: Kafka (events)
- **CDN**: CloudFront (media)

## Data Flow

### Post Creation
```
1. User submits post
2. Post Service validates
3. Store in PostgreSQL
4. Publish to Kafka
5. Update subreddit stats
6. Invalidate cache
7. Index in Elasticsearch
```

### Feed Generation
```
1. User requests subreddit feed
2. Check Redis cache
3. If miss: Query PostgreSQL
4. Apply ranking algorithm
5. Cache result (5 min TTL)
6. Return to client
```

This architecture provides scalability for Reddit's community-driven platform.
