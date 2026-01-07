# Design YouTube/Netflix - API Design

## Core APIs

### 1. Video APIs
```
GET /api/v1/videos/:video_id
POST /api/v1/videos/upload
DELETE /api/v1/videos/:video_id

GET /api/v1/videos/:video_id/stream
Response: HLS/DASH manifest URL
```

### 2. Channel APIs
```
GET /api/v1/channels/:channel_id
GET /api/v1/channels/:channel_id/videos
POST /api/v1/channels/:channel_id/subscribe
```

### 3. Search APIs
```
GET /api/v1/search?q=query&type=video&limit=20
Response: {
  "videos": [...],
  "total": 1000,
  "next_page": "token_abc"
}
```

### 4. Recommendation APIs
```
GET /api/v1/recommendations?video_id=123
GET /api/v1/recommendations/home
Response: {
  "videos": [...],
  "algorithm": "collaborative_filtering"
}
```

### 5. Analytics APIs
```
POST /api/v1/analytics/view
{
  "video_id": "123",
  "watch_duration": 300,
  "quality": "720p"
}
```

## Rate Limiting
```
Upload: 100 videos per day
Views: Unlimited
Search: 1000 requests per hour
```

This API design provides comprehensive access to video streaming functionality.
