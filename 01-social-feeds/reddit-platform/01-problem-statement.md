# Design Reddit Platform - Problem Statement

## Overview
Design a community-driven platform like Reddit with subreddits, threaded discussions, voting systems, and content moderation at scale. The system should handle millions of communities with billions of posts and comments while maintaining democratic content ranking through upvotes and downvotes.

## Functional Requirements

### Core Features
- **Subreddits**: Create and manage topic-based communities
- **Posts**: Submit text, links, images, videos, polls
- **Comments**: Threaded discussions with unlimited nesting
- **Voting**: Upvote/downvote posts and comments
- **Sorting**: Hot, New, Top, Controversial, Rising
- **Search**: Full-text search across posts and comments
- **User Profiles**: Karma, post history, saved content
- **Moderation**: Community-specific rules and moderation tools

### Subreddit Features
- **Create Subreddit**: Anyone can create a community
- **Subreddit Settings**: Rules, description, appearance
- **Moderators**: Assign moderators with permissions
- **Flairs**: Post and user flairs for categorization
- **Wiki**: Community wiki pages
- **Sidebar**: Custom sidebar content

### Post Types
- **Text Posts**: Self-posts with markdown formatting
- **Link Posts**: Share external URLs
- **Image Posts**: Upload images directly
- **Video Posts**: Upload or link videos
- **Poll Posts**: Create polls with multiple options
- **Crosspost**: Share posts across subreddits

### Voting and Ranking
- **Upvote/Downvote**: Democratic content ranking
- **Karma**: Aggregate score from votes
- **Hot Algorithm**: Time-decay based ranking
- **Controversial**: Posts with similar up/down votes
- **Rising**: Fast-growing new posts
- **Best**: Confidence-based comment sorting

### Moderation Tools
- **Remove Posts**: Hide rule-breaking content
- **Ban Users**: Temporary or permanent bans
- **AutoModerator**: Automated moderation rules
- **Mod Queue**: Review flagged content
- **Mod Log**: Audit trail of mod actions
- **User Reports**: Community reporting system

## Non-Functional Requirements

### Performance
- **Feed Load**: <1s for 25 posts
- **Comment Load**: <500ms for 200 comments
- **Vote Registration**: <100ms
- **Search**: <300ms for results
- **Post Creation**: <500ms

### Scalability
- **Users**: 500M registered, 50M DAU
- **Subreddits**: 3M+ active communities
- **Posts**: 2M posts per day
- **Comments**: 20M comments per day
- **Votes**: 500M votes per day

### Reliability
- **Uptime**: 99.9% availability
- **Data Durability**: 99.999999999% (11 9's)
- **Vote Accuracy**: 99.99% accurate counting

## Scale Estimates

### Content Volume
```
Posts: 2M/day = 23 TPS
Comments: 20M/day = 231 TPS
Votes: 500M/day = 5,787 TPS

Storage (5 years):
Posts: 2M × 365 × 5 × 1KB = 3.65TB
Comments: 20M × 365 × 5 × 500 bytes = 18.25TB
Total: ~22TB
```

### Traffic
```
Page Views: 20B/month = 7.7M/day
API Requests: 100M/day = 1,157 RPS
Read:Write Ratio: 100:1
```

This problem statement provides the foundation for designing a Reddit-like community platform.
