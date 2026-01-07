# Database Design - Live Comment System

## Database Architecture Overview

### Multi-Database Strategy

**Polyglot Persistence Approach**:
The live comment system employs a multi-database architecture optimized for different data access patterns and consistency requirements:

```
Database Distribution:
├── Cassandra (Primary Comment Storage)
│   ├── High write throughput (500K+ writes/sec)
│   ├── Time-series optimized partitioning
│   └── Eventual consistency model
├── PostgreSQL (User & Event Metadata)
│   ├── ACID compliance for critical data
│   ├── Complex queries and analytics
│   └── Strong consistency guarantees
├── Redis (Real-time Caching & Sessions)
│   ├── Sub-millisecond read latency
│   ├── WebSocket session management
│   └── Real-time comment streams
└── ClickHouse (Analytics & Aggregations)
    ├── Column-oriented analytics
    ├── Real-time metrics computation
    └── Time-series aggregations
```

## Cassandra Schema Design

### Comment Storage Schema

**Primary Comment Table**:
```sql
-- Comments table optimized for time-series writes
CREATE TABLE comments (
    event_id UUID,
    comment_time TIMESTAMP,
    comment_id UUID,
    user_id UUID,
    content TEXT,
    parent_comment_id UUID,
    reply_count INT,
    like_count INT,
    moderation_status TEXT,
    moderation_reason TEXT,
    client_metadata MAP<TEXT, TEXT>,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    PRIMARY KEY ((event_id), comment_time, comment_id)
) WITH CLUSTERING ORDER BY (comment_time DESC, comment_id ASC)
AND compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_unit': 'HOURS',
    'compaction_window_size': 1
}
AND gc_grace_seconds = 86400;

-- Comments by user for user history
CREATE TABLE comments_by_user (
    user_id UUID,
    comment_time TIMESTAMP,
    event_id UUID,
    comment_id UUID,
    content TEXT,
    moderation_status TEXT,
    PRIMARY KEY ((user_id), comment_time, comment_id)
) WITH CLUSTERING ORDER BY (comment_time DESC, comment_id ASC);

-- Popular comments materialized view
CREATE MATERIALIZED VIEW popular_comments AS
    SELECT event_id, comment_id, user_id, content, like_count, comment_time
    FROM comments
    WHERE event_id IS NOT NULL 
    AND comment_time IS NOT NULL 
    AND comment_id IS NOT NULL
    AND like_count > 10
    PRIMARY KEY ((event_id), like_count, comment_time, comment_id)
    WITH CLUSTERING ORDER BY (like_count DESC, comment_time DESC);
```

**Partitioning Strategy**:
```python
class CassandraPartitioningStrategy:
    def __init__(self):
        self.partition_size_target = 100_000_000  # 100MB per partition
        self.time_window_hours = 1  # 1-hour time windows
        
    def calculate_partitioning_scheme(self):
        """
        Calculate optimal partitioning for comment data
        """
        partitioning_config = {
            'primary_partition_key': 'event_id',
            'clustering_keys': ['comment_time', 'comment_id'],
            'time_window_strategy': {
                'window_size': '1_hour',
                'retention_policy': '30_days',
                'compaction_strategy': 'TimeWindowCompactionStrategy'
            },
            'secondary_indexes': [
                'user_id_index',
                'moderation_status_index',
                'parent_comment_id_index'
            ]
        }
        return partitioning_config
    
    def implement_data_modeling_patterns(self):
        """
        Cassandra-specific data modeling patterns
        """
        patterns = {
            'query_driven_design': {
                'comments_by_event_time': 'Primary access pattern',
                'comments_by_user': 'User history queries',
                'popular_comments': 'Trending content queries',
                'moderated_comments': 'Admin dashboard queries'
            },
            'denormalization_strategy': {
                'duplicate_user_info': 'Avoid joins for display',
                'precompute_aggregates': 'Like counts, reply counts',
                'materialized_views': 'Popular and trending comments'
            },
            'write_optimization': {
                'batch_writes': 'Group related operations',
                'async_updates': 'Non-critical metadata updates',
                'ttl_usage': 'Automatic data expiration'
            }
        }
        return patterns

# Data access layer implementation
class CassandraCommentRepository:
    def __init__(self, session):
        self.session = session
        self.prepared_statements = self._prepare_statements()
        
    def _prepare_statements(self):
        """
        Prepare frequently used CQL statements
        """
        return {
            'insert_comment': self.session.prepare("""
                INSERT INTO comments (
                    event_id, comment_time, comment_id, user_id, 
                    content, moderation_status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                USING TTL 2592000
            """),
            'get_recent_comments': self.session.prepare("""
                SELECT * FROM comments 
                WHERE event_id = ? 
                AND comment_time >= ?
                ORDER BY comment_time DESC
                LIMIT ?
            """),
            'get_user_comments': self.session.prepare("""
                SELECT * FROM comments_by_user
                WHERE user_id = ?
                AND comment_time >= ?
                ORDER BY comment_time DESC
                LIMIT ?
            """)
        }
    
    def insert_comment_batch(self, comments):
        """
        Batch insert comments for better performance
        """
        batch = BatchStatement(consistency_level=ConsistencyLevel.LOCAL_QUORUM)
        
        for comment in comments:
            batch.add(self.prepared_statements['insert_comment'], [
                comment['event_id'],
                comment['comment_time'],
                comment['comment_id'],
                comment['user_id'],
                comment['content'],
                comment['moderation_status'],
                comment['created_at']
            ])
            
        return self.session.execute(batch)
```

