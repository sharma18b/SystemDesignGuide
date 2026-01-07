# Facebook Messenger - Variations and Follow-ups

## Group Messaging vs One-on-One Chat

### Group Messaging Complexities

#### Participant Management
- **Dynamic Membership**: Users can join/leave groups at any time
- **Permission System**: Admin, moderator, and member roles with different capabilities
- **Invitation System**: Invite links, approval workflows, and member limits
- **Group Discovery**: Public groups, searchable groups, and recommendation systems

#### Message Delivery Challenges
- **Fan-out Problem**: Single message needs delivery to hundreds of participants
- **Delivery Optimization**: Batch delivery and parallel processing
- **Read Receipts**: Aggregate read status from multiple participants
- **Notification Management**: Smart notification grouping and frequency control

#### Group-Specific Features
```javascript
// Group message fan-out implementation
class GroupMessageHandler {
  async sendGroupMessage(groupId, message) {
    const participants = await this.getActiveParticipants(groupId);
    const deliveryPromises = [];
    
    // Batch participants for efficient delivery
    const batches = this.createBatches(participants, 100);
    
    for (const batch of batches) {
      const batchPromise = this.deliverToBatch(batch, message);
      deliveryPromises.push(batchPromise);
    }
    
    // Wait for all deliveries to complete
    const results = await Promise.allSettled(deliveryPromises);
    return this.processDeliveryResults(results);
  }
  
  async deliverToBatch(participants, message) {
    const deliveryTasks = participants.map(participant => ({
      userId: participant.id,
      message: this.personalizeMessage(message, participant),
      priority: this.calculatePriority(participant, message)
    }));
    
    return this.messageQueue.addBulk(deliveryTasks);
  }
}
```

### One-on-One Chat Optimizations

#### Direct Message Features
- **Message Encryption**: End-to-end encryption for private conversations
- **Disappearing Messages**: Auto-delete messages after specified time
- **Message Reactions**: Quick emoji responses
- **Voice/Video Calling**: Integrated calling features

#### Performance Optimizations
```javascript
// Optimized direct message handling
class DirectMessageHandler {
  async sendDirectMessage(senderId, recipientId, message) {
    // Simple two-party delivery
    const deliveryPromises = [
      this.deliverToUser(recipientId, message),
      this.updateSenderHistory(senderId, message)
    ];
    
    // Parallel execution for better performance
    const [deliveryResult, historyResult] = await Promise.all(deliveryPromises);
    
    return {
      messageId: message.id,
      delivered: deliveryResult.success,
      timestamp: message.createdAt
    };
  }
}
```

## File Sharing and Media Handling

### Media Upload Pipeline
```javascript
class MediaUploadService {
  async uploadMedia(file, userId, conversationId) {
    // 1. Validate file
    this.validateFile(file);
    
    // 2. Generate unique identifier
    const fileId = this.generateFileId();
    
    // 3. Upload to temporary storage
    const tempUrl = await this.uploadToTemp(file, fileId);
    
    // 4. Process media (resize, compress, scan)
    const processedMedia = await this.processMedia(tempUrl, file.type);
    
    // 5. Upload to permanent storage
    const permanentUrl = await this.uploadToPermanent(processedMedia);
    
    // 6. Store metadata
    await this.storeMediaMetadata({
      fileId,
      originalName: file.name,
      size: file.size,
      type: file.type,
      url: permanentUrl,
      uploadedBy: userId,
      conversationId
    });
    
    return { fileId, url: permanentUrl, thumbnails: processedMedia.thumbnails };
  }
}
```

### File Type Support Matrix
```
File Type    | Max Size | Processing | Thumbnail | Preview
-------------|----------|------------|-----------|--------
Images       | 25MB     | Compress   | Yes       | Yes
Videos       | 100MB    | Transcode  | Yes       | Yes
Audio        | 25MB     | Compress   | Waveform  | Player
Documents    | 25MB     | Scan       | Preview   | Viewer
Archives     | 25MB     | Scan       | No        | List
```

