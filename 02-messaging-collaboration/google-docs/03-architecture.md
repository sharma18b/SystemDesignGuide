# Google Docs - Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Applications                       │
├─────────────┬─────────────┬─────────────┬─────────────────────┤
│ Web App     │ Mobile App  │ Desktop App │ API Clients         │
│ (React/PWA) │ (Native)    │ (Electron)  │ (Third-party)       │
└─────────────┴─────────────┴─────────────┴─────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Global CDN      │
                    │   (Edge Caching)  │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────┼─────────────────────────────┐
│                    API Gateway Layer                      │
├─────────────────────────────┼─────────────────────────────┤
│  ┌─────────────┐  ┌─────────┴─────────┐  ┌─────────────┐ │
│  │ Load        │  │  Authentication   │  │ Rate        │ │
│  │ Balancer    │  │  & Authorization  │  │ Limiting    │ │
│  └─────────────┘  └───────────────────┘  └─────────────┘ │
└─────────────────────────────┼─────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────┐
│                   Core Services Layer                     │
├─────────────────────────────┼─────────────────────────────┤
│  ┌─────────────┐  ┌─────────┴─────────┐  ┌─────────────┐ │
│  │ Real-time   │  │  Document         │  │ Operational │ │
│  │ Sync        │  │  Service          │  │ Transform   │ │
│  │ Service     │  │                   │  │ Service     │ │
│  └─────────────┘  └───────────────────┘  └─────────────┘ │
│                                                          │
│  ┌─────────────┐  ┌───────────────────┐  ┌─────────────┐ │
│  │ User        │  │  Collaboration    │  │ Version     │ │
│  │ Service     │  │  Service          │  │ Control     │ │
│  └─────────────┘  └───────────────────┘  └─────────────┘ │
│                                                          │
│  ┌─────────────┐  ┌───────────────────┐  ┌─────────────┐ │
│  │ Export      │  │  Search           │  │ Notification│ │
│  │ Service     │  │  Service          │  │ Service     │ │
│  └─────────────┘  └───────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────┐
│                    Data Layer                             │
├─────────────────────────────┼─────────────────────────────┤
│  ┌─────────────┐  ┌─────────┴─────────┐  ┌─────────────┐ │
│  │ Spanner     │  │     Redis         │  │ Bigtable    │ │
│  │ (Documents) │  │   (Real-time)     │  │ (Revisions) │ │
│  └─────────────┘  └───────────────────┘  └─────────────┘ │
│                                                          │
│  ┌─────────────┐  ┌───────────────────┐  ┌─────────────┐ │
│  │ Cloud       │  │    Pub/Sub        │  │ Elasticsearch│ │
│  │ Storage     │  │  (Event Stream)   │  │ (Search)    │ │
│  │ (Files)     │  │                   │  │             │ │
│  └─────────────┘  └───────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Core Services Architecture

### 1. Document Service
**Purpose**: Core document management and CRUD operations

```javascript
class DocumentService {
    constructor() {
        this.documentStore = new SpannerDocumentStore();
        this.versionControl = new VersionControlService();
        this.accessControl = new AccessControlService();
    }
    
    async createDocument(userId, documentData) {
        // Validate user permissions
        await this.accessControl.validateCreatePermission(userId);
        
        // Create document with initial content
        const document = {
            id: this.generateDocumentId(),
            title: documentData.title || 'Untitled Document',
            content: documentData.content || this.getEmptyDocumentContent(),
            ownerId: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
            collaborators: [userId],
            settings: {
                permissions: 'private',
                commentingEnabled: true,
                suggestionsEnabled: true
            }
        };
        
        // Store document
        await this.documentStore.create(document);
        
        // Initialize version control
        await this.versionControl.initializeDocument(document.id, document.content);
        
        // Create initial revision
        await this.createRevision(document.id, {
            type: 'document_created',
            userId: userId,
            content: document.content,
            timestamp: new Date()
        });
        
        return document;
    }
    
    async getDocument(documentId, userId) {
        // Check access permissions
        await this.accessControl.validateReadPermission(documentId, userId);
        
        // Get document from cache or database
        let document = await this.documentStore.getFromCache(documentId);
        if (!document) {
            document = await this.documentStore.get(documentId);
            await this.documentStore.setCache(documentId, document);
        }
        
        // Get current operational transform state
        const otState = await this.getOTState(documentId);
        
        // Merge any pending operations
        if (otState.pendingOperations.length > 0) {
            document.content = await this.applyPendingOperations(
                document.content, 
                otState.pendingOperations
            );
        }
        
        return {
            ...document,
            currentVersion: otState.version,
            collaborators: await this.getActiveCollaborators(documentId)
        };
    }
}
```

