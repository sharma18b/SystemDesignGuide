# Database Batch Auditing Service - Scale and Constraints

## Scale Estimation

### Traffic Analysis
- **Databases**: 1,000 databases
- **Tables**: 100,000 tables
- **Changes**: 10K changes/sec average
- **Peak Traffic**: 50K changes/sec
- **Audit Queries**: 1K queries/sec

### Data Volume
```
Daily Changes:
- 10K changes/sec × 86,400 sec = 864M changes/day

Per Change Storage:
- Change record: 1KB average
- 864M × 1KB = 864GB/day
- With compression (5:1): 173GB/day

7-Year Retention:
- 173GB/day × 365 × 7 = 442TB
- With archival compression: ~100TB
```

## Capacity Planning

### Capture Infrastructure
```
Change Data Capture (CDC):
- 1 CDC agent per database
- 1,000 agents total
- 10K changes/sec per agent capacity
- Headroom: 10x current load
```

### Storage Infrastructure
```
Hot Storage (30 days):
- 173GB/day × 30 = 5.2TB
- SSD for fast queries

Warm Storage (1 year):
- 173GB/day × 365 = 63TB
- HDD for cost efficiency

Cold Storage (7 years):
- Compressed archives
- S3 Glacier
- ~100TB total
```

This scale analysis ensures the auditing system handles enterprise data volumes.
