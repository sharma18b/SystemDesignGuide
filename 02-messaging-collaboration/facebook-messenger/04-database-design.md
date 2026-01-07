# Facebook Messenger - Database Design

## Database Architecture Overview

### Multi-Database Strategy
- **Primary Database**: PostgreSQL for transactional data and strong consistency
- **Message Store**: Cassandra for high-volume message storage and retrieval
- **Cache Layer**: Redis for real-time data and session management
- **Search Engine**: Elasticsearch for full-text message search
- **Analytics Store**: ClickHouse for real-time analytics and metrics
- **Media Metadata**: MongoDB for flexible media file metadata

### Data Distribution Strategy
```
┌─────────────────────────────────────────────────────────────┐
│                    Global Data Distribution                  │
├─────────────────────────────────────────────────────────────┤
│  Region: US-East     │  Region: EU-West    │  Region: APAC   │
│  ┌─────────────────┐ │ ┌─────────────────┐ │ ┌─────────────┐ │
│  │ User Data       │ │ │ User Data       │ │ │ User Data   │ │
│  │ Messages        │ │ │ Messages        │ │ │ Messages    │ │
│  │ Media Metadata  │ │ │ Media Metadata  │ │ │ Media Meta  │ │
│  └─────────────────┘ │ └─────────────────┘ │ └─────────────┘ │
│                      │                     │                 │
│  Cross-Region Sync   │  Cross-Region Sync  │ Cross-Region    │
│  (Async Replication) │  (Async Replication)│ Sync            │
└─────────────────────────────────────────────────────────────┘
```

## Core Data Models

### User Management Schema

#### Users Table (PostgreSQL)
```sql
CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    facebook_id BIGINT UNIQUE,
    username VARCHAR(50) UNIQUE,
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    profile_picture_url TEXT,
    status_message TEXT,
    privacy_settings JSONB,
    notification_preferences JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    account_status VARCHAR(20) DEFAULT 'active'
);

-- Indexes for performance
CREATE INDEX idx_users_facebook_id ON users(facebook_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_last_active ON users(last_active_at);
CREATE INDEX idx_users_created_at ON users(created_at);
```

#### User Sessions Table (PostgreSQL)
```sql
CREATE TABLE user_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT REFERENCES users(user_id),
    device_id VARCHAR(255),
    device_type VARCHAR(50), -- 'mobile', 'desktop', 'web'
    platform VARCHAR(50), -- 'ios', 'android', 'windows', 'macos'
    app_version VARCHAR(20),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_device_id ON user_sessions(device_id);
CREATE INDEX idx_sessions_last_activity ON user_sessions(last_activity_at);
```

### Conversation Management Schema

#### Conversations Table (PostgreSQL)
```sql
CREATE TABLE conversations (
    conversation_id BIGSERIAL PRIMARY KEY,
    conversation_type VARCHAR(20) NOT NULL, -- 'direct', 'group'
    title VARCHAR(255), -- NULL for direct messages
    description TEXT,
    avatar_url TEXT,
    created_by BIGINT REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE,
    message_count BIGINT DEFAULT 0,
    is_archived BOOLEAN DEFAULT false,
    settings JSONB -- group settings, permissions, etc.
);

CREATE INDEX idx_conversations_type ON conversations(conversation_type);
CREATE INDEX idx_conversations_created_by ON conversations(created_by);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at);
```

#### Conversation Participants Table (PostgreSQL)
```sql
CREATE TABLE conversation_participants (
    conversation_id BIGINT REFERENCES conversations(conversation_id),
    user_id BIGINT REFERENCES users(user_id),
    role VARCHAR(20) DEFAULT 'member', -- 'admin', 'member'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    last_read_message_id BIGINT,
    last_read_at TIMESTAMP WITH TIME ZONE,
    notification_settings JSONB,
    is_active BOOLEAN DEFAULT true,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_participants_user_id ON conversation_participants(user_id);
CREATE INDEX idx_participants_conversation_id ON conversation_participants(conversation_id);
CREATE INDEX idx_participants_last_read ON conversation_participants(last_read_message_id);
```

## Message Storage Schema (Cassandra)

