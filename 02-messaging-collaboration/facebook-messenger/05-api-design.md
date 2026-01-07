# Facebook Messenger - API Design

## API Architecture Overview

### API Design Principles
- **RESTful Design**: Standard HTTP methods and status codes
- **Real-time First**: WebSocket APIs for real-time communication
- **GraphQL Integration**: Flexible data fetching for complex queries
- **Versioning Strategy**: Backward-compatible API evolution
- **Rate Limiting**: Protect against abuse and ensure fair usage
- **Security First**: Authentication, authorization, and data protection

### API Gateway Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │   API Gateway   │    │  Microservices  │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ REST Client │ ├────┤ │ Rate Limit  │ ├────┤ │ User Service│ │
│ └─────────────┘ │    │ │ Auth        │ │    │ └─────────────┘ │
│                 │    │ │ Validation  │ │    │                 │
│ ┌─────────────┐ │    │ │ Routing     │ │    │ ┌─────────────┐ │
│ │ WebSocket   │ ├────┤ │ Monitoring  │ ├────┤ │ Message Svc │ │
│ │ Client      │ │    │ └─────────────┘ │    │ └─────────────┘ │
│ └─────────────┘ │    │                 │    │                 │
│                 │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ ┌─────────────┐ │    │ │ GraphQL     │ ├────┤ │ Media Svc   │ │
│ │ GraphQL     │ ├────┤ │ Gateway     │ │    │ └─────────────┘ │
│ │ Client      │ │    │ └─────────────┘ │    │                 │
│ └─────────────┘ │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Authentication and Authorization APIs

### Authentication Endpoints

#### User Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password",
  "device_id": "device_uuid",
  "device_type": "mobile",
  "platform": "ios"
}

Response:
{
  "access_token": "jwt_access_token",
  "refresh_token": "jwt_refresh_token",
  "expires_in": 3600,
  "user": {
    "user_id": 123456,
    "username": "johndoe",
    "first_name": "John",
    "last_name": "Doe",
    "profile_picture_url": "https://cdn.messenger.com/profiles/123456.jpg"
  }
}
```

#### Token Refresh
```http
POST /api/v1/auth/refresh
Content-Type: application/json
Authorization: Bearer refresh_token

{
  "refresh_token": "jwt_refresh_token"
}

Response:
{
  "access_token": "new_jwt_access_token",
  "expires_in": 3600
}
```

#### OAuth Integration
```http
POST /api/v1/auth/facebook
Content-Type: application/json

{
  "facebook_access_token": "facebook_token",
  "device_id": "device_uuid",
  "device_type": "web"
}

Response:
{
  "access_token": "jwt_access_token",
  "refresh_token": "jwt_refresh_token",
  "expires_in": 3600,
  "is_new_user": false,
  "user": { /* user object */ }
}
```

### Authorization Middleware
```javascript
// JWT Token Validation
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Rate Limiting
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP'
});
```

## REST API Endpoints

### User Management APIs

#### Get User Profile
```http
GET /api/v1/users/{user_id}
Authorization: Bearer jwt_token

Response:
{
  "user_id": 123456,
  "username": "johndoe",
  "first_name": "John",
  "last_name": "Doe",
  "profile_picture_url": "https://cdn.messenger.com/profiles/123456.jpg",
  "status_message": "Available",
  "last_active_at": "2024-01-03T19:30:00Z",
  "privacy_settings": {
    "show_last_seen": true,
    "show_online_status": true
  }
}
```

#### Update User Profile
```http
PUT /api/v1/users/{user_id}
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Smith",
  "status_message": "Busy",
  "privacy_settings": {
    "show_last_seen": false,
    "show_online_status": true
  }
}

Response:
{
  "success": true,
  "user": { /* updated user object */ }
}
```

#### Search Users
```http
GET /api/v1/users/search?q=john&limit=20&offset=0
Authorization: Bearer jwt_token

