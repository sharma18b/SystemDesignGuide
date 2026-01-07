# Web Cache - Database Design

## Cache Entry Schema

### Core Data Structure
```
CacheEntry:
  cache_key: string (hash of URL + vary headers)
  url: string (original URL)
  method: string (GET, POST, etc.)
  status_code: int (200, 304, 404, etc.)
  headers: map<string, string>
  body: bytes (compressed content)
  body_size: int64
  compressed: boolean
  compression_type: string (gzip, brotli, none)
  created_at: timestamp
  last_accessed: timestamp
  access_count: int64
  ttl: int32 (seconds)
  expires_at: timestamp
  etag: string
  last_modified: timestamp
  vary_headers: []string
  tags: []string (for tag-based invalidation)
  metadata: map<string, any>
```

### Memory Cache Structure (L1)
```
In-Memory Hash Table:
  Key: cache_key (string)
  Value: CacheEntry (struct)
  
LRU List:
  Doubly-linked list of cache keys
  Head: Most recently used
  Tail: Least recently used
  
Index:
  URL → cache_key mapping
  Tag → []cache_key mapping
  
Size: 128GB per node
Eviction: LRU when memory full
```

### Disk Cache Structure (L2)
```
File System Layout:
/cache/
  /hot/     (NVMe SSD - frequently accessed)
    /00/
      /00/
        cache_key_hash.dat
        cache_key_hash.meta
  /warm/    (SATA SSD - less frequently accessed)
    /00/
      /00/
        cache_key_hash.dat
        cache_key_hash.meta

Metadata File (.meta):
  - Cache entry metadata (JSON)
  - Headers, TTL, timestamps
  - Size: ~1KB per entry

Data File (.dat):
  - Compressed response body
  - Size: Variable (avg 200KB)
```

## Indexing Strategy

### Primary Index (Cache Key)
```
Hash Index:
  - O(1) lookup by cache key
  - In-memory for L1
  - B-tree on disk for L2
  
Implementation:
  - Hash function: MurmurHash3
  - Collision handling: Chaining
  - Load factor: 0.75
```

### Secondary Indexes

**URL Index:**
```
Purpose: Lookup by original URL
Structure: Hash table (URL → cache_key)
Use Case: Invalidation by URL
```

**Tag Index:**
```
Purpose: Tag-based invalidation
Structure: Inverted index (tag → []cache_key)
Use Case: Invalidate related content
Example:
  tag:"product:123" → [key1, key2, key3]
  Purge tag → Invalidate all keys
```

**Expiration Index:**
```
Purpose: TTL-based eviction
Structure: Min-heap (expires_at → cache_key)
Use Case: Background cleanup of expired entries
```

## Cache Metadata Management

### Metadata Store
```
Purpose: Track cache statistics and configuration
Storage: Redis or in-memory database

Schemas:

CacheStats:
  node_id: string
  total_requests: int64
  cache_hits: int64
  cache_misses: int64
  hit_rate: float
  total_size_bytes: int64
  entry_count: int64
  eviction_count: int64
  last_updated: timestamp

CacheConfig:
  max_size_bytes: int64
  max_entry_size: int64
  default_ttl: int32
  eviction_policy: string
  compression_enabled: boolean
  compression_algorithm: string
```

## TTL and Expiration Management

### TTL Calculation
```
Priority Order:
1. Cache-Control: max-age (from origin)
2. Expires header (from origin)
3. Last-Modified heuristic (10% of age)
4. Default TTL (configured, e.g., 3600s)

Example:
  Cache-Control: max-age=3600
  → TTL = 3600 seconds
  
  Expires: Thu, 01 Jan 2025 12:00:00 GMT
  → TTL = expires_time - current_time
  
  Last-Modified: Thu, 01 Jan 2024 12:00:00 GMT
  → TTL = (current_time - last_modified) * 0.1
  
  No headers:
  → TTL = default_ttl (3600s)
```

### Expiration Handling
```
Lazy Expiration:
  - Check TTL on cache lookup
  - If expired, treat as cache miss
  - Fetch fresh content from origin
  
Active Expiration:
  - Background thread scans expiration index
  - Delete expired entries every 60 seconds
  - Batch delete for efficiency
  
Grace Period:
  - Serve stale content if origin unavailable
  - Extended TTL during origin outage
  - stale-while-revalidate support
```

## Vary Header Handling

### Multiple Cache Entries
```
URL: /page.html
Vary: Accept-Encoding, Accept-Language

Cache Entries:
1. cache_key: hash("GET:/page.html:gzip:en-US")
   body: gzipped English content
   
2. cache_key: hash("GET:/page.html:gzip:es-ES")
   body: gzipped Spanish content
   
3. cache_key: hash("GET:/page.html:identity:en-US")
   body: uncompressed English content
   
4. cache_key: hash("GET:/page.html:identity:es-ES")
   body: uncompressed Spanish content

Lookup Process:
1. Extract vary headers from request
2. Generate cache key with vary values
3. Lookup in cache
4. If miss, fetch and cache with vary values
```

## Compression Storage

### Compressed Content Storage
```
Storage Strategy:
- Store compressed version by default
- Decompress on-the-fly if needed
- Cache both if frequently accessed

Example:
  Original: 1MB HTML
  Gzipped: 200KB (5x compression)
  Brotli: 150KB (6.7x compression)
  
Storage:
  - Store Brotli version (150KB)
  - Decompress for non-supporting clients
  - Trade-off: Storage vs CPU
```

## Cache Invalidation Tracking

### Invalidation Log
```
InvalidationEvent:
  event_id: UUID
  timestamp: timestamp
  type: string (URL, PATTERN, TAG, ALL)
  target: string (URL, pattern, tag name)
  node_id: string (originating node)
  propagated_to: []string (node IDs)
  status: string (PENDING, COMPLETED, FAILED)

Purpose:
- Track invalidation requests
- Ensure propagation to all nodes
- Audit trail for debugging
- Retry failed invalidations
```

## Backup and Recovery

### Cache Persistence
```
Snapshot Strategy:
- Periodic snapshots of L1 cache
- Frequency: Every 15 minutes
- Format: Binary dump of hash table
- Size: ~128GB per node

Recovery:
- Load snapshot on restart
- Replay invalidation log
- Warm up cache gradually
- Time to recover: <5 minutes
```

### Disaster Recovery
```
Backup:
- Daily backup of cache metadata
- Weekly backup of popular content
- Cross-region replication
- Retention: 30 days

Recovery:
- Restore metadata from backup
- Rebuild cache from origin
- Prioritize popular content
- Time to full recovery: <1 hour
```

This database design provides efficient storage, fast lookups, and reliable cache management for a distributed web caching system.