### 2. Operational Transform Service
**Purpose**: Handle real-time collaborative editing with conflict resolution

```javascript
class OperationalTransformService {
    constructor() {
        this.operationQueue = new OperationQueue();
        this.transformEngine = new TransformEngine();
        this.stateManager = new DocumentStateManager();
    }
    
    async processOperation(documentId, operation, clientId) {
        // Validate operation
        const validationResult = await this.validateOperation(operation);
        if (!validationResult.valid) {
            throw new Error(`Invalid operation: ${validationResult.error}`);
        }
        
        // Get current document state
        const documentState = await this.stateManager.getState(documentId);
        
        // Transform operation against concurrent operations
        const transformedOperation = await this.transformEngine.transform(
            operation,
            documentState.pendingOperations,
            documentState.version
        );
        
        // Apply operation to document
        const newContent = await this.applyOperation(
            documentState.content,
            transformedOperation
        );
        
        // Update document state
        const newState = {
            content: newContent,
            version: documentState.version + 1,
            lastModified: new Date(),
            pendingOperations: []
        };
        
        await this.stateManager.updateState(documentId, newState);
        
        // Broadcast operation to all connected clients
        await this.broadcastOperation(documentId, transformedOperation, clientId);
        
        // Store operation for history
        await this.storeOperation(documentId, transformedOperation);
        
        return {
            success: true,
            transformedOperation: transformedOperation,
            newVersion: newState.version
        };
    }
    
    async transformOperation(operation, concurrentOps, baseVersion) {
        let transformedOp = { ...operation };
        
        // Transform against each concurrent operation
        for (const concurrentOp of concurrentOps) {
            if (concurrentOp.version > baseVersion) {
                transformedOp = await this.transformPair(transformedOp, concurrentOp);
            }
        }
        
        return transformedOp;
    }
    
    async transformPair(op1, op2) {
        // Handle different operation type combinations
        if (op1.type === 'insert' && op2.type === 'insert') {
            return this.transformInsertInsert(op1, op2);
        } else if (op1.type === 'insert' && op2.type === 'delete') {
            return this.transformInsertDelete(op1, op2);
        } else if (op1.type === 'delete' && op2.type === 'insert') {
            return this.transformDeleteInsert(op1, op2);
        } else if (op1.type === 'delete' && op2.type === 'delete') {
            return this.transformDeleteDelete(op1, op2);
        } else if (op1.type === 'format' || op2.type === 'format') {
            return this.transformFormatOperation(op1, op2);
        }
        
        return op1; // No transformation needed
    }
    
    transformInsertInsert(op1, op2) {
        // If op2 is inserted before op1's position, adjust op1's position
        if (op2.position <= op1.position) {
            return {
                ...op1,
                position: op1.position + op2.content.length
            };
        }
        return op1;
    }
    
    transformInsertDelete(op1, op2) {
        // If deletion is before insertion, adjust insertion position
        if (op2.position + op2.length <= op1.position) {
            return {
                ...op1,
                position: op1.position - op2.length
            };
        }
        // If deletion overlaps with insertion position
        else if (op2.position < op1.position) {
            return {
                ...op1,
                position: op2.position
            };
        }
        return op1;
    }
}
```

### 3. Real-time Sync Service
**Purpose**: WebSocket management and real-time synchronization

```javascript
class RealTimeSyncService {
    constructor() {
        this.connectionManager = new WebSocketConnectionManager();
        this.presenceManager = new PresenceManager();
        this.cursorManager = new CursorManager();
        this.pubsub = new PubSubService();
    }
    
    async handleConnection(socket, userId, documentId) {
        // Authenticate and authorize
        const authResult = await this.authenticateConnection(socket, userId);
        if (!authResult.valid) {
            socket.close(1008, 'Authentication failed');
            return;
        }
        
        // Check document access
        const hasAccess = await this.checkDocumentAccess(userId, documentId);
        if (!hasAccess) {
            socket.close(1008, 'Access denied');
            return;
        }
        
        // Register connection
        await this.connectionManager.addConnection(socket, userId, documentId);
        
        // Subscribe to document events
        await this.pubsub.subscribe(`document:${documentId}`, (event) => {
            this.handleDocumentEvent(socket, event);
        });
        
        // Update presence
        await this.presenceManager.userJoined(documentId, userId);
        
        // Send initial document state
        const documentState = await this.getDocumentState(documentId);
        socket.send(JSON.stringify({
            type: 'document_state',
            data: documentState
        }));
        
        // Send current collaborators
        const collaborators = await this.presenceManager.getCollaborators(documentId);
        socket.send(JSON.stringify({
            type: 'collaborators',
            data: collaborators
        }));
        
        // Handle incoming messages
        socket.on('message', (message) => {
            this.handleMessage(socket, userId, documentId, message);
        });
        
        // Handle disconnection
        socket.on('close', () => {
            this.handleDisconnection(userId, documentId);
        });
    }
    
    async handleMessage(socket, userId, documentId, message) {
        const data = JSON.parse(message);
        
        switch (data.type) {
            case 'operation':
                await this.handleOperation(documentId, data.operation, userId);
                break;
                
            case 'cursor_update':
                await this.handleCursorUpdate(documentId, userId, data.cursor);
                break;
                
            case 'selection_update':
                await this.handleSelectionUpdate(documentId, userId, data.selection);
                break;
                
            case 'typing_start':
                await this.handleTypingStart(documentId, userId);
                break;
                
            case 'typing_stop':
                await this.handleTypingStop(documentId, userId);
                break;
                
            case 'comment':
                await this.handleComment(documentId, userId, data.comment);
                break;
                
            case 'suggestion':
                await this.handleSuggestion(documentId, userId, data.suggestion);
                break;
        }
    }
    
    async broadcastToDocument(documentId, event, excludeUserId = null) {
        const connections = await this.connectionManager.getDocumentConnections(documentId);
        
        const message = JSON.stringify(event);
        
        for (const connection of connections) {
            if (excludeUserId && connection.userId === excludeUserId) {
                continue;
            }
            
            if (connection.socket.readyState === WebSocket.OPEN) {
                connection.socket.send(message);
            }
        }
    }
}
```

