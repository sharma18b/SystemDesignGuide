# Design Facebook Newsfeed - Problem Statement

## Overview
Design the core newsfeed system for a social network like Facebook with 2+ billion users, showing personalized content from friends, pages, groups, and ads with sophisticated ranking algorithms. The system should handle massive scale while maintaining real-time updates and high user engagement.

## Functional Requirements

### Core Newsfeed Features
- **Personalized Feed**: Show posts from friends, pages, and groups user follows
- **Post Types**: Text, photos, videos, links, polls, events, live videos
- **Post Interactions**: Like, comment, share, react (love, haha, wow, sad, angry)
- **Post Visibility**: Public, friends, friends of friends, custom lists
- **Feed Ranking**: Algorithmic ranking based on relevance and engagement
- **Real-time Updates**: New posts appear without page refresh
- **Infinite Scroll**: Continuous loading of older posts
- **Feed Filters**: Most recent, top posts, favorites

### Content Sources
- **Friends' Posts**: Posts from connected friends
- **Pages**: Posts from pages user follows
- **Groups**: Posts from groups user is member of
- **Ads**: Sponsored content and advertisements
- **Suggested Content**: Recommended posts from non-friends
- **Memories**: "On This Day" historical posts
- **Stories**: Ephemeral 24-hour content at top of feed

### Post Creation
- **Text Posts**: Status updates up to 63,206 characters
- **Photo Posts**: Upload up to 50 photos per post
- **Video Posts**: Upload videos up to 240 minutes
- **Link Sharing**: Share URLs with preview generation
- **Check-ins**: Tag location in posts
- **Tag Friends**: Mention friends in posts
- **Feeling/Activity**: Add mood or activity to posts
- **Background Colors**: Colorful backgrounds for text posts

### Engagement Features
- **Reactions**: Like, love, haha, wow, sad, angry (6 reactions)
- **Comments**: Nested comments with threading
- **Shares**: Share to timeline, groups, or via messenger
- **Save Posts**: Bookmark posts for later
- **Hide Posts**: Remove from feed
- **Report Posts**: Flag inappropriate content
- **Turn on Notifications**: Get notified of post activity

### Feed Customization
- **Favorites**: Prioritize posts from selected friends/pages
- **Snooze**: Temporarily hide posts from person/page (30 days)
- **Unfollow**: Stop seeing posts without unfriending
- **See First**: Always show posts from specific friends/pages
- **Feed Preferences**: Manage what appears in feed
- **Ad Preferences**: Control ad targeting

## Non-Functional Requirements

### Performance Requirements
- **Feed Load Time**: <1 second for initial 20 posts
- **Post Creation**: <500ms to publish post
- **Real-time Updates**: New posts appear within 5 seconds
- **Reaction Time**: <100ms to register like/reaction
- **Comment Load**: <300ms to load comments
- **Video Playback**: <2 seconds to start playing
- **Image Load**: <500ms for compressed images

### Scalability Requirements
- **Registered Users**: 3 billion registered users
- **Daily Active Users**: 2 billion DAU
- **Monthly Active Users**: 2.9 billion MAU
- **Posts per Day**: 500 million posts created daily
- **Feed Requests**: 100 billion feed requests per day
- **Reactions per Day**: 10 billion reactions per day
- **Comments per Day**: 5 billion comments per day
- **Concurrent Users**: 200 million concurrent users

