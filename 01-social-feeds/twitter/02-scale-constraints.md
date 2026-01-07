# Design Twitter - Scale and Constraints

## User Scale Analysis

### User Base Metrics
- **Total Registered Users**: 500 million
- **Daily Active Users (DAU)**: 200 million (40% of registered)
- **Monthly Active Users (MAU)**: 350 million (70% of registered)
- **Peak Concurrent Users**: 50 million during major events
- **New User Signups**: 500,000 per day
- **User Growth Rate**: 15% year-over-year

### User Distribution
- **Geographic Distribution**:
  - North America: 25% (50M users)
  - Europe: 20% (40M users)
  - Asia: 40% (80M users)
  - Rest of World: 15% (30M users)
- **Platform Distribution**:
  - Mobile (iOS/Android): 80%
  - Web: 15%
  - Third-party apps: 5%
- **User Activity Levels**:
  - Power users (>10 tweets/day): 5% (10M users)
  - Active users (1-10 tweets/day): 20% (40M users)
  - Casual users (<1 tweet/day): 75% (150M users)

### Celebrity and Influencer Impact
- **Celebrity Users**: 10,000 users with >1M followers
- **Influencers**: 100,000 users with >100K followers
- **Average User**: 200 followers
- **Median User**: 50 followers
- **Fan-out Challenge**: Top user has 150M followers

## Content Volume Analysis

### Tweet Generation
- **Total Tweets per Day**: 500 million
- **Tweets per Second**: 
  - Average: 5,787 TPS
  - Peak: 20,000 TPS (during major events)
  - Off-peak: 2,000 TPS
- **Tweet Distribution**:
  - Original tweets: 60% (300M/day)
  - Retweets: 30% (150M/day)
  - Quote tweets: 10% (50M/day)

### Media Content
- **Tweets with Media**: 50% (250M tweets/day)
- **Image Tweets**: 40% (200M/day, avg 2 images per tweet)
- **Video Tweets**: 8% (40M/day)
- **GIF Tweets**: 2% (10M/day)
- **Total Images per Day**: 400 million
- **Total Videos per Day**: 40 million

### Content Size Estimates
- **Average Tweet Text**: 200 bytes (UTF-8 encoded)
- **Tweet Metadata**: 500 bytes (timestamps, user_id, engagement counts)
- **Average Image Size**: 200KB (compressed JPEG)
- **Average Video Size**: 5MB (compressed MP4)
- **Average GIF Size**: 1MB

### Daily Storage Requirements
```
Text Storage:
500M tweets × 700 bytes (text + metadata) = 350GB/day

Image Storage:
400M images × 200KB = 80TB/day

Video Storage:
40M videos × 5MB = 200TB/day

GIF Storage:
10M GIFs × 1MB = 10TB/day

Total Daily Storage: ~290TB/day
Monthly Storage: ~8.7PB/month
Yearly Storage: ~105PB/year
```

## Traffic Patterns and Load

### Read Traffic
- **Timeline Requests**: 10 billion per day
  - Average: 115,740 requests/second
  - Peak: 350,000 requests/second
- **Profile Views**: 2 billion per day
- **Search Queries**: 500 million per day
- **Tweet Detail Views**: 1 billion per day
- **Trending Topics**: 100 million requests per day

### Write Traffic
- **Tweet Posts**: 500 million per day (5,787 TPS average)
- **Likes**: 2 billion per day (23,148 TPS average)
- **Retweets**: 150 million per day (1,736 TPS average)
- **Follows**: 50 million per day (579 TPS average)
- **Profile Updates**: 10 million per day (116 TPS average)

### Read:Write Ratio
- **Overall Ratio**: 100:1 (read-heavy system)
- **Timeline Reads**: 10B requests vs 500M tweet writes = 20:1
- **Engagement Reads**: High read amplification for popular tweets
- **Cache Hit Rate**: Target >90% for timeline requests

### Peak Load Scenarios
- **Major Events**: World Cup, Elections, Breaking News
- **Traffic Spike**: 3-5x normal load
- **Duration**: 2-4 hours sustained peak
- **Geographic Concentration**: 80% traffic from event region
- **Example**: Super Bowl generates 300,000 tweets/minute

## Performance Targets

### Latency Requirements
- **Tweet Posting**: <200ms p95
- **Home Timeline Load**: <1 second p95 (50 tweets)
- **User Timeline Load**: <800ms p95
- **Search Results**: <500ms p95
- **Tweet Detail Page**: <300ms p95
- **Profile Page Load**: <500ms p95
- **Media Upload**: <5 seconds for images, <30 seconds for videos

### Throughput Requirements
- **API Gateway**: 500,000 requests/second peak
- **Tweet Ingestion**: 20,000 tweets/second peak
- **Timeline Generation**: 350,000 timelines/second peak
- **Database Reads**: 1 million queries/second
- **Database Writes**: 50,000 writes/second
- **Cache Operations**: 5 million ops/second

