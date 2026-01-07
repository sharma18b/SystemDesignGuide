# Video Conferencing System - API Design

## API Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                              │
│  • Authentication & Authorization                           │
│  • Rate Limiting & Throttling                              │
│  • Request/Response Transformation                          │
│  • API Versioning & Routing                                │
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

### Connection Establishment
```javascript
// Client Connection
const socket = io('wss://api.videoconf.com/signaling', {
    auth: {
        token: 'jwt_token_here'
    },
    transports: ['websocket']
});

// Server Response
socket.on('connect', () => {
    console.log('Connected:', socket.id);
});
```

### Signaling Events

#### Join Meeting
```javascript
// Client Request
socket.emit('join_meeting', {
    meeting_id: 'uuid',
    user_info: {
        display_name: 'John Doe',
        avatar_url: 'https://...',
        device_type: 'desktop'
    },
    capabilities: {
        video: true,
        audio: true,
        screen_share: true
    }
});

// Server Response
socket.on('meeting_joined', {
    success: true,
    meeting_info: {
        meeting_id: 'uuid',
        title: 'Team Standup',
        host_id: 'uuid',
        participants: [
            {
                user_id: 'uuid',
                display_name: 'Jane Smith',
                is_muted: false,
                is_video_on: true,
                role: 'host'
            }
        ],
        settings: {
            recording_enabled: true,
            chat_enabled: true,
            screen_share_enabled: true
        }
    },
    your_participant_id: 'uuid'
});
```

#### WebRTC Signaling
```javascript
// Offer/Answer Exchange
socket.emit('webrtc_offer', {
    meeting_id: 'uuid',
    target_participant_id: 'uuid',
    offer: {
        type: 'offer',
        sdp: 'v=0\r\no=- 123456789...'
    }
});

socket.on('webrtc_answer', {
    from_participant_id: 'uuid',
    answer: {
        type: 'answer',
        sdp: 'v=0\r\no=- 987654321...'
    }
});

// ICE Candidates
socket.emit('ice_candidate', {
    meeting_id: 'uuid',
    target_participant_id: 'uuid',
    candidate: {
        candidate: 'candidate:1 1 UDP...',
        sdpMLineIndex: 0,
        sdpMid: 'audio'
    }
});
```

#### Participant State Updates
```javascript
// Mute/Unmute
socket.emit('toggle_audio', {
    meeting_id: 'uuid',
    is_muted: true
});

// Video On/Off
socket.emit('toggle_video', {
    meeting_id: 'uuid', 
    is_video_on: false
});

// Screen Share
socket.emit('start_screen_share', {
    meeting_id: 'uuid',
    screen_info: {
        width: 1920,
        height: 1080,
        frame_rate: 30
    }
});

// Broadcast to all participants
socket.broadcast.to(meeting_id).emit('participant_updated', {
    participant_id: 'uuid',
    display_name: 'John Doe',
    is_muted: true,
    is_video_on: false,
    is_screen_sharing: false
});
```

#### Chat Messages
```javascript
// Send Message
socket.emit('send_chat_message', {
    meeting_id: 'uuid',
    message: {
        type: 'text',
        content: 'Hello everyone!',
        reply_to: null, // Optional: reply to message ID
        is_private: false,
        recipient_id: null // For private messages
    }
});

// Receive Message
socket.on('chat_message_received', {
    message_id: 'uuid',
    sender_id: 'uuid',
    sender_name: 'John Doe',
    content: 'Hello everyone!',
    timestamp: '2024-01-15T10:30:00Z',
    type: 'text',
    is_private: false
});
```

## REST API (HTTP Endpoints)

### Authentication
```http
POST /api/v1/auth/login
Content-Type: application/json

{
    "email": "user@example.com",
    "password": "secure_password"
}

Response:
{
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_in": 3600,
    "user": {
        "user_id": "uuid",
        "email": "user@example.com",
        "display_name": "John Doe"
    }
}
```

### Meeting Management

#### Create Meeting
```http
POST /api/v1/meetings
Authorization: Bearer jwt_token
Content-Type: application/json

{
    "title": "Team Standup",
    "description": "Daily team sync",
    "scheduled_start_time": "2024-01-15T10:00:00Z",
    "scheduled_end_time": "2024-01-15T10:30:00Z",
    "settings": {
        "max_participants": 50,
        "require_password": true,
        "password": "meeting123",
        "waiting_room_enabled": true,
        "recording_enabled": false,
        "auto_record": false
    }
}

Response:
{
    "meeting_id": "uuid",
    "title": "Team Standup",
    "host_user_id": "uuid",
    "join_url": "https://videoconf.com/join/uuid",
    "meeting_number": "123-456-789",
    "created_at": "2024-01-15T09:00:00Z"
}
```

