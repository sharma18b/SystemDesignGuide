# Google Search - Database Design

## Storage Systems Overview

### Primary Storage Technologies
- **Bigtable**: Structured data (crawl metadata, index metadata)
- **GFS/Colossus**: Large files (index shards, crawled content)
- **Spanner**: Globally distributed data (user data, settings)
- **Memcache/Redis**: Caching layer

## Inverted Index Schema

### Index Structure
```
Inverted Index (Key-Value Store):
Key: Term (string)
Value: Posting List (compressed binary)

Posting List Entry:
{
  doc_id: uint64,           // Document identifier
  term_frequency: uint16,   // Occurrences in document
  positions: []uint32,      // Word positions
  field_flags: uint8,       // Title, body, anchor, etc.
  proximity_score: float32  // Distance to other terms
}

Example:
"machine learning" → [
  {doc_id: 12345, tf: 5, positions: [10, 45, 67, 89, 120], 
   field_flags: 0b00000011, proximity: 0.95},
  {doc_id: 67890, tf: 2, positions: [5, 234], 
   field_flags: 0b00000001, proximity: 0.87},
  ...
]

Compression:
- Delta encoding for doc_ids
- Variable-length encoding for positions
- 10x compression ratio
- 1 PB compressed from 10 PB raw
```

### Index Sharding
```
Sharding Strategy: Hash-based by term

Shard Assignment:
shard_id = hash(term) % 10000

Shard Size:
- 10,000 shards total
- 10 GB per shard (compressed)
- 100 GB per shard (uncompressed)
- 3x replication

Benefits:
- Even distribution of terms
- Parallel query processing
- Independent shard updates
- Fault isolation
```

## Document Store Schema

### Document Metadata (Bigtable)
```
Table: documents
Row Key: doc_id (uint64)

Column Families:
- content: HTML, text, title
- metadata: URL, crawl_time, language
- links: outlinks, inlinks
- quality: PageRank, spam_score
- engagement: CTR, dwell_time

Schema:
{
  doc_id: 12345,
  content: {
    url: "https://example.com/page",
    title: "Example Page Title",
    text: "Page content...",
    html: "<html>...</html>",
    snippet: "Preview text..."
  },
  metadata: {
    crawl_time: 1704715200,
    last_modified: 1704700000,
    language: "en",
    content_type: "text/html",
    size_bytes: 45678
  },
  links: {
    outlinks: [67890, 11111, 22222],
    inlinks: [33333, 44444],
    anchor_texts: ["example", "sample page"]
  },
  quality: {
    pagerank: 0.00234,
    spam_score: 0.05,
    authority_score: 0.78,
    trust_score: 0.92
  },
  engagement: {
    impressions: 10000,
    clicks: 500,
    ctr: 0.05,
    avg_dwell_time: 45.3
  }
}
```

### URL Frontier (Crawl Queue)
```
Table: url_frontier
Row Key: priority_score + url_hash

Columns:
- url: Full URL
- priority: Crawl priority (0-100)
- last_crawl: Last crawl timestamp
- crawl_frequency: How often to crawl
- depth: Distance from seed URLs
- domain: Domain name

Priority Calculation:
priority = (pagerank × 0.4) + 
           (freshness_need × 0.3) + 
           (link_count × 0.2) + 
           (user_interest × 0.1)

Sharding:
- Shard by domain (politeness)
- Each crawler handles specific domains
- Avoid overloading single domain
```

## Link Graph Schema

### Link Graph Storage
```
Table: link_graph
Row Key: source_doc_id

Columns:
- outlinks: [target_doc_id, anchor_text, position]
- inlink_count: Number of inbound links
- pagerank: Computed PageRank score

Example:
{
  source_doc_id: 12345,
  outlinks: [
    {target: 67890, anchor: "machine learning", pos: 45},
    {target: 11111, anchor: "AI tutorial", pos: 123}
  ],
  inlink_count: 234,
  pagerank: 0.00234
}

Reverse Index (for inlinks):
Table: reverse_links
Row Key: target_doc_id
Columns: [source_doc_id, anchor_text]
```

### PageRank Computation
```
Algorithm: Power Iteration

Pseudocode:
PR(A) = (1-d) + d × Σ(PR(Ti) / C(Ti))

Where:
- PR(A): PageRank of page A
- d: Damping factor (0.85)
- Ti: Pages linking to A
- C(Ti): Outlink count of Ti

Implementation:
1. Initialize all pages: PR = 1/N
2. Iterate 20-30 times:
   - For each page: Calculate new PR
   - Update PR values
3. Converge when change < threshold
4. Store final PR scores

Distributed Computation:
- MapReduce for parallel processing
- Process 100B pages in 24 hours
- Update monthly
```

