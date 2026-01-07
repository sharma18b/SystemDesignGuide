# Team Collaboration Tool - Database Design

## Database Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                           │
├─────────────────┬─────────────────┬─────────────────────────┤
│   PostgreSQL    │     Redis       │    Elasticsearch        │
│   (Primary)     │   (Cache/RT)    │     (Search)            │
├─────────────────┼─────────────────┼─────────────────────────┤
│ • Users         │ • Sessions      │ • Message Index         │
│ • Workspaces    │ • Presence      │ • File Content Index    │
│ • Channels      │ • Real-time     │ • User Directory        │
│ • Messages      │   Events        │ • Analytics Data        │
│ • Files         │ • Cache         │                         │
│ • Permissions   │                 │                         │
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
    status VARCHAR(20) DEFAULT 'active', -- active, suspended, deleted
    
    -- Profile Information
    title VARCHAR(200),
    phone VARCHAR(50),
    bio TEXT,
    pronouns VARCHAR(50),
    
    -- Preferences
    notification_settings JSONB DEFAULT '{}',
    theme_preferences JSONB DEFAULT '{}',
    language VARCHAR(10) DEFAULT 'en',
    
    -- Authentication
    password_hash VARCHAR(255),
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    
    -- Timestamps
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

### Workspaces Table
```sql
CREATE TABLE workspaces (
    workspace_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    domain VARCHAR(100) UNIQUE, -- custom domain like company.slack.com
    description TEXT,
    avatar_url TEXT,
    
    -- Workspace Settings
    settings JSONB DEFAULT '{}', -- retention policies, permissions, etc.
    plan_type VARCHAR(50) DEFAULT 'free', -- free, pro, enterprise
    max_members INTEGER DEFAULT 10000,
    
    -- Billing
    billing_email VARCHAR(255),
    subscription_status VARCHAR(50) DEFAULT 'active',
    
    -- Security
    sso_enabled BOOLEAN DEFAULT FALSE,
    sso_config JSONB,
    require_2fa BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_workspaces_domain (domain),
    INDEX idx_workspaces_created_at (created_at)
);
```

### Workspace Members Table
```sql
CREATE TABLE workspace_members (
    member_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(workspace_id),
    user_id UUID NOT NULL REFERENCES users(user_id),
    
    -- Member Info
    role VARCHAR(50) DEFAULT 'member', -- owner, admin, member, guest
    title VARCHAR(200), -- job title in this workspace
    department VARCHAR(100),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- active, deactivated, invited
    invited_by UUID REFERENCES users(user_id),
    invitation_token VARCHAR(255),
    
    -- Permissions
    permissions JSONB DEFAULT '{}', -- custom permissions override
    
    -- Activity
    last_seen_at TIMESTAMP WITH TIME ZONE,
    timezone VARCHAR(50),
    
    -- Timestamps
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints and Indexes
    UNIQUE(workspace_id, user_id),
    INDEX idx_workspace_members_workspace (workspace_id),
    INDEX idx_workspace_members_user (user_id),
    INDEX idx_workspace_members_role (role),
    INDEX idx_workspace_members_status (status)
);
```

### Channels Table
```sql
CREATE TABLE channels (
    channel_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(workspace_id),
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    description TEXT,
    
    -- Channel Type and Settings
    channel_type VARCHAR(20) DEFAULT 'public', -- public, private, dm, group_dm
    is_archived BOOLEAN DEFAULT FALSE,
    is_general BOOLEAN DEFAULT FALSE, -- the #general channel
    
    -- Channel Configuration
    topic VARCHAR(500),
    purpose TEXT,
    retention_policy JSONB, -- message retention settings
    
    -- Permissions
    allow_threads BOOLEAN DEFAULT TRUE,
    allow_file_upload BOOLEAN DEFAULT TRUE,
    allow_external_sharing BOOLEAN DEFAULT FALSE,
    
    -- Creator and Management
    created_by UUID NOT NULL REFERENCES users(user_id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    archived_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints and Indexes
    UNIQUE(workspace_id, name),
    INDEX idx_channels_workspace (workspace_id),
    INDEX idx_channels_type (channel_type),
    INDEX idx_channels_archived (is_archived),
    INDEX idx_channels_created_at (created_at)
);
```

### Channel Members Table
```sql
CREATE TABLE channel_members (
    membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(channel_id),
    user_id UUID NOT NULL REFERENCES users(user_id),
    
    -- Membership Details
    role VARCHAR(20) DEFAULT 'member', -- admin, member
    notification_level VARCHAR(20) DEFAULT 'all', -- all, mentions, none
    
    -- Join/Leave Tracking
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    invited_by UUID REFERENCES users(user_id),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Constraints and Indexes
    UNIQUE(channel_id, user_id),
    INDEX idx_channel_members_channel (channel_id),
    INDEX idx_channel_members_user (user_id),
    INDEX idx_channel_members_active (is_active)
);
```

