# Google Search - API Design

## Search API

### 1. Web Search
```
GET /search?q={query}&start={offset}&num={count}

Parameters:
- q: Search query (required)
- start: Result offset (default: 0)
- num: Results per page (default: 10, max: 100)
- lr: Language restrict (e.g., lang_en)
- safe: Safe search (off, medium, high)
- filter: Duplicate filter (0=off, 1=on)

Response: 200 OK
{
  "searchInformation": {
    "searchTime": 0.234,
    "totalResults": "45000000",
    "formattedTotalResults": "45,000,000"
  },
  "items": [
    {
      "title": "Machine Learning Tutorial",
      "link": "https://example.com/ml-tutorial",
      "snippet": "Learn machine learning basics...",
      "displayLink": "example.com",
      "formattedUrl": "https://example.com › ml-tutorial",
      "pagemap": {
        "cse_thumbnail": [{
          "src": "https://example.com/thumb.jpg",
          "width": "300",
          "height": "168"
        }],
        "metatags": [{
          "og:title": "ML Tutorial",
          "og:description": "...",
          "article:published_time": "2026-01-01"
        }]
      }
    }
  ],
  "queries": {
    "nextPage": [{
      "startIndex": 11,
      "count": 10
    }]
  }
}
```

### 2. Autocomplete
```
GET /complete/search?q={prefix}&client=chrome

Parameters:
- q: Query prefix (required)
- client: Client type
- hl: Language (e.g., en)

Response: 200 OK
[
  "machine learning",
  [
    "machine learning tutorial",
    "machine learning python",
    "machine learning algorithms",
    "machine learning course",
    "machine learning engineer"
  ],
  [],
  [],
  {
    "google:suggesttype": ["QUERY", "QUERY", "QUERY", "QUERY", "QUERY"],
    "google:suggestrelevance": [1400, 1300, 1200, 1100, 1000]
  }
]
```

### 3. Image Search
```
GET /search?q={query}&tbm=isch&start={offset}

Parameters:
- q: Search query
- tbm: Search type (isch=images)
- start: Result offset
- tbs: Search tools (size, color, type, time)
- safe: Safe search

Response: 200 OK
{
  "items": [
    {
      "title": "Machine Learning Diagram",
      "link": "https://example.com/image.jpg",
      "displayLink": "example.com",
      "snippet": "ML architecture diagram",
      "image": {
        "contextLink": "https://example.com/page",
        "height": 800,
        "width": 1200,
        "byteSize": 156789,
        "thumbnailLink": "https://example.com/thumb.jpg",
        "thumbnailHeight": 100,
        "thumbnailWidth": 150
      }
    }
  ]
}
```

### 4. News Search
```
GET /search?q={query}&tbm=nws

Parameters:
- q: Search query
- tbm: Search type (nws=news)
- tbs: Time filter (qdr:h=hour, qdr:d=day, qdr:w=week)
- sort: Sort by date or relevance

Response: 200 OK
{
  "items": [
    {
      "title": "Breaking: New ML Breakthrough",
      "link": "https://news.example.com/article",
      "snippet": "Researchers announce...",
      "source": "Tech News",
      "date": "2 hours ago",
      "image": {
        "thumbnailLink": "https://news.example.com/thumb.jpg"
      }
    }
  ]
}
```

## Advanced Search Operators

### Search Operators
```
Exact Match:
"machine learning" - Exact phrase

Site Search:
site:example.com machine learning - Search within domain

File Type:
filetype:pdf machine learning - Specific file type

Exclude:
machine learning -python - Exclude term

OR Operator:
machine learning OR artificial intelligence

Wildcard:
machine * learning - Any word between

Number Range:
camera $100..$500 - Price range

Related:
related:example.com - Similar sites

Cache:
cache:example.com - Cached version

Info:
info:example.com - Page information
```

## Indexing API (for Webmasters)

### 1. Submit URL for Indexing
```
POST /indexing/v3/urlNotifications:publish
Authorization: Bearer {access_token}
Content-Type: application/json

Request:
{
  "url": "https://example.com/new-page",
  "type": "URL_UPDATED"
}

Response: 200 OK
{
  "urlNotificationMetadata": {
    "url": "https://example.com/new-page",
    "latestUpdate": {
      "url": "https://example.com/new-page",
      "type": "URL_UPDATED",
      "notifyTime": "2026-01-08T10:00:00Z"
    }
  }
}
```

