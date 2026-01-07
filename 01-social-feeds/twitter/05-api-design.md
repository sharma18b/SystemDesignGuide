# Design Twitter - API Design

## API Architecture

### RESTful API Principles
- **Resource-Based URLs**: `/api/v1/tweets`, `/api/v1/users`
- **HTTP Methods**: GET (read), POST (create), PUT (update), DELETE (delete)
- **Status Codes**: 200 (success), 201 (created), 400 (bad request), 401 (unauthorized), 404 (not found), 500 (server error)
- **Versioning**: URL-based versioning (`/api/v1/`, `/api/v2/`)
- **Pagination**: Cursor-based pagination for timelines
- **Rate Limiting**: Per-user and per-endpoint limits

### API Gateway Features
- **Authentication**: JWT token validation
- **Rate Limiting**: Token bucket algorithm
- **Request Validation**: Schema validation
- **Response Caching**: Cache GET requests
- **Load Balancing**: Distribute requests across services
- **Monitoring**: Request logging and metrics

## Authentication and Authorization

### Authentication Flow
```
1. User Login:
POST /api/v1/auth/login
Request: { "username": "johndoe", "password": "secret" }
Response: { "access_token": "jwt_token", "refresh_token": "refresh_token", "expires_in": 3600 }

2. Token Refresh:
POST /api/v1/auth/refresh
Request: { "refresh_token": "refresh_token" }
Response: { "access_token": "new_jwt_token", "expires_in": 3600 }

3. Logout:
POST /api/v1/auth/logout
Request: { "access_token": "jwt_token" }
Response: { "message": "Logged out successfully" }
```

### Authorization Headers
```
Authorization: Bearer <jwt_token>

JWT Payload:
{
  "user_id": 123456789,
  "username": "johndoe",
  "verified": true,
  "iat": 1704672000,
  "exp": 1704675600
}
```

## Core API Endpoints

### 1. Tweet APIs

#### Create Tweet
```
POST /api/v1/tweets
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "text": "Hello world! #greeting",
  "media_ids": ["media_123", "media_456"],
  "reply_to_tweet_id": null,
  "quote_tweet_id": null
}

Response (201 Created):
{
  "tweet_id": "987654321",
  "user_id": "123456789",
  "username": "johndoe",
  "text": "Hello world! #greeting",
  "created_at": "2026-01-08T10:00:00Z",
  "media": [
    {
      "media_id": "media_123",
      "type": "image",
      "url": "https://cdn.twitter.com/media/123.jpg"
    }
  ],
  "hashtags": ["greeting"],
  "mentions": [],
  "likes_count": 0,
  "retweets_count": 0,
  "replies_count": 0
}

Error Responses:
400 Bad Request: { "error": "Tweet text exceeds 280 characters" }
401 Unauthorized: { "error": "Invalid or expired token" }
429 Too Many Requests: { "error": "Rate limit exceeded" }
```

#### Get Tweet
```
GET /api/v1/tweets/:tweet_id
Authorization: Bearer <token>

Response (200 OK):
{
  "tweet_id": "987654321",
  "user": {
    "user_id": "123456789",
    "username": "johndoe",
    "display_name": "John Doe",
    "profile_image_url": "https://cdn.twitter.com/profile/123.jpg",
    "verified": true
  },
  "text": "Hello world! #greeting",
  "created_at": "2026-01-08T10:00:00Z",
  "media": [...],
  "likes_count": 42,
  "retweets_count": 10,
  "replies_count": 5,
  "views_count": 1000,
  "liked_by_user": false,
  "retweeted_by_user": false
}

Error Responses:
404 Not Found: { "error": "Tweet not found" }
```

#### Delete Tweet
```
DELETE /api/v1/tweets/:tweet_id
Authorization: Bearer <token>

Response (200 OK):
{
  "message": "Tweet deleted successfully",
  "tweet_id": "987654321"
}

Error Responses:
403 Forbidden: { "error": "You can only delete your own tweets" }
404 Not Found: { "error": "Tweet not found" }
```

#### Like Tweet
```
POST /api/v1/tweets/:tweet_id/like
Authorization: Bearer <token>

Response (200 OK):
{
  "liked": true,
  "likes_count": 43
}

DELETE /api/v1/tweets/:tweet_id/like (Unlike)
Response (200 OK):
{
  "liked": false,
  "likes_count": 42
}
```