### Messages Table
```sql
CREATE TABLE messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(channel_id),
    user_id UUID NOT NULL REFERENCES users(user_id),
    
    -- Message Content
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text', -- text, file, system, bot
    formatted_content JSONB, -- rich text formatting, mentions, etc.
    
    -- Threading
    thread_id UUID REFERENCES messages(message_id), -- parent message for threads
    reply_count INTEGER DEFAULT 0,
    
    -- Message Properties
    is_pinned BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Reactions and Interactions
    reactions JSONB DEFAULT '{}', -- {"👍": ["user1", "user2"], "❤️": ["user3"]}
    
    -- Edit History
    edited_at TIMESTAMP WITH TIME ZONE,
    edit_history JSONB DEFAULT '[]', -- array of previous versions
    
    -- Metadata
    client_msg_id VARCHAR(100), -- client-generated ID for deduplication
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_messages_channel_created (channel_id, created_at DESC),
    INDEX idx_messages_user (user_id),
    INDEX idx_messages_thread (thread_id),
    INDEX idx_messages_deleted (is_deleted),
    INDEX idx_messages_client_msg (client_msg_id),
    
    -- Full-text search
    INDEX idx_messages_content_gin (to_tsvector('english', content))
);
```

### Files Table
```sql
CREATE TABLE files (
    file_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(workspace_id),
    uploader_id UUID NOT NULL REFERENCES users(user_id),
    
    -- File Information
    filename VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(200) NOT NULL,
    file_hash VARCHAR(64), -- SHA-256 hash for deduplication
    
    -- Storage Information
    storage_provider VARCHAR(50) NOT NULL, -- s3, gcs, azure
    storage_bucket VARCHAR(200) NOT NULL,
    storage_key VARCHAR(1000) NOT NULL,
    storage_region VARCHAR(50),
    
    -- File Processing
    processing_status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    thumbnails JSONB, -- generated thumbnail URLs
    extracted_text TEXT, -- for search indexing
    
    -- Access and Sharing
    is_public BOOLEAN DEFAULT FALSE,
    share_token VARCHAR(100), -- for public sharing
    download_count INTEGER DEFAULT 0,
    
    -- Security
    virus_scan_status VARCHAR(20) DEFAULT 'pending', -- pending, clean, infected, failed
    virus_scan_result JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- for temporary files
    
    -- Indexes
    INDEX idx_files_workspace (workspace_id),
    INDEX idx_files_uploader (uploader_id),
    INDEX idx_files_hash (file_hash),
    INDEX idx_files_created_at (created_at),
    INDEX idx_files_expires_at (expires_at),
    
    -- Full-text search on filename and extracted text
    INDEX idx_files_search_gin (to_tsvector('english', filename || ' ' || COALESCE(extracted_text, '')))
);
```

### Message Files Table (Junction)
```sql
CREATE TABLE message_files (
    message_id UUID NOT NULL REFERENCES messages(message_id),
    file_id UUID NOT NULL REFERENCES files(file_id),
    
    -- File context in message
    file_comment TEXT, -- optional comment about the file
    
    -- Timestamps
    attached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    PRIMARY KEY (message_id, file_id),
    INDEX idx_message_files_message (message_id),
    INDEX idx_message_files_file (file_id)
);
```

### Integrations Table
```sql
CREATE TABLE integrations (
    integration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(workspace_id),
    
    -- Integration Details
    app_name VARCHAR(200) NOT NULL,
    app_id VARCHAR(200) NOT NULL, -- external app identifier
    integration_type VARCHAR(50) NOT NULL, -- webhook, oauth, bot
    
    -- Configuration
    config JSONB NOT NULL, -- app-specific configuration
    credentials JSONB, -- encrypted credentials
    
    -- Permissions and Scope
    scopes TEXT[], -- requested permissions
    channel_id UUID REFERENCES channels(channel_id), -- channel-specific integration
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- active, disabled, error
    last_error TEXT,
    
    -- Installation Info
    installed_by UUID NOT NULL REFERENCES users(user_id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Indexes
    INDEX idx_integrations_workspace (workspace_id),
    INDEX idx_integrations_app (app_name),
    INDEX idx_integrations_status (status),
    INDEX idx_integrations_channel (channel_id)
);
```

## Redis Schema (Cache & Real-time)