### 4. Version Control Service
**Purpose**: Document versioning and revision history

```javascript
class VersionControlService {
    constructor() {
        this.revisionStore = new BigtableRevisionStore();
        this.diffEngine = new DiffEngine();
        this.compressionService = new CompressionService();
    }
    
    async createRevision(documentId, revisionData) {
        const revision = {
            id: this.generateRevisionId(),
            documentId: documentId,
            version: revisionData.version,
            userId: revisionData.userId,
            timestamp: new Date(),
            operations: revisionData.operations,
            content: revisionData.content,
            changeType: revisionData.changeType,
            description: revisionData.description
        };
        
        // Calculate diff from previous version
        const previousRevision = await this.getLatestRevision(documentId);
        if (previousRevision) {
            revision.diff = await this.diffEngine.calculateDiff(
                previousRevision.content,
                revision.content
            );
        }
        
        // Compress content for storage efficiency
        revision.compressedContent = await this.compressionService.compress(
            revision.content
        );
        
        // Store revision
        await this.revisionStore.store(revision);
        
        // Update document's latest revision pointer
        await this.updateLatestRevision(documentId, revision.id);
        
        return revision;
    }
    
    async getRevisionHistory(documentId, limit = 50, offset = 0) {
        const revisions = await this.revisionStore.getRevisions(
            documentId, 
            limit, 
            offset
        );
        
        // Decompress content for recent revisions
        for (const revision of revisions) {
            if (revision.compressedContent) {
                revision.content = await this.compressionService.decompress(
                    revision.compressedContent
                );
            }
        }
        
        return revisions;
    }
    
    async restoreRevision(documentId, revisionId, userId) {
        // Get the revision to restore
        const revision = await this.revisionStore.getRevision(revisionId);
        if (!revision || revision.documentId !== documentId) {
            throw new Error('Revision not found');
        }
        
        // Create new revision with restored content
        const restoreRevision = await this.createRevision(documentId, {
            version: await this.getNextVersion(documentId),
            userId: userId,
            operations: [],
            content: revision.content,
            changeType: 'restore',
            description: `Restored to version ${revision.version}`
        });
        
        // Update document content
        await this.updateDocumentContent(documentId, revision.content);
        
        return restoreRevision;
    }
    
    async compareRevisions(documentId, fromRevisionId, toRevisionId) {
        const fromRevision = await this.revisionStore.getRevision(fromRevisionId);
        const toRevision = await this.revisionStore.getRevision(toRevisionId);
        
        if (!fromRevision || !toRevision) {
            throw new Error('One or both revisions not found');
        }
        
        // Calculate detailed diff
        const diff = await this.diffEngine.calculateDetailedDiff(
            fromRevision.content,
            toRevision.content
        );
        
        return {
            fromRevision: {
                id: fromRevision.id,
                version: fromRevision.version,
                timestamp: fromRevision.timestamp,
                userId: fromRevision.userId
            },
            toRevision: {
                id: toRevision.id,
                version: toRevision.version,
                timestamp: toRevision.timestamp,
                userId: toRevision.userId
            },
            diff: diff,
            summary: {
                insertions: diff.insertions.length,
                deletions: diff.deletions.length,
                modifications: diff.modifications.length
            }
        };
    }
}
```

## Event-Driven Architecture

