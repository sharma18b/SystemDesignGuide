# Google Docs - API Design

## API Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                              │
│  • Authentication & Authorization                           │
│  • Rate Limiting & Request Validation                       │
│  • Operation Transformation Routing                         │
│  • WebSocket Connection Management                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ WebSocket   │ │ REST API    │ │ GraphQL     │
│ (Real-time) │ │ (CRUD)      │ │ (Flexible)  │
└─────────────┘ └─────────────┘ └─────────────┘
```

## WebSocket API (Real-time Collaboration)

### Connection and Document Joining
```javascript
// Client Connection
const socket = io('wss://docs-api.google.com/collaborate', {
    auth: {
        token: 'jwt_token_here',
        document_id: 'document_uuid'
    },
    transports: ['websocket']
});

// Server Response - Document Joined
socket.on('document_joined', {
    success: true,
    document: {
        id: 'document_uuid',
        title: 'Project Proposal',
        content: {...}, // Full document content
        version: 1234,
        permissions: {
            can_edit: true,
            can_comment: true,
            can_share: false
        }
    },
    collaborators: [
        {
            user_id: 'user_uuid',
            display_name: 'Jane Smith',
            avatar_url: 'https://...',
            cursor_position: 150,
            selection: { start: 100, end: 200 },
            color: '#FF5733',
            is_typing: false
        }
    ],
    your_user_id: 'current_user_uuid'
});
```

### Operational Transform Events

#### Send Operation
```javascript
// Client sends edit operation
socket.emit('operation', {
    operation_id: 'client_generated_uuid',
    type: 'insert',
    position: 150,
    content: 'Hello World!',
    attributes: {
        bold: true,
        fontSize: 12,
        fontFamily: 'Arial'
    },
    base_version: 1234,
    client_id: 'client_uuid',
    timestamp: Date.now()
});

// Server broadcasts transformed operation
socket.on('operation_applied', {
    operation_id: 'server_generated_uuid',
    original_operation_id: 'client_generated_uuid',
    type: 'insert',
    position: 155, // Transformed position
    content: 'Hello World!',
    attributes: {
        bold: true,
        fontSize: 12,
        fontFamily: 'Arial'
    },
    user_id: 'user_uuid',
    user_name: 'John Doe',
    version: 1235,
    timestamp: '2024-01-15T10:30:00Z',
    transform_info: {
        concurrent_operations: 2,
        transform_time_ms: 5
    }
});
```

#### Operation Types
```javascript
// Text Operations
const textOperations = {
    insert: {
        type: 'insert',
        position: 150,
        content: 'Hello World!',
        attributes: { bold: true }
    },
    delete: {
        type: 'delete',
        position: 150,
        length: 11
    },
    format: {
        type: 'format',
        start: 150,
        end: 161,
        attributes: { bold: true, italic: false }
    }
};

// Structure Operations
const structureOperations = {
    insert_paragraph: {
        type: 'insert_paragraph',
        position: 150,
        style: 'heading1'
    },
    insert_table: {
        type: 'insert_table',
        position: 150,
        rows: 3,
        columns: 4,
        style: 'default'
    },
    insert_image: {
        type: 'insert_image',
        position: 150,
        image_id: 'image_uuid',
        width: 400,
        height: 300,
        alignment: 'center'
    }
};
```

#### Cursor and Selection Updates
```javascript
// Cursor Position Update
socket.emit('cursor_update', {
    position: 150,
    timestamp: Date.now()
});

// Text Selection Update
socket.emit('selection_update', {
    start: 100,
    end: 200,
    timestamp: Date.now()
});

// Receive Other Users' Cursors
socket.on('cursor_updated', {
    user_id: 'user_uuid',
    user_name: 'Jane Smith',
    position: 150,
    color: '#FF5733',
    timestamp: '2024-01-15T10:30:00Z'
});

// Receive Other Users' Selections
socket.on('selection_updated', {
    user_id: 'user_uuid',
    user_name: 'Jane Smith',
    start: 100,
    end: 200,
    color: '#FF5733',
    timestamp: '2024-01-15T10:30:00Z'
});
```

#### Typing Indicators
```javascript
// Start Typing
socket.emit('typing_start', {
    position: 150
});

