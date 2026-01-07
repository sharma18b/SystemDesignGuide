# Google Docs - Database Design

## Database Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                           │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Spanner       │     Redis       │      Bigtable           │
│   (Documents)   │   (Real-time)   │     (Revisions)         │
├─────────────────┼─────────────────┼─────────────────────────┤
│ • Documents     │ • OT State      │ • Revision History      │
│ • Users         │ • Presence      │ • Operation Logs        │
│ • Permissions   │ • Cursors       │ • Document Snapshots    │
│ • Comments      │ • Sessions      │ • Analytics Events      │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## Spanner Schema (Primary Database)

### Documents Table
```sql
CREATE TABLE documents (
    document_id STRING(36) NOT NULL,
    title STRING(500) NOT NULL,
    owner_id STRING(36) NOT NULL,
    
    -- Content and Structure
    content JSON NOT NULL,
    content_type STRING(50) DEFAULT 'rich_text',
    word_count INT64 DEFAULT 0,
    character_count INT64 DEFAULT 0,
    page_count INT64 DEFAULT 1,
    
    -- Versioning
    current_version INT64 DEFAULT 1,
    latest_revision_id STRING(36),
    
    -- Collaboration Settings
    sharing_mode STRING(20) DEFAULT 'private', -- private, link_sharing, public
    default_permission STRING(20) DEFAULT 'view', -- view, comment, edit
    allow_comments BOOL DEFAULT TRUE,
    allow_suggestions BOOL DEFAULT TRUE,
    
    -- Document Settings
    language STRING(10) DEFAULT 'en',
    page_setup JSON, -- margins, orientation, size
    styles JSON, -- custom styles and formatting
    
    -- Status and Metadata
    status STRING(20) DEFAULT 'active', -- active, archived, deleted
    folder_id STRING(36),
    template_id STRING(36),
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL OPTIONS (allow_commit_timestamp=true),
    updated_at TIMESTAMP NOT NULL OPTIONS (allow_commit_timestamp=true),
    last_accessed_at TIMESTAMP,
    
    -- Indexes
    PRIMARY KEY (document_id),
    INDEX idx_documents_owner (owner_id, created_at DESC),
    INDEX idx_documents_folder (folder_id, updated_at DESC),
    INDEX idx_documents_status (status, updated_at DESC)
) PRIMARY KEY (document_id),
  INTERLEAVE IN PARENT users (owner_id);
```

### Users Table
```sql
CREATE TABLE users (
    user_id STRING(36) NOT NULL,
    email STRING(255) NOT NULL,
    display_name STRING(200) NOT NULL,
    avatar_url STRING(500),
    
    -- User Preferences
    language STRING(10) DEFAULT 'en',
    timezone STRING(50) DEFAULT 'UTC',
    editor_preferences JSON, -- font, theme, shortcuts
    
    -- Account Information
    account_type STRING(20) DEFAULT 'personal', -- personal, workspace, enterprise
    organization_id STRING(36),
    
    -- Usage Statistics
    documents_created INT64 DEFAULT 0,
    documents_edited INT64 DEFAULT 0,
    last_active_at TIMESTAMP,
    
    -- Status
    status STRING(20) DEFAULT 'active', -- active, suspended, deleted
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL OPTIONS (allow_commit_timestamp=true),
    updated_at TIMESTAMP NOT NULL OPTIONS (allow_commit_timestamp=true),
    
    -- Constraints and Indexes
    PRIMARY KEY (user_id),
    UNIQUE INDEX idx_users_email (email),
    INDEX idx_users_organization (organization_id, status),
    INDEX idx_users_last_active (last_active_at DESC)
) PRIMARY KEY (user_id);
```

