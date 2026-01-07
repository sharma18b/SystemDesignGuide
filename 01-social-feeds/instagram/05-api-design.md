# Design Instagram - API Design

## API Architecture

### RESTful API Principles
- **Resource-Based URLs**: `/api/v1/posts`, `/api/v1/users`
- **HTTP Methods**: GET (read), POST (create), PUT (update), DELETE (delete)
- **Status Codes**: 200 (OK), 201 (created), 400 (bad request), 401 (unauthorized), 404 (not found), 500 (error)
- **Versioning**: URL-based (`/api/v1/`, `/api/v2/`)
- **Pagination**: Cursor-based for feeds
- **Rate Limiting**: Per-user and per-endpoint limits

### Authentication
```
OAuth 2.0 + JWT Tokens

Login Flow:
POST /api/v1/auth/login
Request: { "username": "johndoe", "password": "secret" }
Response: {
  "access_token": "jwt_token",
  "refresh_token": "refresh_token",
  "expires_in": 3600,
  "user": { "user_id": 123, "username": "johndoe" }
}

Authorization Header:
Authorization: Bearer <jwt_token>
```

## Core API Endpoints

### 1. Post APIs

#### Upload Photo
```
POST /api/v1/posts
Authorization: Bearer <token>
Content-Type: multipart/form-data

Request:
{
  "caption": "Beautiful sunset! #nature #photography",
  "location_id": 12345,
  "user_tags": [456, 789],
  "media": [<binary_file_1>, <binary_file_2>]
}

Response (201 Created):
{
  "post_id": "987654321",
  "user": {
    "user_id": "123",
    "username": "johndoe",
    "profile_image_url": "https://cdn.instagram.com/profile/123.jpg"
  },
  "caption": "Beautiful sunset! #nature #photography",
  "media": [
    {
      "media_id": "media_123",
      "type": "photo",
      "url": "https://cdn.instagram.com/p/987654321/1.jpg",
      "width": 1080,
      "height": 1080
    }
  ],
  "location": {
    "location_id": 12345,
    "name": "Golden Gate Bridge"
  },
  "hashtags": ["nature", "photography"],
  "user_tags": [
    { "user_id": 456, "username": "janedoe", "x": 0.5, "y": 0.3 }
  ],
  "created_at": "2026-01-08T10:00:00Z",
  "likes_count": 0,
  "comments_count": 0
}

Error Responses:
400: { "error": "Invalid media format" }
413: { "error": "File size exceeds 8MB limit" }
429: { "error": "Rate limit exceeded" }
```

#### Get Post
```
GET /api/v1/posts/:post_id
Authorization: Bearer <token>

Response (200 OK):
{
  "post_id": "987654321",
  "user": {...},
  "caption": "Beautiful sunset!",
  "media": [...],
  "location": {...},
  "created_at": "2026-01-08T10:00:00Z",
  "likes_count": 1250,
  "comments_count": 45,
  "liked_by_user": false,
  "saved_by_user": false
}
```

#### Delete Post
```
DELETE /api/v1/posts/:post_id
Authorization: Bearer <token>

Response (200 OK):
{
  "message": "Post deleted successfully",
  "post_id": "987654321"
}
```

#### Like Post
```
POST /api/v1/posts/:post_id/like
Authorization: Bearer <token>

Response (200 OK):
{
  "liked": true,
  "likes_count": 1251
}

DELETE /api/v1/posts/:post_id/like (Unlike)
Response (200 OK):
{
  "liked": false,
  "likes_count": 1250
}
```

#### Comment on Post
```
POST /api/v1/posts/:post_id/comments
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "text": "Amazing photo! 😍",
  "parent_comment_id": null
}

Response (201 Created):
{
  "comment_id": "comment_123",
  "post_id": "987654321",
  "user": {
    "user_id": "456",
    "username": "janedoe",
    "profile_image_url": "..."
  },
  "text": "Amazing photo! 😍",
  "created_at": "2026-01-08T11:00:00Z",
  "likes_count": 0
}
```

