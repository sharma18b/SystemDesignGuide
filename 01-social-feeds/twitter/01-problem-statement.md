# Design Twitter - Problem Statement

## Overview
Design a microblogging platform similar to Twitter that allows users to post short messages (tweets), follow other users, and see a personalized timeline of tweets from people they follow. The system should handle hundreds of millions of users with real-time tweet delivery and high availability.

## Functional Requirements

### Core Tweet Features
- **Post Tweets**: Users can post text messages up to 280 characters
- **Media Attachments**: Support images (up to 4 per tweet), videos (up to 2:20 minutes), GIFs
- **Tweet Interactions**: Like, retweet, quote tweet, reply to tweets
- **Tweet Threading**: Create threaded conversations with multiple connected tweets
- **Tweet Deletion**: Users can delete their own tweets
- **Tweet Editing**: Edit tweets within 30 minutes with edit history visible

### Timeline Features
- **Home Timeline**: Personalized feed of tweets from followed users
- **User Timeline**: View all tweets from a specific user
- **Mentions Timeline**: See tweets that mention the user
- **Trending Topics**: Display trending hashtags and topics
- **Search**: Full-text search for tweets, users, and hashtags
- **Bookmarks**: Save tweets for later viewing

### Social Features
- **Follow/Unfollow**: Follow other users to see their tweets
- **Followers/Following Lists**: View who follows you and who you follow
- **User Profiles**: Display name, bio, profile picture, banner, verification badge
- **Direct Messages**: Private messaging between users (out of scope for initial design)
- **Notifications**: Real-time notifications for likes, retweets, mentions, new followers
- **Lists**: Create curated lists of users to follow specific topics

### Content Discovery
- **Trending Section**: Real-time trending topics and hashtags
- **Explore Page**: Discover new content based on interests
- **Recommendations**: Suggested users to follow
- **Hashtags**: Click hashtags to see related tweets
- **Moments**: Curated collections of tweets about events
- **Topics**: Follow specific topics of interest

### User Management
- **Registration**: Sign up with email/phone, username, password
- **Authentication**: Secure login with optional 2FA
- **Profile Management**: Update profile information, settings
- **Privacy Controls**: Public, protected (private), or blocked accounts
- **Verification**: Blue checkmark for verified accounts
- **Account Suspension**: Moderation and suspension capabilities

## Non-Functional Requirements

### Performance Requirements
- **Tweet Posting Latency**: <200ms for tweet creation
- **Timeline Load Time**: <1 second for home timeline (50 tweets)
- **Search Response Time**: <500ms for search queries
- **Media Upload**: Images <5MB upload within 5 seconds
- **Real-time Updates**: New tweets appear within 5 seconds
- **API Response Time**: 95th percentile <300ms

### Scalability Requirements
- **Registered Users**: Support 500 million registered users
- **Daily Active Users**: 200 million DAU
- **Tweets per Day**: 500 million tweets posted daily
- **Timeline Requests**: 10 billion timeline requests per day
- **Peak Load**: Handle 3x normal load during major events
- **Concurrent Users**: 50 million concurrent active users

