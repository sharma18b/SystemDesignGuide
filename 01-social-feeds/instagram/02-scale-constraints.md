# Design Instagram - Scale and Constraints

## User Scale Analysis

### User Base Metrics
- **Total Registered Users**: 2 billion
- **Daily Active Users (DAU)**: 500 million (25% of registered)
- **Monthly Active Users (MAU)**: 1.5 billion (75% of registered)
- **Peak Concurrent Users**: 100 million during major events
- **New User Signups**: 1 million per day
- **User Growth Rate**: 20% year-over-year

### User Distribution
- **Geographic Distribution**:
  - North America: 20% (100M users)
  - Europe: 15% (75M users)
  - Asia: 45% (225M users)
  - Latin America: 12% (60M users)
  - Rest of World: 8% (40M users)
- **Platform Distribution**:
  - Mobile (iOS/Android): 95%
  - Web: 5%
- **User Activity Levels**:
  - Power users (>5 posts/week): 10% (50M users)
  - Active users (1-5 posts/week): 30% (150M users)
  - Casual users (<1 post/week): 60% (300M users)

### Influencer and Celebrity Impact
- **Celebrity Users**: 50,000 users with >1M followers
- **Influencers**: 500,000 users with >100K followers
- **Average User**: 150 followers
- **Median User**: 80 followers
- **Top User**: 600M followers (Instagram's own account)

## Content Volume Analysis

### Photo Generation
- **Total Photos per Day**: 100 million
- **Photos per Second**:
  - Average: 1,157 photos/second
  - Peak: 3,500 photos/second (during events)
  - Off-peak: 500 photos/second
- **Photo Distribution**:
  - Single photo posts: 60% (60M/day)
  - Carousel posts (2-10 photos): 40% (40M/day)
  - Average photos per carousel: 3

### Video Generation
- **Total Videos per Day**: 50 million
- **Videos per Second**:
  - Average: 579 videos/second
  - Peak: 1,700 videos/second
  - Off-peak: 250 videos/second
- **Video Duration**:
  - Average: 30 seconds
  - Feed videos: 15-60 seconds
  - IGTV: 10-60 minutes

### Stories Generation
- **Total Stories per Day**: 500 million
- **Stories per Second**:
  - Average: 5,787 stories/second
  - Peak: 17,000 stories/second
  - Off-peak: 2,500 stories/second
- **Story Retention**: 24 hours only
- **Story Highlights**: 10% saved permanently

### Content Size Estimates
- **Original Photo**: 2MB average (JPEG, 4000×3000)
- **Compressed Photo**: 200KB (optimized for feed)
- **Thumbnail**: 20KB (profile grid)
- **Original Video**: 20MB average (1080p, 30s)
- **Compressed Video**: 5MB (720p, optimized)
- **Story Photo**: 1MB average
- **Story Video**: 10MB average (15s)

### Daily Storage Requirements
```
Photos:
Original: 100M × 2MB = 200TB/day
Compressed: 100M × 200KB = 20TB/day
Thumbnails: 100M × 20KB = 2TB/day
Total Photos: 222TB/day

Videos:
Original: 50M × 20MB = 1PB/day
Compressed: 50M × 5MB = 250TB/day
Thumbnails: 50M × 100KB = 5TB/day
Total Videos: 1.255PB/day

Stories (24h retention):
Photos: 300M × 1MB = 300TB/day
Videos: 200M × 10MB = 2PB/day
Total Stories: 2.3PB/day

Total Daily Storage: ~3.8PB/day
Monthly Storage: ~114PB/month
Yearly Storage: ~1.4EB/year
```

## Traffic Patterns and Load

### Read Traffic
- **Feed Requests**: 50 billion per day
  - Average: 578,703 requests/second
  - Peak: 1.7 million requests/second
- **Photo Views**: 100 billion per day
- **Video Views**: 20 billion per day
- **Story Views**: 10 billion per day
- **Profile Views**: 5 billion per day
- **Search Queries**: 2 billion per day

### Write Traffic
- **Photo Uploads**: 100 million per day (1,157 TPS)
- **Video Uploads**: 50 million per day (579 TPS)
- **Story Uploads**: 500 million per day (5,787 TPS)
- **Likes**: 4 billion per day (46,296 TPS)
- **Comments**: 1 billion per day (11,574 TPS)
- **Follows**: 100 million per day (1,157 TPS)

### Read:Write Ratio
- **Overall Ratio**: 500:1 (extremely read-heavy)
- **Feed Reads**: 50B requests vs 100M photo uploads = 500:1
- **Engagement Reads**: High read amplification for popular posts
- **Cache Hit Rate**: Target >90% for media content

### Peak Load Scenarios
- **Major Events**: World Cup, Olympics, Celebrity posts
- **Traffic Spike**: 3-5x normal load
- **Duration**: 2-6 hours sustained peak
- **Geographic Concentration**: 70% traffic from event region
- **Example**: Celebrity wedding generates 50M photo views in 1 hour

## Performance Targets

### Latency Requirements
- **Photo Upload**: <5 seconds p95 (including processing)
- **Video Upload**: <30 seconds p95 (including transcoding)
- **Feed Load**: <1 second p95 (20 posts)
- **Image Load**: <500ms p95 (compressed)
- **Video Playback Start**: <2 seconds p95
- **Story Load**: <800ms p95
- **Search Results**: <300ms p95
- **Profile Load**: <600ms p95

### Throughput Requirements
- **API Gateway**: 2 million requests/second peak
- **Photo Ingestion**: 3,500 photos/second peak
- **Video Ingestion**: 1,700 videos/second peak
- **Feed Generation**: 1.7M feeds/second peak
- **Database Reads**: 5 million queries/second
- **Database Writes**: 100,000 writes/second
- **Cache Operations**: 10 million ops/second

### Availability Targets
- **System Uptime**: 99.95% (4.38 hours downtime/year)
- **API Availability**: 99.99% for critical endpoints
- **Data Durability**: 99.999999999% (11 9's)
- **Regional Failover**: <10 minutes to failover
- **Disaster Recovery**: RTO <4 hours, RPO <1 hour

## Data Storage Constraints

### Database Storage
```
User Data:
2B users × 5KB per user = 10TB

Post Metadata:
100M posts/day × 365 days × 5 years × 2KB = 365TB

Social Graph:
2B users × 150 followers × 16 bytes = 4.8TB

Engagement Data (likes, comments):
4B likes/day × 365 days × 1 year × 24 bytes = 35TB/year

Total Database Storage: ~400TB
```

### Media Storage
```
Photos (5 years):
Original: 100M/day × 365 × 5 × 2MB = 365PB
Compressed: 100M/day × 365 × 5 × 200KB = 36.5PB
Thumbnails: 100M/day × 365 × 5 × 20KB = 3.65PB

Videos (5 years):
Original: 50M/day × 365 × 5 × 20MB = 1,825PB
Compressed: 50M/day × 365 × 5 × 5MB = 456PB

Stories (30 days rolling):
500M/day × 30 × 2MB = 30PB

Total Media Storage: ~2,700PB
With deduplication (20% savings): ~2,160PB
```

### Cache Storage
- **Redis Cluster**: 50TB for hot data
  - Feed cache: 30TB
  - User profiles: 10TB
  - Post metadata: 5TB
  - Session data: 5TB

### Search Index Storage
- **Elasticsearch Cluster**: 100TB
  - User index: 20TB
  - Post index: 60TB
  - Hashtag index: 10TB
  - Location index: 10TB

## Network Bandwidth

### Ingress Bandwidth
```
Photo Upload:
100M photos/day × 2MB = 200TB/day = 2.3GB/s average

Video Upload:
50M videos/day × 20MB = 1PB/day = 11.6GB/s average

Story Upload:
500M stories/day × 2MB = 1PB/day = 11.6GB/s average

Total Ingress: ~25GB/s average, ~75GB/s peak
```

### Egress Bandwidth
```
Photo Views:
100B views/day × 200KB = 20PB/day = 231GB/s average

Video Views:
20B views/day × 5MB = 100PB/day = 1,157GB/s average

Story Views:
10B views/day × 2MB = 20PB/day = 231GB/s average

Total Egress: ~1,600GB/s average, ~4,800GB/s peak
```

### CDN Offload
- **CDN Hit Rate**: 90% for media content
- **Origin Traffic**: 10% of total = 160GB/s average
- **CDN Bandwidth**: 1,440GB/s average, 4,320GB/s peak
- **CDN PoPs**: 200+ locations globally

## Compute Resources

### Application Servers
- **Total Servers**: 100,000 application servers
- **Server Specs**: 32 vCPU, 128GB RAM per server
- **Requests per Server**: 20,000 requests/second
- **Auto-scaling**: Scale up to 300,000 servers during peaks

### Database Servers
- **Primary Databases**: 2,000 shards
- **Read Replicas**: 10,000 replicas (5 per shard)
- **Server Specs**: 64 vCPU, 512GB RAM, 20TB NVMe SSD
- **Connections per Server**: 2,000 connections

### Cache Servers
- **Redis Nodes**: 1,000 nodes
- **Node Specs**: 32 vCPU, 256GB RAM
- **Cache Capacity**: 50TB total
- **Operations per Node**: 100,000 ops/second

### Media Processing Servers
- **Image Processing**: 5,000 workers
- **Video Transcoding**: 10,000 workers
- **Worker Specs**: 16 vCPU, 64GB RAM, GPU for video
- **Processing Queue**: Kafka with 1PB/day throughput

### Message Queue Servers
- **Kafka Brokers**: 500 brokers
- **Broker Specs**: 32 vCPU, 128GB RAM, 40TB SSD
- **Throughput per Broker**: 200MB/s
- **Total Throughput**: 100GB/s

## Cost Estimates

### Infrastructure Costs (Monthly)
```
Compute (Application Servers):
100,000 servers × $200/month = $20M/month

Database Servers:
12,000 servers × $500/month = $6M/month

Cache Servers:
1,000 servers × $300/month = $300K/month

Media Processing:
15,000 workers × $150/month = $2.25M/month

Storage (Database):
400TB × $100/TB/month = $40K/month

Storage (Media - S3):
2,160PB × $20/TB/month = $43.2M/month

CDN Bandwidth:
1,440GB/s × 2.6PB/month × $50/TB = $187M/month

Total Monthly Cost: ~$259M/month
Cost per DAU: $259M / 500M = $0.52 per DAU/month
```

## Scaling Bottlenecks

### Write Bottlenecks
- **Photo Upload**: 3,500 TPS peak requires distributed processing
- **Video Transcoding**: CPU-intensive, requires GPU acceleration
- **Database Writes**: 100,000 writes/second requires sharding
- **Solution**: Horizontal scaling, async processing, GPU clusters

### Read Bottlenecks
- **Feed Generation**: 1.7M requests/second peak
- **Media Delivery**: 1,600GB/s egress bandwidth
- **Database Reads**: 5M queries/second requires replicas
- **Solution**: Aggressive caching, CDN, read replicas

### Storage Bottlenecks
- **Media Storage Growth**: 3.8PB/day requires object storage
- **Database Growth**: 400TB requires sharding and archival
- **Index Size**: Search index grows with content
- **Solution**: Tiered storage, compression, deduplication

### Network Bottlenecks
- **Egress Bandwidth**: 1,600GB/s requires CDN
- **Cross-Region Traffic**: Global users need regional data centers
- **Media Delivery**: 90% CDN hit rate critical
- **Solution**: Multi-region deployment, CDN, edge caching

## Constraints and Limitations

### Technical Constraints
- **Photo Size**: Max 8MB per photo
- **Video Duration**: Max 60 seconds for feed, 60 minutes for IGTV
- **Carousel Limit**: Max 10 photos/videos per post
- **Caption Length**: Max 2,200 characters
- **Hashtag Limit**: Max 30 hashtags per post
- **Story Duration**: 24 hours before expiration
- **API Rate Limits**: 200 requests per hour per user

### Business Constraints
- **Content Moderation**: <0.5% of content requires manual review
- **Compliance**: GDPR, CCPA, COPPA data retention and deletion
- **Uptime SLA**: 99.95% availability guarantee
- **Data Residency**: Regional data storage requirements
- **Cost Optimization**: <$0.52 per DAU per month target

### Operational Constraints
- **Deployment Frequency**: Multiple deployments per day
- **Monitoring**: <5 minute detection for critical issues
- **Incident Response**: <15 minute response time
- **Backup Frequency**: Continuous replication, hourly snapshots
- **Disaster Recovery**: <4 hour RTO, <1 hour RPO

This comprehensive scale analysis provides the foundation for designing a system that can handle Instagram's massive scale while maintaining performance, reliability, and cost-effectiveness.