### 2. Feed APIs

#### Get Home Feed
```
GET /api/v1/feed
Authorization: Bearer <token>
Query Parameters:
  - count: Number of posts (default: 20, max: 50)
  - cursor: Pagination cursor (optional)

Response (200 OK):
{
  "posts": [
    {
      "post_id": "987654321",
      "user": {...},
      "caption": "...",
      "media": [...],
      "created_at": "...",
      "likes_count": 1250,
      "comments_count": 45,
      "liked_by_user": false
    },
    ...
  ],
  "next_cursor": "cursor_abc123",
  "has_more": true
}
```

#### Get User Posts
```
GET /api/v1/users/:user_id/posts
Authorization: Bearer <token>
Query Parameters:
  - count: Number of posts (default: 20, max: 50)
  - cursor: Pagination cursor

Response (200 OK):
{
  "posts": [...],
  "next_cursor": "cursor_xyz789",
  "has_more": true
}
```

#### Get Explore Feed
```
GET /api/v1/explore
Authorization: Bearer <token>
Query Parameters:
  - count: Number of posts (default: 20, max: 50)
  - cursor: Pagination cursor

Response (200 OK):
{
  "posts": [...],
  "next_cursor": "cursor_def456",
  "has_more": true
}
```

### 3. Story APIs

#### Upload Story
```
POST /api/v1/stories
Authorization: Bearer <token>
Content-Type: multipart/form-data

Request:
{
  "media": <binary_file>,
  "media_type": "photo",
  "duration": 5
}

Response (201 Created):
{
  "story_id": "story_123",
  "user_id": "123",
  "media_url": "https://cdn.instagram.com/stories/123/story_123.jpg",
  "created_at": "2026-01-08T10:00:00Z",
  "expires_at": "2026-01-09T10:00:00Z"
}
```

#### Get Stories Feed
```
GET /api/v1/stories/feed
Authorization: Bearer <token>

Response (200 OK):
{
  "stories": [
    {
      "user": {
        "user_id": "456",
        "username": "janedoe",
        "profile_image_url": "..."
      },
      "stories": [
        {
          "story_id": "story_456",
          "media_url": "...",
          "media_type": "photo",
          "created_at": "...",
          "expires_at": "...",
          "viewed": false
        }
      ],
      "has_unseen": true
    }
  ]
}
```

#### View Story
```
POST /api/v1/stories/:story_id/view
Authorization: Bearer <token>

Response (200 OK):
{
  "story_id": "story_123",
  "viewed": true,
  "views_count": 1250
}
```

### 4. User APIs

#### Get User Profile
```
GET /api/v1/users/:user_id
Authorization: Bearer <token>

Response (200 OK):
{
  "user_id": "123",
  "username": "johndoe",
  "full_name": "John Doe",
  "bio": "Photographer | Traveler",
  "website": "https://johndoe.com",
  "profile_image_url": "...",
  "verified": true,
  "private_account": false,
  "stats": {
    "followers_count": 10000,
    "following_count": 500,
    "posts_count": 250
  },
  "following": false,
  "followed_by": false,
  "requested": false
}
```

#### Update Profile
```
PUT /api/v1/users/:user_id
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "full_name": "John Doe Jr.",
  "bio": "Updated bio",
  "website": "https://newsite.com"
}

Response (200 OK):
{
  "user": {...updated user object...}
}
```

### 5. Social Graph APIs

#### Follow User
```
POST /api/v1/users/:user_id/follow
Authorization: Bearer <token>

Response (200 OK):
{
  "following": true,
  "user": {
    "user_id": "456",
    "username": "janedoe"
  }
}

For private accounts:
{
  "requested": true,
  "user": {...}
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
  - count: Number of users (default: 20, max: 100)
  - cursor: Pagination cursor

Response (200 OK):
{
  "users": [
    {
      "user_id": "789",
      "username": "follower1",
      "full_name": "Follower One",
      "profile_image_url": "...",
      "following": false
    }
  ],
  "next_cursor": "cursor_abc",
  "has_more": true
}
```

