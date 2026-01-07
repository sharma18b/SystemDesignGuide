# Design YouTube/Netflix - Variations and Follow-up Questions

## Common Variations

### 1. Add Live Streaming
**Requirements**: Real-time video broadcasting
**Changes**: RTMP ingestion, low-latency streaming, chat system

### 2. Add Offline Downloads (Netflix)
**Requirements**: Download videos for offline viewing
**Changes**: DRM, download management, storage limits

### 3. Add Content Recommendations
**Requirements**: Personalized video recommendations
**Changes**: ML models, user behavior tracking, A/B testing

### 4. Add Subtitles/Captions
**Requirements**: Multi-language subtitle support
**Changes**: Subtitle processing, synchronization, rendering

## Follow-up Questions

### Q1: "How does adaptive bitrate streaming work?"
**Answer**:
```
1. Transcode video to multiple resolutions (360p-4K)
2. Segment each resolution into chunks (2-10 seconds)
3. Generate HLS/DASH manifest listing all resolutions
4. Client measures bandwidth
5. Client selects appropriate resolution
6. Client switches quality seamlessly during playback

Benefits:
- Smooth playback on varying bandwidth
- Optimal quality for each user
- Reduced buffering
```

### Q2: "How do you handle video transcoding at scale?"
**Answer**:
- Queue: SQS with priority (popular channels first)
- Workers: 100,000 GPU servers
- Parallel: Process multiple resolutions simultaneously
- Spot Instances: Use AWS Spot for 70% cost savings
- Monitoring: Track queue depth, processing time

### Q3: "How do you implement video recommendations?"
**Answer**:
```
Collaborative Filtering:
- Find similar users based on watch history
- Recommend videos watched by similar users

Content-Based:
- Analyze video metadata (title, tags, category)
- Recommend similar videos

Neural Networks:
- Deep learning models
- Input: User features + Video features
- Output: Engagement probability

Hybrid:
- Combine all approaches
- Weight based on performance
```

### Q4: "How do you prevent video piracy?"
**Answer**:
- DRM: Digital Rights Management (Widevine, FairPlay)
- Encryption: Encrypt video segments
- Watermarking: Embed user ID in video
- Geo-blocking: Restrict by region
- Token-based access: Expiring URLs

### Q5: "How do you handle CDN failures?"
**Answer**:
- Multi-CDN: Use multiple CDN providers
- Failover: Automatic failover to backup CDN
- Origin fallback: Serve from origin if CDN fails
- Monitoring: Real-time CDN health checks

### Q6: "How do you optimize video quality?"
**Answer**:
- Codec: H.265 for 50% size reduction
- Bitrate: Optimize bitrate per resolution
- GOP: Optimize keyframe interval
- Audio: AAC codec, 128kbps
- Testing: Perceptual quality metrics (VMAF)

### Q7: "How do you handle copyright detection?"
**Answer**:
- Content ID: Fingerprint copyrighted content
- Matching: Compare uploads against database
- Actions: Block, monetize, or track
- Appeals: Manual review process

### Q8: "How do you implement watch history?"
**Answer**:
```
Storage: Cassandra (partitioned by user_id)
Schema:
- user_id, video_id, watched_at, watch_duration

Resume Playback:
- Store last position every 10 seconds
- Resume from last position on next play

Analytics:
- Aggregate watch time
- Track completion rate
- Identify popular content
```

## Edge Cases

### 1. Video Upload Fails Mid-Upload
**Solution**: Chunked upload with resume capability

### 2. Transcoding Takes Too Long
**Solution**: Priority queue, more workers, GPU acceleration

### 3. CDN Cache Miss During Peak
**Solution**: Origin shield, pre-warming, multi-CDN

### 4. User Switches Quality During Playback
**Solution**: Seamless switching at segment boundaries

### 5. Copyright Claim on Popular Video
**Solution**: Automated takedown, appeal process, monetization sharing

This guide covers common variations and follow-up questions for YouTube/Netflix design.