Response:
{
  "users": [
    {
      "user_id": 123456,
      "username": "johndoe",
      "first_name": "John",
      "last_name": "Doe",
      "profile_picture_url": "https://cdn.messenger.com/profiles/123456.jpg",
      "mutual_friends_count": 5
    }
  ],
  "total_count": 1,
  "has_more": false
}
```

### Conversation Management APIs

#### Get Conversations List
```http
GET /api/v1/conversations?limit=50&cursor=eyJsYXN0X21lc3NhZ2VfYXQiOiIyMDI0LTAxLTAz...
Authorization: Bearer jwt_token

Response:
{
  "conversations": [
    {
      "conversation_id": 1001,
      "conversation_type": "direct",
      "title": null,
      "participants": [
        {
          "user_id": 123456,
          "first_name": "John",
          "last_name": "Doe",
          "profile_picture_url": "https://cdn.messenger.com/profiles/123456.jpg"
        }
      ],
      "last_message": {
        "message_id": "01234567-89ab-cdef-0123-456789abcdef",
        "sender_id": 123456,
        "content": "Hey, how are you?",
        "created_at": "2024-01-03T19:30:00Z",
        "message_type": "text"
      },
      "unread_count": 2,
      "last_read_message_id": "01234567-89ab-cdef-0123-456789abcdef",
      "updated_at": "2024-01-03T19:30:00Z"
    }
  ],
  "next_cursor": "eyJsYXN0X21lc3NhZ2VfYXQiOiIyMDI0LTAxLTAz...",
  "has_more": true
}
```

#### Create Conversation
```http
POST /api/v1/conversations
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "conversation_type": "group",
  "title": "Project Team",
  "participant_ids": [123456, 789012, 345678],
  "description": "Discussion for the new project"
}

Response:
{
  "conversation_id": 1002,
  "conversation_type": "group",
  "title": "Project Team",
  "description": "Discussion for the new project",
  "created_by": 111111,
  "created_at": "2024-01-03T19:30:00Z",
  "participants": [ /* participant objects */ ]
}
```

#### Add/Remove Participants
```http
POST /api/v1/conversations/{conversation_id}/participants
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "action": "add",
  "user_ids": [456789, 987654]
}

Response:
{
  "success": true,
  "added_participants": [
    {
      "user_id": 456789,
      "first_name": "Jane",
      "last_name": "Smith",
      "joined_at": "2024-01-03T19:30:00Z"
    }
  ]
}
```

### Message Management APIs

#### Get Message History
```http
GET /api/v1/conversations/{conversation_id}/messages?limit=50&before=01234567-89ab-cdef-0123-456789abcdef
Authorization: Bearer jwt_token

Response:
{
  "messages": [
    {
      "message_id": "01234567-89ab-cdef-0123-456789abcdef",
      "conversation_id": 1001,
      "sender_id": 123456,
      "message_type": "text",
      "content": "Hello there!",
      "created_at": "2024-01-03T19:30:00Z",
      "updated_at": "2024-01-03T19:30:00Z",
      "delivery_status": "read",
      "reactions": {
        "👍": [123456, 789012],
        "❤️": [345678]
      },
      "reply_to_message_id": null,
      "media_attachments": []
    }
  ],
  "has_more": true,
  "next_cursor": "eyJtZXNzYWdlX2lkIjoiMDEyMzQ1Njc..."
}
```

#### Send Message
```http
POST /api/v1/conversations/{conversation_id}/messages
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "message_type": "text",
  "content": "Hello everyone!",
  "reply_to_message_id": "01234567-89ab-cdef-0123-456789abcdef",
  "client_message_id": "client_generated_uuid"
}

Response:
{
  "message_id": "fedcba98-7654-3210-fedc-ba9876543210",
  "conversation_id": 1001,
  "sender_id": 111111,
  "message_type": "text",
  "content": "Hello everyone!",
  "created_at": "2024-01-03T19:30:00Z",
  "delivery_status": "sent",
  "client_message_id": "client_generated_uuid"
}
```

#### Edit Message
```http
PUT /api/v1/messages/{message_id}
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "content": "Hello everyone! (edited)",
  "edit_reason": "typo_correction"
}

