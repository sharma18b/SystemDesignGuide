# Design YouTube/Netflix - Scale and Constraints

## User Scale
- **Registered Users**: 2B
- **Daily Active Users**: 500M (25%)
- **Monthly Active Users**: 1.5B (75%)
- **Concurrent Viewers**: 100M peak
- **Channels**: 50M active channels

## Content Volume
- **Total Videos**: 500M videos
- **Upload Rate**: 500 hours per minute
- **Daily Uploads**: 720,000 hours per day
- **Average Video**: 10 minutes, 500MB
- **Total Storage**: 650PB (5 years)

## Traffic Patterns
- **Video Views**: 1B per day (11,574 VPS)
- **Peak Views**: 35,000 VPS
- **Watch Time**: 1B hours per day
- **Average Session**: 40 minutes
- **Read:Write Ratio**: 1000:1

## Bandwidth Requirements
```
Streaming:
- Views: 1B/day
- Duration: 10 min average
- Bitrate: 2 Mbps average
- Total: 1B × 10 × 2 Mbps = 20PB/day = 231TB/s
- With CDN (95% hit): Origin 11.6TB/s

Upload:
- 500 hours/min × 500MB/hour = 250GB/min = 4.2GB/s
```

## Storage Estimates
```
Original Videos:
720K hours/day × 365 × 5 years × 2GB/hour = 2,628PB

Transcoded (4 resolutions):
2,628PB × 4 = 10,512PB

Thumbnails:
500M videos × 5 thumbnails × 100KB = 250TB

Total: ~10,762PB (with compression: ~8,000PB)
```

## Performance Targets
- **Playback Start**: <2s p95
- **Rebuffer Rate**: <1%
- **Upload Success**: 99.9%
- **Search Latency**: <300ms p95
- **CDN Hit Rate**: >95%

## Compute Resources
- **Transcoding Workers**: 100,000 GPU servers
- **Application Servers**: 50,000 servers
- **Database Servers**: 10,000 servers
- **Cache Servers**: 5,000 Redis nodes

## Cost Estimates
```
Monthly:
- Compute: $50M
- Storage: $160M (8PB × $20/TB)
- CDN: $500M (231TB/s × 2.6PB/month × $80/TB)
- Transcoding: $100M
Total: ~$810M/month
Cost per DAU: $1.62/month
```

This scale analysis provides the foundation for YouTube/Netflix architecture.