### Messages Table Design
```cql
CREATE TABLE messages (
    conversation_id BIGINT,
    message_id TIMEUUID,
    sender_id BIGINT,
    message_type VARCHAR, -- 'text', 'image', 'video', 'voice', 'file', 'location'
    content TEXT,
    media_attachments LIST<FROZEN<media_attachment>>,
    reply_to_message_id TIMEUUID,
    forwarded_from_message_id TIMEUUID,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP,
    edit_history LIST<FROZEN<message_edit>>,
    reactions MAP<BIGINT, VARCHAR>, -- user_id -> emoji
    delivery_status VARCHAR, -- 'sent', 'delivered', 'read'
    PRIMARY KEY (conversation_id, message_id)
) WITH CLUSTERING ORDER BY (message_id DESC)
  AND gc_grace_seconds = 864000
  AND compaction = {'class': 'TimeWindowCompactionStrategy'};

-- User Defined Types
CREATE TYPE media_attachment (
    attachment_id UUID,
    file_type VARCHAR,
    file_size BIGINT,
    file_url TEXT,
    thumbnail_url TEXT,
    width INT,
    height INT,
    duration INT -- for videos/audio
);

CREATE TYPE message_edit (
    edited_at TIMESTAMP,
    previous_content TEXT,
    edit_reason VARCHAR
);
```

### Message Delivery Tracking (Cassandra)
```cql
CREATE TABLE message_delivery_status (
    conversation_id BIGINT,
    message_id TIMEUUID,
    recipient_id BIGINT,
    status VARCHAR, -- 'sent', 'delivered', 'read'
    timestamp TIMESTAMP,
    PRIMARY KEY ((conversation_id, message_id), recipient_id)
);

CREATE TABLE user_message_status (
    user_id BIGINT,
    conversation_id BIGINT,
    message_id TIMEUUID,
    status VARCHAR,
    timestamp TIMESTAMP,
    PRIMARY KEY (user_id, conversation_id, message_id)
) WITH CLUSTERING ORDER BY (conversation_id ASC, message_id DESC);
```

### Message Sharding Strategy
- **Partition Key**: conversation_id for data locality
- **Clustering Key**: message_id (TIMEUUID) for chronological ordering
- **Shard Distribution**: Hash-based partitioning across 10,000+ nodes
- **Replication Factor**: 3 replicas per data center
- **Consistency Level**: QUORUM for writes, LOCAL_QUORUM for reads

## Presence and Real-time Data (Redis)

### Presence Data Structures
```redis
# User online status
HSET user:presence:123456 status "online" last_seen "2024-01-03T19:30:00Z" device_count 2

# Active conversations per user
SADD user:active_conversations:123456 conv_1001 conv_1002 conv_1003

# Typing indicators
SETEX typing:conv_1001:user_123456 30 "typing"

# WebSocket connection mapping
HSET websocket:connections server_id "ws-server-01" connection_count 1500

# Recent message cache (per conversation)
LPUSH conversation:messages:1001 '{"message_id":"uuid","sender_id":123456,"content":"Hello"}'
LTRIM conversation:messages:1001 0 49  # Keep last 50 messages
```

### Session Management (Redis)
```redis
# User session data
HSET session:uuid user_id 123456 device_id "device_abc" created_at "2024-01-03T19:00:00Z"
EXPIRE session:uuid 86400  # 24 hour expiration

# Device to user mapping
SET device:device_abc:user 123456
EXPIRE device:device_abc:user 86400

# Rate limiting
INCR rate_limit:user:123456:messages
EXPIRE rate_limit:user:123456:messages 60  # 1 minute window
```

## Search and Analytics Schema

### Message Search Index (Elasticsearch)
```json
{
  "mappings": {
    "properties": {
      "message_id": {"type": "keyword"},
      "conversation_id": {"type": "long"},
      "sender_id": {"type": "long"},
      "content": {
        "type": "text",
        "analyzer": "standard",
        "search_analyzer": "standard"
      },
      "message_type": {"type": "keyword"},
      "created_at": {"type": "date"},
      "participants": {"type": "long"},
      "has_media": {"type": "boolean"},
      "language": {"type": "keyword"}
    }
  },
  "settings": {
    "number_of_shards": 50,
    "number_of_replicas": 1,
    "refresh_interval": "5s"
  }
}
```

### Analytics Events (ClickHouse)
```sql
CREATE TABLE message_events (
    event_id UUID,
    event_type String, -- 'message_sent', 'message_delivered', 'message_read'
    user_id UInt64,
    conversation_id UInt64,
    message_id String,
    timestamp DateTime,
    properties Map(String, String),
    device_type String,
    platform String,
    app_version String,
    country_code String,
    region String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (event_type, user_id, timestamp)
SETTINGS index_granularity = 8192;
```

