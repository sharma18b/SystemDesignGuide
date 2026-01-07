# Team Collaboration Tool - API Design

## API Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                              │
│  • Authentication & Authorization                           │
│  • Rate Limiting & Request Validation                       │
│  • Request/Response Transformation                          │
│  • API Versioning & Documentation                           │
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

## WebSocket API (Real-time Communication)

### Connection and Authentication
```javascript
// Client Connection
const socket = io('wss://api.teamchat.com/realtime', {
    auth: {
        token: 'jwt_token_here',
        workspace_id: 'workspace_uuid'
    },
    transports: ['websocket']
});

// Server Authentication Response
socket.on('authenticated', (data) => {
    console.log('Connected to workspace:', data.workspace_name);
    console.log('User channels:', data.channels);
    console.log('Unread counts:', data.unread_counts);
});
```

### Real-time Events

#### Message Events
```javascript
// Send Message
socket.emit('message.send', {
    channel_id: 'uuid',
    content: 'Hello team! 👋',
    message_type: 'text',
    thread_id: null, // null for new message, uuid for thread reply
    client_msg_id: 'client_generated_uuid' // for deduplication
});

// Receive Message
socket.on('message.received', {
    message_id: 'uuid',
    channel_id: 'uuid',
    user_id: 'uuid',
    username: 'johndoe',
    display_name: 'John Doe',
    avatar_url: 'https://...',
    content: 'Hello team! 👋',
    message_type: 'text',
    thread_id: null,
    created_at: '2024-01-15T10:30:00Z',
    reactions: {},
    is_edited: false
});

// Message Edited
socket.on('message.edited', {
    message_id: 'uuid',
    content: 'Hello team! 👋 (edited)',
    edited_at: '2024-01-15T10:35:00Z',
    edit_history: [
        {
            content: 'Hello team! 👋',
            edited_at: '2024-01-15T10:30:00Z'
        }
    ]
});

// Message Deleted
socket.on('message.deleted', {
    message_id: 'uuid',
    channel_id: 'uuid',
    deleted_at: '2024-01-15T10:40:00Z'
});
```

#### Typing Indicators
```javascript
// Start Typing
socket.emit('typing.start', {
    channel_id: 'uuid'
});

// Stop Typing
socket.emit('typing.stop', {
    channel_id: 'uuid'
});

// Typing Status Update
socket.on('typing.update', {
    channel_id: 'uuid',
    typing_users: [
        {
            user_id: 'uuid',
            display_name: 'Jane Smith',
            started_at: '2024-01-15T10:30:00Z'
        }
    ]
});
```

#### Presence Updates
```javascript
// Update Status
socket.emit('presence.update', {
    status: 'away', // online, away, busy, offline
    custom_status: 'In a meeting',
    expires_at: '2024-01-15T12:00:00Z' // optional expiry
});

// Presence Changed
socket.on('presence.changed', {
    user_id: 'uuid',
    status: 'away',
    custom_status: 'In a meeting',
    last_seen: '2024-01-15T10:30:00Z'
});
```

#### Channel Events
```javascript
// Join Channel
socket.emit('channel.join', {
    channel_id: 'uuid'
});

// Leave Channel
socket.emit('channel.leave', {
    channel_id: 'uuid'
});

// User Joined Channel
socket.on('channel.user_joined', {
    channel_id: 'uuid',
    user_id: 'uuid',
    display_name: 'New User',
    joined_at: '2024-01-15T10:30:00Z'
});

// User Left Channel
socket.on('channel.user_left', {
    channel_id: 'uuid',
    user_id: 'uuid',
    left_at: '2024-01-15T10:30:00Z'
});
```

## REST API (HTTP Endpoints)

### Authentication
```http
POST /api/v1/auth/login
Content-Type: application/json

{
    "email": "user@company.com",
    "password": "secure_password",
    "workspace_domain": "company"
}

Response:
{
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_in": 3600,
    "user": {
        "user_id": "uuid",
        "email": "user@company.com",
        "display_name": "John Doe",
        "avatar_url": "https://..."
    },
    "workspace": {
        "workspace_id": "uuid",
        "name": "Company Team",
        "domain": "company"
    }
}
```