### User Sessions
```redis
# User session data
SET session:{session_id} '{
    "user_id": "uuid",
    "workspace_id": "uuid",
    "device_type": "desktop",
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "created_at": "2024-01-15T10:30:00Z",
    "last_activity": "2024-01-15T11:45:00Z",
    "permissions": ["read", "write", "admin"]
}' EX 86400  # 24 hour expiry

# User presence status
SET presence:{user_id}:{workspace_id} '{
    "status": "online",
    "custom_status": "In a meeting",
    "last_seen": "2024-01-15T11:45:00Z",
    "device_type": "desktop",
    "timezone": "America/New_York"
}' EX 300  # 5 minute expiry with heartbeat
```

### Real-time Events
```redis
# WebSocket connection mapping
SET connection:{connection_id} '{
    "user_id": "uuid",
    "workspace_id": "uuid",
    "channels": ["channel1", "channel2"],
    "connected_at": "2024-01-15T10:30:00Z"
}' EX 7200  # 2 hour expiry

# Channel member cache
SET channel_members:{channel_id} '{
    "members": ["user1", "user2", "user3"],
    "member_count": 3,
    "last_updated": "2024-01-15T10:30:00Z"
}' EX 1800  # 30 minute expiry

# Typing indicators
SET typing:{channel_id}:{user_id} '1' EX 10  # 10 second expiry
```

### Message Cache
```redis
# Recent messages cache (last 100 messages per channel)
LPUSH recent_messages:{channel_id} '{
    "message_id": "uuid",
    "user_id": "uuid",
    "content": "Hello team!",
    "created_at": "2024-01-15T11:45:00Z",
    "message_type": "text"
}'
LTRIM recent_messages:{channel_id} 0 99  # Keep only last 100

# Unread message counts
HSET unread_counts:{user_id}:{workspace_id} channel_id count
# Example: HSET unread_counts:user123:workspace456 channel789 5
```

### Rate Limiting
```redis
# API rate limiting (sliding window)
INCR rate_limit:{user_id}:{endpoint}:{window}
EXPIRE rate_limit:{user_id}:{endpoint}:{window} 3600  # 1 hour window

# Message rate limiting (prevent spam)
INCR message_rate:{user_id}:{channel_id}:{minute}
EXPIRE message_rate:{user_id}:{channel_id}:{minute} 60  # 1 minute window
```

## Elasticsearch Schema (Search Index)

### Messages Index
```json
{
  "mappings": {
    "properties": {
      "message_id": { "type": "keyword" },
      "workspace_id": { "type": "keyword" },
      "channel_id": { "type": "keyword" },
      "user_id": { "type": "keyword" },
      "username": { "type": "keyword" },
      "display_name": { "type": "text" },
      "content": { 
        "type": "text",
        "analyzer": "standard",
        "search_analyzer": "standard"
      },
      "message_type": { "type": "keyword" },
      "thread_id": { "type": "keyword" },
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" },
      "mentions": { "type": "keyword" },
      "channel_name": { "type": "keyword" },
      "has_files": { "type": "boolean" },
      "reaction_count": { "type": "integer" }
    }
  },
  "settings": {
    "number_of_shards": 5,
    "number_of_replicas": 1,
    "refresh_interval": "5s"
  }
}
```

### Files Index
```json
{
  "mappings": {
    "properties": {
      "file_id": { "type": "keyword" },
      "workspace_id": { "type": "keyword" },
      "filename": { 
        "type": "text",
        "fields": {
          "keyword": { "type": "keyword" }
        }
      },
      "file_size": { "type": "long" },
      "mime_type": { "type": "keyword" },
      "uploader_id": { "type": "keyword" },
      "uploader_name": { "type": "text" },
      "extracted_text": { "type": "text" },
      "created_at": { "type": "date" },
      "channel_ids": { "type": "keyword" },
      "tags": { "type": "keyword" }
    }
  }
}
```

### Users Index
```json
{
  "mappings": {
    "properties": {
      "user_id": { "type": "keyword" },
      "workspace_id": { "type": "keyword" },
      "username": { "type": "keyword" },
      "display_name": { 
        "type": "text",
        "fields": {
          "keyword": { "type": "keyword" }
        }
      },
      "email": { "type": "keyword" },
      "title": { "type": "text" },
      "department": { "type": "keyword" },
      "bio": { "type": "text" },
      "status": { "type": "keyword" },
      "last_active": { "type": "date" }
    }
  }
}
```

## Database Partitioning Strategy