### User and Event Metadata (PostgreSQL)

**User Management Schema**:
```sql
-- Users table with comprehensive profile data
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    reputation_score INTEGER DEFAULT 0,
    moderation_level VARCHAR(20) DEFAULT 'standard',
    account_status VARCHAR(20) DEFAULT 'active',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE
);

-- User authentication and security
CREATE TABLE user_auth (
    user_id UUID PRIMARY KEY REFERENCES users(user_id),
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(255) NOT NULL,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sessions for WebSocket management
CREATE TABLE user_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id),
    connection_id VARCHAR(255) NOT NULL,
    server_id VARCHAR(100) NOT NULL,
    event_id UUID,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT,
    ip_address INET,
    status VARCHAR(20) DEFAULT 'active'
);

-- Indexes for performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_last_active ON users(last_active_at);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_event_id ON user_sessions(event_id);
CREATE INDEX idx_user_sessions_server_id ON user_sessions(server_id);
```

**Event Management Schema**:
```sql
-- Live events that support commenting
CREATE TABLE events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) NOT NULL, -- 'sports', 'news', 'entertainment'
    status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'live', 'ended'
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    timezone VARCHAR(50) DEFAULT 'UTC',
    max_participants INTEGER,
    moderation_level VARCHAR(20) DEFAULT 'standard',
    comment_settings JSONB DEFAULT '{}',
    analytics_config JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event moderation rules and settings
CREATE TABLE event_moderation_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(event_id),
    rule_type VARCHAR(50) NOT NULL, -- 'rate_limit', 'content_filter', 'user_restriction'
    rule_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event participant tracking
CREATE TABLE event_participants (
    event_id UUID NOT NULL REFERENCES events(event_id),
    user_id UUID NOT NULL REFERENCES users(user_id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    participation_type VARCHAR(20) DEFAULT 'viewer', -- 'viewer', 'commenter', 'moderator'
    comment_count INTEGER DEFAULT 0,
    last_comment_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (event_id, user_id)
);

-- Indexes for event queries
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_event_participants_event_id ON event_participants(event_id);
CREATE INDEX idx_event_participants_user_id ON event_participants(user_id);
```

## Redis Schema Design

### Real-Time Data Structures