### Workspace Management

#### Get Workspace Info
```http
GET /api/v1/workspaces/{workspace_id}
Authorization: Bearer jwt_token

Response:
{
    "workspace_id": "uuid",
    "name": "Company Team",
    "domain": "company",
    "description": "Our team collaboration space",
    "avatar_url": "https://...",
    "member_count": 150,
    "channel_count": 45,
    "plan_type": "pro",
    "settings": {
        "retention_days": 365,
        "file_upload_limit_mb": 1000,
        "require_2fa": false
    },
    "created_at": "2023-01-15T10:00:00Z"
}
```

#### List Workspace Members
```http
GET /api/v1/workspaces/{workspace_id}/members?limit=50&offset=0&role=member
Authorization: Bearer jwt_token

Response:
{
    "members": [
        {
            "user_id": "uuid",
            "display_name": "John Doe",
            "username": "johndoe",
            "email": "john@company.com",
            "avatar_url": "https://...",
            "role": "member",
            "title": "Software Engineer",
            "department": "Engineering",
            "status": "active",
            "last_seen_at": "2024-01-15T10:30:00Z",
            "joined_at": "2023-06-01T09:00:00Z"
        }
    ],
    "total_count": 150,
    "has_more": true
}
```

### Channel Management

#### Create Channel
```http
POST /api/v1/workspaces/{workspace_id}/channels
Authorization: Bearer jwt_token
Content-Type: application/json

{
    "name": "project-alpha",
    "display_name": "Project Alpha",
    "description": "Discussion about Project Alpha",
    "channel_type": "public",
    "topic": "Weekly updates and planning",
    "purpose": "Coordinate Project Alpha development"
}

Response:
{
    "channel_id": "uuid",
    "name": "project-alpha",
    "display_name": "Project Alpha",
    "description": "Discussion about Project Alpha",
    "channel_type": "public",
    "member_count": 1,
    "created_by": "uuid",
    "created_at": "2024-01-15T10:30:00Z"
}
```

#### List Channels
```http
GET /api/v1/workspaces/{workspace_id}/channels?type=public&archived=false&limit=50
Authorization: Bearer jwt_token

Response:
{
    "channels": [
        {
            "channel_id": "uuid",
            "name": "general",
            "display_name": "General",
            "description": "Company-wide announcements and discussion",
            "channel_type": "public",
            "member_count": 150,
            "unread_count": 5,
            "last_message": {
                "message_id": "uuid",
                "content": "Welcome to the team!",
                "user_display_name": "Jane Smith",
                "created_at": "2024-01-15T10:25:00Z"
            },
            "is_member": true,
            "notification_level": "all"
        }
    ],
    "total_count": 45
}
```

#### Join/Leave Channel
```http
POST /api/v1/channels/{channel_id}/members
Authorization: Bearer jwt_token
Content-Type: application/json

{
    "user_id": "uuid" // optional, defaults to current user
}

Response:
{
    "success": true,
    "joined_at": "2024-01-15T10:30:00Z"
}

DELETE /api/v1/channels/{channel_id}/members/{user_id}
Authorization: Bearer jwt_token

Response:
{
    "success": true,
    "left_at": "2024-01-15T10:30:00Z"
}
```

### Message Management

#### Send Message
```http
POST /api/v1/channels/{channel_id}/messages
Authorization: Bearer jwt_token
Content-Type: application/json

{
    "content": "Hello team! Check out this document.",
    "message_type": "text",
    "thread_id": null,
    "file_ids": ["file_uuid_1", "file_uuid_2"],
    "client_msg_id": "client_generated_uuid"
}

Response:
{
    "message_id": "uuid",
    "channel_id": "uuid",
    "user_id": "uuid",
    "content": "Hello team! Check out this document.",
    "message_type": "text",
    "thread_id": null,
    "files": [
        {
            "file_id": "uuid",
            "filename": "document.pdf",
            "file_size": 1024000,
            "download_url": "https://..."
        }
    ],
    "created_at": "2024-01-15T10:30:00Z"
}
```