### Document Permissions Table
```sql
CREATE TABLE document_permissions (
    permission_id STRING(36) NOT NULL,
    document_id STRING(36) NOT NULL,
    user_id STRING(36),
    email STRING(255), -- For sharing with non-users
    
    -- Permission Details
    permission_type STRING(20) NOT NULL, -- view, comment, edit, owner
    granted_by STRING(36) NOT NULL, -- user who granted permission
    
    -- Sharing Context
    share_type STRING(20) DEFAULT 'direct', -- direct, link, domain
    share_token STRING(100), -- For link sharing
    
    -- Expiration and Restrictions
    expires_at TIMESTAMP,
    can_share BOOL DEFAULT FALSE,
    can_download BOOL DEFAULT TRUE,
    can_copy BOOL DEFAULT TRUE,
    
    -- Status
    status STRING(20) DEFAULT 'active', -- active, revoked, expired
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL OPTIONS (allow_commit_timestamp=true),
    updated_at TIMESTAMP NOT NULL OPTIONS (allow_commit_timestamp=true),
    last_accessed_at TIMESTAMP,
    
    -- Constraints and Indexes
    PRIMARY KEY (document_id, permission_id),
    INDEX idx_permissions_user (user_id, status),
    INDEX idx_permissions_email (email, status),
    INDEX idx_permissions_token (share_token),
    INDEX idx_permissions_expires (expires_at)
) PRIMARY KEY (document_id, permission_id),
  INTERLEAVE IN PARENT documents (document_id);
```

### Comments Table
```sql
CREATE TABLE comments (
    comment_id STRING(36) NOT NULL,
    document_id STRING(36) NOT NULL,
    user_id STRING(36) NOT NULL,
    
    -- Comment Content
    content TEXT NOT NULL,
    comment_type STRING(20) DEFAULT 'comment', -- comment, suggestion
    
    -- Position in Document
    anchor_start INT64 NOT NULL, -- Character position
    anchor_end INT64 NOT NULL,
    anchor_text STRING(1000), -- Original text for context
    
    -- Threading
    parent_comment_id STRING(36), -- For replies
    thread_id STRING(36) NOT NULL, -- Groups related comments
    
    -- Suggestion Details (if comment_type = 'suggestion')
    suggested_text TEXT,
    suggestion_type STRING(20), -- insert, delete, replace
    
    -- Status and Resolution
    status STRING(20) DEFAULT 'open', -- open, resolved, deleted
    resolved_by STRING(36),
    resolved_at TIMESTAMP,
    
    -- Mentions and Notifications
    mentioned_users ARRAY<STRING(36)>,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL OPTIONS (allow_commit_timestamp=true),
    updated_at TIMESTAMP NOT NULL OPTIONS (allow_commit_timestamp=true),
    
    -- Constraints and Indexes
    PRIMARY KEY (document_id, comment_id),
    INDEX idx_comments_user (user_id, created_at DESC),
    INDEX idx_comments_thread (thread_id, created_at),
    INDEX idx_comments_status (status, created_at DESC),
    INDEX idx_comments_position (anchor_start, anchor_end)
) PRIMARY KEY (document_id, comment_id),
  INTERLEAVE IN PARENT documents (document_id);
```

### Document Collaborators Table
```sql
CREATE TABLE document_collaborators (
    document_id STRING(36) NOT NULL,
    user_id STRING(36) NOT NULL,
    
    -- Collaboration Details
    role STRING(20) NOT NULL, -- viewer, commenter, editor, owner
    last_edit_at TIMESTAMP,
    edit_count INT64 DEFAULT 0,
    
    -- Session Information
    is_active BOOL DEFAULT FALSE,
    last_seen_at TIMESTAMP,
    cursor_position INT64,
    selection_start INT64,
    selection_end INT64,
    
    -- User Context
    display_name STRING(200),
    avatar_url STRING(500),
    user_color STRING(7), -- Hex color for cursor/selection
    
    -- Timestamps
    first_accessed_at TIMESTAMP NOT NULL OPTIONS (allow_commit_timestamp=true),
    last_accessed_at TIMESTAMP NOT NULL OPTIONS (allow_commit_timestamp=true),
    
    -- Constraints and Indexes
    PRIMARY KEY (document_id, user_id),
    INDEX idx_collaborators_active (is_active, last_seen_at DESC),
    INDEX idx_collaborators_last_edit (last_edit_at DESC)
) PRIMARY KEY (document_id, user_id),
  INTERLEAVE IN PARENT documents (document_id);
```

