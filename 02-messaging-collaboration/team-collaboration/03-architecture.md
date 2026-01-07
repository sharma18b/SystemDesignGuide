# Team Collaboration Tool - Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Applications                       │
├─────────────┬─────────────┬─────────────┬─────────────────────┤
│ Web App     │ Desktop App │ Mobile App  │ Third-party Apps    │
│ (React/PWA) │ (Electron)  │ (Native)    │ (API/Webhooks)      │
└─────────────┴─────────────┴─────────────┴─────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Load Balancer   │
                    │   (Global CDN)    │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────┼─────────────────────────────┐
│                    API Gateway Layer                      │
├─────────────────────────────┼─────────────────────────────┤
│  ┌─────────────┐  ┌─────────┴─────────┐  ┌─────────────┐ │
│  │ Rate        │  │  Authentication   │  │ Request     │ │
│  │ Limiting    │  │  & Authorization  │  │ Routing     │ │
│  └─────────────┘  └───────────────────┘  └─────────────┘ │
└─────────────────────────────┼─────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────┐
│                   Core Services Layer                     │
├─────────────────────────────┼─────────────────────────────┤
│  ┌─────────────┐  ┌─────────┴─────────┐  ┌─────────────┐ │
│  │ Real-time   │  │  Message Service  │  │ File        │ │
│  │ Service     │  │                   │  │ Service     │ │
│  │ (WebSocket) │  │                   │  │             │ │
│  └─────────────┘  └───────────────────┘  └─────────────┘ │
│                                                          │
│  ┌─────────────┐  ┌───────────────────┐  ┌─────────────┐ │
│  │ User        │  │  Workspace        │  │ Search      │ │
│  │ Service     │  │  Service          │  │ Service     │ │
│  └─────────────┘  └───────────────────┘  └─────────────┘ │
│                                                          │
│  ┌─────────────┐  ┌───────────────────┐  ┌─────────────┐ │
│  │ Integration │  │  Notification     │  │ Analytics   │ │
│  │ Service     │  │  Service          │  │ Service     │ │
│  └─────────────┘  └───────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────┐
│                    Data Layer                             │
├─────────────────────────────┼─────────────────────────────┤
│  ┌─────────────┐  ┌─────────┴─────────┐  ┌─────────────┐ │
│  │ PostgreSQL  │  │     Redis         │  │ Elasticsearch│ │
│  │ (Primary)   │  │   (Cache/RT)      │  │ (Search)    │ │
│  └─────────────┘  └───────────────────┘  └─────────────┘ │
│                                                          │
│  ┌─────────────┐  ┌───────────────────┐  ┌─────────────┐ │
│  │ Object      │  │    Apache Kafka   │  │ Time Series │ │
│  │ Storage     │  │  (Event Stream)   │  │ DB (Metrics)│ │
│  │ (S3/GCS)    │  │                   │  │ (InfluxDB)  │ │
│  └─────────────┘  └───────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Core Services Architecture

### 1. Real-time Service (WebSocket Gateway)
**Purpose**: Handle real-time connections and message broadcasting

```javascript
class RealTimeService {
    constructor() {
        this.connectionManager = new ConnectionManager();
        this.messageRouter = new MessageRouter();
        this.presenceManager = new PresenceManager();
    }
    
    async handleConnection(socket, userId, workspaceId) {
        // Register connection
        await this.connectionManager.addConnection(socket, userId, workspaceId);
        
        // Subscribe to user's channels
        const channels = await this.getUserChannels(userId, workspaceId);
        await this.subscribeToChannels(socket, channels);
        
        // Update presence
        await this.presenceManager.setOnline(userId, workspaceId);
        
        // Send initial state
        await this.sendInitialState(socket, userId, workspaceId);
    }
    
    async broadcastMessage(message, channelId, workspaceId) {
        // Get channel members
        const members = await this.getChannelMembers(channelId);
        
        // Get active connections for members
        const connections = await this.connectionManager.getConnections(
            members, 
            workspaceId
        );
        
        // Broadcast to all connections
        await Promise.all(connections.map(conn => 
            conn.send(JSON.stringify({
                type: 'message',
                data: message
            }))
        ));
        
        // Send push notifications to offline users
        const offlineUsers = members.filter(id => 
            !this.connectionManager.isOnline(id, workspaceId)
        );
        await this.sendPushNotifications(offlineUsers, message);
    }
}
```