### 6. Search APIs

#### Search Users
```
GET /api/v1/search/users
Authorization: Bearer <token>
Query Parameters:
  - q: Search query (required)
  - count: Number of results (default: 20, max: 50)

Response (200 OK):
{
  "users": [
    {
      "user_id": "123",
      "username": "johndoe",
      "full_name": "John Doe",
      "profile_image_url": "...",
      "verified": true,
      "followers_count": 10000
    }
  ],
  "total_count": 150
}
```

#### Search Hashtags
```
GET /api/v1/search/hashtags
Authorization: Bearer <token>
Query Parameters:
  - q: Search query (required)
  - count: Number of results (default: 20, max: 50)

Response (200 OK):
{
  "hashtags": [
    {
      "name": "photography",
      "post_count": 1500000,
      "trending": true
    }
  ]
}
```

#### Search Locations
```
GET /api/v1/search/locations
Authorization: Bearer <token>
Query Parameters:
  - q: Search query (required)
  - lat: Latitude (optional)
  - lng: Longitude (optional)
  - count: Number of results (default: 20, max: 50)

Response (200 OK):
{
  "locations": [
    {
      "location_id": 12345,
      "name": "Golden Gate Bridge",
      "city": "San Francisco",
      "country": "United States",
      "lat": 37.8199,
      "lng": -122.4783,
      "post_count": 500000
    }
  ]
}
```

### 7. Notification APIs

#### Get Notifications
```
GET /api/v1/notifications
Authorization: Bearer <token>
Query Parameters:
  - count: Number of notifications (default: 20, max: 50)
  - cursor: Pagination cursor

Response (200 OK):
{
  "notifications": [
    {
      "notification_id": "notif_123",
      "type": "like",
      "actor": {
        "user_id": "456",
        "username": "janedoe",
        "profile_image_url": "..."
      },
      "post": {
        "post_id": "987654321",
        "thumbnail_url": "..."
      },
      "created_at": "2026-01-08T10:00:00Z",
      "read": false
    }
  ],
  "next_cursor": "cursor_abc",
  "has_more": true,
  "unread_count": 5
}
```

## Rate Limiting

### Rate Limit Headers
```
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 199
X-RateLimit-Reset: 1704675600
```

### Rate Limit Tiers
```
Authenticated Requests:
- Post upload: 50 posts per hour
- Story upload: 100 stories per hour
- Feed requests: 200 requests per hour
- Search: 100 requests per hour
- Follow/Unfollow: 200 requests per hour

Unauthenticated Requests:
- Search: 20 requests per hour
- User lookup: 50 requests per hour
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
GET /api/v1/feed?count=20&cursor=abc123

Response:
{
  "posts": [...],
  "next_cursor": "xyz789",
  "previous_cursor": "def456",
  "has_more": true
}

Next Page:
GET /api/v1/feed?count=20&cursor=xyz789
```

## Error Handling

### Standard Error Response
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Caption exceeds maximum length",
    "details": {
      "field": "caption",
      "max_length": 2200
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
- `MEDIA_TOO_LARGE`: File size exceeds limit
- `INVALID_MEDIA_FORMAT`: Unsupported file format

## WebSocket API (Real-time Updates)

### Connection
```
WebSocket URL: wss://realtime.instagram.com/v1/stream
Authorization: Bearer <token>

Connection Message:
{
  "type": "subscribe",
  "channels": ["feed", "notifications", "stories"]
}
```

### Real-time Events
```
New Post Event:
{
  "type": "new_post",
  "data": {
    "post_id": "987654321",
    "user": {...},
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
    "created_at": "2026-01-08T10:00:00Z"
  }
}

Story Event:
{
  "type": "new_story",
  "data": {
    "story_id": "story_123",
    "user": {...},
    "created_at": "2026-01-08T10:00:00Z"
  }
}
```

This comprehensive API design provides a complete interface for building Instagram clients with proper authentication, rate limiting, pagination, and error handling.
