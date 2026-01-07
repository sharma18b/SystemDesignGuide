# Design Reddit - API Design

## Core APIs

### 1. Post APIs
```
GET /api/v1/r/:subreddit/posts?sort=hot&limit=25
POST /api/v1/posts
{
  "subreddit": "programming",
  "title": "Check out my project",
  "content": "...",
  "type": "text"
}

GET /api/v1/posts/:post_id
DELETE /api/v1/posts/:post_id
```

### 2. Comment APIs
```
GET /api/v1/posts/:post_id/comments?sort=best
POST /api/v1/comments
{
  "post_id": "123",
  "parent_id": null,
  "content": "Great post!"
}

GET /api/v1/comments/:comment_id
DELETE /api/v1/comments/:comment_id
```

### 3. Vote APIs
```
POST /api/v1/vote
{
  "target_id": "123",
  "target_type": "post",
  "direction": 1
}

Response:
{
  "score": 1250,
  "user_vote": 1
}
```

### 4. Subreddit APIs
```
GET /api/v1/subreddits?query=programming
POST /api/v1/subreddits
{
  "name": "mysubreddit",
  "title": "My Community",
  "description": "..."
}

GET /api/v1/r/:subreddit
PUT /api/v1/r/:subreddit
```

### 5. User APIs
```
GET /api/v1/users/:username
GET /api/v1/users/:username/posts
GET /api/v1/users/:username/comments
GET /api/v1/users/:username/karma
```

## Rate Limiting
```
Authenticated:
- Posts: 10 per hour
- Comments: 100 per hour
- Votes: 1000 per hour

Headers:
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1704675600
```

## Pagination
```
Cursor-based:
GET /api/v1/r/programming/posts?after=t3_abc123&limit=25

Response:
{
  "posts": [...],
  "after": "t3_xyz789",
  "before": "t3_def456"
}
```

This API design provides comprehensive access to Reddit functionality.