## Redis Schema (Real-time State)

### Operational Transform State
```redis
# Document OT State
HSET ot_state:{document_id} 
    version 1234
    last_operation_id "op_uuid"
    pending_operations "[]"
    active_editors "['user1', 'user2']"
    last_updated "2024-01-15T10:30:00Z"

# Operation Queue (per document)
LPUSH ot_queue:{document_id} '{
    "operation_id": "op_uuid",
    "type": "insert",
    "position": 150,
    "content": "Hello World",
    "user_id": "user_uuid",
    "client_id": "client_uuid",
    "timestamp": "2024-01-15T10:30:00Z",
    "version": 1234
}'
LTRIM ot_queue:{document_id} 0 999  # Keep last 1000 operations

# Transform Cache (for performance)
SET transform_cache:{op1_hash}:{op2_hash} '{
    "transformed_op1": {...},
    "transformed_op2": {...},
    "cached_at": "2024-01-15T10:30:00Z"
}' EX 3600  # 1 hour expiry
```

### Real-time Presence
```redis
# User Presence in Document
HSET presence:{document_id}:{user_id}
    status "editing"
    cursor_position 150
    selection_start 100
    selection_end 200
    last_activity "2024-01-15T10:30:00Z"
    user_color "#FF5733"
    display_name "John Doe"

EXPIRE presence:{document_id}:{user_id} 300  # 5 minute expiry

# Active Users in Document
SADD active_users:{document_id} user_id
EXPIRE active_users:{document_id} 300

# Typing Indicators
SET typing:{document_id}:{user_id} "1" EX 10  # 10 second expiry
```

### WebSocket Session Management
```redis
# WebSocket Connection Mapping
HSET ws_connections:{connection_id}
    user_id "user_uuid"
    document_id "doc_uuid"
    connected_at "2024-01-15T10:30:00Z"
    last_heartbeat "2024-01-15T10:35:00Z"
    client_type "web"

EXPIRE ws_connections:{connection_id} 7200  # 2 hour expiry

# User to Connection Mapping
SADD user_connections:{user_id} connection_id
EXPIRE user_connections:{user_id} 7200

# Document to Connection Mapping
SADD doc_connections:{document_id} connection_id
EXPIRE doc_connections:{document_id} 7200
```

### Document Cache
```redis
# Document Content Cache
SET doc_content:{document_id} '{
    "content": {...},
    "version": 1234,
    "word_count": 500,
    "last_modified": "2024-01-15T10:30:00Z"
}' EX 1800  # 30 minute expiry

# Document Metadata Cache
HSET doc_meta:{document_id}
    title "My Document"
    owner_id "user_uuid"
    sharing_mode "link_sharing"
    word_count 500
    updated_at "2024-01-15T10:30:00Z"

EXPIRE doc_meta:{document_id} 3600  # 1 hour expiry

# Permission Cache
SET doc_permissions:{document_id}:{user_id} '{
    "permission_type": "edit",
    "can_share": true,
    "can_comment": true,
    "expires_at": null
}' EX 1800  # 30 minute expiry
```

## Bigtable Schema (Revision History)

### Document Revisions Table
```
Row Key: {document_id}#{timestamp_reverse}#{revision_id}
Column Families:
  - content: Document content and metadata
  - operations: Individual operations that created this revision
  - user: User information and attribution
  - diff: Differences from previous revision

Example Row:
doc_12345#9223372036854775807-1642248000000#rev_67890
  content:
    full_content: <compressed document content>
    word_count: 1500
    character_count: 8500
    content_hash: "sha256_hash"
  operations:
    operation_count: 15
    operations_json: <compressed operations array>
    operation_types: "insert,delete,format"
  user:
    user_id: "user_uuid"
    display_name: "John Doe"
    user_agent: "Chrome/96.0"
    ip_address_hash: "hashed_ip"
  diff:
    diff_size: 150
    diff_json: <compressed diff data>
    change_summary: "Added paragraph, fixed typos"
```

