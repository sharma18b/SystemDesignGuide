# Video Conferencing System - Database Design

## Database Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                           │
├─────────────────┬─────────────────┬─────────────────────────┤
│   PostgreSQL    │     Redis       │      Cassandra          │
│   (OLTP)        │   (Cache/       │     (Analytics/         │
│                 │   Sessions)     │     Time Series)        │
├─────────────────┼─────────────────┼─────────────────────────┤
│ • Users         │ • Active        │ • Meeting Events        │
│ • Meetings      │   Sessions      │ • Call Quality Metrics  │
│ • Permissions   │ • WebRTC State  │ • Usage Analytics       │
│ • Recordings    │ • Chat Messages │ • Audit Logs           │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## PostgreSQL Schema (Primary Database)

### Users Table
```sql
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    avatar_url TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    account_type VARCHAR(20) DEFAULT 'basic', -- basic, pro, enterprise
    status VARCHAR(20) DEFAULT 'active', -- active, suspended, deleted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    -- Indexes
    INDEX idx_users_email (email),
    INDEX idx_users_username (username),
    INDEX idx_users_status (status),
    INDEX idx_users_created_at (created_at)
);
```

### Meetings Table
```sql
CREATE TABLE meetings (
    meeting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_user_id UUID NOT NULL REFERENCES users(user_id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    meeting_type VARCHAR(20) NOT NULL, -- instant, scheduled, recurring
    
    -- Scheduling
    scheduled_start_time TIMESTAMP WITH TIME ZONE,
    scheduled_end_time TIMESTAMP WITH TIME ZONE,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    
    -- Meeting Configuration
    max_participants INTEGER DEFAULT 100,
    require_password BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255),
    waiting_room_enabled BOOLEAN DEFAULT TRUE,
    recording_enabled BOOLEAN DEFAULT FALSE,
    auto_record BOOLEAN DEFAULT FALSE,
    
    -- Meeting Settings
    allow_screen_share BOOLEAN DEFAULT TRUE,
    allow_chat BOOLEAN DEFAULT TRUE,
    allow_reactions BOOLEAN DEFAULT TRUE,
    mute_on_entry BOOLEAN DEFAULT FALSE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, active, ended, cancelled
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_meetings_host (host_user_id),
    INDEX idx_meetings_status (status),
    INDEX idx_meetings_scheduled_start (scheduled_start_time),
    INDEX idx_meetings_created_at (created_at)
);
```

### Meeting Participants Table
```sql
CREATE TABLE meeting_participants (
    participant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(meeting_id),
    user_id UUID REFERENCES users(user_id), -- NULL for guest users
    
    -- Participant Info
    display_name VARCHAR(200) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(20) DEFAULT 'participant', -- host, co-host, participant, viewer
    
    -- Join/Leave Tracking
    joined_at TIMESTAMP WITH TIME ZONE,
    left_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    
    -- Participant State
    is_muted BOOLEAN DEFAULT FALSE,
    is_video_on BOOLEAN DEFAULT TRUE,
    is_screen_sharing BOOLEAN DEFAULT FALSE,
    is_hand_raised BOOLEAN DEFAULT FALSE,
    
    -- Connection Info
    connection_id VARCHAR(100), -- WebRTC connection identifier
    ip_address INET,
    user_agent TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'invited', -- invited, joined, left, removed
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_participants_meeting (meeting_id),
    INDEX idx_participants_user (user_id),
    INDEX idx_participants_status (status),
    INDEX idx_participants_joined_at (joined_at),
    
    -- Constraints
    UNIQUE(meeting_id, user_id, joined_at) -- Allow rejoining
);
```

### Recordings Table
```sql
CREATE TABLE recordings (
    recording_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(meeting_id),
    recorded_by_user_id UUID NOT NULL REFERENCES users(user_id),
    
    -- Recording Info
    title VARCHAR(500) NOT NULL,
    description TEXT,
    file_size_bytes BIGINT,
    duration_seconds INTEGER,
    
    -- File Storage
    storage_provider VARCHAR(50) NOT NULL, -- s3, gcs, azure
    storage_bucket VARCHAR(200) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    storage_region VARCHAR(50),
    
    -- Recording Configuration
    recording_type VARCHAR(20) NOT NULL, -- full, audio_only, screen_only
    video_quality VARCHAR(20), -- 720p, 1080p, 4k
    audio_quality VARCHAR(20), -- standard, high
    
    -- Processing Status
    processing_status VARCHAR(20) DEFAULT 'processing', -- processing, completed, failed
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,
    
    -- Access Control
    visibility VARCHAR(20) DEFAULT 'private', -- private, internal, public
    download_enabled BOOLEAN DEFAULT TRUE,
    password_protected BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- Auto-deletion date
    
    -- Indexes
    INDEX idx_recordings_meeting (meeting_id),
    INDEX idx_recordings_recorded_by (recorded_by_user_id),
    INDEX idx_recordings_status (processing_status),
    INDEX idx_recordings_created_at (created_at),
    INDEX idx_recordings_expires_at (expires_at)
);
```