#### Retweet
```
POST /api/v1/tweets/:tweet_id/retweet
Authorization: Bearer <token>

Response (201 Created):
{
  "retweet_id": "111222333",
  "original_tweet_id": "987654321",
  "retweeted_at": "2026-01-08T11:00:00Z"
}

DELETE /api/v1/tweets/:tweet_id/retweet (Unretweet)
Response (200 OK):
{
  "message": "Retweet removed"
}
```

### 2. Timeline APIs

#### Get Home Timeline
```
GET /api/v1/timelines/home
Authorization: Bearer <token>
Query Parameters:
  - count: Number of tweets (default: 20, max: 200)
  - cursor: Pagination cursor (optional)
  - since_id: Return tweets after this ID (optional)
  - max_id: Return tweets before this ID (optional)

Response (200 OK):
{
  "tweets": [
    {
      "tweet_id": "987654321",
      "user": {...},
      "text": "Hello world!",
      "created_at": "2026-01-08T10:00:00Z",
      ...
    },
    ...
  ],
  "next_cursor": "cursor_abc123",
  "has_more": true
}
```

#### Get User Timeline
```
GET /api/v1/users/:user_id/tweets
Authorization: Bearer <token>
Query Parameters:
  - count: Number of tweets (default: 20, max: 200)
  - cursor: Pagination cursor
  - include_retweets: Include retweets (default: true)
  - include_replies: Include replies (default: true)

Response (200 OK):
{
  "tweets": [...],
  "next_cursor": "cursor_xyz789",
  "has_more": true
}
```

### 3. User APIs

#### Get User Profile
```
GET /api/v1/users/:user_id
Authorization: Bearer <token>

Response (200 OK):
{
  "user_id": "123456789",
  "username": "johndoe",
  "display_name": "John Doe",
  "bio": "Software Engineer | Tech Enthusiast",
  "location": "San Francisco, CA",
  "website": "https://johndoe.com",
  "profile_image_url": "https://cdn.twitter.com/profile/123.jpg",
  "banner_image_url": "https://cdn.twitter.com/banner/123.jpg",
  "verified": true,
  "protected": false,
  "created_at": "2020-01-01T00:00:00Z",
  "stats": {
    "followers_count": 1000,
    "following_count": 500,
    "tweets_count": 5000,
    "likes_count": 10000
  },
  "following": false,
  "followed_by": false
}
```

#### Update User Profile
```
PUT /api/v1/users/:user_id
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "display_name": "John Doe Jr.",
  "bio": "Updated bio",
  "location": "New York, NY",
  "website": "https://newsite.com"
}

Response (200 OK):
{
  "user": {...updated user object...}
}
```

### 4. Social Graph APIs

#### Follow User
```
POST /api/v1/users/:user_id/follow
Authorization: Bearer <token>

Response (200 OK):
{
  "following": true,
  "user": {
    "user_id": "987654321",
    "username": "janedoe",
    "display_name": "Jane Doe"
  }
}
```

#### Unfollow User
```
DELETE /api/v1/users/:user_id/follow
Authorization: Bearer <token>

Response (200 OK):
{
  "following": false
}
```

#### Get Followers
```
GET /api/v1/users/:user_id/followers
Authorization: Bearer <token>
Query Parameters:
  - count: Number of users (default: 20, max: 200)
  - cursor: Pagination cursor

Response (200 OK):
{
  "users": [
    {
      "user_id": "111222333",
      "username": "follower1",
      "display_name": "Follower One",
      "profile_image_url": "...",
      "verified": false,
      "following": false
    },
    ...
  ],
  "next_cursor": "cursor_abc",
  "has_more": true
}
```

#### Get Following
```
GET /api/v1/users/:user_id/following
Authorization: Bearer <token>
Query Parameters: (same as followers)

Response: (same structure as followers)
```

### 5. Search APIs

#### Search Tweets
```
GET /api/v1/search/tweets
Authorization: Bearer <token>
Query Parameters:
  - q: Search query (required)
  - count: Number of results (default: 20, max: 100)
  - result_type: "recent", "popular", or "mixed" (default: "mixed")
  - since_id: Return tweets after this ID
  - max_id: Return tweets before this ID

Response (200 OK):
{
  "tweets": [...],
  "search_metadata": {
    "query": "hello world",
    "count": 20,
    "completed_in": 0.05,
    "max_id": "987654321",
    "since_id": "123456789"
  }
}
```

