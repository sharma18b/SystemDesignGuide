# Design Instagram - Problem Statement

## Overview
Design a photo and video sharing social platform similar to Instagram where users can upload media, apply filters, follow others, and engage through likes, comments, and stories. The system should handle billions of photos and videos with high availability and low latency for global users.

## Functional Requirements

### Core Media Features
- **Photo Upload**: Upload photos (up to 10 per post), max 8MB per photo
- **Video Upload**: Upload videos up to 60 seconds, max 100MB
- **Image Filters**: Apply filters and effects to photos before posting
- **Photo Editing**: Crop, rotate, adjust brightness/contrast
- **Multiple Photos**: Carousel posts with up to 10 photos/videos
- **Captions**: Add text captions up to 2,200 characters
- **Hashtags**: Tag posts with hashtags for discovery
- **Location Tags**: Tag posts with geographic locations
- **User Tags**: Tag other users in photos

### Feed and Discovery
- **Home Feed**: Personalized feed of posts from followed users
- **Explore Page**: Discover new content based on interests
- **Profile Feed**: View all posts from a specific user
- **Hashtag Feed**: View all posts with specific hashtag
- **Location Feed**: View posts from specific location
- **Saved Posts**: Bookmark posts for later viewing
- **Feed Ranking**: Algorithmic ranking based on engagement and relevance

### Stories Feature
- **Story Upload**: Post photos/videos that disappear after 24 hours
- **Story Viewing**: View stories from followed users
- **Story Replies**: Send direct messages in response to stories
- **Story Highlights**: Save stories permanently to profile
- **Story Stickers**: Add polls, questions, countdowns, location stickers
- **Story Analytics**: View who watched your stories

### Social Interactions
- **Follow/Unfollow**: Follow users to see their content
- **Like Posts**: Like photos and videos
- **Comment**: Comment on posts with text and emojis
- **Share**: Share posts via DM or to stories
- **Direct Messages**: Private messaging (out of scope for initial design)
- **Mentions**: Mention users in captions and comments
- **Notifications**: Real-time notifications for likes, comments, follows

### User Profile
- **Profile Information**: Bio, profile picture, website link
- **Profile Grid**: Grid view of all user posts
- **Follower/Following Lists**: View followers and following
- **Private Accounts**: Approve follower requests for private accounts
- **Verified Accounts**: Blue checkmark for verified users
- **Account Settings**: Privacy settings, notification preferences

### Content Discovery
- **Search**: Search for users, hashtags, locations
- **Trending Hashtags**: Popular hashtags and topics
- **Suggested Users**: Recommendations for users to follow
- **Related Posts**: Similar content recommendations
- **IGTV**: Long-form video content (10-60 minutes)
- **Reels**: Short-form video content (15-90 seconds)

## Non-Functional Requirements

### Performance Requirements
- **Photo Upload**: <5 seconds for photos <5MB
- **Video Upload**: <30 seconds for videos <50MB
- **Feed Load Time**: <1 second for initial 20 posts
- **Image Load Time**: <500ms for compressed images
- **Story Load Time**: <800ms for story feed
- **Search Response**: <300ms for search queries
- **Notification Delivery**: <2 seconds for real-time notifications

### Scalability Requirements
- **Registered Users**: 2 billion registered users
- **Daily Active Users**: 500 million DAU
- **Monthly Active Users**: 1.5 billion MAU
- **Photos Uploaded**: 100 million photos per day
- **Videos Uploaded**: 50 million videos per day
- **Stories Posted**: 500 million stories per day
- **Feed Requests**: 50 billion per day
- **Concurrent Users**: 100 million concurrent users