### 2. Message Service
**Purpose**: Core messaging functionality and persistence

```javascript
class MessageService {
    constructor() {
        this.messageStore = new MessageStore();
        this.eventPublisher = new EventPublisher();
        this.searchIndexer = new SearchIndexer();
    }
    
    async sendMessage(senderId, channelId, content, messageType = 'text') {
        // Validate permissions
        await this.validateSendPermission(senderId, channelId);
        
        // Create message
        const message = {
            id: this.generateMessageId(),
            senderId: senderId,
            channelId: channelId,
            content: content,
            type: messageType,
            timestamp: new Date(),
            threadId: null,
            reactions: {},
            editHistory: []
        };
        
        // Store message
        await this.messageStore.save(message);
        
        // Index for search
        await this.searchIndexer.indexMessage(message);
        
        // Publish event for real-time delivery
        await this.eventPublisher.publish('message.sent', {
            message: message,
            workspaceId: await this.getWorkspaceId(channelId)
        });
        
        // Process mentions and notifications
        await this.processMentions(message);
        
        return message;
    }
    
    async editMessage(messageId, userId, newContent) {
        const message = await this.messageStore.get(messageId);
        
        // Validate edit permissions
        if (message.senderId !== userId) {
            throw new UnauthorizedError('Cannot edit message');
        }
        
        // Check edit time limit (15 minutes)
        const editDeadline = new Date(message.timestamp.getTime() + 15 * 60 * 1000);
        if (new Date() > editDeadline) {
            throw new ForbiddenError('Edit time limit exceeded');
        }
        
        // Save edit history
        message.editHistory.push({
            content: message.content,
            editedAt: new Date()
        });
        
        // Update content
        message.content = newContent;
        message.editedAt = new Date();
        
        // Save and broadcast update
        await this.messageStore.update(message);
        await this.eventPublisher.publish('message.edited', { message });
        
        return message;
    }
}
```

### 3. File Service
**Purpose**: File upload, storage, and processing

```javascript
class FileService {
    constructor() {
        this.storageProvider = new CloudStorageProvider();
        this.virusScanner = new VirusScanner();
        this.thumbnailGenerator = new ThumbnailGenerator();
        this.contentExtractor = new ContentExtractor();
    }
    
    async uploadFile(userId, workspaceId, file, channelId) {
        // Validate file
        await this.validateFile(file, workspaceId);
        
        // Generate unique file ID and path
        const fileId = this.generateFileId();
        const storagePath = this.generateStoragePath(workspaceId, fileId);
        
        // Create file record
        const fileRecord = {
            id: fileId,
            name: file.name,
            size: file.size,
            mimeType: file.type,
            uploaderId: userId,
            workspaceId: workspaceId,
            channelId: channelId,
            storagePath: storagePath,
            status: 'uploading',
            uploadedAt: new Date()
        };
        
        // Save initial record
        await this.saveFileRecord(fileRecord);
        
        // Upload to storage
        const uploadResult = await this.storageProvider.upload(
            storagePath, 
            file.stream
        );
        
        // Update status
        fileRecord.status = 'processing';
        await this.updateFileRecord(fileRecord);
        
        // Process file asynchronously
        await this.processFileAsync(fileRecord);
        
        return fileRecord;
    }
    
    async processFileAsync(fileRecord) {
        try {
            // Virus scan
            const scanResult = await this.virusScanner.scan(fileRecord.storagePath);
            if (!scanResult.clean) {
                await this.quarantineFile(fileRecord);
                return;
            }
            
            // Generate thumbnails for images/videos
            if (this.isMediaFile(fileRecord.mimeType)) {
                const thumbnails = await this.thumbnailGenerator.generate(
                    fileRecord.storagePath,
                    fileRecord.mimeType
                );
                fileRecord.thumbnails = thumbnails;
            }
            
            // Extract text content for search
            if (this.isTextFile(fileRecord.mimeType)) {
                const textContent = await this.contentExtractor.extract(
                    fileRecord.storagePath
                );
                await this.searchIndexer.indexFile(fileRecord, textContent);
            }
            
            // Update status to ready
            fileRecord.status = 'ready';
            await this.updateFileRecord(fileRecord);
            
            // Notify completion
            await this.eventPublisher.publish('file.processed', { 
                fileRecord 
            });
            
        } catch (error) {
            fileRecord.status = 'error';
            fileRecord.error = error.message;
            await this.updateFileRecord(fileRecord);
        }
    }
}
```