## Data Consistency and Synchronization

### Message Ordering Strategy
- **Single Conversation Ordering**: Use TIMEUUID in Cassandra for natural ordering
- **Cross-Device Consistency**: Vector clocks for causal ordering
- **Conflict Resolution**: Last-writer-wins with timestamp comparison
- **Duplicate Detection**: Client-side deduplication using message IDs
- **Gap Detection**: Sequence numbers for detecting missing messages

### Synchronization Patterns
```sql
-- Message sequence tracking per conversation
CREATE TABLE message_sequences (
    conversation_id BIGINT PRIMARY KEY,
    last_sequence_number BIGINT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Client synchronization state
CREATE TABLE client_sync_state (
    user_id BIGINT,
    device_id VARCHAR(255),
    conversation_id BIGINT,
    last_sync_sequence BIGINT,
    last_sync_timestamp TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (user_id, device_id, conversation_id)
);
```

## Media Storage and Metadata

### Media Files Metadata (MongoDB)
```javascript
{
  _id: ObjectId("..."),
  file_id: "uuid-v4",
  conversation_id: 1001,
  message_id: "timeuuid",
  uploader_id: 123456,
  file_type: "image/jpeg",
  original_filename: "photo.jpg",
  file_size: 2048576,
  dimensions: {
    width: 1920,
    height: 1080
  },
  storage: {
    bucket: "messenger-media-us-east-1",
    key: "images/2024/01/03/uuid-v4.jpg",
    cdn_url: "https://cdn.messenger.com/images/uuid-v4.jpg"
  },
  thumbnails: [
    {
      size: "small",
      dimensions: { width: 150, height: 150 },
      url: "https://cdn.messenger.com/thumbs/small/uuid-v4.jpg"
    },
    {
      size: "medium", 
      dimensions: { width: 300, height: 300 },
      url: "https://cdn.messenger.com/thumbs/medium/uuid-v4.jpg"
    }
  ],
  processing_status: "completed",
  created_at: ISODate("2024-01-03T19:30:00Z"),
  expires_at: ISODate("2029-01-03T19:30:00Z") // 5 year retention
}
```

## Database Performance Optimization

### Indexing Strategy
- **Composite Indexes**: Multi-column indexes for common query patterns
- **Partial Indexes**: Index only active/non-deleted records
- **Expression Indexes**: Indexes on computed values
- **Covering Indexes**: Include all columns needed for queries
- **Index Maintenance**: Regular REINDEX and statistics updates

### Query Optimization Patterns
```sql
-- Efficient conversation list query
SELECT c.conversation_id, c.title, c.last_message_at, 
       cp.last_read_message_id, cp.notification_settings
FROM conversations c
JOIN conversation_participants cp ON c.conversation_id = cp.conversation_id
WHERE cp.user_id = $1 AND cp.is_active = true
ORDER BY c.last_message_at DESC
LIMIT 50;

-- Recent messages with pagination
SELECT message_id, sender_id, content, created_at
FROM messages 
WHERE conversation_id = $1 
  AND message_id < $2  -- cursor-based pagination
ORDER BY message_id DESC
LIMIT 20;
```

### Connection Pooling and Management
- **Connection Pool Size**: 100-500 connections per application server
- **Connection Lifecycle**: 30-minute connection lifetime
- **Read Replicas**: Separate read traffic from write traffic
- **Connection Routing**: Route queries to appropriate database nodes
- **Health Monitoring**: Continuous monitoring of database connections

## Backup and Disaster Recovery

### Backup Strategy
- **Continuous Backup**: Point-in-time recovery for PostgreSQL
- **Snapshot Backup**: Daily Cassandra snapshots with incremental backups
- **Cross-Region Replication**: Asynchronous replication to backup regions
- **Backup Retention**: 30 days hot backup, 1 year cold storage
- **Backup Testing**: Monthly restore testing and validation

### Data Archival and Retention
- **Message Retention**: 10 years for compliance requirements
- **Media Retention**: 5 years with automatic cleanup
- **User Data**: Permanent retention with GDPR deletion rights
- **Analytics Data**: 2 years for business intelligence
- **Audit Logs**: 7 years for security and compliance

This comprehensive database design provides the foundation for storing and managing billions of messages while maintaining high performance, consistency, and reliability across a global messaging platform.