**WebSocket Session Management**:
```python
class RedisSessionManager:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.session_ttl = 3600  # 1 hour
        
    def design_session_data_structures(self):
        """
        Redis data structures for session management
        """
        data_structures = {
            'user_sessions': {
                'type': 'hash',
                'key_pattern': 'session:{user_id}',
                'fields': [
                    'connection_id', 'server_id', 'event_id',
                    'connected_at', 'last_heartbeat', 'status'
                ],
                'ttl': self.session_ttl
            },
            'server_connections': {
                'type': 'set',
                'key_pattern': 'server:{server_id}:connections',
                'purpose': 'Track connections per server',
                'ttl': self.session_ttl
            },
            'event_participants': {
                'type': 'sorted_set',
                'key_pattern': 'event:{event_id}:participants',
                'score': 'join_timestamp',
                'purpose': 'Real-time participant list',
                'ttl': 86400  # 24 hours
            },
            'user_presence': {
                'type': 'string',
                'key_pattern': 'presence:{user_id}',
                'values': ['online', 'away', 'offline'],
                'ttl': 300  # 5 minutes
            }
        }
        return data_structures
    
    def implement_session_operations(self):
        """
        Core session management operations
        """
        operations = {
            'create_session': self._create_user_session,
            'update_heartbeat': self._update_session_heartbeat,
            'get_session': self._get_user_session,
            'cleanup_expired': self._cleanup_expired_sessions,
            'get_server_load': self._get_server_connection_count
        }
        return operations
    
    def _create_user_session(self, user_id, connection_data):
        """
        Create new user session in Redis
        """
        session_key = f"session:{user_id}"
        server_key = f"server:{connection_data['server_id']}:connections"
        event_key = f"event:{connection_data['event_id']}:participants"
        presence_key = f"presence:{user_id}"
        
        pipeline = self.redis.pipeline()
        
        # Store session data
        pipeline.hset(session_key, mapping={
            'connection_id': connection_data['connection_id'],
            'server_id': connection_data['server_id'],
            'event_id': connection_data['event_id'],
            'connected_at': time.time(),
            'last_heartbeat': time.time(),
            'status': 'active'
        })
        pipeline.expire(session_key, self.session_ttl)
        
        # Add to server connection set
        pipeline.sadd(server_key, user_id)
        pipeline.expire(server_key, self.session_ttl)
        
        # Add to event participants
        pipeline.zadd(event_key, {user_id: time.time()})
        pipeline.expire(event_key, 86400)
        
        # Set user presence
        pipeline.set(presence_key, 'online', ex=300)
        
        return pipeline.execute()
```

**Real-Time Comment Streams**:
```python
class RedisCommentStreams:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.stream_maxlen = 10000  # Keep last 10K comments
        
    def implement_comment_streaming(self):
        """
        Redis Streams for real-time comment delivery
        """
        stream_config = {
            'event_comment_stream': {
                'key_pattern': 'stream:event:{event_id}:comments',
                'maxlen': self.stream_maxlen,
                'consumer_groups': [
                    'websocket_delivery',
                    'moderation_pipeline',
                    'analytics_processing'
                ]
            },
            'user_mention_stream': {
                'key_pattern': 'stream:user:{user_id}:mentions',
                'maxlen': 1000,
                'consumer_groups': ['notification_delivery']
            },
            'moderation_action_stream': {
                'key_pattern': 'stream:moderation:actions',
                'maxlen': 5000,
                'consumer_groups': ['audit_logging', 'user_notification']
            }
        }
        return stream_config
    
    def publish_comment_to_stream(self, event_id, comment_data):
        """
        Publish comment to Redis stream for real-time delivery
        """
        stream_key = f"stream:event:{event_id}:comments"
        
        message = {
            'comment_id': comment_data['comment_id'],
            'user_id': comment_data['user_id'],
            'username': comment_data['username'],
            'content': comment_data['content'],
            'timestamp': comment_data['timestamp'],
            'moderation_status': comment_data['moderation_status'],
            'metadata': json.dumps(comment_data.get('metadata', {}))
        }
        
        # Add to stream with automatic trimming
        message_id = self.redis.xadd(
            stream_key, 
            message, 
            maxlen=self.stream_maxlen,
            approximate=True
        )
        
        # Set stream expiration
        self.redis.expire(stream_key, 86400)  # 24 hours
        
        return message_id
    
    def consume_comment_stream(self, event_id, consumer_group, consumer_name):
        """
        Consume comments from Redis stream
        """
        stream_key = f"stream:event:{event_id}:comments"
        
        try:
            # Create consumer group if it doesn't exist
            self.redis.xgroup_create(
                stream_key, 
                consumer_group, 
                id='0', 
                mkstream=True
            )
        except ResponseError:
            pass  # Group already exists
        
        # Read new messages
        messages = self.redis.xreadgroup(
            consumer_group,
            consumer_name,
            {stream_key: '>'},
            count=100,
            block=1000  # 1 second timeout
        )
        
        return messages
```

## ClickHouse Analytics Schema

### Real-Time Analytics Tables