### 4. Search Service
**Purpose**: Full-text search across messages, files, and users

```javascript
class SearchService {
    constructor() {
        this.elasticsearch = new ElasticsearchClient();
        this.indexManager = new IndexManager();
    }
    
    async search(userId, workspaceId, query, filters = {}) {
        // Build search query
        const searchQuery = {
            bool: {
                must: [
                    {
                        multi_match: {
                            query: query,
                            fields: ['content^2', 'filename', 'username'],
                            type: 'best_fields'
                        }
                    },
                    {
                        term: { workspaceId: workspaceId }
                    }
                ],
                filter: []
            }
        };
        
        // Add access control filter
        const accessibleChannels = await this.getUserAccessibleChannels(
            userId, 
            workspaceId
        );
        searchQuery.bool.filter.push({
            terms: { channelId: accessibleChannels }
        });
        
        // Add date filter if specified
        if (filters.dateRange) {
            searchQuery.bool.filter.push({
                range: {
                    timestamp: {
                        gte: filters.dateRange.start,
                        lte: filters.dateRange.end
                    }
                }
            });
        }
        
        // Add type filter (messages, files, users)
        if (filters.type) {
            searchQuery.bool.filter.push({
                term: { type: filters.type }
            });
        }
        
        // Execute search
        const results = await this.elasticsearch.search({
            index: `workspace_${workspaceId}`,
            body: {
                query: searchQuery,
                highlight: {
                    fields: {
                        content: {},
                        filename: {}
                    }
                },
                sort: [
                    { _score: { order: 'desc' } },
                    { timestamp: { order: 'desc' } }
                ],
                size: 50
            }
        });
        
        return this.formatSearchResults(results);
    }
}
```

## Event-Driven Architecture

### Message Flow with Kafka
```
┌─────────────┐    Produce    ┌─────────────┐    Consume    ┌─────────────┐
│   Message   │──────────────►│    Kafka    │──────────────►│  Real-time  │
│   Service   │               │   Cluster   │               │   Service   │
└─────────────┘               └─────────────┘               └─────────────┘
                                     │
                              ┌─────────────┐
                              │ Search      │
                              │ Indexer     │
                              └─────────────┘
                                     │
                              ┌─────────────┐
                              │ Analytics   │
                              │ Service     │
                              └─────────────┘
```

### Event Types and Handlers
```javascript
const eventHandlers = {
    'message.sent': [
        'realtime.broadcast',
        'search.index',
        'analytics.track',
        'notification.process'
    ],
    'message.edited': [
        'realtime.broadcast',
        'search.reindex'
    ],
    'message.deleted': [
        'realtime.broadcast',
        'search.remove'
    ],
    'file.uploaded': [
        'virus.scan',
        'thumbnail.generate',
        'search.index'
    ],
    'user.joined': [
        'realtime.broadcast',
        'analytics.track',
        'notification.welcome'
    ]
};
```

## Microservices Communication

### Service Mesh Architecture
```yaml
# Istio Service Mesh Configuration
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: message-service
spec:
  hosts:
  - message-service
  http:
  - match:
    - uri:
        prefix: "/api/v1/messages"
    route:
    - destination:
        host: message-service
        subset: v1
      weight: 90
    - destination:
        host: message-service
        subset: v2
      weight: 10  # Canary deployment
    timeout: 5s
    retries:
      attempts: 3
      perTryTimeout: 2s
```