// Stop Typing
socket.emit('typing_stop');

// Typing Status Update
socket.on('typing_update', {
    typing_users: [
        {
            user_id: 'user_uuid',
            user_name: 'Jane Smith',
            position: 150,
            color: '#FF5733'
        }
    ]
});
```

## REST API (HTTP Endpoints)

### Document Management

#### Create Document
```http
POST /api/v1/documents
Authorization: Bearer jwt_token
Content-Type: application/json

{
    "title": "Project Proposal",
    "content": {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [
                    {
                        "type": "text",
                        "text": "This is the initial content."
                    }
                ]
            }
        ]
    },
    "template_id": null,
    "folder_id": "folder_uuid"
}

Response:
{
    "document_id": "document_uuid",
    "title": "Project Proposal",
    "owner_id": "user_uuid",
    "sharing_mode": "private",
    "edit_url": "https://docs.google.com/document/d/document_uuid/edit",
    "view_url": "https://docs.google.com/document/d/document_uuid/view",
    "created_at": "2024-01-15T10:30:00Z",
    "current_version": 1
}
```

#### Get Document
```http
GET /api/v1/documents/{document_id}?include_content=true&version=latest
Authorization: Bearer jwt_token

Response:
{
    "document_id": "document_uuid",
    "title": "Project Proposal",
    "owner_id": "user_uuid",
    "content": {
        "type": "doc",
        "content": [...]
    },
    "current_version": 1234,
    "word_count": 1500,
    "character_count": 8500,
    "sharing_mode": "link_sharing",
    "permissions": {
        "can_edit": true,
        "can_comment": true,
        "can_share": true,
        "can_download": true
    },
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T11:45:00Z",
    "last_accessed_at": "2024-01-15T11:50:00Z"
}
```

#### List User Documents
```http
GET /api/v1/users/me/documents?folder_id=folder_uuid&limit=50&offset=0&order_by=updated_at
Authorization: Bearer jwt_token

Response:
{
    "documents": [
        {
            "document_id": "document_uuid",
            "title": "Project Proposal",
            "word_count": 1500,
            "sharing_mode": "private",
            "last_opened_at": "2024-01-15T11:45:00Z",
            "updated_at": "2024-01-15T11:45:00Z",
            "thumbnail_url": "https://...",
            "collaborator_count": 3,
            "comment_count": 5
        }
    ],
    "total_count": 127,
    "has_more": true
}
```

### Sharing and Permissions

#### Share Document
```http
POST /api/v1/documents/{document_id}/share
Authorization: Bearer jwt_token
Content-Type: application/json

{
    "share_type": "user", // user, email, link, domain
    "recipients": [
        {
            "email": "colleague@company.com",
            "permission": "edit",
            "notify": true,
            "message": "Please review this proposal"
        }
    ],
    "link_sharing": {
        "enabled": true,
        "permission": "comment",
        "expires_at": "2024-02-15T10:30:00Z"
    }
}

Response:
{
    "share_url": "https://docs.google.com/document/d/document_uuid/edit?usp=sharing",
    "view_url": "https://docs.google.com/document/d/document_uuid/view?usp=sharing",
    "permissions_granted": [
        {
            "email": "colleague@company.com",
            "permission": "edit",
            "status": "sent"
        }
    ],
    "link_sharing": {
        "enabled": true,
        "share_token": "share_token_here"
    }
}
```

#### Get Document Permissions
```http
GET /api/v1/documents/{document_id}/permissions
Authorization: Bearer jwt_token

Response:
{
    "owner": {
        "user_id": "owner_uuid",
        "display_name": "John Doe",
        "email": "john@company.com",
        "permission": "owner"
    },
    "users": [
        {
            "user_id": "user_uuid",
            "display_name": "Jane Smith",
            "email": "jane@company.com",
            "permission": "edit",
            "granted_at": "2024-01-15T10:30:00Z",
            "last_accessed_at": "2024-01-15T11:45:00Z"
        }
    ],
    "link_sharing": {
        "enabled": true,
        "permission": "comment",
        "share_url": "https://...",
        "expires_at": "2024-02-15T10:30:00Z"
    },
    "domain_sharing": {
        "enabled": false,
        "domain": "company.com",
        "permission": "view"
    }
}
```

### Comments and Suggestions

#### Add Comment
```http
POST /api/v1/documents/{document_id}/comments
Authorization: Bearer jwt_token
Content-Type: application/json