### Operation Log Table
```
Row Key: {document_id}#{timestamp}#{operation_id}
Column Families:
  - op: Operation details
  - transform: Transformation information
  - client: Client context

Example Row:
doc_12345#1642248000000#op_abc123
  op:
    type: "insert"
    position: 150
    content: "Hello World"
    length: 11
  transform:
    base_version: 1233
    transformed_version: 1234
    concurrent_ops: 2
    transform_time_ms: 5
  client:
    user_id: "user_uuid"
    client_id: "client_uuid"
    session_id: "session_uuid"
    timestamp: 1642248000000
```

### Document Snapshots Table
```
Row Key: {document_id}#{snapshot_type}#{timestamp}
Column Families:
  - snapshot: Full document snapshot
  - metadata: Snapshot metadata

Snapshot Types:
- daily: Daily snapshots for quick recovery
- major: Major version snapshots (every 100 versions)
- manual: User-created snapshots

Example Row:
doc_12345#daily#1642204800000
  snapshot:
    content: <compressed full document>
    version: 1200
    size_bytes: 25600
    compression_ratio: 0.3
  metadata:
    word_count: 1500
    collaborator_count: 5
    comment_count: 12
    created_reason: "daily_snapshot"
```

## Database Partitioning Strategy

### Spanner Partitioning
```sql
-- Documents partitioned by owner_id for locality
-- Interleaved tables for related data co-location

-- Partition by user for better locality
CREATE TABLE documents (
    owner_id STRING(36) NOT NULL,
    document_id STRING(36) NOT NULL,
    ...
) PRIMARY KEY (owner_id, document_id);

-- Interleave permissions with documents
CREATE TABLE document_permissions (
    owner_id STRING(36) NOT NULL,
    document_id STRING(36) NOT NULL,
    permission_id STRING(36) NOT NULL,
    ...
) PRIMARY KEY (owner_id, document_id, permission_id),
  INTERLEAVE IN PARENT documents (owner_id, document_id);
```

### Bigtable Row Key Design
```javascript
// Reverse timestamp for recent-first ordering
function generateRowKey(documentId, timestamp, revisionId) {
    const reverseTimestamp = Long.MAX_VALUE - timestamp;
    return `${documentId}#${reverseTimestamp}#${revisionId}`;
}

// Efficient range scans for document history
function getDocumentRevisions(documentId, limit = 50) {
    const startKey = `${documentId}#`;
    const endKey = `${documentId}#~`;
    return bigtable.scanRange(startKey, endKey, limit);
}
```

## Data Consistency and Transactions

### Spanner Transactions
```sql
-- Atomic document update with version increment
BEGIN TRANSACTION;
    UPDATE documents 
    SET content = @new_content,
        current_version = current_version + 1,
        updated_at = PENDING_COMMIT_TIMESTAMP()
    WHERE document_id = @document_id
    AND current_version = @expected_version;
    
    INSERT INTO document_revisions (
        revision_id, document_id, version, content, user_id, created_at
    ) VALUES (
        @revision_id, @document_id, @new_version, @new_content, @user_id, PENDING_COMMIT_TIMESTAMP()
    );