#### Get Messages
```http
GET /api/v1/channels/{channel_id}/messages?limit=50&before=2024-01-15T10:30:00Z&thread_id=uuid
Authorization: Bearer jwt_token

Response:
{
    "messages": [
        {
            "message_id": "uuid",
            "user_id": "uuid",
            "username": "johndoe",
            "display_name": "John Doe",
            "avatar_url": "https://...",
            "content": "Hello team!",
            "message_type": "text",
            "thread_id": null,
            "reply_count": 3,
            "reactions": {
                "👍": ["user1", "user2"],
                "❤️": ["user3"]
            },
            "files": [],
            "created_at": "2024-01-15T10:30:00Z",
            "edited_at": null
        }
    ],
    "has_more": true,
    "oldest": "2024-01-15T09:00:00Z",
    "latest": "2024-01-15T10:30:00Z"
}
```

#### Edit Message
```http
PUT /api/v1/messages/{message_id}
Authorization: Bearer jwt_token
Content-Type: application/json

{
    "content": "Hello team! (edited)"
}

Response:
{
    "message_id": "uuid",
    "content": "Hello team! (edited)",
    "edited_at": "2024-01-15T10:35:00Z",
    "edit_history": [
        {
            "content": "Hello team!",
            "edited_at": "2024-01-15T10:30:00Z"
        }
    ]
}
```

#### Add Reaction
```http
POST /api/v1/messages/{message_id}/reactions
Authorization: Bearer jwt_token
Content-Type: application/json

{
    "emoji": "👍"
}

Response:
{
    "success": true,
    "reactions": {
        "👍": ["user1", "user2", "current_user"],
        "❤️": ["user3"]
    }
}
```

### File Management

#### Upload File
```http
POST /api/v1/workspaces/{workspace_id}/files
Authorization: Bearer jwt_token
Content-Type: multipart/form-data

file: [binary data]
filename: document.pdf
channel_id: uuid (optional)

Response:
{
    "file_id": "uuid",
    "filename": "document.pdf",
    "original_filename": "document.pdf",
    "file_size": 1024000,
    "mime_type": "application/pdf",
    "processing_status": "processing",
    "upload_url": "https://...", // for resumable uploads
    "created_at": "2024-01-15T10:30:00Z"
}
```

#### Get File Info
```http
GET /api/v1/files/{file_id}
Authorization: Bearer jwt_token

Response:
{
    "file_id": "uuid",
    "filename": "document.pdf",
    "file_size": 1024000,
    "mime_type": "application/pdf",
    "processing_status": "completed",
    "thumbnails": {
        "small": "https://...",
        "medium": "https://...",
        "large": "https://..."
    },
    "download_url": "https://...",
    "share_url": "https://...",
    "uploader": {
        "user_id": "uuid",
        "display_name": "John Doe"
    },
    "created_at": "2024-01-15T10:30:00Z"
}
```

### Search API

#### Search Messages and Files
```http
GET /api/v1/workspaces/{workspace_id}/search?q=project%20alpha&type=messages&limit=20&offset=0
Authorization: Bearer jwt_token

Response:
{
    "results": [
        {
            "type": "message",
            "message_id": "uuid",
            "channel_id": "uuid",
            "channel_name": "project-alpha",
            "content": "Let's discuss the **project alpha** timeline",
            "highlighted_content": "Let's discuss the <em>project alpha</em> timeline",
            "user_display_name": "John Doe",
            "created_at": "2024-01-15T10:30:00Z",
            "score": 0.95
        },
        {
            "type": "file",
            "file_id": "uuid",
            "filename": "project-alpha-specs.pdf",
            "highlighted_filename": "<em>project-alpha</em>-specs.pdf",
            "file_size": 2048000,
            "uploader_name": "Jane Smith",
            "created_at": "2024-01-14T15:20:00Z",
            "score": 0.87
        }
    ],
    "total_count": 45,
    "has_more": true,
    "search_time_ms": 23
}
```

