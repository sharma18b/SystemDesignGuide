# Design YouTube/Netflix - System Architecture

## High-Level Architecture

```
[Clients] → [CDN (95% hit)] → [Load Balancer] → [API Gateway]
                                                       ↓
                                    [Upload Service, Streaming Service,
                                     Recommendation Service, Search Service]
                                                       ↓
                                    [S3, Transcoding Pipeline, Database]
```

## Core Services

### 1. Upload Service
- Pre-signed S3 URLs for direct upload
- Chunked upload for large files
- Upload progress tracking
- Metadata extraction

### 2. Transcoding Service
- FFmpeg-based transcoding
- Multiple resolutions (360p-4K)
- Multiple formats (H.264, H.265, VP9)
- Thumbnail generation
- GPU acceleration

### 3. Streaming Service
- HLS/DASH manifest generation
- Adaptive bitrate streaming
- CDN integration
- Playback analytics

### 4. Recommendation Service
- Collaborative filtering
- Content-based filtering
- ML models (neural networks)
- Real-time personalization

### 5. Search Service
- Elasticsearch for full-text search
- Video metadata indexing
- Autocomplete suggestions
- Trending videos

## Video Processing Pipeline

```
Upload → S3 → SNS → SQS → Transcoding Workers → S3 → CDN
                                ↓
                          Update Database
```

### Transcoding Workflow
1. Upload original video to S3
2. S3 triggers SNS notification
3. SQS queues transcoding job
4. Worker picks up job
5. Transcode to multiple resolutions
6. Upload transcoded videos to S3
7. Generate HLS/DASH manifests
8. Update database with video URLs
9. Warm CDN cache

## Adaptive Bitrate Streaming

### HLS (HTTP Live Streaming)
```
master.m3u8:
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
360p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=842x480
480p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720
720p.m3u8
```

### DASH (Dynamic Adaptive Streaming)
- Similar to HLS but uses MPD manifest
- Better for live streaming
- Industry standard

## Technology Stack
- **Backend**: Go, Python
- **Transcoding**: FFmpeg, GPU acceleration
- **Storage**: S3, Glacier
- **Database**: Cassandra, PostgreSQL
- **Cache**: Redis, Memcached
- **CDN**: CloudFront, Akamai
- **Search**: Elasticsearch
- **ML**: TensorFlow, PyTorch
- **Queue**: SQS, Kafka

## Data Flow

### Video Upload
```
1. User requests upload URL
2. Upload Service generates pre-signed S3 URL
3. Client uploads directly to S3
4. S3 triggers SNS notification
5. Transcoding pipeline processes video
6. Update database with video metadata
7. Warm CDN cache
```

### Video Playback
```
1. User requests video
2. Streaming Service checks CDN
3. If CDN hit: Serve from edge
4. If CDN miss: Fetch from S3, cache in CDN
5. Return HLS/DASH manifest
6. Client requests video segments
7. CDN serves segments
8. Track playback analytics
```

This architecture provides scalability for billions of video views with low latency.