### Chat Messages Table
```sql
CREATE TABLE chat_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(meeting_id),
    sender_user_id UUID REFERENCES users(user_id),
    sender_name VARCHAR(200) NOT NULL,
    
    -- Message Content
    message_type VARCHAR(20) DEFAULT 'text', -- text, file, image, system
    content TEXT NOT NULL,
    formatted_content JSONB, -- Rich text formatting
    
    -- File Attachments
    file_url TEXT,
    file_name VARCHAR(500),
    file_size_bytes INTEGER,
    file_type VARCHAR(100),
    
    -- Message Properties
    is_private BOOLEAN DEFAULT FALSE,
    recipient_user_id UUID REFERENCES users(user_id), -- For private messages
    reply_to_message_id UUID REFERENCES chat_messages(message_id),
    
    -- Reactions
    reactions JSONB DEFAULT '{}', -- {"👍": ["user1", "user2"], "❤️": ["user3"]}
    
    -- Status
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by_user_id UUID REFERENCES users(user_id),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_chat_meeting (meeting_id),
    INDEX idx_chat_sender (sender_user_id),
    INDEX idx_chat_created_at (created_at),
    INDEX idx_chat_private (is_private, recipient_user_id),
    INDEX idx_chat_deleted (is_deleted)
);
```

## Redis Schema (Cache & Sessions)

### Active Sessions
```redis
# WebRTC Session State
SET session:{session_id} '{
    "user_id": "uuid",
    "meeting_id": "uuid", 
    "connection_id": "webrtc_conn_id",
    "joined_at": "2024-01-15T10:30:00Z",
    "is_muted": false,
    "is_video_on": true,
    "peer_connections": ["pc1", "pc2"],
    "ice_candidates": [...],
    "sdp_offer": "...",
    "sdp_answer": "..."
}' EX 7200  # 2 hour expiry

# Meeting Room State
SET meeting_room:{meeting_id} '{
    "active_participants": ["user1", "user2", "user3"],
    "participant_count": 3,
    "is_recording": true,
    "screen_sharing_user": "user2",
    "chat_enabled": true,
    "waiting_room_users": ["user4"],
    "breakout_rooms": {...}
}' EX 14400  # 4 hour expiry
```

### Real-time Chat Cache
```redis
# Recent Chat Messages (Last 100 messages)
LPUSH chat:{meeting_id} '{
    "message_id": "uuid",
    "sender_id": "uuid",
    "sender_name": "John Doe",
    "content": "Hello everyone!",
    "timestamp": "2024-01-15T10:35:00Z",
    "type": "text"
}'
LTRIM chat:{meeting_id} 0 99  # Keep only last 100 messages

# User Presence
SET presence:{user_id} '{
    "status": "in_meeting",
    "meeting_id": "uuid",
    "last_seen": "2024-01-15T10:35:00Z",
    "device_type": "desktop"
}' EX 300  # 5 minute expiry with heartbeat
```

### WebRTC Signaling Cache
```redis
# ICE Candidates Queue
LPUSH ice_candidates:{connection_id} '{
    "candidate": "candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host",
    "sdpMLineIndex": 0,
    "sdpMid": "audio"
}'
EXPIRE ice_candidates:{connection_id} 300  # 5 minute expiry

# SDP Offers/Answers
SET sdp_offer:{connection_id} '{
    "type": "offer",
    "sdp": "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\n..."
}' EX 300

SET sdp_answer:{connection_id} '{
    "type": "answer", 
    "sdp": "v=0\r\no=- 987654321 2 IN IP4 127.0.0.1\r\n..."
}' EX 300
```

## Cassandra Schema (Analytics & Time Series)

