# API Design - Live Comment System

## API Architecture Overview

### Multi-Protocol API Strategy

The live comment system employs multiple API protocols optimized for different use cases:

```
API Protocol Distribution:
├── WebSocket API (Real-time Communication)
│   ├── Comment submission and delivery
│   ├── Live presence updates
│   └── Real-time moderation actions
├── REST API (Standard Operations)
│   ├── Authentication and user management
│   ├── Event management and configuration
│   └── Historical data retrieval
├── GraphQL API (Flexible Queries)
│   ├── Complex comment thread queries
│   ├── User profile and analytics data
│   └── Admin dashboard operations
└── gRPC API (Internal Services)
    ├── High-performance service communication
    ├── Content moderation pipeline
    └── Analytics data processing
```

## WebSocket API Design

### Connection Management

**WebSocket Connection Flow**:
```javascript
// WebSocket connection establishment
class LiveCommentWebSocket {
    constructor(eventId, authToken) {
        this.eventId = eventId;
        this.authToken = authToken;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.heartbeatInterval = 30000; // 30 seconds
    }
    
    connect() {
        const wsUrl = `wss://api.livecomments.com/ws/events/${this.eventId}`;
        
        this.ws = new WebSocket(wsUrl, ['live-comments-v1'], {
            headers: {
                'Authorization': `Bearer ${this.authToken}`,
                'X-Client-Version': '1.0.0',
                'X-Client-Platform': 'web'
            }
        });
        
        this.setupEventHandlers();
        this.startHeartbeat();
    }
    
    setupEventHandlers() {
        this.ws.onopen = (event) => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
            this.sendMessage({
                type: 'subscribe',
                payload: {
                    event_id: this.eventId,
                    subscription_types: ['comments', 'moderation', 'presence']
                }
            });
        };
        
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleIncomingMessage(message);
        };
        
        this.ws.onclose = (event) => {
            console.log('WebSocket disconnected:', event.code, event.reason);
            this.handleReconnection();
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
}
```

**Message Protocol Specification**:
```json
{
  "websocket_message_format": {
    "outbound_messages": {
      "comment_submission": {
        "type": "comment_submit",
        "message_id": "uuid",
        "timestamp": "iso8601",
        "payload": {
          "event_id": "uuid",
          "content": "string",
          "parent_comment_id": "uuid|null",
          "client_metadata": {
            "platform": "web|mobile|desktop",
            "version": "string",
            "user_agent": "string"
          }
        }
      },
      "presence_update": {
        "type": "presence_update",
        "message_id": "uuid",
        "timestamp": "iso8601",
        "payload": {
          "status": "active|away|typing",
          "last_activity": "iso8601"
        }
      }
    },
    "inbound_messages": {
      "comment_broadcast": {
        "type": "comment_broadcast",
        "message_id": "uuid",
        "timestamp": "iso8601",
        "payload": {
          "comment_id": "uuid",
          "event_id": "uuid",
          "user": {
            "user_id": "uuid",
            "username": "string",
            "display_name": "string",
            "avatar_url": "string"
          },
          "content": "string",
          "parent_comment_id": "uuid|null",
          "created_at": "iso8601",
          "like_count": "integer",
          "reply_count": "integer"
        }
      },
      "moderation_action": {
        "type": "moderation_action",
        "message_id": "uuid",
        "timestamp": "iso8601",
        "payload": {
          "comment_id": "uuid",
          "action": "approved|blocked|flagged",
          "reason": "string|null",
          "moderator_id": "uuid|null"
        }
      }
    }
  }
}
```

### Real-Time Event Handling

**WebSocket Event Processing**:
```python
class WebSocketEventHandler:
    def __init__(self, redis_client, kafka_producer):
        self.redis = redis_client
        self.kafka = kafka_producer
        self.rate_limiter = RateLimiter()
        
    async def handle_comment_submission(self, websocket, message):
        """
        Handle incoming comment submission via WebSocket
        """
        try:
            # Rate limiting check
            user_id = websocket.user_id
            if not await self.rate_limiter.check_rate_limit(user_id, 'comment_submit'):
                await self.send_error(websocket, 'RATE_LIMIT_EXCEEDED', 
                                    'Too many comments submitted')
                return
            
            # Validate message format
            validation_result = await self.validate_comment_message(message)
            if not validation_result.is_valid:
                await self.send_error(websocket, 'INVALID_MESSAGE', 
                                    validation_result.error)
                return
            
            # Process comment submission
            comment_data = {
                'comment_id': str(uuid.uuid4()),
                'event_id': message['payload']['event_id'],
                'user_id': user_id,
                'content': message['payload']['content'],
                'parent_comment_id': message['payload'].get('parent_comment_id'),
                'timestamp': datetime.utcnow().isoformat(),
                'client_metadata': message['payload'].get('client_metadata', {})
            }
            
            # Publish to Kafka for processing pipeline
            await self.kafka.send('comment_submissions', comment_data)
            
            # Send acknowledgment
            await self.send_acknowledgment(websocket, message['message_id'])
            
        except Exception as e:
            await self.send_error(websocket, 'PROCESSING_ERROR', str(e))
    
    async def broadcast_comment_to_subscribers(self, event_id, comment_data):
        """
        Broadcast comment to all subscribers of an event
        """
        # Get all WebSocket connections for this event
        subscriber_key = f"event:{event_id}:subscribers"
        subscribers = await self.redis.smembers(subscriber_key)
        
        broadcast_message = {
            'type': 'comment_broadcast',
            'message_id': str(uuid.uuid4()),
            'timestamp': datetime.utcnow().isoformat(),
            'payload': comment_data
        }
        
        # Broadcast to all subscribers
        broadcast_tasks = []
        for subscriber_id in subscribers:
            connection = self.get_websocket_connection(subscriber_id)
            if connection and connection.is_active:
                task = asyncio.create_task(
                    connection.send_json(broadcast_message)
                )
                broadcast_tasks.append(task)
        
        # Wait for all broadcasts to complete
        if broadcast_tasks:
            await asyncio.gather(*broadcast_tasks, return_exceptions=True)