### Document Event Flow
```
┌─────────────┐    Publish    ┌─────────────┐    Subscribe   ┌─────────────┐
│   Client    │──────────────►│   Pub/Sub   │──────────────►│ Real-time   │
│ Operation   │               │   Service   │               │   Clients   │
└─────────────┘               └─────────────┘               └─────────────┘
                                     │
                              ┌─────────────┐
                              │ Operation   │
                              │ Transform   │
                              └─────────────┘
                                     │
                              ┌─────────────┐
                              │ Version     │
                              │ Control     │
                              └─────────────┘
```

### Event Types and Handlers
```javascript
const eventHandlers = {
    'document.operation': [
        'operational_transform.process',
        'realtime_sync.broadcast',
        'version_control.record',
        'search.index_update'
    ],
    'document.created': [
        'search.index_document',
        'analytics.track_creation',
        'notification.notify_collaborators'
    ],
    'user.joined': [
        'presence.update',
        'realtime_sync.broadcast_presence',
        'analytics.track_collaboration'
    ],
    'comment.added': [
        'notification.notify_mentioned_users',
        'realtime_sync.broadcast_comment',
        'search.index_comment'
    ]
};
```

## Caching Strategy

### Multi-Level Caching Architecture
```
┌─────────────┐    L1 Cache    ┌─────────────┐    L2 Cache    ┌─────────────┐
│   Client    │◄──────────────►│ Application │◄──────────────►│    Redis    │
│   (Memory)  │                │   Server    │                │   Cluster   │
└─────────────┘                └─────────────┘                └─────────────┘
                                       │                              │
                                       ▼                              ▼
                               ┌─────────────┐                ┌─────────────┐
                               │   Spanner   │                │ CDN Cache   │
                               │  Database   │                │ (Static)    │
                               └─────────────┘                └─────────────┘
```

### Cache Implementation
```javascript
class DocumentCacheManager {
    constructor() {
        this.localCache = new LRUCache({ max: 1000, ttl: 300000 }); // 5 min
        this.redisCache = new RedisCluster();
        this.cacheStrategies = {
            'document_content': { ttl: 1800, strategy: 'write-through' },
            'document_metadata': { ttl: 3600, strategy: 'cache-aside' },
            'user_permissions': { ttl: 900, strategy: 'write-behind' },
            'revision_history': { ttl: 7200, strategy: 'cache-aside' }
        };
    }
    
    async getDocument(documentId) {
        // Try L1 cache first
        let document = this.localCache.get(`doc:${documentId}`);
        if (document) return document;
        
        // Try L2 cache (Redis)
        document = await this.redisCache.get(`doc:${documentId}`);
        if (document) {
            this.localCache.set(`doc:${documentId}`, document);
            return JSON.parse(document);
        }
        
        // Fetch from database
        document = await this.fetchFromDatabase(documentId);
        
        // Cache in both levels
        await this.redisCache.setex(`doc:${documentId}`, 1800, JSON.stringify(document));
        this.localCache.set(`doc:${documentId}`, document);
        
        return document;
    }
    
    async invalidateDocument(documentId) {
        // Invalidate all cache levels
        this.localCache.delete(`doc:${documentId}`);
        await this.redisCache.del(`doc:${documentId}`);
        
        // Invalidate related caches
        await this.redisCache.del(`doc:${documentId}:permissions`);
        await this.redisCache.del(`doc:${documentId}:collaborators`);
    }
}
```

## Offline Support Architecture

### Offline-First Design
```javascript
class OfflineManager {
    constructor() {
        this.localDB = new IndexedDBManager();
        this.syncQueue = new OperationSyncQueue();
        this.conflictResolver = new OfflineConflictResolver();
    }
    
    async handleOfflineOperation(documentId, operation) {
        // Apply operation locally immediately
        await this.applyOperationLocally(documentId, operation);
        
        // Queue operation for sync when online
        await this.syncQueue.enqueue({
            documentId: documentId,
            operation: operation,
            timestamp: Date.now(),
            clientId: this.getClientId()
        });
        
        // Update local document state
        await this.updateLocalDocument(documentId, operation);
    }
    
    async syncWhenOnline() {
        if (!navigator.onLine) return;
        
        const queuedOperations = await this.syncQueue.getAll();
        
        for (const queuedOp of queuedOperations) {
            try {
                // Send operation to server
                const result = await this.sendOperationToServer(queuedOp);
                
                if (result.conflict) {
                    // Handle conflict resolution
                    await this.conflictResolver.resolve(queuedOp, result.serverState);
                }
                
                // Remove from queue on success
                await this.syncQueue.remove(queuedOp.id);
                
            } catch (error) {
                // Keep in queue for retry
                console.error('Sync failed:', error);
            }
        }
    }
}
```