#### Get Meeting Details
```http
GET /api/v1/meetings/{meeting_id}
Authorization: Bearer jwt_token

Response:
{
    "meeting_id": "uuid",
    "title": "Team Standup",
    "description": "Daily team sync",
    "host_user_id": "uuid",
    "status": "scheduled",
    "scheduled_start_time": "2024-01-15T10:00:00Z",
    "scheduled_end_time": "2024-01-15T10:30:00Z",
    "actual_start_time": null,
    "actual_end_time": null,
    "participants": [
        {
            "user_id": "uuid",
            "display_name": "Jane Smith",
            "email": "jane@example.com",
            "role": "co-host",
            "status": "invited"
        }
    ],
    "settings": {
        "max_participants": 50,
        "require_password": true,
        "waiting_room_enabled": true,
        "recording_enabled": false
    }
}
```

#### List User Meetings
```http
GET /api/v1/users/me/meetings?status=scheduled&limit=20&offset=0
Authorization: Bearer jwt_token

Response:
{
    "meetings": [
        {
            "meeting_id": "uuid",
            "title": "Team Standup",
            "scheduled_start_time": "2024-01-15T10:00:00Z",
            "status": "scheduled",
            "participant_count": 5,
            "role": "host"
        }
    ],
    "total_count": 45,
    "has_more": true
}
```

### Recording Management

#### List Recordings
```http
GET /api/v1/recordings?meeting_id=uuid&limit=10
Authorization: Bearer jwt_token

Response:
{
    "recordings": [
        {
            "recording_id": "uuid",
            "meeting_id": "uuid",
            "title": "Team Standup - Jan 15",
            "duration_seconds": 1800,
            "file_size_bytes": 157286400,
            "processing_status": "completed",
            "created_at": "2024-01-15T10:30:00Z",
            "download_url": "https://recordings.videoconf.com/uuid",
            "thumbnail_url": "https://thumbnails.videoconf.com/uuid.jpg"
        }
    ]
}
```

#### Download Recording
```http
GET /api/v1/recordings/{recording_id}/download
Authorization: Bearer jwt_token

Response:
302 Redirect to signed URL
Location: https://s3.amazonaws.com/recordings/uuid?signature=...
```

### User Management

#### Get User Profile
```http
GET /api/v1/users/me
Authorization: Bearer jwt_token

Response:
{
    "user_id": "uuid",
    "email": "user@example.com",
    "username": "johndoe",
    "display_name": "John Doe",
    "avatar_url": "https://avatars.videoconf.com/uuid.jpg",
    "timezone": "America/New_York",
    "language": "en",
    "account_type": "pro",
    "settings": {
        "default_mute_on_join": false,
        "default_video_on_join": true,
        "notification_preferences": {
            "email_reminders": true,
            "push_notifications": true
        }
    }
}
```

#### Update User Settings
```http
PATCH /api/v1/users/me
Authorization: Bearer jwt_token
Content-Type: application/json

{
    "display_name": "John Smith",
    "timezone": "America/Los_Angeles",
    "settings": {
        "default_mute_on_join": true,
        "notification_preferences": {
            "email_reminders": false
        }
    }
}
```

## GraphQL API (Flexible Queries)

### Schema Definition
```graphql
type User {
    id: ID!
    email: String!
    displayName: String!
    avatarUrl: String
    timezone: String!
    meetings(status: MeetingStatus, limit: Int, offset: Int): [Meeting!]!
    recordings(limit: Int, offset: Int): [Recording!]!
}

type Meeting {
    id: ID!
    title: String!
    description: String
    hostUser: User!
    status: MeetingStatus!
    scheduledStartTime: DateTime
    scheduledEndTime: DateTime
    actualStartTime: DateTime
    actualEndTime: DateTime
    participants: [Participant!]!
    recordings: [Recording!]!
    chatMessages(limit: Int, offset: Int): [ChatMessage!]!
}

type Participant {
    id: ID!
    user: User
    displayName: String!
    role: ParticipantRole!
    joinedAt: DateTime
    leftAt: DateTime
    isMuted: Boolean!
    isVideoOn: Boolean!
    isScreenSharing: Boolean!
}

type Recording {
    id: ID!
    meeting: Meeting!
    title: String!
    durationSeconds: Int!
    fileSizeBytes: Int!
    processingStatus: ProcessingStatus!
    downloadUrl: String
    thumbnailUrl: String
    createdAt: DateTime!
}

enum MeetingStatus {
    SCHEDULED
    ACTIVE  
    ENDED
    CANCELLED
}

enum ParticipantRole {
    HOST
    CO_HOST
    PARTICIPANT
    VIEWER
}
```

