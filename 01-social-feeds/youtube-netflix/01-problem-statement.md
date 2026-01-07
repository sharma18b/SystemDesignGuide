# Design YouTube/Netflix - Problem Statement

## Overview
Design a video streaming platform that supports video upload, processing, storage, and streaming to millions of users globally with adaptive bitrate streaming, recommendations, and high availability.

## Functional Requirements

### Core Features
- **Video Upload**: Upload videos up to 12 hours
- **Video Processing**: Transcode to multiple formats/resolutions
- **Video Streaming**: Adaptive bitrate streaming (HLS/DASH)
- **Video Player**: Playback with controls, quality selection
- **Recommendations**: Personalized video recommendations
- **Search**: Full-text search for videos
- **Subscriptions**: Subscribe to channels
- **Comments**: Comment on videos
- **Likes/Dislikes**: Rate videos

### Video Processing
- **Transcoding**: Convert to H.264/H.265
- **Multiple Resolutions**: 360p, 480p, 720p, 1080p, 4K
- **Thumbnail Generation**: Multiple thumbnails
- **Subtitle Processing**: Support for captions
- **Audio Extraction**: Separate audio tracks

### Streaming Features
- **Adaptive Bitrate**: Adjust quality based on bandwidth
- **Resume Playback**: Continue from last position
- **Offline Download**: Download for offline viewing (Netflix)
- **Live Streaming**: Real-time video streaming
- **DVR**: Pause/rewind live streams

## Non-Functional Requirements

### Performance
- **Video Start Time**: <2s for playback start
- **Buffering**: <1% rebuffer rate
- **Upload**: <30 min for 1GB video
- **Search**: <300ms for results
- **Recommendation**: <500ms to generate

### Scalability
- **Users**: 2B registered, 500M DAU
- **Videos**: 500M total videos
- **Uploads**: 500 hours of video per minute
- **Views**: 1B video views per day
- **Concurrent Streams**: 100M concurrent viewers

### Reliability
- **Uptime**: 99.99% availability
- **Data Durability**: 99.999999999% (11 9's)
- **CDN Availability**: 99.9%

## Scale Estimates

### Storage
```
Videos (5 years):
500 hours/min × 60 min × 24 hours × 365 days × 5 years = 1.3B hours
Average: 500MB per hour (compressed)
Total: 1.3B × 500MB = 650PB
```

### Bandwidth
```
Views: 1B/day
Average duration: 10 minutes
Average bitrate: 2 Mbps
Bandwidth: 1B × 10 min × 2 Mbps / 86400s = 23TB/s
With CDN (95% hit rate): Origin 1.2TB/s
```

### Traffic
```
Video views: 1B/day = 11,574 views/second
Peak: 35,000 views/second
Upload: 500 hours/min = 30,000 hours/hour
```

This problem statement provides the foundation for designing a video streaming platform like YouTube or Netflix.