{
    "content": "This section needs more detail about the timeline.",
    "anchor_start": 150,
    "anchor_end": 200,
    "anchor_text": "project timeline",
    "comment_type": "comment",
    "mentioned_users": ["user_uuid_1", "user_uuid_2"]
}

Response:
{
    "comment_id": "comment_uuid",
    "content": "This section needs more detail about the timeline.",
    "user": {
        "user_id": "user_uuid",
        "display_name": "Jane Smith",
        "avatar_url": "https://..."
    },
    "anchor_start": 150,
    "anchor_end": 200,
    "anchor_text": "project timeline",
    "thread_id": "thread_uuid",
    "status": "open",
    "created_at": "2024-01-15T10:30:00Z"
}
```

#### Add Suggestion
```http
POST /api/v1/documents/{document_id}/suggestions
Authorization: Bearer jwt_token
Content-Type: application/json

{
    "suggestion_type": "replace",
    "anchor_start": 150,
    "anchor_end": 200,
    "original_text": "project timeline",
    "suggested_text": "detailed project timeline with milestones",
    "comment": "Adding more specificity to the timeline reference"
}

Response:
{
    "suggestion_id": "suggestion_uuid",
    "suggestion_type": "replace",
    "original_text": "project timeline",
    "suggested_text": "detailed project timeline with milestones",
    "user": {
        "user_id": "user_uuid",
        "display_name": "Jane Smith"
    },
    "status": "pending",
    "created_at": "2024-01-15T10:30:00Z"
}
```

#### Accept/Reject Suggestion
```http
POST /api/v1/suggestions/{suggestion_id}/accept
Authorization: Bearer jwt_token

Response:
{
    "success": true,
    "operation_applied": {
        "type": "replace",
        "position": 150,
        "delete_length": 16,
        "insert_content": "detailed project timeline with milestones"
    },
    "new_version": 1235
}

POST /api/v1/suggestions/{suggestion_id}/reject
Authorization: Bearer jwt_token
Content-Type: application/json

{
    "reason": "The original text is more appropriate for this context"
}
```

### Version History

#### Get Revision History
```http
GET /api/v1/documents/{document_id}/revisions?limit=20&offset=0
Authorization: Bearer jwt_token

Response:
{
    "revisions": [
        {
            "revision_id": "revision_uuid",
            "version": 1234,
            "user": {
                "user_id": "user_uuid",
                "display_name": "John Doe",
                "avatar_url": "https://..."
            },
            "timestamp": "2024-01-15T10:30:00Z",
            "change_summary": "Added introduction paragraph",
            "word_count_change": +25,
            "operation_count": 3,
            "is_major_revision": false
        }
    ],
    "total_count": 156,
    "has_more": true
}
```

#### Compare Revisions
```http
GET /api/v1/documents/{document_id}/revisions/compare?from={revision_id_1}&to={revision_id_2}
Authorization: Bearer jwt_token

Response:
{
    "from_revision": {
        "revision_id": "revision_uuid_1",
        "version": 1230,
        "timestamp": "2024-01-15T09:30:00Z"
    },
    "to_revision": {
        "revision_id": "revision_uuid_2", 
        "version": 1234,
        "timestamp": "2024-01-15T10:30:00Z"
    },
    "diff": {
        "insertions": [
            {
                "position": 150,
                "content": "This is new text that was added.",
                "attributes": { "bold": true }
            }
        ],
        "deletions": [
            {
                "position": 200,
                "length": 25,
                "original_content": "This text was removed."
            }
        ],
        "modifications": [
            {
                "position": 300,
                "original_attributes": { "italic": false },
                "new_attributes": { "italic": true }
            }
        ]
    },
    "summary": {
        "insertions_count": 1,
        "deletions_count": 1,
        "modifications_count": 1,
        "net_word_change": +3
    }
}
```

#### Restore Revision
```http
POST /api/v1/documents/{document_id}/revisions/{revision_id}/restore
Authorization: Bearer jwt_token

