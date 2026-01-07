# Design Reddit - Scale and Constraints

## User Scale
- **Registered Users**: 500M
- **Daily Active Users**: 50M (10%)
- **Monthly Active Users**: 430M (86%)
- **Subreddits**: 3M+ active communities
- **Moderators**: 100K+ volunteer moderators

## Content Volume
- **Posts per Day**: 2M (23 TPS, peak 70 TPS)
- **Comments per Day**: 20M (231 TPS, peak 700 TPS)
- **Votes per Day**: 500M (5,787 TPS, peak 17K TPS)
- **Average Post Size**: 1KB (text + metadata)
- **Average Comment Size**: 500 bytes

## Traffic Patterns
- **Page Views**: 20B per month
- **API Requests**: 100M per day (1,157 RPS)
- **Read:Write Ratio**: 100:1 (read-heavy)
- **Peak Hours**: 6 PM - 11 PM EST

## Storage Estimates
```
Posts (5 years):
2M/day × 365 × 5 × 1KB = 3.65TB

Comments (5 years):
20M/day × 365 × 5 × 500 bytes = 18.25TB

Votes (1 year):
500M/day × 365 × 16 bytes = 2.92TB

Subreddit Data:
3M subreddits × 100KB = 300GB

Total: ~25TB
```

## Performance Targets
- **Feed Load**: <1s p95
- **Comment Thread**: <500ms p95
- **Vote Registration**: <100ms p95
- **Search**: <300ms p95
- **Uptime**: 99.9%

## Compute Resources
- **Application Servers**: 5,000 servers
- **Database Servers**: 500 shards + 2,500 replicas
- **Cache Servers**: 200 Redis nodes (5TB total)
- **Search Servers**: 100 Elasticsearch nodes

## Cost Estimates
```
Monthly Infrastructure:
- Compute: $1M
- Database: $500K
- Cache: $100K
- Storage: $50K
- CDN: $200K
Total: ~$1.85M/month
Cost per DAU: $0.037/month
```

This scale analysis provides the foundation for Reddit's architecture.