#### Advanced Search with Filters
```http
GET /api/v1/workspaces/{workspace_id}/search
?q=budget
&type=messages
&channel_id=uuid
&from_user=johndoe
&date_from=2024-01-01
&date_to=2024-01-31
&has_files=true
Authorization: Bearer jwt_token
```

## GraphQL API (Flexible Queries)

### Schema Definition
```graphql
type User {
    id: ID!
    username: String!
    displayName: String!
    email: String!
    avatarUrl: String
    title: String
    department: String
    status: UserStatus!
    customStatus: String
    lastSeenAt: DateTime
    timezone: String
}

type Workspace {
    id: ID!
    name: String!
    domain: String
    description: String
    avatarUrl: String
    memberCount: Int!
    channelCount: Int!
    planType: PlanType!
    settings: WorkspaceSettings!
    members(limit: Int, offset: Int, role: MemberRole): [WorkspaceMember!]!
    channels(type: ChannelType, archived: Boolean): [Channel!]!
}

type Channel {
    id: ID!
    name: String!
    displayName: String
    description: String
    type: ChannelType!
    memberCount: Int!
    isArchived: Boolean!
    topic: String
    purpose: String
    createdBy: User!
    createdAt: DateTime!
    messages(limit: Int, before: DateTime, threadId: ID): MessageConnection!
    members: [ChannelMember!]!
    unreadCount: Int!
}

type Message {
    id: ID!
    content: String!
    type: MessageType!
    user: User!
    channel: Channel!
    threadId: ID
    replyCount: Int!
    reactions: [Reaction!]!
    files: [File!]!
    createdAt: DateTime!
    editedAt: DateTime
    editHistory: [MessageEdit!]!
}

type File {
    id: ID!
    filename: String!
    fileSize: Int!
    mimeType: String!
    processingStatus: ProcessingStatus!
    thumbnails: FileThumbnails
    downloadUrl: String!
    shareUrl: String
    uploader: User!
    createdAt: DateTime!
}

enum UserStatus {
    ONLINE
    AWAY
    BUSY
    OFFLINE
}

enum ChannelType {
    PUBLIC
    PRIVATE
    DM
    GROUP_DM
}

enum MessageType {
    TEXT
    FILE
    SYSTEM
    BOT
}
```

### Example Queries
```graphql
# Get workspace overview with recent activity
query GetWorkspaceOverview($workspaceId: ID!) {
    workspace(id: $workspaceId) {
        name
        memberCount
        channels(type: PUBLIC, archived: false) {
            id
            name
            displayName
            memberCount
            unreadCount
            messages(limit: 1) {
                edges {
                    node {
                        content
                        user {
                            displayName
                        }
                        createdAt
                    }
                }
            }
        }
    }
}

# Get channel with messages and thread replies
query GetChannelMessages($channelId: ID!, $limit: Int!, $before: DateTime) {
    channel(id: $channelId) {
        name
        displayName
        messages(limit: $limit, before: $before) {
            edges {
                node {
                    id
                    content
                    user {
                        displayName
                        avatarUrl
                    }
                    reactions {
                        emoji
                        count
                        users {
                            displayName
                        }
                    }
                    files {
                        filename
                        downloadUrl
                        thumbnails {
                            small
                        }
                    }
                    createdAt
                    editedAt
                }
            }
            pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
            }
        }
    }
}
```

### Mutations
```graphql
# Send message with files
mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
        message {
            id
            content
            user {
                displayName
            }
            files {
                filename
                downloadUrl
            }
            createdAt
        }
        errors {
            field
            message
        }
    }
}

# Create channel
mutation CreateChannel($input: CreateChannelInput!) {
    createChannel(input: $input) {
        channel {
            id
            name
            displayName
            type
            createdAt
        }
        errors {
            field
            message
        }
    }
}
```

## Webhook API (Integrations)