Response:
{
    "success": true,
    "new_revision": {
        "revision_id": "new_revision_uuid",
        "version": 1235,
        "restored_from_version": 1200,
        "timestamp": "2024-01-15T10:30:00Z"
    },
    "document_updated": true
}
```

### Export and Import

#### Export Document
```http
GET /api/v1/documents/{document_id}/export?format=pdf&include_comments=true
Authorization: Bearer jwt_token

Response:
{
    "export_id": "export_uuid",
    "format": "pdf",
    "status": "processing",
    "estimated_completion": "2024-01-15T10:32:00Z",
    "download_url": null // Will be populated when ready
}

# Check export status
GET /api/v1/exports/{export_id}
Authorization: Bearer jwt_token

Response:
{
    "export_id": "export_uuid",
    "status": "completed",
    "format": "pdf",
    "file_size": 2048000,
    "download_url": "https://storage.googleapis.com/exports/export_uuid.pdf?signature=...",
    "expires_at": "2024-01-16T10:30:00Z"
}
```

#### Import Document
```http
POST /api/v1/documents/import
Authorization: Bearer jwt_token
Content-Type: multipart/form-data

file: [Word document binary data]
title: "Imported Document"
folder_id: "folder_uuid"
convert_format: "google_docs"

Response:
{
    "import_id": "import_uuid",
    "status": "processing",
    "estimated_completion": "2024-01-15T10:32:00Z",
    "document_id": null // Will be populated when ready
}
```

## GraphQL API (Flexible Queries)

### Schema Definition
```graphql
type Document {
    id: ID!
    title: String!
    content: JSON!
    owner: User!
    currentVersion: Int!
    wordCount: Int!
    characterCount: Int!
    sharingMode: SharingMode!
    permissions(userId: ID): DocumentPermissions!
    collaborators: [Collaborator!]!
    comments(resolved: Boolean): [Comment!]!
    suggestions(status: SuggestionStatus): [Suggestion!]!
    revisions(limit: Int, offset: Int): RevisionConnection!
    createdAt: DateTime!
    updatedAt: DateTime!
}

type User {
    id: ID!
    displayName: String!
    email: String!
    avatarUrl: String
    documents(limit: Int, offset: Int): DocumentConnection!
    sharedWithMe(limit: Int, offset: Int): DocumentConnection!
    recentDocuments(limit: Int): [Document!]!
}

type Collaborator {
    user: User!
    role: CollaboratorRole!
    isActive: Boolean!
    cursorPosition: Int
    selection: TextSelection
    color: String!
    lastSeenAt: DateTime
}

type Comment {
    id: ID!
    content: String!
    user: User!
    anchorStart: Int!
    anchorEnd: Int!
    anchorText: String!
    status: CommentStatus!
    replies: [Comment!]!
    mentionedUsers: [User!]!
    createdAt: DateTime!
    resolvedAt: DateTime
    resolvedBy: User
}

type Suggestion {
    id: ID!
    suggestionType: SuggestionType!
    originalText: String!
    suggestedText: String!
    user: User!
    status: SuggestionStatus!
    comment: String
    createdAt: DateTime!
    reviewedAt: DateTime
    reviewedBy: User
}

enum SharingMode {
    PRIVATE
    LINK_SHARING
    PUBLIC
    DOMAIN_SHARING
}

enum SuggestionType {
    INSERT
    DELETE
    REPLACE
    FORMAT
}

enum SuggestionStatus {
    PENDING
    ACCEPTED
    REJECTED
}
```

### Example Queries
```graphql
# Get document with collaborators and recent comments
query GetDocumentForEditing($documentId: ID!) {
    document(id: $documentId) {
        id
        title
        content
        currentVersion
        permissions {
            canEdit
            canComment
            canShare
        }
        collaborators {
            user {
                id
                displayName
                avatarUrl
            }
            isActive
            cursorPosition
            selection {
                start
                end
            }
            color
        }
        comments(resolved: false) {
            id
            content
            user {
                displayName
            }
            anchorStart
            anchorEnd
            createdAt
        }
    }
}