### Reliability Requirements
- **System Uptime**: 99.95% availability (4.38 hours downtime per year)
- **Data Durability**: 99.999999999% (11 9's) for media files
- **Upload Success Rate**: 99.9% successful uploads
- **Disaster Recovery**: <4 hours RTO, <1 hour RPO
- **Graceful Degradation**: Maintain core features during partial outages
- **Zero-Downtime Deployments**: Rolling updates without interruption

### Security Requirements
- **Authentication**: OAuth 2.0, JWT tokens, optional 2FA
- **Authorization**: Role-based access control for content
- **Data Encryption**: All data encrypted at rest (AES-256) and in transit (TLS 1.3)
- **Privacy Compliance**: GDPR, CCPA compliance
- **Content Moderation**: Automated and manual content review
- **Copyright Protection**: DMCA compliance, content ID matching
- **Account Security**: Suspicious login detection, account recovery

### Consistency Requirements
- **Feed Delivery**: Eventual consistency (5-10 second lag acceptable)
- **Like Counts**: Eventually consistent engagement metrics
- **Follower Counts**: Eventually consistent counts
- **User Profile**: Strong consistency for profile updates
- **Story Expiration**: Eventually consistent (stories may appear briefly after 24h)
- **Content Deletion**: Eventually consistent deletion across CDN

## Scale Estimates

### User Metrics
- **Total Users**: 2 billion registered users
- **Daily Active Users**: 500 million (25% of registered)
- **Monthly Active Users**: 1.5 billion (75% of registered)
- **Average Followers**: 150 followers per user
- **Power Users**: 2% of users have >100K followers
- **Celebrity Users**: 50,000 users with >1M followers

### Content Metrics
- **Photos per Day**: 100 million photos
- **Videos per Day**: 50 million videos
- **Stories per Day**: 500 million stories
- **Comments per Day**: 1 billion comments
- **Likes per Day**: 4 billion likes
- **Average Photo Size**: 2MB (original), 200KB (compressed)
- **Average Video Size**: 20MB (original), 5MB (compressed)

### Traffic Metrics
- **Feed Requests**: 50 billion per day (~580K per second)
- **Photo Views**: 100 billion per day
- **Video Views**: 20 billion per day
- **Story Views**: 10 billion per day
- **Search Queries**: 2 billion per day
- **Read:Write Ratio**: 500:1 (extremely read-heavy)

### Storage Estimates
```
Photos (5 years):
100M photos/day × 365 days × 5 years × 2MB = 365PB (original)
100M photos/day × 365 days × 5 years × 200KB = 36.5PB (compressed)

Videos (5 years):
50M videos/day × 365 days × 5 years × 20MB = 1,825PB (original)
50M videos/day × 365 days × 5 years × 5MB = 456PB (compressed)

Stories (30 days retention):
500M stories/day × 30 days × 2MB = 30PB

Total Storage: ~2,700PB (with compression and deduplication: ~900PB)
```

### Bandwidth Estimates
```
Ingress:
- Photos: 100M × 2MB = 200TB/day = 2.3GB/s
- Videos: 50M × 20MB = 1PB/day = 11.6GB/s
- Total: ~14GB/s average, ~40GB/s peak

Egress:
- Photo views: 100B × 200KB = 20PB/day = 231GB/s
- Video views: 20B × 5MB = 100PB/day = 1,157GB/s
- Total: ~1,400GB/s average, ~4,000GB/s peak
- With CDN (90% hit rate): Origin serves ~140GB/s
```

## Edge Cases and Constraints

### High-Resolution Media
- **Challenge**: Users upload 4K photos and 4K videos
- **Impact**: Massive storage and bandwidth requirements
- **Solution**: Compress and transcode to multiple resolutions
- **Approach**: Store original + multiple compressed versions

### Viral Content
- **Challenge**: Post goes viral with millions of views
- **Impact**: Sudden traffic spike, CDN cache misses
- **Solution**: Aggressive CDN caching, edge computing
- **Approach**: Pre-warm cache for trending content

### Celebrity Posts
- **Challenge**: Celebrity with 200M followers posts photo
- **Impact**: Fan-out explosion, notification storm
- **Solution**: Separate handling for celebrity accounts
- **Approach**: Pull-based feed for celebrities, rate-limited notifications

### Story Expiration
- **Challenge**: Stories must disappear exactly after 24 hours
- **Impact**: Scheduled deletion at scale
- **Solution**: Background job with eventual consistency
- **Approach**: Mark expired, lazy deletion, CDN cache invalidation

### Duplicate Content Detection
- **Challenge**: Users re-upload same photo multiple times
- **Impact**: Wasted storage and bandwidth
- **Solution**: Perceptual hashing and deduplication
- **Approach**: Hash images, detect duplicates, store once

### Copyright Infringement
- **Challenge**: Users upload copyrighted content
- **Impact**: Legal liability, DMCA takedowns
- **Solution**: Content ID matching, automated detection
- **Approach**: Hash-based matching, ML-based detection

## Success Metrics

### User Engagement
- **Daily Active Users**: Target 500 million DAU
- **Photos Uploaded**: 100+ million per day
- **Stories Posted**: 500+ million per day
- **Session Duration**: Average 30+ minutes per session
- **Retention Rate**: 90%+ day-1 retention, 75%+ day-30 retention
- **Engagement Rate**: 60%+ of users engage daily (like, comment, share)

### Performance Metrics
- **Upload Success Rate**: 99.9%+ successful uploads
- **Feed Load Time**: 95th percentile <1 second
- **Image Load Time**: 95th percentile <500ms
- **Video Playback**: 99%+ successful video plays
- **Search Performance**: 95th percentile <300ms
- **Notification Delivery**: 95%+ delivered within 2 seconds

### Business Metrics
- **Revenue per User**: Increase through ads and shopping
- **Ad Engagement**: 3%+ click-through rate on ads
- **Shopping Conversion**: 5%+ conversion on product tags
- **Support Ticket Volume**: <0.05% of DAU requiring support
- **Infrastructure Cost**: <$0.15 per user per month
- **Content Moderation**: <0.5% of content requiring manual review

### Technical Metrics
- **System Uptime**: 99.95%+ availability
- **CDN Hit Rate**: >90% for media content
- **Database Query Latency**: <10ms p95
- **Cache Hit Rate**: >85% for feed requests
- **Error Rate**: <0.1% of requests result in errors
- **Deployment Frequency**: Multiple deployments per day

## Out of Scope

### Features Not Included in Initial Design
- **Direct Messages**: Private messaging system (separate design)
- **Instagram Shopping**: E-commerce integration and checkout
- **Instagram Live**: Live video streaming
- **Instagram TV (IGTV)**: Long-form video platform
- **Reels**: Short-form video feature (TikTok competitor)
- **Ads Platform**: Advertising creation and campaign management
- **Creator Studio**: Analytics and management tools for creators
- **Business Accounts**: Advanced analytics and insights
- **Instagram API**: Third-party developer platform
- **Cross-posting**: Integration with Facebook, Twitter

This problem statement provides the foundation for designing a comprehensive photo and video sharing platform that can compete with Instagram while maintaining high performance, reliability, and user satisfaction.
