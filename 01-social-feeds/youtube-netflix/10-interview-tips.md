# Design YouTube/Netflix - Interview Tips

## Interview Approach

### Step 1: Requirements (5-10 min)
```
Questions:
- "Core features: Upload, streaming, recommendations?"
- "Scale: YouTube (2B users) or Netflix (200M)?"
- "Live streaming or VOD only?"
- "Adaptive bitrate streaming?"
- "Content recommendations?"

Sample Dialog:
You: "Let me clarify:
- Video upload and streaming?
- Scale: YouTube's scale (500M DAU, 1B views/day)?
- Adaptive bitrate streaming (HLS/DASH)?
- Recommendations: ML-based personalization?
- Live streaming or VOD only?"
```

### Step 2: Calculations (5 min)
```
Users:
- Registered: 2B
- DAU: 500M (25%)
- Concurrent: 100M peak

Content:
- Total videos: 500M
- Upload: 500 hours/minute
- Views: 1B/day (11,574 VPS)

Storage (5 years):
- Original: 2,628PB
- Transcoded (4 resolutions): 10,512PB
- Total: ~10,762PB

Bandwidth:
- Streaming: 231TB/s average
- With CDN (95% hit): Origin 11.6TB/s
- Upload: 4.2GB/s
```

### Step 3: High-Level Design (10-15 min)
```
Components:
- Upload Service
- Transcoding Service
- Streaming Service
- Recommendation Service
- Search Service
- S3 (storage)
- CDN (delivery)
- Database (metadata)
```

### Step 4: Deep Dive (15-20 min)

#### Critical Decision 1: Adaptive Bitrate Streaming
```
Interviewer: "How does adaptive bitrate streaming work?"

Strong Answer:
"I'd use HLS/DASH for adaptive streaming:

1. Transcoding:
   - Transcode video to multiple resolutions
   - 360p, 480p, 720p, 1080p, 4K
   - Segment each into 2-10 second chunks

2. Manifest Generation:
   - Create HLS master playlist
   - List all available resolutions
   - Include bitrate and resolution info

3. Client Selection:
   - Client measures bandwidth
   - Selects appropriate resolution
   - Switches quality seamlessly

4. Benefits:
   - Smooth playback on varying bandwidth
   - Optimal quality for each user
   - Reduced buffering (<1%)

This provides excellent user experience globally."
```

#### Critical Decision 2: Transcoding at Scale
```
Interviewer: "How do you handle video transcoding?"

Strong Answer:
"I'd use GPU-accelerated transcoding:

1. Upload Pipeline:
   - User uploads to S3 via pre-signed URL
   - S3 triggers SNS notification
   - SQS queues transcoding job

2. Transcoding Workers:
   - 100,000 GPU servers
   - FFmpeg with GPU acceleration
   - Process multiple resolutions in parallel
   - Use AWS Spot instances (70% cost savings)

3. Output:
   - Store transcoded videos in S3
   - Generate HLS/DASH manifests
   - Update database with URLs
   - Warm CDN cache

4. Optimization:
   - Priority queue (popular channels first)
   - Parallel processing
   - Monitor queue depth

This handles 500 hours/minute of uploads."
```

#### Critical Decision 3: CDN Strategy
```
Interviewer: "How do you deliver videos globally?"

Strong Answer:
"I'd use multi-CDN strategy:

1. CDN Architecture:
   - Primary: CloudFront/Akamai
   - 200+ edge locations globally
   - 95%+ cache hit rate
   - 7-30 day cache duration

2. Origin Shield:
   - Reduce origin load
   - Regional caching layer
   - Collapse requests

3. Failover:
   - Multi-CDN for redundancy
   - Automatic failover
   - Origin fallback

4. Benefits:
   - Low latency (<50ms)
   - High availability (99.9%)
   - Reduced origin load (5%)
   - Cost-effective

This provides fast, reliable video delivery globally."
```

## Common Pitfalls

### Pitfall 1: Ignoring Transcoding
❌ Wrong: "Store original video only"
✅ Right: "Transcode to multiple resolutions for adaptive streaming"

### Pitfall 2: Not Using CDN
❌ Wrong: "Serve videos from origin"
✅ Right: "Use CDN with 95%+ hit rate"

### Pitfall 3: Forgetting Recommendations
❌ Wrong: "Show videos chronologically"
✅ Right: "ML-based personalized recommendations"

### Pitfall 4: Ignoring DRM
❌ Wrong: "No content protection"
✅ Right: "DRM for premium content (Netflix)"

## Impressive Points

### Technical Depth
```
1. HLS vs DASH:
   "HLS for VOD (wide support), DASH for live (lower latency)"

2. H.265 Codec:
   "50% size reduction vs H.264 with same quality"

3. VMAF Quality Metric:
   "Perceptual quality metric for video optimization"

4. Content ID:
   "Fingerprint-based copyright detection system"
```

## Time Management
```
0-5 min: Requirements
5-10 min: Calculations
10-25 min: High-level design
25-40 min: Deep dive (transcoding, streaming, CDN)
40-45 min: Wrap-up
```

## Final Tips

### Do's ✅
- Discuss adaptive bitrate streaming
- Explain transcoding pipeline
- Mention CDN strategy
- Consider recommendations
- Think about DRM (Netflix)

### Don'ts ❌
- Don't ignore transcoding
- Don't forget CDN
- Don't overlook recommendations
- Don't skip DRM for Netflix

Remember: Show your understanding of video streaming (transcoding, adaptive bitrate, CDN) and how it scales globally!