# Get user's recent documents with collaboration info
query GetUserDashboard($userId: ID!) {
    user(id: $userId) {
        displayName
        recentDocuments(limit: 10) {
            id
            title
            updatedAt
            wordCount
            collaborators {
                user {
                    displayName
                }
                isActive
            }
            permissions {
                canEdit
            }
        }
        sharedWithMe(limit: 5) {
            edges {
                node {
                    id
                    title
                    owner {
                        displayName
                    }
                    updatedAt
                }
            }
        }
    }
}
```

### Mutations
```graphql
# Create document
mutation CreateDocument($input: CreateDocumentInput!) {
    createDocument(input: $input) {
        document {
            id
            title
            editUrl
            createdAt
        }
        errors {
            field
            message
        }
    }
}

# Share document
mutation ShareDocument($documentId: ID!, $input: ShareDocumentInput!) {
    shareDocument(documentId: $documentId, input: $input) {
        shareUrl
        permissions {
            email
            permission
            status
        }
        errors {
            field
            message
        }
    }
}
```

## Real-time Operation API

### Operation Batching
```javascript
// Batch multiple operations for efficiency
socket.emit('operation_batch', {
    batch_id: 'batch_uuid',
    operations: [
        {
            operation_id: 'op_1',
            type: 'insert',
            position: 150,
            content: 'Hello '
        },
        {
            operation_id: 'op_2', 
            type: 'insert',
            position: 156,
            content: 'World!'
        },
        {
            operation_id: 'op_3',
            type: 'format',
            start: 150,
            end: 162,
            attributes: { bold: true }
        }
    ],
    base_version: 1234
});

// Server response with batch results
socket.on('operation_batch_applied', {
    batch_id: 'batch_uuid',
    results: [
        {
            operation_id: 'op_1',
            success: true,
            transformed_position: 150
        },
        {
            operation_id: 'op_2',
            success: true,
            transformed_position: 156
        },
        {
            operation_id: 'op_3',
            success: true,
            transformed_range: { start: 150, end: 162 }
        }
    ],
    new_version: 1237
});
```

## Error Handling and Recovery

### Operation Conflict Resolution
```javascript
// Handle operation conflicts
socket.on('operation_conflict', {
    original_operation_id: 'client_op_uuid',
    conflict_reason: 'concurrent_modification',
    server_version: 1235,
    client_version: 1234,
    resolution: {
        type: 'transform_and_retry',
        transformed_operation: {
            type: 'insert',
            position: 155, // Adjusted position
            content: 'Hello World!'
        }
    }
});

// Client handles conflict resolution
socket.on('operation_conflict', (conflictData) => {
    if (conflictData.resolution.type === 'transform_and_retry') {
        // Apply transformed operation
        this.applyOperation(conflictData.resolution.transformed_operation);
    } else if (conflictData.resolution.type === 'manual_resolution_required') {
        // Show conflict resolution UI to user
        this.showConflictResolutionDialog(conflictData);
    }
});
```

### Error Response Format
```json
{
    "error": {
        "code": "DOCUMENT_NOT_FOUND",
        "message": "The specified document could not be found or you don't have access",
        "details": {
            "document_id": "invalid-uuid",
            "user_id": "user-uuid",
            "requested_permission": "edit"
        },
        "request_id": "req_123456789",
        "timestamp": "2024-01-15T10:30:00Z"
    }
}
```

### Rate Limiting
```yaml
# Per User Limits (per hour)
Personal Account:
  - Document Operations: 10,000/hour
  - Document Creation: 100/hour
  - Export Requests: 50/hour
  - Share Operations: 500/hour

Workspace Account:
  - Document Operations: 100,000/hour
  - Document Creation: 1,000/hour
  - Export Requests: 500/hour
  - Share Operations: 5,000/hour

Enterprise Account:
  - Document Operations: 1,000,000/hour
  - Document Creation: 10,000/hour
  - Export Requests: 5,000/hour
  - Share Operations: 50,000/hour
```