## Message Encryption and Security

### End-to-End Encryption Implementation
```javascript
class E2EEncryptionService {
  async generateKeyPair(userId) {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256"
      },
      true,
      ["encrypt", "decrypt"]
    );
    
    // Store private key locally, public key on server
    await this.storePrivateKey(userId, keyPair.privateKey);
    await this.uploadPublicKey(userId, keyPair.publicKey);
    
    return keyPair;
  }
  
  async encryptMessage(message, recipientPublicKey) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    
    const encryptedData = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      recipientPublicKey,
      data
    );
    
    return Array.from(new Uint8Array(encryptedData));
  }
  
  async decryptMessage(encryptedMessage, privateKey) {
    const encryptedData = new Uint8Array(encryptedMessage);
    
    const decryptedData = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedData
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  }
}
```

### Security Features
- **Message Encryption**: Optional E2E encryption for sensitive conversations
- **Forward Secrecy**: New keys for each session
- **Key Verification**: QR code verification for key exchange
- **Secure Deletion**: Cryptographic deletion of messages
- **Audit Logging**: Security event logging and monitoring

## Offline Support and Synchronization

### Offline Message Queue
```javascript
class OfflineMessageManager {
  constructor() {
    this.pendingMessages = new Map();
    this.syncQueue = [];
    this.isOnline = navigator.onLine;
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingMessages();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }
  
  async sendMessage(message) {
    if (this.isOnline) {
      try {
        return await this.sendMessageOnline(message);
      } catch (error) {
        // Network error, queue for later
        this.queueMessage(message);
        return { queued: true, messageId: message.id };
      }
    } else {
      this.queueMessage(message);
      return { queued: true, messageId: message.id };
    }
  }
  
  queueMessage(message) {
    message.queuedAt = Date.now();
    this.pendingMessages.set(message.id, message);
    this.saveToLocalStorage();
  }
  
  async syncPendingMessages() {
    const messages = Array.from(this.pendingMessages.values());
    
    for (const message of messages) {
      try {
        await this.sendMessageOnline(message);
        this.pendingMessages.delete(message.id);
      } catch (error) {
        console.error('Failed to sync message:', error);
      }
    }
    
    this.saveToLocalStorage();
  }
}
```

### Data Synchronization Strategy
- **Incremental Sync**: Only sync changed data since last connection
- **Conflict Resolution**: Last-writer-wins with timestamp comparison
- **Local Storage**: IndexedDB for offline message storage
- **Background Sync**: Service Worker for background synchronization
- **Sync Indicators**: UI indicators for sync status

## Advanced Features and Extensions

