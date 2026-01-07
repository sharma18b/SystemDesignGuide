# Design YouTube/Netflix - Tradeoffs and Alternatives

## Core Decisions

### 1. Transcoding: On-Upload vs On-Demand

#### On-Upload (Chosen)
**Pros**: Fast playback start, predictable quality
**Cons**: High upfront cost, storage overhead

**Decision**: Transcode on upload
- Better user experience
- Predictable costs
- Storage cost acceptable

### 2. Streaming: HLS vs DASH

#### HLS (HTTP Live Streaming)
**Pros**: Wide support, simple, Apple standard
**Cons**: Higher latency for live

#### DASH (Dynamic Adaptive Streaming)
**Pros**: Industry standard, better for live
**Cons**: Complex implementation

**Decision**: Support both HLS and DASH
- HLS for VOD
- DASH for live streaming

### 3. Storage: Self-Hosted vs Cloud

#### Cloud (S3) - Chosen
**Pros**: Infinite scalability, 11 9's durability, CDN integration
**Cons**: Egress costs, vendor lock-in

**Decision**: S3 for storage
- Cost-effective at scale
- Proven reliability
- Easy CDN integration

### 4. CDN: Self-Hosted vs Third-Party

#### Third-Party (Chosen)
**Pros**: Global coverage, proven performance
**Cons**: High cost ($500M/month)

**Decision**: Use CloudFront/Akamai
- 200+ edge locations
- 95%+ hit rate
- Focus on core product

### 5. Recommendation: Collaborative vs Content-Based

#### Hybrid (Chosen)
**Pros**: Best of both worlds
**Cons**: Complex implementation

**Decision**: Hybrid approach
- Collaborative filtering for similar users
- Content-based for similar videos
- Neural networks for deep learning

## Alternative Architectures

### Monolith vs Microservices

#### Microservices (Chosen)
**Pros**: Independent scaling, fault isolation
**Cons**: Operational complexity

**Decision**: Microservices
- Upload, Streaming, Recommendation services
- Independent scaling

### Transcoding: CPU vs GPU

#### GPU (Chosen)
**Pros**: 10x faster, cost-effective
**Cons**: Higher upfront cost

**Decision**: GPU acceleration
- Faster transcoding
- Lower operational cost
- Better quality

This analysis provides the foundation for YouTube/Netflix architecture decisions.