#### Search Users
```
GET /api/v1/search/users
Authorization: Bearer <token>
Query Parameters:
  - q: Search query (required)
  - count: Number of results (default: 20, max: 100)
  - page: Page number (default: 1)

Response (200 OK):
{
  "users": [...],
  "total_count": 150
}
```

### 6. Trending APIs

#### Get Trending Topics
```
GET /api/v1/trends
Authorization: Bearer <token>
Query Parameters:
  - location: WOEID (Where On Earth ID) for location-based trends
  - count: Number of trends (default: 10, max: 50)

Response (200 OK):
{
  "trends": [
    {
      "name": "#WorldCup",
      "tweet_volume": 1500000,
      "url": "https://twitter.com/search?q=%23WorldCup",
      "rank": 1
    },
    ...
  ],
  "as_of": "2026-01-08T10:00:00Z",
  "location": {
    "name": "United States",
    "woeid": 23424977
  }
}
```

### 7. Media APIs

#### Upload Media
```
POST /api/v1/media/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

Request:
- file: Binary file data
- media_type: "image" or "video"

Response (201 Created):
{
  "media_id": "media_123456",
  "media_type": "image",
  "size": 524288,
  "url": "https://cdn.twitter.com/media/123456.jpg",
  "processing_status": "succeeded"
}

For large videos (chunked upload):
1. POST /api/v1/media/upload?command=INIT
2. POST /api/v1/media/upload?command=APPEND (multiple times)
3. POST /api/v1/media/upload?command=FINALIZE
```

## Rate Limiting

### Rate Limit Headers
```
X-Rate-Limit-Limit: 300
X-Rate-Limit-Remaining: 299
X-Rate-Limit-Reset: 1704675600
```

### Rate Limit Tiers
```
Authenticated Requests:
- Tweet posting: 300 tweets per 3 hours
- Timeline requests: 180 requests per 15 minutes
- Search: 180 requests per 15 minutes
- User lookup: 900 requests per 15 minutes
- Follow/Unfollow: 400 requests per 24 hours

Unauthenticated Requests:
- Search: 45 requests per 15 minutes
- User lookup: 300 requests per 15 minutes
```

### Rate Limit Response
```
HTTP 429 Too Many Requests

{
  "error": "Rate limit exceeded",
  "message": "You have exceeded the rate limit for this endpoint",
  "reset_at": "2026-01-08T11:00:00Z"
}
```

## Pagination

### Cursor-Based Pagination
```
Request:
GET /api/v1/timelines/home?count=20&cursor=abc123

Response:
{
  "tweets": [...],
  "next_cursor": "xyz789",
  "previous_cursor": "def456",
  "has_more": true
}

Next Page:
GET /api/v1/timelines/home?count=20&cursor=xyz789
```

### Offset-Based Pagination (for search)
```
Request:
GET /api/v1/search/tweets?q=hello&count=20&page=2

Response:
{
  "tweets": [...],
  "page": 2,
  "total_pages": 50,
  "total_count": 1000
}
```

## Error Handling

### Standard Error Response
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Tweet text is required",
    "details": {
      "field": "text",
      "reason": "missing_field"
    }
  }
}
```

### Common Error Codes
- `INVALID_REQUEST`: Malformed request
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `SERVER_ERROR`: Internal server error

## WebSocket API (Real-time Updates)

### Connection
```
WebSocket URL: wss://stream.twitter.com/v1/stream
Authorization: Bearer <token>

Connection Message:
{
  "type": "subscribe",
  "channels": ["timeline", "notifications"]
}
```

### Real-time Events
```
New Tweet Event:
{
  "type": "new_tweet",
  "data": {
    "tweet_id": "987654321",
    "user": {...},
    "text": "Hello world!",
    "created_at": "2026-01-08T10:00:00Z"
  }
}

Notification Event:
{
  "type": "notification",
  "data": {
    "notification_id": "notif_123",
    "type": "like",
    "actor": {...},
    "tweet": {...},
    "created_at": "2026-01-08T10:00:00Z"
  }
}
```

This comprehensive API design provides a complete interface for building Twitter clients and third-party applications with proper authentication, rate limiting, and error handling.
