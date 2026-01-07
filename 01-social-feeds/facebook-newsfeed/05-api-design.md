# Design Facebook Newsfeed - API Design

## Core API Endpoints

### 1. Feed APIs

```
GET /api/v1/feed
Authorization: Bearer <token>
Query: count=20, cursor=abc123

Response:
{
  "posts": [{
    "post_id": "123",
    "user": {...},
    "content": "Hello world!",
    "created_at": "2026-01-08T10:00:00Z",
    "reactions": {"like": 100, "love": 50},
    "comments_count": 25,
    "shares_count": 10
  }],
  "next_cursor": "xyz789",
  "has_more": true
}
```

### 2. Post APIs

```
POST /api/v1/posts
{
  "content": "Hello world!",
  "privacy": "friends",
  "media_ids": ["media_123"],
  "tagged_users": [456, 789]
}

Response (201):
{
  "post_id": "123",
  "user": {...},
  "content": "Hello world!",
  "created_at": "2026-01-08T10:00:00Z"
}
```

### 3. Reaction APIs

```
POST /api/v1/posts/:post_id/reactions
{
  "reaction_type": "love"
}

Response:
{
  "reacted": true,
  "reactions": {"like": 100, "love": 51}
}
```

### 4. Comment APIs

```
POST /api/v1/posts/:post_id/comments
{
  "text": "Great post!",
  "parent_comment_id": null
}

Response:
{
  "comment_id": "456",
  "user": {...},
  "text": "Great post!",
  "created_at": "2026-01-08T11:00:00Z"
}
```

## Rate Limiting

```
Authenticated:
- Post creation: 100 posts per hour
- Feed requests: 500 requests per hour
- Reactions: 1000 per hour

Response Headers:
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 499
X-RateLimit-Reset: 1704675600
```

## WebSocket API

```
WebSocket: wss://realtime.facebook.com/v1/stream
Authorization: Bearer <token>

Events:
{
  "type": "new_post",
  "data": {
    "post_id": "123",
    "user": {...}
  }
}
```

This API design provides comprehensive access to Facebook newsfeed functionality.