```

## REST API Design

### Authentication and Authorization

**JWT-Based Authentication**:
```python
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import jwt
from datetime import datetime, timedelta

app = FastAPI(title="Live Comment System API", version="1.0.0")
security = HTTPBearer()

class AuthTokens(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class LoginRequest(BaseModel):
    username: str
    password: str

class UserProfile(BaseModel):
    user_id: str
    username: str
    display_name: str
    email: str
    avatar_url: str
    reputation_score: int
    account_status: str
    created_at: datetime

@app.post("/auth/login", response_model=AuthTokens)
async def login(login_data: LoginRequest):
    """
    Authenticate user and return JWT tokens
    """
    # Validate credentials
    user = await authenticate_user(login_data.username, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Generate tokens
    access_token = create_access_token(user.user_id)
    refresh_token = create_refresh_token(user.user_id)
    
    return AuthTokens(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=3600  # 1 hour
    )

@app.post("/auth/refresh", response_model=AuthTokens)
async def refresh_token(refresh_token: str):
    """
    Refresh access token using refresh token
    """
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Generate new access token
        new_access_token = create_access_token(user_id)
        
        return AuthTokens(
            access_token=new_access_token,
            refresh_token=refresh_token,  # Keep same refresh token
            expires_in=3600
        )
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Extract and validate current user from JWT token
    """
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

### Comment Management Endpoints

**Comment CRUD Operations**:
```python
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

class CommentCreate(BaseModel):
    event_id: str
    content: str = Field(..., min_length=1, max_length=2000)
    parent_comment_id: Optional[str] = None

class CommentResponse(BaseModel):
    comment_id: str
    event_id: str
    user: UserProfile
    content: str
    parent_comment_id: Optional[str]
    reply_count: int
    like_count: int
    created_at: datetime
    updated_at: datetime
    moderation_status: str

class CommentListResponse(BaseModel):
    comments: List[CommentResponse]
    total_count: int
    has_more: bool
    next_cursor: Optional[str]

@app.post("/events/{event_id}/comments", response_model=CommentResponse)
async def create_comment(
    event_id: str,
    comment_data: CommentCreate,
    current_user: UserProfile = Depends(get_current_user)
):
    """
    Create a new comment for an event
    """
    # Validate event exists and is active
    event = await get_event_by_id(event_id)
    if not event or event.status != 'live':
        raise HTTPException(status_code=404, detail="Event not found or not active")
    
    # Check user permissions
    if not await can_user_comment_on_event(current_user.user_id, event_id):
        raise HTTPException(status_code=403, detail="Not authorized to comment")
    
    # Rate limiting
    if not await check_comment_rate_limit(current_user.user_id):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    # Create comment
    comment = await create_comment_in_db({
        'event_id': event_id,
        'user_id': current_user.user_id,
        'content': comment_data.content,
        'parent_comment_id': comment_data.parent_comment_id
    })
    
    # Trigger real-time broadcast
    await broadcast_comment_via_websocket(comment)
    
    return CommentResponse(**comment)

@app.get("/events/{event_id}/comments", response_model=CommentListResponse)
async def get_event_comments(
    event_id: str,
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[str] = None,
    sort_by: str = Query("newest", regex="^(newest|oldest|popular)$"),
    current_user: Optional[UserProfile] = Depends(get_current_user)
):
    """
    Get comments for an event with pagination
    """
    # Validate event access
    if not await can_user_view_event(current_user.user_id if current_user else None, event_id):
        raise HTTPException(status_code=403, detail="Not authorized to view comments")
    
    # Build query parameters
    query_params = {
        'event_id': event_id,
        'limit': limit,
        'cursor': cursor,
        'sort_by': sort_by
    }
    
    # Get comments from database
    comments_result = await get_comments_paginated(query_params)
    
    return CommentListResponse(
        comments=[CommentResponse(**comment) for comment in comments_result.comments],
        total_count=comments_result.total_count,
        has_more=comments_result.has_more,
        next_cursor=comments_result.next_cursor
    )

@app.put("/comments/{comment_id}/like")
async def like_comment(
    comment_id: str,
    current_user: UserProfile = Depends(get_current_user)
):
    """
    Like or unlike a comment
    """
    # Check if comment exists
    comment = await get_comment_by_id(comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Toggle like status
    like_result = await toggle_comment_like(comment_id, current_user.user_id)
    
    # Broadcast like update via WebSocket
    await broadcast_like_update(comment_id, like_result.new_like_count)
    
    return {"liked": like_result.is_liked, "like_count": like_result.new_like_count}

@app.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: str,
    current_user: UserProfile = Depends(get_current_user)
):
    """
    Delete a comment (soft delete)
    """
    comment = await get_comment_by_id(comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check permissions (owner or moderator)
    if not await can_user_delete_comment(current_user.user_id, comment):
        raise HTTPException(status_code=403, detail="Not authorized to delete comment")
    
    # Soft delete comment
    await soft_delete_comment(comment_id, current_user.user_id)
    
    # Broadcast deletion via WebSocket
    await broadcast_comment_deletion(comment_id)
    
    return {"message": "Comment deleted successfully"}
```

### Event Management Endpoints

**Event CRUD and Configuration**:
```python
class EventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    event_type: str = Field(..., regex="^(sports|news|entertainment|gaming)$")
    start_time: datetime
    end_time: Optional[datetime] = None
    max_participants: Optional[int] = Field(None, ge=1)
    moderation_level: str = Field("standard", regex="^(strict|standard|relaxed)$")
    comment_settings: Optional[dict] = {}

class EventResponse(BaseModel):
    event_id: str
    title: str
    description: Optional[str]
    event_type: str
    status: str
    start_time: datetime
    end_time: Optional[datetime]
    participant_count: int
    comment_count: int
    created_by: UserProfile
    created_at: datetime

@app.post("/events", response_model=EventResponse)
async def create_event(
    event_data: EventCreate,
    current_user: UserProfile = Depends(get_current_user)
):
    """
    Create a new live event
    """
    # Check user permissions to create events
    if not await can_user_create_events(current_user.user_id):
        raise HTTPException(status_code=403, detail="Not authorized to create events")
    
    # Validate event timing
    if event_data.end_time and event_data.end_time <= event_data.start_time:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    
    # Create event
    event = await create_event_in_db({
        **event_data.dict(),
        'created_by': current_user.user_id,
        'status': 'scheduled'
    })
    
    return EventResponse(**event)

@app.get("/events/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: str,
    current_user: Optional[UserProfile] = Depends(get_current_user)
):
    """
    Get event details
    """
    event = await get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check access permissions
    if not await can_user_view_event(current_user.user_id if current_user else None, event_id):
        raise HTTPException(status_code=403, detail="Not authorized to view event")
    
    return EventResponse(**event)

@app.put("/events/{event_id}/status")
async def update_event_status(
    event_id: str,
    status: str = Body(..., regex="^(scheduled|live|ended|cancelled)$"),
    current_user: UserProfile = Depends(get_current_user)
):
    """
    Update event status (start/stop live commenting)
    """
    event = await get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check permissions
    if not await can_user_manage_event(current_user.user_id, event_id):
        raise HTTPException(status_code=403, detail="Not authorized to manage event")
    
    # Update status
    await update_event_status_in_db(event_id, status)
    
    # Broadcast status change to all participants
    await broadcast_event_status_change(event_id, status)
    
    return {"message": f"Event status updated to {status}"}
```

This API design provides a comprehensive foundation for the live comment system with proper authentication, real-time capabilities, and scalable REST endpoints.