### PostgreSQL Partitioning
```sql
-- Partition messages by workspace_id and date
CREATE TABLE messages_2024_01 PARTITION OF messages
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE messages_2024_02 PARTITION OF messages
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Partition files by workspace_id hash
CREATE TABLE files_shard_0 PARTITION OF files
FOR VALUES WITH (MODULUS 16, REMAINDER 0);

CREATE TABLE files_shard_1 PARTITION OF files
FOR VALUES WITH (MODULUS 16, REMAINDER 1);
```

### Elasticsearch Sharding
```javascript
// Index per workspace for large workspaces
const indexName = workspace.memberCount > 10000 
    ? `messages_workspace_${workspaceId}`
    : `messages_shared_${Math.floor(workspaceId.hashCode() % 10)}`;

// Time-based indices for high-volume workspaces
const timeBasedIndex = `messages_${workspaceId}_${year}_${month}`;
```

## Data Retention and Archival

### Automated Data Lifecycle
```sql
-- Archive old messages (configurable per workspace)
CREATE OR REPLACE FUNCTION archive_old_messages()
RETURNS void AS $$
DECLARE
    workspace_record RECORD;
    retention_days INTEGER;
BEGIN
    FOR workspace_record IN 
        SELECT workspace_id, settings->'retention_days' as retention_days 
        FROM workspaces 
    LOOP
        retention_days := COALESCE(workspace_record.retention_days::INTEGER, 365);
        
        -- Move to archive table
        INSERT INTO messages_archive 
        SELECT * FROM messages 
        WHERE workspace_id = workspace_record.workspace_id
        AND created_at < NOW() - INTERVAL '1 day' * retention_days;
        
        -- Delete from main table
        DELETE FROM messages 
        WHERE workspace_id = workspace_record.workspace_id
        AND created_at < NOW() - INTERVAL '1 day' * retention_days;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule to run daily
SELECT cron.schedule('archive-messages', '0 2 * * *', 'SELECT archive_old_messages();');
```

### File Storage Tiering
```javascript
class FileStorageManager {
    async tierFiles() {
        // Move files to appropriate storage tier based on age and access
        const files = await this.getFilesForTiering();
        
        for (const file of files) {
            const daysSinceCreated = this.daysSince(file.created_at);
            const daysSinceAccessed = this.daysSince(file.last_accessed_at);
            
            if (daysSinceAccessed > 365) {
                // Move to cold storage
                await this.moveToTier(file, 'GLACIER');
            } else if (daysSinceAccessed > 90) {
                // Move to warm storage
                await this.moveToTier(file, 'STANDARD_IA');
            }
            // Keep in hot storage (STANDARD) if accessed recently
        }
    }
}
```

## Backup and Recovery

### PostgreSQL Backup Strategy
```yaml
# Continuous WAL archiving
archive_mode: on
archive_command: 'aws s3 cp %p s3://backup-bucket/wal/%f'
wal_level: replica

# Daily full backups
pg_dump_schedule:
  frequency: daily
  time: "02:00"
  retention: 30_days
  compression: gzip
  destination: s3://backup-bucket/dumps/

# Point-in-time recovery capability
recovery_target_time: '2024-01-15 14:30:00'
```

### Redis Persistence
```yaml
# RDB snapshots
save 900 1      # Save if at least 1 key changed in 900 seconds
save 300 10     # Save if at least 10 keys changed in 300 seconds
save 60 10000   # Save if at least 10000 keys changed in 60 seconds

# AOF persistence
appendonly yes
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
```

### Elasticsearch Backup
```json
{
  "type": "s3",
  "settings": {
    "bucket": "elasticsearch-backups",
    "region": "us-east-1",
    "base_path": "snapshots"
  }
}
```

## Performance Optimization

### Database Indexing Strategy
```sql
-- Composite indexes for common query patterns
CREATE INDEX idx_messages_channel_thread_created 
ON messages (channel_id, thread_id, created_at DESC);

CREATE INDEX idx_messages_user_workspace_created 
ON messages (user_id, workspace_id, created_at DESC);

-- Partial indexes for active data
CREATE INDEX idx_active_workspace_members 
ON workspace_members (workspace_id, user_id) 
WHERE status = 'active';

-- Expression indexes for search
CREATE INDEX idx_messages_search_vector 
ON messages USING gin(to_tsvector('english', content));
```

### Query Optimization
```sql
-- Optimized query for recent messages with user info
SELECT 
    m.message_id,
    m.content,
    m.created_at,
    u.display_name,
    u.avatar_url
FROM messages m
JOIN users u ON m.user_id = u.user_id
WHERE m.channel_id = $1
    AND m.created_at > $2
    AND m.is_deleted = FALSE
ORDER BY m.created_at DESC
LIMIT 50;
```