### Reliability Requirements
- **System Uptime**: 99.9% availability (8.76 hours downtime per year)
- **Data Durability**: 99.999999999% (11 9's) for tweet data
- **Tweet Delivery**: 99.5% successful tweet delivery to followers
- **Disaster Recovery**: <2 hours RTO, <15 minutes RPO
- **Graceful Degradation**: Maintain core features during partial outages
- **Zero-Downtime Deployments**: Rolling updates without service interruption

### Security Requirements
- **Authentication**: OAuth 2.0, JWT tokens, optional 2FA
- **Authorization**: Role-based access control for tweets and profiles
- **Data Encryption**: All data encrypted at rest and in transit (TLS 1.3)
- **Privacy Compliance**: GDPR, CCPA compliance for user data
- **Content Moderation**: Automated and manual content review
- **Rate Limiting**: Prevent spam and API abuse
- **Audit Logging**: Comprehensive security event logging

### Consistency Requirements
- **Tweet Ordering**: Eventual consistency for timeline delivery
- **Follower Counts**: Eventually consistent follower/following counts
- **Like Counts**: Eventually consistent engagement metrics
- **User Profile**: Strong consistency for profile updates
- **Tweet Deletion**: Eventually consistent deletion across timelines
- **Trending Topics**: Near real-time consistency (5-minute lag acceptable)

## Scale Estimates

### User Metrics
- **Total Users**: 500 million registered users
- **Daily Active Users**: 200 million (40% of registered)
- **Monthly Active Users**: 350 million (70% of registered)
- **Average Followers**: 200 followers per user
- **Power Users**: 1% of users have >100K followers

### Content Metrics
- **Tweets per Day**: 500 million tweets
- **Tweets per Second**: ~6,000 average, ~20,000 peak
- **Average Tweet Size**: 200 bytes (text) + 500KB (media average)
- **Media Tweets**: 50% of tweets include media
- **Retweets**: 30% of timeline content is retweets

### Traffic Metrics
- **Timeline Requests**: 10 billion per day (~115K per second)
- **Read:Write Ratio**: 100:1 (mostly read-heavy)
- **Search Queries**: 500 million per day
- **API Calls**: 5 billion per day from third-party apps

### Storage Estimates
- **Tweet Storage**: 500M tweets/day × 200 bytes = 100GB/day (text only)
- **Media Storage**: 250M media tweets/day × 500KB = 125TB/day
- **Total Daily Storage**: ~125TB per day
- **5-Year Storage**: ~230PB (with compression and deduplication)

### Bandwidth Estimates
- **Incoming**: 500M tweets/day × 500KB = 250TB/day = 2.9GB/s
- **Outgoing**: 10B timeline requests × 50 tweets × 200 bytes = 100TB/day = 1.2GB/s
- **Peak Bandwidth**: 3x average = 12GB/s during major events

## Edge Cases and Constraints

### Celebrity User Problem
- **Challenge**: Users with millions of followers cause fan-out explosion
- **Impact**: Single tweet generates millions of timeline writes
- **Solution**: Separate handling for users with >1M followers
- **Approach**: Pull-based timeline generation for celebrity tweets

### Viral Content
- **Challenge**: Tweets that go viral cause sudden traffic spikes
- **Impact**: Rapid increase in retweets, likes, and timeline requests
- **Solution**: Caching, rate limiting, and load shedding
- **Approach**: Pre-compute popular content, use CDN aggressively

### Trending Topics
- **Challenge**: Real-time computation of trending hashtags
- **Impact**: High computational cost for aggregation
- **Solution**: Approximate counting algorithms (Count-Min Sketch)
- **Approach**: Sliding window with decay for recency

### Timeline Consistency
- **Challenge**: Showing consistent timeline across devices
- **Impact**: User sees different tweets on web vs mobile
- **Solution**: Timeline versioning with cursor-based pagination
- **Approach**: Eventual consistency with conflict resolution

### Deleted Tweet Propagation
- **Challenge**: Removing deleted tweets from all timelines
- **Impact**: Deleted tweets may still appear temporarily
- **Solution**: Lazy deletion with tombstone markers
- **Approach**: Background cleanup jobs with eventual consistency

### Network Partitions
- **Challenge**: Data center isolation during network failures
- **Impact**: Users in different regions see different data
- **Solution**: Multi-region active-active deployment
- **Approach**: Conflict resolution with last-write-wins

## Success Metrics

### User Engagement
- **Daily Active Users**: Target 200 million DAU
- **Tweet Volume**: 500+ million tweets per day
- **Session Duration**: Average 15+ minutes per session
- **Retention Rate**: 80%+ day-1 retention, 60%+ day-30 retention
- **Engagement Rate**: 5%+ of users tweet daily, 50%+ engage (like/retweet)
- **Timeline Refresh**: Average 20+ timeline refreshes per session

### Performance Metrics
- **Tweet Posting Success**: 99.9%+ successful tweet posts
- **Timeline Load Time**: 95th percentile <1 second
- **Search Performance**: 95th percentile <500ms
- **Media Upload Success**: 99%+ successful media uploads
- **API Availability**: 99.9%+ API uptime
- **Real-time Delivery**: 95%+ of tweets delivered within 5 seconds

### Business Metrics
- **Revenue per User**: Increase through promoted tweets and ads
- **Ad Engagement**: 2%+ click-through rate on promoted content
- **API Usage**: 5 billion+ API calls per day from ecosystem
- **Support Ticket Volume**: <0.05% of DAU requiring support
- **Infrastructure Cost**: <$0.02 per user per month
- **Content Moderation**: <1% of tweets requiring manual review

### Technical Metrics
- **System Uptime**: 99.9%+ availability
- **Database Performance**: <10ms p95 query latency
- **Cache Hit Rate**: >90% for timeline requests
- **CDN Offload**: >80% of media served from CDN
- **Error Rate**: <0.1% of requests result in errors
- **Deployment Frequency**: Multiple deployments per day with zero downtime

## Out of Scope

### Features Not Included in Initial Design
- **Direct Messages**: Private messaging system (separate design)
- **Spaces**: Live audio conversations (separate design)
- **Fleets**: Temporary stories feature
- **Twitter Blue**: Premium subscription features
- **Advanced Analytics**: Detailed analytics dashboard for users
- **Third-Party Apps**: OAuth app management and developer portal
- **Advertising Platform**: Ad creation and campaign management
- **Content Moderation Tools**: Advanced moderation dashboard
- **Machine Learning Models**: Recommendation algorithm details
- **Video Live Streaming**: Live video broadcasting (Periscope)

This problem statement provides the foundation for designing a scalable, reliable, and performant microblogging platform that can compete with Twitter while maintaining high performance and user satisfaction.