Response:
{
  "success": true,
  "message": {
    "message_id": "fedcba98-7654-3210-fedc-ba9876543210",
    "content": "Hello everyone! (edited)",
    "updated_at": "2024-01-03T19:31:00Z",
    "edit_history": [
      {
        "edited_at": "2024-01-03T19:31:00Z",
        "previous_content": "Hello everyone!",
        "edit_reason": "typo_correction"
      }
    ]
  }
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
    "👍": [111111, 123456],
    "❤️": [789012]
  }
}
```

### Media Upload APIs

#### Upload Media File
```http
POST /api/v1/media/upload
Authorization: Bearer jwt_token
Content-Type: multipart/form-data

file: [binary file data]
conversation_id: 1001
message_type: image

Response:
{
  "file_id": "media_uuid",
  "file_type": "image/jpeg",
  "file_size": 2048576,
  "file_url": "https://cdn.messenger.com/media/media_uuid.jpg",
  "thumbnail_url": "https://cdn.messenger.com/thumbs/media_uuid_thumb.jpg",
  "dimensions": {
    "width": 1920,
    "height": 1080
  },
  "processing_status": "completed"
}
```

#### Send Media Message
```http
POST /api/v1/conversations/{conversation_id}/messages
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "message_type": "image",
  "content": "Check out this photo!",
  "media_attachments": [
    {
      "file_id": "media_uuid",
      "file_type": "image/jpeg",
      "file_url": "https://cdn.messenger.com/media/media_uuid.jpg",
      "thumbnail_url": "https://cdn.messenger.com/thumbs/media_uuid_thumb.jpg"
    }
  ]
}
```

## WebSocket API for Real-time Communication

### WebSocket Connection Flow
```javascript
// Client connection establishment
const ws = new WebSocket('wss://ws.messenger.com/v1/connect');

// Authentication after connection
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'jwt_access_token',
    device_id: 'device_uuid'
  }));
};

// Handle authentication response
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch(message.type) {
    case 'auth_success':
      console.log('Authenticated successfully');
      subscribeToConversations();
      break;
    case 'auth_error':
      console.error('Authentication failed:', message.error);
      break;
  }
};
```

### WebSocket Message Types

#### Subscribe to Conversations
```json
{
  "type": "subscribe",
  "conversation_ids": [1001, 1002, 1003],
  "request_id": "client_request_uuid"
}

Response:
{
  "type": "subscribe_success",
  "request_id": "client_request_uuid",
  "subscribed_conversations": [1001, 1002, 1003]
}
```

#### Send Real-time Message
```json
{
  "type": "send_message",
  "conversation_id": 1001,
  "message_type": "text",
  "content": "Hello in real-time!",
  "client_message_id": "client_uuid",
  "request_id": "request_uuid"
}

Response:
{
  "type": "message_sent",
  "request_id": "request_uuid",
  "message_id": "server_generated_uuid",
  "client_message_id": "client_uuid",
  "timestamp": "2024-01-03T19:30:00Z"
}
```

#### Receive Real-time Message
```json
{
  "type": "new_message",
  "conversation_id": 1001,
  "message": {
    "message_id": "server_generated_uuid",
    "sender_id": 123456,
    "message_type": "text",
    "content": "Hello back!",
    "created_at": "2024-01-03T19:30:00Z",
    "delivery_status": "sent"
  }
}
```

#### Typing Indicators
```json
// Start typing
{
  "type": "typing_start",
  "conversation_id": 1001
}

// Stop typing
{
  "type": "typing_stop",
  "conversation_id": 1001
}

// Receive typing notification
{
  "type": "user_typing",
  "conversation_id": 1001,
  "user_id": 123456,
  "is_typing": true
}
```

#### Presence Updates
```json
// Update presence
{
  "type": "presence_update",
  "status": "online"
}

// Receive presence notification
{
  "type": "presence_changed",
  "user_id": 123456,
  "status": "away",
  "last_seen": "2024-01-03T19:25:00Z"
}
```

#### Message Delivery Receipts
```json
// Mark message as delivered
{
  "type": "message_delivered",
  "message_id": "server_generated_uuid",
  "conversation_id": 1001
}

// Mark message as read
{
  "type": "message_read",
  "message_id": "server_generated_uuid",
  "conversation_id": 1001
}