### Message Reactions System
```javascript
class MessageReactionService {
  async addReaction(messageId, userId, emoji) {
    // Validate emoji
    if (!this.isValidEmoji(emoji)) {
      throw new Error('Invalid emoji');
    }
    
    // Add reaction to database
    await this.database.query(`
      INSERT INTO message_reactions (message_id, user_id, emoji, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (message_id, user_id, emoji) DO NOTHING
    `, [messageId, userId, emoji]);
    
    // Update cached reaction counts
    await this.updateReactionCache(messageId);
    
    // Notify other participants
    await this.notifyReactionAdded(messageId, userId, emoji);
    
    return { success: true };
  }
  
  async getReactionSummary(messageId) {
    const reactions = await this.database.query(`
      SELECT emoji, COUNT(*) as count, 
             array_agg(user_id) as user_ids
      FROM message_reactions 
      WHERE message_id = $1 
      GROUP BY emoji
    `, [messageId]);
    
    return reactions.rows.reduce((summary, row) => {
      summary[row.emoji] = {
        count: parseInt(row.count),
        users: row.user_ids
      };
      return summary;
    }, {});
  }
}
```

### Message Threading and Replies
```javascript
class MessageThreadService {
  async replyToMessage(parentMessageId, reply) {
    // Validate parent message exists
    const parentMessage = await this.getMessage(parentMessageId);
    if (!parentMessage) {
      throw new Error('Parent message not found');
    }
    
    // Create reply with thread reference
    const replyMessage = {
      ...reply,
      parentMessageId,
      threadId: parentMessage.threadId || parentMessageId,
      depth: (parentMessage.depth || 0) + 1
    };
    
    // Save reply
    const savedReply = await this.saveMessage(replyMessage);
    
    // Update thread metadata
    await this.updateThreadMetadata(replyMessage.threadId);
    
    return savedReply;
  }
  
  async getMessageThread(threadId, limit = 50) {
    const messages = await this.database.query(`
      SELECT * FROM messages 
      WHERE thread_id = $1 OR message_id = $1
      ORDER BY created_at ASC
      LIMIT $2
    `, [threadId, limit]);
    
    return this.buildThreadStructure(messages.rows);
  }
}
```

### Voice and Video Integration
```javascript
class VoiceVideoService {
  async initiateCall(callerId, recipientId, callType) {
    // Generate call session
    const callSession = {
      id: this.generateCallId(),
      callerId,
      recipientId,
      type: callType, // 'voice' or 'video'
      status: 'initiating',
      createdAt: Date.now()
    };
    
    // Store call session
    await this.storeCallSession(callSession);
    
    // Send call invitation
    await this.sendCallInvitation(recipientId, callSession);
    
    // Set up WebRTC signaling
    const signalingChannel = await this.setupSignaling(callSession.id);
    
    return {
      callId: callSession.id,
      signalingChannel
    };
  }
  
  async handleCallResponse(callId, response) {
    const callSession = await this.getCallSession(callId);
    
    if (response === 'accept') {
      callSession.status = 'active';
      await this.updateCallSession(callSession);
      
      // Initialize media streams
      return this.initializeMediaStreams(callSession);
    } else {
      callSession.status = 'declined';
      await this.updateCallSession(callSession);
      
      return { declined: true };
    }
  }
}
```

## Performance Optimizations

### Message Pagination and Lazy Loading
```javascript
class MessagePaginationService {
  async getMessages(conversationId, cursor = null, limit = 50) {
    let query = `
      SELECT message_id, sender_id, content, created_at, message_type
      FROM messages 
      WHERE conversation_id = $1
    `;
    
    const params = [conversationId];
    
    if (cursor) {
      query += ` AND message_id < $2`;
      params.push(cursor);
    }
    
    query += ` ORDER BY message_id DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const result = await this.database.query(query, params);
    
    return {
      messages: result.rows,
      nextCursor: result.rows.length === limit ? 
        result.rows[result.rows.length - 1].message_id : null,
      hasMore: result.rows.length === limit
    };
  }
}
```

### Smart Notification Batching
```javascript
class SmartNotificationService {
  constructor() {
    this.notificationBatches = new Map();
    this.batchTimeout = 5000; // 5 seconds
  }
  
  async queueNotification(userId, notification) {
    if (!this.notificationBatches.has(userId)) {
      this.notificationBatches.set(userId, []);
      
      // Set timeout to send batch
      setTimeout(() => {
        this.sendBatchedNotifications(userId);
      }, this.batchTimeout);
    }
    
    this.notificationBatches.get(userId).push(notification);
  }
  
  async sendBatchedNotifications(userId) {
    const notifications = this.notificationBatches.get(userId);
    if (!notifications || notifications.length === 0) return;
    
    // Group notifications by conversation
    const grouped = this.groupNotificationsByConversation(notifications);
    
    // Send summarized notifications
    for (const [conversationId, convNotifications] of grouped) {
      await this.sendSummarizedNotification(userId, conversationId, convNotifications);
    }
    
    // Clear batch
    this.notificationBatches.delete(userId);
  }
}
```

This comprehensive guide covers the major variations and extensions that can be built on top of the core messaging platform, providing flexibility for different use cases and advanced features.