### 2. Check Indexing Status
```
GET /indexing/v3/urlNotifications/metadata?url={url}
Authorization: Bearer {access_token}

Response: 200 OK
{
  "url": "https://example.com/page",
  "latestUpdate": {
    "type": "URL_UPDATED",
    "notifyTime": "2026-01-08T10:00:00Z"
  },
  "latestRemove": null
}
```

## Search Console API

### 1. Get Search Analytics
```
POST /webmasters/v3/sites/{siteUrl}/searchAnalytics/query
Authorization: Bearer {access_token}

Request:
{
  "startDate": "2026-01-01",
  "endDate": "2026-01-07",
  "dimensions": ["query", "page"],
  "rowLimit": 1000
}

Response: 200 OK
{
  "rows": [
    {
      "keys": ["machine learning", "https://example.com/ml"],
      "clicks": 1234,
      "impressions": 45678,
      "ctr": 0.027,
      "position": 3.5
    }
  ]
}
```

### 2. Submit Sitemap
```
PUT /webmasters/v3/sites/{siteUrl}/sitemaps/{feedpath}
Authorization: Bearer {access_token}

Response: 200 OK
{
  "path": "https://example.com/sitemap.xml",
  "lastSubmitted": "2026-01-08T10:00:00Z",
  "isPending": false,
  "isSitemapsIndex": false,
  "type": "SITEMAP",
  "lastDownloaded": "2026-01-08T10:05:00Z",
  "warnings": 0,
  "errors": 0
}
```

## Internal APIs

### 1. Crawler API (Internal)
```
POST /internal/crawler/schedule
Authorization: Internal-Token

Request:
{
  "urls": ["https://example.com/page1", "https://example.com/page2"],
  "priority": "HIGH",
  "crawl_type": "INCREMENTAL"
}

Response: 200 OK
{
  "job_id": "crawl-job-12345",
  "scheduled_urls": 2,
  "estimated_completion": "2026-01-08T11:00:00Z"
}
```

### 2. Index Update API (Internal)
```
POST /internal/index/update
Authorization: Internal-Token

Request:
{
  "doc_id": 12345,
  "operation": "UPDATE",
  "content": {
    "title": "Updated Title",
    "text": "Updated content...",
    "url": "https://example.com/page"
  }
}

Response: 200 OK
{
  "doc_id": 12345,
  "status": "INDEXED",
  "shard_id": 1234,
  "indexed_at": "2026-01-08T10:00:00Z"
}
```

### 3. Ranking API (Internal)
```
POST /internal/ranking/score
Authorization: Internal-Token

Request:
{
  "query": "machine learning",
  "doc_ids": [12345, 67890, 11111],
  "user_context": {
    "location": "San Francisco",
    "language": "en",
    "device": "mobile"
  }
}

Response: 200 OK
{
  "ranked_results": [
    {
      "doc_id": 12345,
      "score": 0.95,
      "signals": {
        "relevance": 0.92,
        "authority": 0.88,
        "freshness": 0.95,
        "engagement": 0.85
      }
    }
  ]
}
```

## Rate Limiting

### Rate Limits
```
Public Search API:
- Free tier: 100 queries/day
- Paid tier: 10,000 queries/day
- Enterprise: Custom limits

Indexing API:
- 200 requests/day per site
- Burst: 10 requests/second

Search Console API:
- 1,200 requests/minute
- 50,000 requests/day

Headers:
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9950
X-RateLimit-Reset: 1704715200
```

## Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": 400,
    "message": "Invalid query parameter",
    "errors": [
      {
        "domain": "global",
        "reason": "invalidParameter",
        "message": "Invalid value for parameter 'q'",
        "locationType": "parameter",
        "location": "q"
      }
    ]
  }
}
```

### HTTP Status Codes
```
200 OK - Success
400 Bad Request - Invalid parameters
401 Unauthorized - Missing/invalid auth
403 Forbidden - Quota exceeded
404 Not Found - Resource not found
429 Too Many Requests - Rate limit exceeded
500 Internal Server Error - Server error
503 Service Unavailable - Temporary unavailable
```

## WebSocket API (Real-time)

### Search Suggestions Stream
```
ws://api.google.com/v1/suggestions

Connection:
{
  "type": "subscribe",
  "query_prefix": "mach"
}

Messages:
{
  "type": "suggestion_update",
  "prefix": "mach",
  "suggestions": [
    "machine learning",
    "machine translation",
    "machinery"
  ],
  "timestamp": "2026-01-08T10:00:00Z"
}
```

This API design provides comprehensive search functionality while maintaining performance, security, and ease of use for both end users and developers.