**Comment Analytics Schema**:
```sql
-- Comment events for real-time analytics
CREATE TABLE comment_events (
    event_id UUID,
    comment_id UUID,
    user_id UUID,
    event_timestamp DateTime64(3),
    action_type LowCardinality(String), -- 'submit', 'like', 'reply', 'moderate'
    content_length UInt32,
    moderation_status LowCardinality(String),
    user_reputation UInt32,
    event_type LowCardinality(String),
    client_platform LowCardinality(String),
    geo_country LowCardinality(String),
    geo_region String,
    processing_latency_ms UInt32,
    delivery_count UInt32
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(event_timestamp)
ORDER BY (event_id, event_timestamp, comment_id)
TTL event_timestamp + INTERVAL 90 DAY;

-- Aggregated metrics materialized view
CREATE MATERIALIZED VIEW comment_metrics_hourly
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMMDD(hour_timestamp)
ORDER BY (event_id, hour_timestamp, action_type)
AS SELECT
    event_id,
    toStartOfHour(event_timestamp) as hour_timestamp,
    action_type,
    count() as event_count,
    uniq(user_id) as unique_users,
    avg(content_length) as avg_content_length,
    avg(processing_latency_ms) as avg_processing_latency,
    sum(delivery_count) as total_deliveries
FROM comment_events
GROUP BY event_id, hour_timestamp, action_type;

-- Real-time dashboard queries
CREATE MATERIALIZED VIEW live_event_stats
ENGINE = ReplacingMergeTree()
ORDER BY (event_id, update_timestamp)
AS SELECT
    event_id,
    now() as update_timestamp,
    count() as total_comments,
    uniq(user_id) as active_commenters,
    countIf(action_type = 'submit' AND event_timestamp >= now() - INTERVAL 1 MINUTE) as comments_last_minute,
    countIf(moderation_status = 'blocked') as blocked_comments,
    avg(processing_latency_ms) as avg_latency
FROM comment_events
WHERE event_timestamp >= now() - INTERVAL 1 HOUR
GROUP BY event_id;
```

## Data Consistency and Replication

### Multi-Region Replication Strategy

**Cassandra Multi-DC Setup**:
```python
class CassandraReplicationStrategy:
    def __init__(self):
        self.datacenters = ['us-east', 'us-west', 'eu-west', 'ap-southeast']
        
    def configure_keyspace_replication(self):
        """
        Configure keyspace replication across regions
        """
        replication_config = {
            'class': 'NetworkTopologyStrategy',
            'us-east': 3,      # 3 replicas in US East
            'us-west': 3,      # 3 replicas in US West  
            'eu-west': 2,      # 2 replicas in EU West
            'ap-southeast': 2  # 2 replicas in AP Southeast
        }
        
        keyspace_cql = f"""
        CREATE KEYSPACE IF NOT EXISTS live_comments
        WITH REPLICATION = {replication_config}
        AND DURABLE_WRITES = true;
        """
        
        return keyspace_cql
    
    def implement_consistency_levels(self):
        """
        Define consistency levels for different operations
        """
        consistency_strategy = {
            'comment_writes': {
                'consistency_level': 'LOCAL_QUORUM',
                'rationale': 'Fast writes with local consistency'
            },
            'comment_reads': {
                'consistency_level': 'LOCAL_ONE',
                'rationale': 'Fastest reads, eventual consistency acceptable'
            },
            'user_profile_writes': {
                'consistency_level': 'QUORUM',
                'rationale': 'Strong consistency for user data'
            },
            'analytics_writes': {
                'consistency_level': 'ONE',
                'rationale': 'Best effort, performance over consistency'
            }
        }
        return consistency_strategy

# PostgreSQL streaming replication
class PostgreSQLReplication:
    def __init__(self):
        self.primary_region = 'us-east'
        self.replica_regions = ['us-west', 'eu-west']
        
    def configure_streaming_replication(self):
        """
        Configure PostgreSQL streaming replication
        """
        replication_config = {
            'synchronous_standby_names': 'us-west,eu-west',
            'synchronous_commit': 'remote_apply',
            'wal_level': 'replica',
            'max_wal_senders': 10,
            'wal_keep_segments': 100,
            'hot_standby': 'on',
            'hot_standby_feedback': 'on'
        }
        return replication_config
```

This comprehensive database design provides the foundation for handling massive scale while maintaining performance and consistency appropriate for a live comment system's requirements.