### Meeting Events Table
```cql
CREATE TABLE meeting_events (
    meeting_id UUID,
    event_time TIMESTAMP,
    event_id UUID,
    event_type TEXT, -- join, leave, mute, unmute, screen_share_start, etc.
    user_id UUID,
    user_name TEXT,
    event_data MAP<TEXT, TEXT>, -- Additional event-specific data
    PRIMARY KEY (meeting_id, event_time, event_id)
) WITH CLUSTERING ORDER BY (event_time DESC);
```

### Call Quality Metrics
```cql
CREATE TABLE call_quality_metrics (
    meeting_id UUID,
    participant_id UUID,
    metric_time TIMESTAMP,
    
    -- Audio Metrics
    audio_bitrate INT,
    audio_packet_loss FLOAT,
    audio_jitter FLOAT,
    audio_rtt INT, -- Round trip time in ms
    
    -- Video Metrics  
    video_bitrate INT,
    video_packet_loss FLOAT,
    video_frame_rate FLOAT,
    video_resolution TEXT, -- "1920x1080"
    video_rtt INT,
    
    -- Network Metrics
    network_type TEXT, -- wifi, cellular, ethernet
    bandwidth_available INT,
    cpu_usage FLOAT,
    memory_usage INT,
    
    PRIMARY KEY ((meeting_id, participant_id), metric_time)
) WITH CLUSTERING ORDER BY (metric_time DESC);
```

### Usage Analytics
```cql
CREATE TABLE daily_usage_stats (
    date DATE,
    metric_name TEXT,
    dimension_key TEXT, -- user_id, region, device_type, etc.
    dimension_value TEXT,
    metric_value BIGINT,
    PRIMARY KEY (date, metric_name, dimension_key, dimension_value)
);

-- Examples:
-- ('2024-01-15', 'total_meetings', 'region', 'us-east-1', 15000)
-- ('2024-01-15', 'total_participants', 'device_type', 'mobile', 50000)
-- ('2024-01-15', 'meeting_duration_minutes', 'user_id', 'uuid', 120)
```

## Database Partitioning Strategy

### PostgreSQL Partitioning
```sql
-- Partition meetings by month
CREATE TABLE meetings_2024_01 PARTITION OF meetings
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE meetings_2024_02 PARTITION OF meetings  
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Partition chat messages by meeting_id hash
CREATE TABLE chat_messages_0 PARTITION OF chat_messages
FOR VALUES WITH (MODULUS 16, REMAINDER 0);

CREATE TABLE chat_messages_1 PARTITION OF chat_messages
FOR VALUES WITH (MODULUS 16, REMAINDER 1);
```

### Cassandra Partitioning
```cql
-- Partition by meeting_id for even distribution
-- Time-based clustering for efficient range queries
-- Separate tables for different time granularities

CREATE TABLE meeting_events_hourly (
    meeting_id UUID,
    hour_bucket TIMESTAMP, -- Rounded to hour
    event_time TIMESTAMP,
    event_id UUID,
    event_type TEXT,
    event_data MAP<TEXT, TEXT>,
    PRIMARY KEY ((meeting_id, hour_bucket), event_time, event_id)
);
```

## Data Retention Policies

### PostgreSQL Retention
```sql
-- Auto-delete old meetings (7 years retention)
DELETE FROM meetings 
WHERE created_at < NOW() - INTERVAL '7 years'
AND status = 'ended';

-- Archive old chat messages (1 year retention)
DELETE FROM chat_messages 
WHERE created_at < NOW() - INTERVAL '1 year';
```

### Redis Expiration
- Session data: 2-4 hours TTL
- Chat cache: 24 hours TTL  
- Presence data: 5 minutes TTL with heartbeat
- WebRTC signaling: 5 minutes TTL

### Cassandra TTL
```cql
-- Insert with TTL for automatic cleanup
INSERT INTO call_quality_metrics (...) 
VALUES (...) USING TTL 2592000; -- 30 days

INSERT INTO meeting_events (...)
VALUES (...) USING TTL 31536000; -- 1 year
```

## Backup and Recovery

### PostgreSQL Backup
- **Continuous WAL archiving** to S3
- **Daily full backups** with point-in-time recovery
- **Cross-region replication** for disaster recovery
- **Automated backup testing** and validation

### Redis Persistence
- **RDB snapshots** every 15 minutes
- **AOF (Append Only File)** for durability
- **Redis Cluster** with automatic failover
- **Memory optimization** with appropriate eviction policies

### Cassandra Backup
- **Incremental backups** using snapshots
- **Cross-datacenter replication** (RF=3 per DC)
- **Automated repair** and consistency checks
- **Backup verification** and restore testing