### Example Queries
```graphql
# Get user with upcoming meetings
query GetUserDashboard($userId: ID!) {
    user(id: $userId) {
        displayName
        meetings(status: SCHEDULED, limit: 5) {
            id
            title
            scheduledStartTime
            participants {
                displayName
                role
            }
        }
        recordings(limit: 3) {
            id
            title
            durationSeconds
            createdAt
        }
    }
}

# Get meeting details with participants and chat
query GetMeetingDetails($meetingId: ID!) {
    meeting(id: $meetingId) {
        title
        status
        hostUser {
            displayName
        }
        participants {
            displayName
            role
            isMuted
            isVideoOn
        }
        chatMessages(limit: 50) {
            content
            senderName
            timestamp
        }
    }
}
```

## API Rate Limiting

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642248000
X-RateLimit-Retry-After: 60
```

### Rate Limit Tiers
```yaml
# Per User Limits (per hour)
Basic Account:
  - API Calls: 1,000/hour
  - Meeting Creation: 10/hour
  - Recording Downloads: 50/hour

Pro Account:
  - API Calls: 10,000/hour
  - Meeting Creation: 100/hour
  - Recording Downloads: 500/hour

Enterprise Account:
  - API Calls: 100,000/hour
  - Meeting Creation: 1,000/hour
  - Recording Downloads: Unlimited
```

## Error Handling

### Standard Error Response
```json
{
    "error": {
        "code": "MEETING_NOT_FOUND",
        "message": "The specified meeting could not be found",
        "details": {
            "meeting_id": "invalid-uuid",
            "timestamp": "2024-01-15T10:30:00Z"
        },
        "request_id": "req_123456789"
    }
}
```

### Common Error Codes
```yaml
Authentication Errors:
  - INVALID_TOKEN: JWT token is invalid or expired
  - INSUFFICIENT_PERMISSIONS: User lacks required permissions
  - ACCOUNT_SUSPENDED: User account is suspended

Meeting Errors:
  - MEETING_NOT_FOUND: Meeting ID does not exist
  - MEETING_FULL: Meeting has reached participant limit
  - MEETING_ENDED: Cannot join ended meeting
  - INVALID_PASSWORD: Incorrect meeting password

WebRTC Errors:
  - SIGNALING_FAILED: WebRTC signaling error
  - MEDIA_FAILED: Media stream establishment failed
  - ICE_FAILED: ICE candidate exchange failed
  - PEER_CONNECTION_FAILED: Peer connection establishment failed

Rate Limiting:
  - RATE_LIMIT_EXCEEDED: API rate limit exceeded
  - QUOTA_EXCEEDED: Account quota exceeded
```

## API Versioning Strategy

### URL Versioning
```http
GET /api/v1/meetings/{id}  # Current version
GET /api/v2/meetings/{id}  # New version with breaking changes
```

### Header Versioning
```http
GET /api/meetings/{id}
Accept: application/vnd.videoconf.v1+json
```

### Backward Compatibility
- Maintain v1 API for 2 years after v2 release
- Gradual migration with deprecation warnings
- Feature flags for new functionality
- Client SDK automatic version handling

## SDK Examples

### JavaScript SDK
```javascript
import VideoConfSDK from '@videoconf/sdk';

const client = new VideoConfSDK({
    apiKey: 'your_api_key',
    baseUrl: 'https://api.videoconf.com'
});

// Create meeting
const meeting = await client.meetings.create({
    title: 'Team Standup',
    scheduledStartTime: new Date('2024-01-15T10:00:00Z')
});

// Join meeting with WebRTC
const session = await client.join(meeting.id, {
    displayName: 'John Doe',
    video: true,
    audio: true
});

session.on('participant_joined', (participant) => {
    console.log(`${participant.displayName} joined`);
});
```

### Python SDK
```python
from videoconf_sdk import VideoConfClient

client = VideoConfClient(api_key='your_api_key')

# Create meeting
meeting = client.meetings.create(
    title='Team Standup',
    scheduled_start_time='2024-01-15T10:00:00Z'
)

# List recordings
recordings = client.recordings.list(meeting_id=meeting.id)
```