### Reliability Requirements
- **System Uptime**: 99.99% availability (52 minutes downtime per year)
- **Data Durability**: 99.999999999% (11 9's) for posts
- **Feed Delivery**: 99.9% successful feed generation
- **Disaster Recovery**: <2 hours RTO, <15 minutes RPO
- **Graceful Degradation**: Maintain core features during outages
- **Zero-Downtime Deployments**: Rolling updates without interruption

### Security Requirements
- **Authentication**: OAuth 2.0, JWT tokens, optional 2FA
- **Authorization**: Fine-grained privacy controls per post
- **Data Encryption**: All data encrypted at rest and in transit
- **Privacy Compliance**: GDPR, CCPA, COPPA compliance
- **Content Moderation**: Automated and manual review
- **Rate Limiting**: Prevent spam and API abuse
- **Audit Logging**: Comprehensive security event logging

### Consistency Requirements
- **Feed Delivery**: Eventual consistency (5-10 second lag acceptable)
- **Reaction Counts**: Eventually consistent engagement metrics
- **Friend Counts**: Eventually consistent counts
- **Post Visibility**: Strong consistency for privacy settings
- **Post Deletion**: Eventually consistent deletion across feeds
- **Trending Topics**: Near real-time consistency (5-minute lag)

## Scale Estimates

### User Metrics
- **Total Users**: 3 billion registered users
- **Daily Active Users**: 2 billion (67% of registered)
- **Monthly Active Users**: 2.9 billion (97% of registered)
- **Average Friends**: 338 friends per user
- **Average Page Follows**: 40 pages per user
- **Average Group Memberships**: 5 groups per user

### Content Metrics
- **Posts per Day**: 500 million posts
- **Photos per Day**: 350 million photos
- **Videos per Day**: 100 million videos
- **Comments per Day**: 5 billion comments
- **Reactions per Day**: 10 billion reactions
- **Shares per Day**: 2 billion shares
- **Average Post Size**: 500 bytes (text) + 2MB (media average)

### Traffic Metrics
- **Feed Requests**: 100 billion per day (~1.16M per second)
- **Read:Write Ratio**: 200:1 (extremely read-heavy)
- **Peak Load**: 3x normal during major events
- **API Calls**: 50 billion per day from apps

### Storage Estimates
```
Posts (5 years):
500M posts/day × 365 days × 5 years × 500 bytes = 456TB

Photos (5 years):
350M photos/day × 365 days × 5 years × 2MB = 1,277PB

Videos (5 years):
100M videos/day × 365 days × 5 years × 20MB = 3,650PB

Total Storage: ~5,000PB (with compression: ~2,000PB)
```

### Bandwidth Estimates
```
Ingress:
- Posts: 500M × 500 bytes = 250GB/day = 2.9MB/s
- Media: 450M × 2MB = 900TB/day = 10.4GB/s
- Total: ~10.5GB/s average, ~30GB/s peak

Egress:
- Feed requests: 100B × 20 posts × 500 bytes = 1PB/day = 11.6GB/s
- Media views: 50B × 2MB = 100PB/day = 1,157GB/s
- Total: ~1,200GB/s average, ~3,600GB/s peak
- With CDN (90% hit rate): Origin serves ~120GB/s
```

## Edge Cases and Constraints

### Viral Content
- **Challenge**: Post goes viral with millions of shares
- **Impact**: Sudden traffic spike, fan-out explosion
- **Solution**: Aggressive caching, rate limiting, load shedding
- **Approach**: Pre-compute popular content, use CDN

### Celebrity Posts
- **Challenge**: User with 100M+ friends posts content
- **Impact**: Fan-out explosion, notification storm
- **Solution**: Separate handling for high-profile users
- **Approach**: Pull-based feed for celebrities

### Privacy Changes
- **Challenge**: User changes post privacy after sharing
- **Impact**: Need to update visibility across all feeds
- **Solution**: Lazy update with eventual consistency
- **Approach**: Background job to propagate changes

### Feed Consistency
- **Challenge**: Showing consistent feed across devices
- **Impact**: User sees different posts on web vs mobile
- **Solution**: Feed versioning with cursor-based pagination
- **Approach**: Eventual consistency with conflict resolution

### Deleted Post Propagation
- **Challenge**: Removing deleted posts from all feeds
- **Impact**: Deleted posts may still appear temporarily
- **Solution**: Lazy deletion with tombstone markers
- **Approach**: Background cleanup job

## Success Metrics

### User Engagement
- **Daily Active Users**: Target 2 billion DAU
- **Posts Created**: 500+ million per day
- **Session Duration**: Average 35+ minutes per session
- **Retention Rate**: 95%+ day-1 retention, 85%+ day-30 retention
- **Engagement Rate**: 70%+ of users engage daily
- **Feed Refresh**: Average 15+ feed refreshes per session

### Performance Metrics
- **Feed Load Time**: 95th percentile <1 second
- **Post Creation Success**: 99.9%+ successful posts
- **Real-time Delivery**: 95%+ of posts delivered within 5 seconds
- **Reaction Success**: 99.9%+ successful reactions
- **Comment Load Time**: 95th percentile <300ms
- **Video Playback**: 99%+ successful video plays

### Business Metrics
- **Revenue per User**: Increase through ads
- **Ad Engagement**: 2%+ click-through rate
- **API Usage**: 50 billion+ API calls per day
- **Support Ticket Volume**: <0.03% of DAU
- **Infrastructure Cost**: <$0.20 per user per month
- **Content Moderation**: <0.3% requiring manual review

## Out of Scope

### Features Not Included in Initial Design
- **Messenger**: Private messaging system (separate design)
- **Marketplace**: Buy/sell platform
- **Dating**: Facebook Dating feature
- **Gaming**: Facebook Gaming platform
- **Watch**: Video streaming platform
- **Events**: Event creation and management
- **Fundraisers**: Charity and fundraising tools
- **Jobs**: Job posting and application
- **Ads Manager**: Ad creation and campaign management
- **Business Suite**: Business management tools

This problem statement provides the foundation for designing a comprehensive newsfeed system that can compete with Facebook while maintaining high performance, reliability, and user satisfaction at massive scale.
