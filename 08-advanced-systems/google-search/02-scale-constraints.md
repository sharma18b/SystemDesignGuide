# Google Search - Scale and Constraints

## Web Scale Statistics

### Web Size
```
Total Web Pages: 100 billion indexed pages
New Pages Daily: 5 million new pages
Updated Pages Daily: 500 million updates
Total Websites: 1.5 billion domains
Average Page Size: 2 MB (HTML + resources)
Total Web Size: 200 petabytes of content
```

### Query Volume
```
Daily Queries: 8 billion searches
Queries per Second: 92K average, 200K peak
Unique Queries: 15% never seen before
Query Length: 3-5 words average
Mobile Queries: 60% of total
Voice Queries: 20% of total
```

## Crawling Scale

### Crawler Statistics
```
Pages Crawled per Month: 100 billion pages
Crawl Rate: 40K pages/second average
Bandwidth: 800 Gbps for crawling
Crawler Instances: 10,000+ distributed crawlers
Politeness Delay: 1-10 seconds per domain
Robots.txt Checks: 100 million domains
```

### Crawl Frequency
```
Popular Sites (News): Every 5 minutes
High-Traffic Sites: Every hour
Medium-Traffic Sites: Daily
Low-Traffic Sites: Weekly
Deep Web Pages: Monthly
Total Crawl Cycles: 3-4 per month average
```

## Index Size

### Inverted Index
```
Total Terms: 1 trillion unique terms
Posting Lists: 100 billion pages × 500 terms = 50 trillion postings
Index Size: 50 trillion × 20 bytes = 1 petabyte compressed
Forward Index: 100 billion pages × 10 KB = 1 petabyte
Total Index: 100 petabytes (with replicas and auxiliary indices)
```

### Index Breakdown
```
Main Index (Text): 50 PB
Link Graph: 20 PB (100B pages × 10 links × 20 bytes)
Image Index: 10 PB
Video Index: 5 PB
News Index: 2 PB
Local Index: 3 PB
Knowledge Graph: 5 PB
Auxiliary Data: 5 PB
Total: 100 PB
```

## Query Processing Scale

### Query Load
```
Queries per Second: 92K average, 200K peak
Query Processing Time: 200-500ms per query
Servers Queried: 1000+ servers per query
Documents Scored: 10,000+ documents per query
Results Returned: Top 10 results
Cache Hit Rate: 30% (popular queries)
```

### Query Distribution
```
Cached Queries: 30% (served from cache)
Simple Queries: 40% (single term, quick)
Complex Queries: 20% (multiple terms, slower)
Long-Tail Queries: 10% (rare, never seen)
```

## Storage Requirements

### Primary Storage
```
Web Content: 200 PB (raw HTML)
Inverted Index: 50 PB
Forward Index: 1 PB
Link Graph: 20 PB
Metadata: 10 PB
Total Primary: 281 PB
```

### Replicas and Backups
```
Replication Factor: 3x
Total with Replicas: 843 PB
Backups: 281 PB
Total Storage: 1.1 exabytes
```

## Compute Requirements

### Crawling Infrastructure
```
Crawler Servers: 10,000 instances (16 vCPU, 32GB RAM)
Total Compute: 160K vCPUs, 320 TB RAM
Network: 800 Gbps bandwidth
Storage: 10 PB for crawl queue and temp data
```

### Indexing Infrastructure
```
Indexing Servers: 50,000 instances (32 vCPU, 128GB RAM)
Total Compute: 1.6M vCPUs, 6.4 PB RAM
Processing: 5M pages/day × 2 MB = 10 TB/day
Index Updates: 500M updates/day
```

### Query Serving Infrastructure
```
Query Servers: 100,000 instances (64 vCPU, 256GB RAM)
Total Compute: 6.4M vCPUs, 25.6 PB RAM
Queries Served: 92K queries/second
Latency Target: <500ms p95
Cache Servers: 10,000 Redis instances
```

## Network Bandwidth

### Inbound Traffic (Crawling)
```
Crawl Bandwidth: 800 Gbps
Pages Fetched: 40K pages/second × 2 MB = 80 GB/s = 640 Gbps
DNS Lookups: 10K lookups/second
Robots.txt: 1K fetches/second
Total Inbound: 800 Gbps
```

### Outbound Traffic (Query Results)
```
Query Results: 92K queries/s × 100 KB = 9.2 GB/s = 74 Gbps
Autocomplete: 200K requests/s × 10 KB = 2 GB/s = 16 Gbps
Images/Videos: 50K requests/s × 500 KB = 25 GB/s = 200 Gbps
Total Outbound: 290 Gbps
```

## Cost Estimates

### Infrastructure Costs (Annual)
```
Compute:
- Crawlers: $50M/year
- Indexers: $250M/year
- Query Servers: $500M/year
Total Compute: $800M/year

Storage:
- Primary Storage (1.1 EB): $110M/year ($100/TB/year)
- Backup Storage: $30M/year
Total Storage: $140M/year

Network:
- Bandwidth (1 Tbps): $50M/year
- CDN: $20M/year
Total Network: $70M/year

Total Infrastructure: $1.01B/year
```

### Cost per Query
```
Infrastructure: $1.01B / 2.9T queries = $0.00035 per query
Revenue per Query: $0.50 (with ads)
Gross Margin: $0.49965 per query (99.93%)
```

## Data Center Distribution

### Global Infrastructure
```
Primary Data Centers: 20 locations
- North America: 8 DCs
- Europe: 6 DCs
- Asia-Pacific: 4 DCs
- Other: 2 DCs

Edge Locations: 200+ PoPs
- Cache popular queries
- Serve static content
- Reduce latency

Total Servers: 2 million+ servers globally
Power Consumption: 500 MW
```

## Bottlenecks and Constraints

### Critical Bottlenecks
1. **Index Size**: 100 PB requires distributed storage
2. **Query Latency**: Must query 1000+ servers in <500ms
3. **Crawl Rate**: Limited by politeness and bandwidth
4. **Ranking Quality**: ML models require massive compute
5. **Freshness**: Balance crawl frequency vs resources

### Mitigation Strategies
```
Index Size:
- Distributed index across 10,000+ shards
- Compression (10x reduction)
- Tiered storage (hot/warm/cold)

Query Latency:
- Parallel querying across shards
- Early termination (top-k optimization)
- Aggressive caching (30% hit rate)

Crawl Rate:
- Distributed crawlers (10K instances)
- Prioritize important pages
- Incremental crawling

Ranking:
- Pre-compute PageRank
- Lightweight ML models for real-time
- Offline training, online inference

Freshness:
- Adaptive crawl frequency
- Real-time indexing for news
- Incremental index updates
```

This scale analysis demonstrates the massive infrastructure required to operate a global search engine, processing billions of queries daily while maintaining sub-second response times and comprehensive web coverage.