### Incoming Webhooks
```http
POST /api/v1/webhooks/{webhook_token}
Content-Type: application/json

{
    "text": "Deployment completed successfully! 🚀",
    "channel": "#deployments",
    "username": "DeployBot",
    "icon_emoji": ":rocket:",
    "attachments": [
        {
            "color": "good",
            "title": "Production Deployment",
            "title_link": "https://github.com/company/app/releases/tag/v1.2.3",
            "text": "Version 1.2.3 deployed to production",
            "fields": [
                {
                    "title": "Environment",
                    "value": "Production",
                    "short": true
                },
                {
                    "title": "Duration",
                    "value": "2m 34s",
                    "short": true
                }
            ],
            "footer": "GitHub Actions",
            "ts": 1642248000
        }
    ]
}
```

### Outgoing Webhooks
```http
# Webhook payload sent to external service
POST https://external-service.com/webhook
Content-Type: application/json
X-Slack-Signature: v0=signature
X-Slack-Request-Timestamp: 1642248000

{
    "token": "webhook_verification_token",
    "team_id": "workspace_id",
    "team_domain": "company",
    "channel_id": "uuid",
    "channel_name": "general",
    "user_id": "uuid",
    "user_name": "johndoe",
    "text": "Hello world!",
    "timestamp": "1642248000.123456",
    "trigger_word": "hello"
}
```

## Rate Limiting and Error Handling

### Rate Limiting Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642248000
X-RateLimit-Retry-After: 60
```

### Rate Limit Tiers
```yaml
# Per User Limits (per hour)
Free Plan:
  - API Calls: 1,000/hour
  - File Uploads: 100/hour
  - Webhook Calls: 500/hour

Pro Plan:
  - API Calls: 10,000/hour
  - File Uploads: 1,000/hour
  - Webhook Calls: 5,000/hour

Enterprise Plan:
  - API Calls: 100,000/hour
  - File Uploads: 10,000/hour
  - Webhook Calls: 50,000/hour
```

### Error Response Format
```json
{
    "error": {
        "code": "CHANNEL_NOT_FOUND",
        "message": "The specified channel could not be found",
        "details": {
            "channel_id": "invalid-uuid",
            "workspace_id": "workspace-uuid"
        },
        "request_id": "req_123456789",
        "timestamp": "2024-01-15T10:30:00Z"
    }
}
```

### Common Error Codes
```yaml
Authentication Errors:
  - INVALID_TOKEN: JWT token is invalid or expired
  - INSUFFICIENT_PERMISSIONS: User lacks required permissions
  - WORKSPACE_ACCESS_DENIED: User not member of workspace

Resource Errors:
  - CHANNEL_NOT_FOUND: Channel ID does not exist
  - MESSAGE_NOT_FOUND: Message ID does not exist
  - FILE_NOT_FOUND: File ID does not exist
  - USER_NOT_FOUND: User ID does not exist

Validation Errors:
  - INVALID_CHANNEL_NAME: Channel name format invalid
  - MESSAGE_TOO_LONG: Message exceeds length limit
  - FILE_TOO_LARGE: File exceeds size limit
  - INVALID_FILE_TYPE: File type not allowed

Rate Limiting:
  - RATE_LIMIT_EXCEEDED: API rate limit exceeded
  - QUOTA_EXCEEDED: Account quota exceeded
  - TOO_MANY_REQUESTS: Temporary rate limit
```

## API Versioning and Documentation

### Versioning Strategy
```http
# URL versioning (preferred)
GET /api/v1/channels/{id}
GET /api/v2/channels/{id}

# Header versioning (alternative)
GET /api/channels/{id}
Accept: application/vnd.teamchat.v1+json
```

### OpenAPI Documentation
```yaml
openapi: 3.0.0
info:
  title: Team Collaboration API
  version: 1.0.0
  description: REST API for team collaboration platform

paths:
  /api/v1/channels/{channel_id}/messages:
    post:
      summary: Send message to channel
      parameters:
        - name: channel_id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SendMessageRequest'
      responses:
        '201':
          description: Message sent successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Message'
```
