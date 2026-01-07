# Google Search - System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Layer                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   Web    │  │  Mobile  │  │  Voice   │  │   API    │  │
│  │ Browser  │  │   Apps   │  │Assistant │  │ Clients  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼─────────────┼─────────────┼─────────────┼─────────┘
        │             │             │             │
        └─────────────┼─────────────┼─────────────┘
                      │             │
        ┌─────────────┴─────────────┴─────────────┐
        │         CDN + Edge Cache                 │
        │    (Autocomplete, Popular Queries)       │
        └─────────────┬─────────────┬──────────────┘
                      │             │
        ┌─────────────┴─────────────┴──────────────┐
        │         Query Frontend                    │
        │  (Load Balancing, Query Parsing)          │
        └─────────────┬─────────────┬──────────────┘
                      │             │
    ┌─────────────────┼─────────────┼─────────────────┐
    │                 │             │                 │
┌───┴────────┐  ┌─────┴──────┐  ┌──┴─────────┐  ┌───┴──────┐
│   Query    │  │   Index    │  │  Ranking   │  │  Cache   │
│ Processing │  │  Servers   │  │  Service   │  │  Layer   │
└───┬────────┘  └─────┬──────┘  └──┬─────────┘  └───┬──────┘
    │                 │             │                │
    └─────────────────┼─────────────┼────────────────┘
                      │             │
        ┌─────────────┴─────────────┴──────────────┐
        │      Distributed Index Storage            │
        │    (10,000+ Shards, 100 PB Data)          │
        └───────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Crawling & Indexing Pipeline               │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Web     │→ │ Content  │→ │  Index   │→ │  Index   │  │
│  │ Crawler  │  │ Parser   │  │ Builder  │  │ Storage  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Web Crawler (Googlebot)
**Purpose**: Discover and fetch web pages

**Architecture**:
```
URL Frontier:
- Priority queue of URLs to crawl
- Prioritize by PageRank, freshness, importance
- Distributed across 10K crawler instances
- 100 billion URLs in queue

Crawler Workers:
- Fetch pages in parallel
- Respect robots.txt
- Politeness delay (1-10s per domain)
- Handle redirects, errors, timeouts

DNS Resolver:
- Cache DNS lookups
- 10M domains cached
- Reduce DNS query overhead

Content Fetcher:
- HTTP/HTTPS requests
- Handle compression (gzip, brotli)
- Follow redirects (max 5 hops)
- Timeout after 30 seconds
```

**Crawl Strategy**:
```
Breadth-First Crawl:
1. Start with seed URLs (popular sites)
2. Extract links from fetched pages
3. Add new URLs to frontier
4. Prioritize by importance
5. Crawl in breadth-first order

Focused Crawling:
- Prioritize high-quality pages
- Use PageRank for prioritization
- Crawl popular sites more frequently
- Skip low-quality content

Incremental Crawling:
- Re-crawl changed pages
- Detect changes with checksums
- Update index incrementally
- Reduce redundant crawling
```

### 2. Content Parser and Extractor
**Purpose**: Extract text and metadata from HTML

**Processing Pipeline**:
```
1. HTML Parsing:
   - Parse HTML with lenient parser
   - Handle malformed HTML
   - Extract DOM structure

2. Text Extraction:
   - Remove scripts, styles, ads
   - Extract main content
   - Identify title, headings, paragraphs
   - Extract meta tags

3. Link Extraction:
   - Extract all hyperlinks
   - Resolve relative URLs
   - Filter spam links
   - Build link graph

4. Metadata Extraction:
   - Title, description, keywords
   - Author, publish date
   - Open Graph tags
   - Schema.org structured data

5. Content Analysis:
   - Language detection
   - Topic classification
   - Entity recognition
   - Sentiment analysis
```

### 3. Index Builder
**Purpose**: Create inverted index for fast search

**Inverted Index Structure**:
```
Term → Posting List

Example:
"google" → [
  {doc_id: 1, positions: [5, 23, 45], tf: 3, ...},
  {doc_id: 5, positions: [12], tf: 1, ...},
  {doc_id: 8, positions: [3, 67], tf: 2, ...},
  ...
]

Posting List Fields:
- doc_id: Document identifier
- positions: Word positions in document
- tf: Term frequency
- field: Title, body, anchor text
- proximity: Distance to other query terms
```

**Index Building Process**:
```
1. Tokenization:
   - Split text into words
   - Normalize (lowercase, stemming)
   - Remove stop words (optional)

2. Term Extraction:
   - Extract unique terms
   - Calculate term frequency (TF)
   - Store term positions

3. Posting List Creation:
   - Group by term
   - Sort by document ID
   - Compress with delta encoding

4. Index Sharding:
   - Partition by term hash
   - 10,000 index shards
   - Each shard: 10 GB compressed

5. Index Merging:
   - Merge incremental updates
   - Compact posting lists
   - Remove deleted documents
```

