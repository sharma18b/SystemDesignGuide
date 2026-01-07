# Design Facebook Newsfeed - Scale and Constraints

## User Scale Analysis

### User Base Metrics
- **Total Registered Users**: 3 billion
- **Daily Active Users (DAU)**: 2 billion (67%)
- **Monthly Active Users (MAU)**: 2.9 billion (97%)
- **Peak Concurrent Users**: 200 million
- **New User Signups**: 2 million per day
- **User Growth Rate**: 10% year-over-year

### User Distribution
- **Geographic Distribution**:
  - Asia-Pacific: 45% (900M users)
  - Europe: 20% (400M users)
  - North America: 15% (300M users)
  - Latin America: 12% (240M users)
  - Rest of World: 8% (160M users)
- **Platform Distribution**:
  - Mobile (iOS/Android): 85%
  - Web: 15%
- **User Activity Levels**:
  - Power users (>10 posts/week): 5% (100M)
  - Active users (1-10 posts/week): 25% (500M)
  - Casual users (<1 post/week): 70% (1.4B)

### Social Graph Metrics
- **Average Friends**: 338 friends per user
- **Average Page Follows**: 40 pages per user
- **Average Group Memberships**: 5 groups per user
- **Celebrity Users**: 100,000 users with >1M friends
- **Top User**: 150M friends (Facebook's own page)

## Content Volume Analysis

### Post Generation
- **Total Posts per Day**: 500 million
- **Posts per Second**:
  - Average: 5,787 posts/second
  - Peak: 17,000 posts/second
  - Off-peak: 2,500 posts/second
- **Post Distribution**:
  - Text only: 30% (150M/day)
  - Photos: 50% (250M/day)
  - Videos: 15% (75M/day)
  - Links: 5% (25M/day)

### Engagement Volume
- **Reactions per Day**: 10 billion
- **Comments per Day**: 5 billion
- **Shares per Day**: 2 billion
- **Reactions per Second**: 115,740 RPS average
- **Comments per Second**: 57,870 CPS average

### Media Content
- **Photos per Day**: 350 million
- **Videos per Day**: 100 million
- **Average Photo Size**: 2MB (original), 200KB (compressed)
- **Average Video Size**: 20MB (original), 5MB (compressed)
- **Video Duration**: Average 2 minutes

### Daily Storage Requirements
```
Text Posts:
500M posts × 500 bytes = 250GB/day

Photos:
350M photos × 2MB = 700TB/day (original)
350M photos × 200KB = 70TB/day (compressed)

Videos:
100M videos × 20MB = 2PB/day (original)
100M videos × 5MB = 500TB/day (compressed)

Total Daily Storage: ~3.3PB/day
Monthly Storage: ~99PB/month
Yearly Storage: ~1.2EB/year
```

## Traffic Patterns and Load

### Read Traffic
- **Feed Requests**: 100 billion per day
  - Average: 1,157,407 requests/second
  - Peak: 3.5 million requests/second
- **Post Views**: 200 billion per day
- **Comment Views**: 10 billion per day
- **Profile Views**: 5 billion per day

### Write Traffic
- **Post Creation**: 500 million per day (5,787 TPS)
- **Reactions**: 10 billion per day (115,740 TPS)
- **Comments**: 5 billion per day (57,870 TPS)
- **Shares**: 2 billion per day (23,148 TPS)

### Read:Write Ratio
- **Overall Ratio**: 200:1 (extremely read-heavy)
- **Feed Reads**: 100B vs 500M posts = 200:1
- **Cache Hit Rate**: Target >95% for feed requests

### Peak Load Scenarios
- **Major Events**: Elections, Super Bowl, New Year
- **Traffic Spike**: 3-5x normal load
- **Duration**: 2-6 hours sustained peak
- **Example**: New Year generates 5M posts/minute

## Performance Targets

### Latency Requirements
- **Feed Load**: <1 second p95 (20 posts)
- **Post Creation**: <500ms p95
- **Reaction**: <100ms p95
- **Comment Load**: <300ms p95
- **Video Playback Start**: <2 seconds p95
- **Image Load**: <500ms p95

### Throughput Requirements
- **API Gateway**: 4 million requests/second peak
- **Post Ingestion**: 17,000 posts/second peak
- **Feed Generation**: 3.5M feeds/second peak
- **Database Reads**: 10 million queries/second
- **Database Writes**: 200,000 writes/second
- **Cache Operations**: 20 million ops/second

### Availability Targets
- **System Uptime**: 99.99% (52 minutes downtime/year)
- **API Availability**: 99.99% for critical endpoints
- **Data Durability**: 99.999999999% (11 9's)
- **Regional Failover**: <10 minutes
- **Disaster Recovery**: RTO <2 hours, RPO <15 minutes

## Data Storage Constraints

### Database Storage
```
User Data:
3B users × 5KB per user = 15TB

Post Metadata (5 years):
500M posts/day × 365 × 5 × 500 bytes = 456TB

Social Graph:
3B users × 338 friends × 16 bytes = 16TB

Engagement Data (1 year):
10B reactions/day × 365 × 24 bytes = 88TB/year

Total Database Storage: ~575TB
```

### Media Storage
```
Photos (5 years):
350M/day × 365 × 5 × 2MB = 1,277PB (original)
350M/day × 365 × 5 × 200KB = 128PB (compressed)

Videos (5 years):
100M/day × 365 × 5 × 20MB = 3,650PB (original)
100M/day × 365 × 5 × 5MB = 913PB (compressed)

Total Media Storage: ~6,000PB
With deduplication (15% savings): ~5,100PB
```

### Cache Storage
- **Redis Cluster**: 100TB for hot data
  - Feed cache: 60TB
  - User profiles: 20TB
  - Post metadata: 10TB
  - Session data: 10TB

### Search Index Storage
- **Elasticsearch Cluster**: 200TB
  - Post index: 150TB
  - User index: 30TB
  - Page/Group index: 20TB

## Network Bandwidth

### Ingress Bandwidth
```
Post Text:
500M posts/day × 500 bytes = 250GB/day = 2.9MB/s

Media Upload:
450M media/day × 2MB = 900TB/day = 10.4GB/s

Total Ingress: ~10.5GB/s average, ~30GB/s peak
```

### Egress Bandwidth
```
Feed Requests:
100B requests/day × 20 posts × 500 bytes = 1PB/day = 11.6GB/s

Media Downloads:
50B views/day × 2MB = 100PB/day = 1,157GB/s

Total Egress: ~1,200GB/s average, ~3,600GB/s peak
```

### CDN Offload
- **CDN Hit Rate**: 90% for media content
- **Origin Traffic**: 10% = 120GB/s average
- **CDN Bandwidth**: 1,080GB/s average, 3,240GB/s peak

## Compute Resources

### Application Servers
- **Total Servers**: 200,000 application servers
- **Server Specs**: 32 vCPU, 128GB RAM
- **Requests per Server**: 20,000 requests/second
- **Auto-scaling**: Up to 600,000 servers during peaks

### Database Servers
- **Primary Databases**: 5,000 shards
- **Read Replicas**: 25,000 replicas (5 per shard)
- **Server Specs**: 64 vCPU, 512GB RAM, 20TB NVMe SSD
- **Connections per Server**: 2,000 connections

### Cache Servers
- **Redis Nodes**: 2,000 nodes
- **Node Specs**: 32 vCPU, 256GB RAM
- **Cache Capacity**: 100TB total
- **Operations per Node**: 100,000 ops/second

### Message Queue Servers
- **Kafka Brokers**: 1,000 brokers
- **Broker Specs**: 32 vCPU, 128GB RAM, 40TB SSD
- **Throughput per Broker**: 200MB/s
- **Total Throughput**: 200GB/s

## Cost Estimates

### Infrastructure Costs (Monthly)
```
Compute (Application Servers):
200,000 servers × $200/month = $40M/month

Database Servers:
30,000 servers × $500/month = $15M/month

Cache Servers:
2,000 servers × $300/month = $600K/month

Storage (Database):
575TB × $100/TB/month = $57.5K/month

Storage (Media - S3):
5,100PB × $20/TB/month = $102M/month

CDN Bandwidth:
1,080GB/s × 2.6PB/month × $50/TB = $140M/month

Total Monthly Cost: ~$298M/month
Cost per DAU: $298M / 2B = $0.15 per DAU/month
```

## Scaling Bottlenecks

### Write Bottlenecks
- **Post Ingestion**: 17,000 TPS peak requires sharding
- **Fan-out Writes**: Celebrity posts cause write amplification
- **Database Writes**: 200,000 writes/second requires partitioning
- **Solution**: Sharding, async processing, write-through caching

### Read Bottlenecks
- **Feed Generation**: 3.5M requests/second peak
- **Hot User Problem**: Popular users cause cache stampede
- **Database Reads**: 10M queries/second requires replicas
- **Solution**: Multi-level caching, read replicas, CDN

### Storage Bottlenecks
- **Media Storage Growth**: 3.3PB/day requires object storage
- **Database Growth**: 575TB requires sharding and archival
- **Index Size**: Search index grows with content
- **Solution**: Tiered storage, data archival, compression

### Network Bottlenecks
- **Egress Bandwidth**: 1,200GB/s requires CDN
- **Cross-Region Traffic**: Global users need regional data centers
- **Media Delivery**: 1,157GB/s requires CDN
- **Solution**: Multi-region deployment, CDN, edge caching

## Constraints and Limitations

### Technical Constraints
- **Post Length**: 63,206 characters maximum
- **Photo Limit**: 50 photos per post
- **Video Duration**: 240 minutes maximum
- **File Size**: 10MB photos, 4GB videos
- **API Rate Limits**: 200 requests per hour per user
- **Friend Limit**: 5,000 friends maximum

### Business Constraints
- **Content Moderation**: <0.3% requiring manual review
- **Compliance**: GDPR, CCPA, COPPA data retention
- **Uptime SLA**: 99.99% availability guarantee
- **Data Residency**: Regional data storage requirements
- **Cost Optimization**: <$0.15 per DAU per month target

### Operational Constraints
- **Deployment Frequency**: Multiple deployments per day
- **Monitoring**: <5 minute detection for critical issues
- **Incident Response**: <15 minute response time
- **Backup Frequency**: Continuous replication, hourly snapshots
- **Disaster Recovery**: <2 hour RTO, <15 minute RPO

This comprehensive scale analysis provides the foundation for designing a system that can handle Facebook's massive scale while maintaining performance, reliability, and cost-effectiveness.