// Receive delivery status update
{
  "type": "delivery_status_update",
  "message_id": "server_generated_uuid",
  "conversation_id": 1001,
  "user_id": 123456,
  "status": "read",
  "timestamp": "2024-01-03T19:30:00Z"
}
```

## GraphQL API Design

### Schema Definition
```graphql
type User {
  id: ID!
  username: String!
  firstName: String!
  lastName: String!
  profilePictureUrl: String
  statusMessage: String
  lastActiveAt: DateTime
  isOnline: Boolean!
}

type Conversation {
  id: ID!
  type: ConversationType!
  title: String
  participants: [User!]!
  messages(first: Int, after: String): MessageConnection!
  lastMessage: Message
  unreadCount: Int!
  updatedAt: DateTime!
}

type Message {
  id: ID!
  conversationId: ID!
  sender: User!
  type: MessageType!
  content: String
  mediaAttachments: [MediaAttachment!]!
  reactions: [Reaction!]!
  replyTo: Message
  createdAt: DateTime!
  updatedAt: DateTime!
  deliveryStatus: DeliveryStatus!
}

type Query {
  me: User!
  conversations(first: Int, after: String): ConversationConnection!
  conversation(id: ID!): Conversation
  searchUsers(query: String!, first: Int): UserConnection!
  searchMessages(query: String!, conversationId: ID, first: Int): MessageConnection!
}

type Mutation {
  sendMessage(input: SendMessageInput!): SendMessagePayload!
  editMessage(id: ID!, content: String!): EditMessagePayload!
  deleteMessage(id: ID!): DeleteMessagePayload!
  addReaction(messageId: ID!, emoji: String!): AddReactionPayload!
  createConversation(input: CreateConversationInput!): CreateConversationPayload!
  updatePresence(status: PresenceStatus!): UpdatePresencePayload!
}

type Subscription {
  messageAdded(conversationId: ID!): Message!
  messageUpdated(conversationId: ID!): Message!
  presenceChanged(userId: ID!): PresenceUpdate!
  typingIndicator(conversationId: ID!): TypingIndicator!
}
```

### GraphQL Query Examples
```graphql
# Get conversations with recent messages
query GetConversations {
  conversations(first: 20) {
    edges {
      node {
        id
        type
        title
        participants {
          id
          firstName
          lastName
          profilePictureUrl
          isOnline
        }
        lastMessage {
          id
          content
          sender {
            firstName
          }
          createdAt
        }
        unreadCount
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}

# Send a message
mutation SendMessage($input: SendMessageInput!) {
  sendMessage(input: $input) {
    message {
      id
      content
      createdAt
      deliveryStatus
    }
    errors {
      field
      message
    }
  }
}

# Subscribe to new messages
subscription MessageAdded($conversationId: ID!) {
  messageAdded(conversationId: $conversationId) {
    id
    content
    sender {
      id
      firstName
    }
    createdAt
  }
}
```

## Push Notification APIs

### Register Device for Notifications
```http
POST /api/v1/notifications/devices
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "device_token": "apns_or_fcm_token",
  "platform": "ios", // or "android"
  "device_id": "device_uuid",
  "app_version": "1.2.3"
}

Response:
{
  "success": true,
  "device_id": "device_uuid",
  "registered_at": "2024-01-03T19:30:00Z"
}
```

### Update Notification Preferences
```http
PUT /api/v1/notifications/preferences
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "global_notifications": true,
  "message_notifications": true,
  "group_notifications": true,
  "quiet_hours": {
    "enabled": true,
    "start_time": "22:00",
    "end_time": "08:00",
    "timezone": "America/New_York"
  },
  "conversation_preferences": {
    "1001": {
      "notifications_enabled": false
    }
  }
}
```

## Rate Limiting and Error Handling

### Rate Limiting Headers
```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1641234567
X-RateLimit-Window: 900
```

### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "content",
        "message": "Message content cannot be empty"
      }
    ],
    "request_id": "req_uuid",
    "timestamp": "2024-01-03T19:30:00Z"
  }
}
```

### Common HTTP Status Codes
- **200 OK**: Successful request
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request parameters
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error
- **503 Service Unavailable**: Service temporarily unavailable

This comprehensive API design provides a robust foundation for building a scalable messaging platform with real-time capabilities, efficient data fetching, and excellent developer experience.