### 4. Query Processing Service
**Purpose**: Parse and understand user queries

**Query Pipeline**:
```
1. Query Parsing:
   - Tokenize query
   - Identify operators (AND, OR, NOT, quotes)
   - Extract filters (site:, filetype:)

2. Query Expansion:
   - Synonyms (car → automobile)
   - Stemming (running → run)
   - Spell correction (gogle → google)

3. Query Understanding:
   - Intent detection (informational, navigational)
   - Entity recognition (person, place, product)
   - Query classification (news, images, local)

4. Query Rewriting:
   - Add implicit terms
   - Remove redundant terms
   - Optimize for performance
```

### 5. Index Servers
**Purpose**: Retrieve matching documents from index

**Query Execution**:
```
1. Shard Selection:
   - Query all 10,000 shards in parallel
   - Each shard searches its partition
   - Timeout: 200ms per shard

2. Posting List Retrieval:
   - Fetch posting lists for query terms
   - Intersect lists for AND queries
   - Union lists for OR queries

3. Document Scoring:
   - Calculate relevance score
   - BM25 algorithm
   - Consider term frequency, document length
   - Early termination (top-k optimization)

4. Result Aggregation:
   - Collect results from all shards
   - Merge and sort by score
   - Return top 1000 documents
```

### 6. Ranking Service
**Purpose**: Rank results by relevance

**Ranking Factors**:
```
Content Relevance (40%):
- Term frequency (TF)
- Inverse document frequency (IDF)
- Term proximity
- Field importance (title > body)

Page Authority (30%):
- PageRank score
- Domain authority
- Backlink quality
- Trust signals

User Engagement (20%):
- Click-through rate
- Dwell time
- Bounce rate
- Return visits

Freshness (10%):
- Publish date
- Last modified date
- Crawl recency
- Query freshness need
```

**Ranking Algorithm**:
```
1. Initial Scoring (BM25):
   score = Σ IDF(term) × (TF(term) × (k1 + 1)) / 
           (TF(term) + k1 × (1 - b + b × (docLen / avgDocLen)))

2. PageRank Boost:
   score = score × log(PageRank + 1)

3. ML Re-Ranking:
   - Features: 200+ signals
   - Model: LambdaMART (gradient boosting)
   - Training: Click data, human raters
   - Inference: <50ms

4. Personalization:
   - User location
   - Search history
   - Language preference
   - Device type

5. Diversity:
   - Ensure variety of sources
   - Avoid duplicate content
   - Balance perspectives
```

### 7. Cache Layer
**Purpose**: Cache popular queries for fast response

**Caching Strategy**:
```
L1 Cache (Edge):
- Autocomplete suggestions
- Popular queries (top 1%)
- TTL: 5 minutes
- Hit rate: 30%

L2 Cache (Regional):
- Query results
- Personalized results
- TTL: 1 hour
- Hit rate: 20%

L3 Cache (Data Center):
- Index shards
- Document metadata
- TTL: 24 hours
- Hit rate: 50%
```

## Data Storage

### Index Storage
```
Distributed File System (GFS/Colossus):
- 100 PB of index data
- 10,000 shards
- 3x replication
- Automatic failover

Shard Distribution:
- Hash-based partitioning
- Even distribution of terms
- Co-locate related data
- Minimize cross-shard queries
```

### Link Graph Storage
```
Graph Database:
- 100 billion nodes (pages)
- 1 trillion edges (links)
- PageRank computation
- Link analysis

Storage Format:
- Adjacency list
- Compressed with delta encoding
- Sharded by domain
- 20 PB total size
```

## Real-Time Indexing

### Fresh Index Pipeline
```
1. Detect New Content:
   - RSS feeds
   - Sitemaps
   - Social media
   - News sites

2. Fast Crawl:
   - Priority crawl queue
   - 5-minute crawl cycle
   - Real-time parsing

3. Incremental Index:
   - Update index in-place
   - No full rebuild
   - Visible in <10 minutes

4. Merge with Main Index:
   - Periodic merge (hourly)
   - Maintain consistency
   - Remove duplicates
```

## Monitoring and Operations

### Key Metrics
```
Crawl Metrics:
- Pages crawled per second
- Crawl success rate
- Average page size
- Robots.txt compliance

Index Metrics:
- Index size and growth
- Index freshness
- Duplicate rate
- Spam detection rate

Query Metrics:
- Queries per second
- Query latency (p50, p95, p99)
- Cache hit rate
- Result quality (CTR, dwell time)
```

This architecture enables Google Search to crawl billions of pages, build massive indices, and serve billions of queries daily with sub-second latency through distributed systems, intelligent caching, and advanced ranking algorithms.