### Availability Targets
- **System Uptime**: 99.9% (8.76 hours downtime/year)
- **API Availability**: 99.95% for critical endpoints
- **Data Durability**: 99.999999999% (11 9's)
- **Regional Failover**: <5 minutes to failover
- **Disaster Recovery**: RTO <2 hours, RPO <15 minutes

## Data Storage Constraints

### Database Storage
```
User Data:
500M users × 2KB per user = 1TB

Tweet Data (5 years):
500M tweets/day × 365 days × 5 years × 700 bytes = 638TB

Social Graph:
500M users × 200 followers × 16 bytes = 1.6TB

Engagement Data (likes, retweets):
2B likes/day × 365 days × 1 year × 24 bytes = 17.5TB/year

Total Database Storage: ~2TB + 638TB + 1.6TB + 17.5TB = ~660TB
```

### Media Storage
```
Images (5 years):
400M images/day × 365 days × 5 years × 200KB = 146PB

Videos (5 years):
40M videos/day × 365 days × 5 years × 5MB = 365PB

GIFs (5 years):
10M GIFs/day × 365 days × 5 years × 1MB = 18PB

Total Media Storage: ~529PB (with compression: ~400PB)
```

### Cache Storage
- **Redis Cluster**: 10TB for hot data
  - Recent tweets: 2TB
  - User timelines: 5TB
  - User profiles: 1TB
  - Trending topics: 500GB
  - Session data: 1.5TB

### Search Index Storage
- **Elasticsearch Cluster**: 50TB
  - Tweet index: 40TB (recent 6 months)
  - User index: 5TB
  - Hashtag index: 5TB

## Network Bandwidth

### Ingress Bandwidth
```
Tweet Text:
500M tweets/day × 700 bytes = 350GB/day = 4MB/s average

Media Upload:
290TB/day = 3.4GB/s average, 10GB/s peak

Total Ingress: ~3.5GB/s average, ~10GB/s peak
```

### Egress Bandwidth
```
Timeline Requests:
10B requests/day × 50 tweets × 700 bytes = 350TB/day = 4GB/s

Media Downloads:
Assume 50% of timeline tweets have media, 30% click-through
10B requests × 25 tweets with media × 30% × 200KB = 15PB/day = 174GB/s

Total Egress: ~180GB/s average, ~500GB/s peak
```

### CDN Offload
- **CDN Hit Rate**: 85% for media content
- **Origin Traffic**: 15% of total = 27GB/s average
- **CDN Bandwidth**: 153GB/s average, 425GB/s peak

## Compute Resources

### Application Servers
- **Total Servers**: 50,000 application servers
- **Server Specs**: 32 vCPU, 128GB RAM per server
- **Requests per Server**: 10,000 requests/second
- **Auto-scaling**: Scale up to 150,000 servers during peaks

### Database Servers
- **Primary Databases**: 1,000 shards
- **Read Replicas**: 5,000 replicas (5 per shard)
- **Server Specs**: 64 vCPU, 512GB RAM, 10TB NVMe SSD
- **Connections per Server**: 1,000 connections

### Cache Servers
- **Redis Nodes**: 500 nodes
- **Node Specs**: 32 vCPU, 256GB RAM
- **Cache Capacity**: 10TB total
- **Operations per Node**: 100,000 ops/second

### Message Queue Servers
- **Kafka Brokers**: 200 brokers
- **Broker Specs**: 32 vCPU, 128GB RAM, 20TB SSD
- **Throughput per Broker**: 100MB/s
- **Total Throughput**: 20GB/s

## Cost Estimates

### Infrastructure Costs (Monthly)
```
Compute (Application Servers):
50,000 servers × $200/month = $10M/month

Database Servers:
6,000 servers × $500/month = $3M/month

Cache Servers:
500 servers × $300/month = $150K/month

Storage (Database):
660TB × $100/TB/month = $66K/month

Storage (Media - S3):
400PB × $20/TB/month = $8M/month

CDN Bandwidth:
153GB/s × 2.6PB/month × $50/TB = $130K/month

Total Monthly Cost: ~$21.5M/month
Cost per User: $21.5M / 200M DAU = $0.11 per DAU/month
```

## Scaling Bottlenecks

### Write Bottlenecks
- **Tweet Ingestion**: 20,000 TPS peak requires sharding
- **Fan-out Writes**: Celebrity tweets cause write amplification
- **Database Writes**: 50,000 writes/second requires partitioning
- **Solution**: Sharding, async processing, write-through caching

### Read Bottlenecks
- **Timeline Generation**: 350,000 requests/second peak
- **Hot User Problem**: Popular users cause cache stampede
- **Database Reads**: 1M queries/second requires read replicas
- **Solution**: Multi-level caching, read replicas, CDN

### Storage Bottlenecks
- **Media Storage Growth**: 290TB/day requires object storage
- **Database Growth**: 638TB over 5 years requires archival
- **Index Size**: Search index grows with content
- **Solution**: Tiered storage, data archival, compression

### Network Bottlenecks
- **Egress Bandwidth**: 180GB/s average requires CDN
- **Cross-Region Traffic**: Global users need regional data centers
- **Media Delivery**: 174GB/s for media requires CDN
- **Solution**: Multi-region deployment, CDN, edge caching

## Constraints and Limitations

### Technical Constraints
- **Tweet Length**: 280 characters maximum
- **Media Limits**: 4 images, 1 video, or 1 GIF per tweet
- **Video Duration**: 2 minutes 20 seconds maximum
- **File Size**: 5MB images, 512MB videos
- **API Rate Limits**: 300 requests per 15 minutes per user
- **Follow Limits**: 5,000 follows per day, 400 per hour

### Business Constraints
- **Content Moderation**: <1% of tweets require manual review
- **Compliance**: GDPR, CCPA data retention and deletion
- **Uptime SLA**: 99.9% availability guarantee
- **Data Residency**: Regional data storage requirements
- **Cost Optimization**: <$0.11 per DAU per month target

### Operational Constraints
- **Deployment Frequency**: Multiple deployments per day
- **Monitoring**: <5 minute detection for critical issues
- **Incident Response**: <15 minute response time
- **Backup Frequency**: Continuous replication, hourly snapshots
- **Disaster Recovery**: <2 hour RTO, <15 minute RPO

This comprehensive scale analysis provides the foundation for designing a system that can handle Twitter's massive scale while maintaining performance, reliability, and cost-effectiveness.