COMMIT TRANSACTION;
```

### Operational Transform Consistency
```javascript
class OTConsistencyManager {
    async applyOperationAtomically(documentId, operation, expectedVersion) {
        const transaction = this.spanner.transaction();
        
        try {
            // Read current document state
            const [rows] = await transaction.read('documents', {
                keys: [documentId],
                columns: ['current_version', 'content']
            });
            
            if (rows.length === 0) {
                throw new Error('Document not found');
            }
            
            const currentVersion = rows[0].current_version;
            if (currentVersion !== expectedVersion) {
                throw new Error('Version conflict');
            }
            
            // Apply operation
            const newContent = this.applyOperation(rows[0].content, operation);
            const newVersion = currentVersion + 1;
            
            // Update document
            await transaction.update('documents', {
                document_id: documentId,
                content: newContent,
                current_version: newVersion,
                updated_at: new Date()
            });
            
            // Record operation
            await transaction.insert('operation_log', {
                operation_id: operation.id,
                document_id: documentId,
                operation_data: operation,
                version: newVersion,
                created_at: new Date()
            });
            
            await transaction.commit();
            
            return { success: true, newVersion: newVersion };
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
}
```

## Data Retention and Archival

### Automated Cleanup Policies
```sql
-- Archive old revisions (keep last 100 per document)
CREATE OR REPLACE PROCEDURE archive_old_revisions()
BEGIN
    DECLARE document_cursor CURSOR FOR 
        SELECT document_id FROM documents WHERE status = 'active';
    
    FOR document_record IN document_cursor DO
        -- Keep only last 100 revisions per document
        DELETE FROM document_revisions 
        WHERE document_id = document_record.document_id
        AND revision_id NOT IN (
            SELECT revision_id 
            FROM document_revisions 
            WHERE document_id = document_record.document_id
            ORDER BY created_at DESC 
            LIMIT 100
        );
    END FOR;
END;
```

### Bigtable TTL Configuration
```javascript
// Configure TTL for different data types
const bigtableConfig = {
    revisions: {
        maxAge: '365d', // 1 year retention
        maxVersions: 100 // Keep last 100 versions
    },
    operations: {
        maxAge: '90d', // 3 months retention
        maxVersions: 1000 // Keep last 1000 operations
    },
    snapshots: {
        maxAge: '2555d', // 7 years retention
        maxVersions: 50 // Keep last 50 snapshots
    }
};
```

## Performance Optimization

### Indexing Strategy
```sql
-- Composite indexes for common query patterns
CREATE INDEX idx_documents_owner_updated 
ON documents (owner_id, updated_at DESC);

CREATE INDEX idx_documents_collaborator_access
ON document_collaborators (user_id, last_accessed_at DESC);

CREATE INDEX idx_comments_document_status
ON comments (document_id, status, created_at DESC);

-- Covering indexes to avoid table lookups
CREATE INDEX idx_documents_list_view
ON documents (owner_id, status, updated_at DESC)
STORING (title, sharing_mode, word_count);
```

### Query Optimization
```sql
-- Optimized query for user's recent documents
SELECT d.document_id, d.title, d.updated_at, d.word_count
FROM documents d
WHERE d.owner_id = @user_id
    AND d.status = 'active'
ORDER BY d.updated_at DESC
LIMIT 50;

-- Optimized query for document collaborators
SELECT dc.user_id, dc.display_name, dc.role, dc.is_active
FROM document_collaborators dc
WHERE dc.document_id = @document_id
    AND dc.last_accessed_at > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
ORDER BY dc.is_active DESC, dc.last_accessed_at DESC;
```

### Caching Strategy
```javascript
class DocumentCacheStrategy {
    getCacheKey(type, documentId, userId = null) {
        const keys = {
            'document_content': `doc:${documentId}:content`,
            'document_metadata': `doc:${documentId}:meta`,
            'user_permissions': `doc:${documentId}:perm:${userId}`,
            'collaborators': `doc:${documentId}:collab`,
            'recent_operations': `doc:${documentId}:ops`
        };
        return keys[type];
    }
    
    getCacheTTL(type) {
        const ttls = {
            'document_content': 1800,    // 30 minutes
            'document_metadata': 3600,   // 1 hour
            'user_permissions': 900,     // 15 minutes
            'collaborators': 300,        // 5 minutes
            'recent_operations': 60      // 1 minute
        };
        return ttls[type] || 300;
    }
}
```