## Query Log Schema

### Query Logs (Bigtable)
```
Table: query_logs
Row Key: timestamp + user_id + query_hash

Columns:
- query: Query text
- user_id: User identifier (hashed)
- timestamp: Query time
- results_shown: Top 10 result doc_ids
- clicks: Clicked result positions
- dwell_times: Time spent on each result
- location: User location (city-level)
- device: Desktop, mobile, tablet

Example:
{
  query: "machine learning tutorial",
  user_id: "hash_abc123",
  timestamp: 1704715200,
  results_shown: [12345, 67890, 11111, ...],
  clicks: [0, 2],  // Clicked 1st and 3rd results
  dwell_times: [45.3, 120.5],  // Seconds
  location: "San Francisco, CA",
  device: "mobile"
}

Usage:
- Ranking model training
- Query understanding
- Autocomplete suggestions
- Trending queries
```

## Autocomplete Data

### Autocomplete Trie
```
Data Structure: Prefix Tree (Trie)

Node Structure:
{
  prefix: "mach",
  children: {
    'i': Node,  // "machi"
    'o': Node   // "macho"
  },
  suggestions: [
    {query: "machine learning", score: 95, count: 1M},
    {query: "machine translation", score: 78, count: 500K}
  ]
}

Scoring:
score = (query_frequency × 0.6) + 
        (recency × 0.2) + 
        (personalization × 0.2)

Storage:
- 100M unique queries
- 1B prefix nodes
- 10 GB compressed
- Replicated to edge locations
```

## Cache Schema

### Query Result Cache (Redis)
```
Key: query_hash + location + language
Value: Serialized search results
TTL: 1 hour (popular queries), 5 minutes (fresh queries)

Example:
Key: "sha256(machine learning):SF:en"
Value: {
  results: [
    {doc_id: 12345, title: "...", snippet: "...", url: "..."},
    ...
  ],
  total_results: 45000000,
  query_time_ms: 234,
  cached_at: 1704715200
}

Cache Invalidation:
- TTL-based expiration
- Manual invalidation for updated pages
- LRU eviction for memory management
```

## Index Metadata

### Shard Metadata (Bigtable)
```
Table: index_shards
Row Key: shard_id

Columns:
- shard_id: Shard identifier (0-9999)
- term_range: [start_term, end_term]
- doc_count: Documents in shard
- term_count: Unique terms in shard
- size_bytes: Shard size
- last_updated: Last update timestamp
- servers: Servers hosting this shard

Example:
{
  shard_id: 1234,
  term_range: ["machine", "magazine"],
  doc_count: 10000000,
  term_count: 50000,
  size_bytes: 10737418240,  // 10 GB
  last_updated: 1704715200,
  servers: ["server-1234", "server-5678", "server-9012"]
}
```

## User Data Schema

### User Profiles (Spanner)
```
Table: users
Primary Key: user_id

Columns:
- user_id: UUID
- email: Encrypted email
- preferences: JSON (language, safe search, etc.)
- search_history: Recent queries (encrypted)
- location: Default location
- created_at: Account creation time

Example:
{
  user_id: "uuid-123",
  email: "encrypted_email",
  preferences: {
    language: "en",
    safe_search: true,
    results_per_page: 10
  },
  search_history: ["encrypted_query_1", "encrypted_query_2"],
  location: "San Francisco, CA",
  created_at: 1704715200
}

Privacy:
- Encrypted at rest
- Anonymized for analytics
- GDPR compliant
- User can delete history
```

## Data Retention

### Retention Policies
```
Crawled Content:
- Current version: Indefinite
- Historical versions: 90 days
- Deleted pages: 30 days (for recovery)

Index Data:
- Active index: Indefinite
- Incremental updates: 7 days
- Old index versions: 30 days

Query Logs:
- Detailed logs: 18 months
- Aggregated data: 5 years
- Anonymized data: Indefinite

User Data:
- Active users: Indefinite
- Inactive users (>2 years): Anonymize
- Deleted accounts: 30 days grace period
```

## Backup and Recovery

### Backup Strategy
```
Index Backups:
- Full backup: Weekly
- Incremental backup: Daily
- Snapshot: Every 6 hours
- Retention: 30 days

Recovery:
- Point-in-time recovery
- Shard-level recovery
- Cross-region replication
- RTO: 4 hours, RPO: 6 hours
```

This database design supports Google Search's massive scale with distributed storage, efficient indexing, and fast query processing while maintaining data consistency and reliability.