### Circuit Breaker Pattern
```javascript
class ServiceClient {
    constructor(serviceName) {
        this.circuitBreaker = new CircuitBreaker({
            timeout: 5000,
            errorThresholdPercentage: 50,
            resetTimeout: 30000
        });
    }
    
    async callService(endpoint, data) {
        return await this.circuitBreaker.fire(async () => {
            const response = await fetch(`${this.serviceUrl}${endpoint}`, {
                method: 'POST',
                body: JSON.stringify(data),
                timeout: 5000
            });
            
            if (!response.ok) {
                throw new Error(`Service call failed: ${response.status}`);
            }
            
            return response.json();
        });
    }
}
```

## Caching Strategy

### Multi-Level Caching
```
┌─────────────┐    L1 Cache    ┌─────────────┐    L2 Cache    ┌─────────────┐
│   Client    │◄──────────────►│ Application │◄──────────────►│    Redis    │
│   (Memory)  │                │   Server    │                │   Cluster   │
└─────────────┘                └─────────────┘                └─────────────┘
                                       │                              │
                                       ▼                              ▼
                               ┌─────────────┐                ┌─────────────┐
                               │ PostgreSQL  │                │ CDN Cache   │
                               │  Database   │                │ (Static)    │
                               └─────────────┘                └─────────────┘
```

### Cache Implementation
```javascript
class CacheManager {
    constructor() {
        this.localCache = new LRUCache({ max: 10000, ttl: 300000 }); // 5 min
        this.redisCache = new RedisClient();
        this.cacheStrategies = {
            'user_profile': { ttl: 3600, strategy: 'write-through' },
            'channel_members': { ttl: 1800, strategy: 'write-behind' },
            'recent_messages': { ttl: 300, strategy: 'cache-aside' }
        };
    }
    
    async get(key, type = 'default') {
        // Try L1 cache first
        let value = this.localCache.get(key);
        if (value) return value;
        
        // Try L2 cache (Redis)
        value = await this.redisCache.get(key);
        if (value) {
            this.localCache.set(key, value);
            return JSON.parse(value);
        }
        
        return null;
    }
    
    async set(key, value, type = 'default') {
        const strategy = this.cacheStrategies[type];
        const ttl = strategy?.ttl || 300;
        
        // Set in L1 cache
        this.localCache.set(key, value);
        
        // Set in L2 cache
        await this.redisCache.setex(key, ttl, JSON.stringify(value));
    }
}
```

## Monitoring and Observability

### Distributed Tracing
```javascript
const opentelemetry = require('@opentelemetry/api');

class MessageService {
    async sendMessage(senderId, channelId, content) {
        const span = opentelemetry.trace.getActiveSpan();
        span?.setAttributes({
            'message.sender_id': senderId,
            'message.channel_id': channelId,
            'message.content_length': content.length
        });
        
        try {
            // Message processing logic
            const message = await this.processMessage(senderId, channelId, content);
            
            span?.setStatus({ code: opentelemetry.SpanStatusCode.OK });
            return message;
        } catch (error) {
            span?.recordException(error);
            span?.setStatus({ 
                code: opentelemetry.SpanStatusCode.ERROR,
                message: error.message 
            });
            throw error;
        }
    }
}
```

### Health Checks and Metrics
```javascript
class HealthCheckService {
    constructor() {
        this.checks = {
            database: new DatabaseHealthCheck(),
            redis: new RedisHealthCheck(),
            kafka: new KafkaHealthCheck(),
            storage: new StorageHealthCheck()
        };
    }
    
    async getHealthStatus() {
        const results = {};
        const promises = Object.entries(this.checks).map(async ([name, check]) => {
            try {
                const result = await Promise.race([
                    check.execute(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), 5000)
                    )
                ]);
                results[name] = { status: 'healthy', ...result };
            } catch (error) {
                results[name] = { status: 'unhealthy', error: error.message };
            }
        });
        
        await Promise.all(promises);
        
        const overallStatus = Object.values(results).every(r => r.status === 'healthy') 
            ? 'healthy' : 'unhealthy';
            
        return { status: overallStatus, checks: results };
    }
}
```
