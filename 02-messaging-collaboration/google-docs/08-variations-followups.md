# Variations and Follow-up Questions for Google Docs

## Overview
This document explores variations of the core Google Docs design, additional features, and common follow-up questions asked in system design interviews.

## 1. Rich Text Formatting

### Challenge
Supporting rich text (bold, italic, fonts, colors) with operational transform adds complexity to the transformation functions.

### Implementation Strategy

**Data Model**:
```javascript
// Character-based representation with attributes
{
  type: 'insert',
  position: 10,
  content: [
    { char: 'H', attrs: { bold: true, fontSize: 14 } },
    { char: 'e', attrs: { bold: true, fontSize: 14 } },
    { char: 'l', attrs: { bold: true, fontSize: 14 } },
    { char: 'l', attrs: { bold: true, fontSize: 14 } },
    { char: 'o', attrs: { bold: true, fontSize: 14 } }
  ]
}

// Format operation
{
  type: 'format',
  start: 10,
  end: 15,
  attrs: { bold: true, color: '#FF0000' }
}
```

**OT Transformation for Formatting**:
```javascript
function transformFormat(op1, op2) {
  // Case 1: Non-overlapping ranges
  if (op1.end <= op2.start || op2.end <= op1.start) {
    return op1; // No transformation needed
  }
  
  // Case 2: Overlapping ranges - merge attributes
  if (op1.start < op2.start && op1.end > op2.end) {
    // op1 contains op2 - split into 3 ranges
    return [
      { ...op1, end: op2.start },
      { ...op1, start: op2.start, end: op2.end, attrs: { ...op1.attrs, ...op2.attrs } },
      { ...op1, start: op2.end }
    ];
  }
  
  // Case 3: Partial overlap - adjust ranges
  return adjustOverlappingRanges(op1, op2);
}
```

**Storage Optimization**:
```javascript
// Run-length encoding for consecutive characters with same attributes
{
  runs: [
    { text: 'Hello', attrs: { bold: true, fontSize: 14 } },
    { text: ' ', attrs: { fontSize: 14 } },
    { text: 'World', attrs: { italic: true, fontSize: 14 } }
  ]
}

// Reduces storage from 11 characters × 50 bytes = 550 bytes
// To 3 runs × 100 bytes = 300 bytes (45% savings)
```

### Scaling Considerations
- **Attribute Explosion**: Limit to 20 attributes per character
- **Format Operations**: Batch consecutive format changes
- **Storage**: Use run-length encoding to reduce size by 40-60%

## 2. Comments and Suggestions

### Architecture

**Comment System**:
```javascript
// Comment data model
{
  id: 'comment_123',
  documentId: 'doc_456',
  anchorPosition: 150,  // Character position in document
  anchorLength: 20,     // Length of highlighted text
  content: 'This needs clarification',
  author: 'user_789',
  createdAt: 1704672000000,
  resolved: false,
  replies: [
    {
      id: 'reply_001',
      content: 'I agree',
      author: 'user_012',
      createdAt: 1704672100000
    }
  ]
}
```

**Anchor Adjustment with OT**:
```javascript
// When text is inserted/deleted, adjust comment anchors
function adjustCommentAnchors(comments, operation) {
  return comments.map(comment => {
    if (operation.type === 'insert') {
      if (operation.position <= comment.anchorPosition) {
        // Shift anchor forward
        return {
          ...comment,
          anchorPosition: comment.anchorPosition + operation.text.length
        };
      }
    } else if (operation.type === 'delete') {
      if (operation.position < comment.anchorPosition) {
        // Shift anchor backward
        return {
          ...comment,
          anchorPosition: Math.max(
            operation.position,
            comment.anchorPosition - operation.length
          )
        };
      } else if (operation.position < comment.anchorPosition + comment.anchorLength) {
        // Deletion overlaps with comment - adjust length
        return {
          ...comment,
          anchorLength: Math.max(0, comment.anchorLength - operation.length)
        };
      }
    }
    return comment;
  });
}
```

**Suggestion Mode**:
```javascript
// Suggestions are tracked as pending operations
{
  id: 'suggestion_123',
  type: 'insert',
  position: 100,
  text: 'new content',
  author: 'user_456',
  status: 'pending',  // pending, accepted, rejected
  createdAt: 1704672000000
}

// Render suggestions as overlays without modifying document
// Accept: Apply operation to document
// Reject: Discard operation
```

### Storage Strategy
```sql
-- Comments table (PostgreSQL)
CREATE TABLE comments (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL,
  anchor_position INT NOT NULL,
  anchor_length INT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL,
  created_at TIMESTAMP NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  INDEX idx_document_id (document_id),
  INDEX idx_author_id (author_id)
);

-- Suggestions table
CREATE TABLE suggestions (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL,
  operation JSONB NOT NULL,
  author_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  INDEX idx_document_status (document_id, status)
);
```

## 3. Document Permissions and Sharing

### Permission Levels
```javascript
const PermissionLevels = {
  OWNER: 'owner',       // Full control
  EDITOR: 'editor',     // Can edit and comment
  COMMENTER: 'commenter', // Can only comment
  VIEWER: 'viewer'      // Read-only access
};

// Permission model
{
  documentId: 'doc_123',
  permissions: [
    { userId: 'user_456', level: 'owner' },
    { userId: 'user_789', level: 'editor' },
    { groupId: 'group_012', level: 'viewer' },
    { type: 'anyone_with_link', level: 'commenter' }
  ],
  inheritFrom: 'folder_345'  // Inherit from parent folder
}
```

### Access Control Implementation
```javascript
// Check permission before allowing operation
async function checkPermission(userId, documentId, requiredLevel) {
  const permissions = await getDocumentPermissions(documentId);
  
  // Check direct user permission
  const userPerm = permissions.find(p => p.userId === userId);
  if (userPerm && hasRequiredLevel(userPerm.level, requiredLevel)) {
    return true;
  }
  
  // Check group permissions
  const userGroups = await getUserGroups(userId);
  const groupPerm = permissions.find(p => 
    p.groupId && userGroups.includes(p.groupId)
  );
  if (groupPerm && hasRequiredLevel(groupPerm.level, requiredLevel)) {
    return true;
  }
  
  // Check link sharing
  const linkPerm = permissions.find(p => p.type === 'anyone_with_link');
  if (linkPerm && hasRequiredLevel(linkPerm.level, requiredLevel)) {
    return true;
  }
  
  return false;
}

function hasRequiredLevel(userLevel, requiredLevel) {
  const hierarchy = ['viewer', 'commenter', 'editor', 'owner'];
  return hierarchy.indexOf(userLevel) >= hierarchy.indexOf(requiredLevel);
}
```

### Sharing Links
```javascript
// Generate shareable link with token
{
  documentId: 'doc_123',
  shareToken: 'a7b3c9d2e5f8',  // Random token
  permissionLevel: 'viewer',
  expiresAt: 1704758400000,    // Optional expiration
  passwordProtected: true,      // Optional password
  allowDownload: false          // Restrict downloads
}

// Access via link: /docs/doc_123?token=a7b3c9d2e5f8
```

## 4. Document Templates

### Template System
```javascript
// Template definition
{
  id: 'template_123',
  name: 'Project Proposal',
  category: 'business',
  content: {
    // Document structure with placeholders
    sections: [
      {
        type: 'heading',
        level: 1,
        text: '{{PROJECT_NAME}}'
      },
      {
        type: 'paragraph',
        text: 'Project Owner: {{OWNER_NAME}}'
      },
      {
        type: 'table',
        rows: 5,
        cols: 3,
        headers: ['Task', 'Owner', 'Deadline']
      }
    ]
  },
  variables: [
    { name: 'PROJECT_NAME', type: 'text', required: true },
    { name: 'OWNER_NAME', type: 'text', required: true }
  ]
}

// Create document from template
async function createFromTemplate(templateId, variables) {
  const template = await getTemplate(templateId);
  const content = substituteVariables(template.content, variables);
  return createDocument(content);
}
```

## 5. Export and Import

### Export Formats
```javascript
// Export service
class ExportService {
  async exportToPDF(documentId) {
    const doc = await getDocument(documentId);
    const html = this.convertToHTML(doc);
    const pdf = await this.htmlToPDF(html);
    return pdf;
  }
  
  async exportToDocx(documentId) {
    const doc = await getDocument(documentId);
    const docx = await this.convertToDocx(doc);
    return docx;
  }
  
  async exportToMarkdown(documentId) {
    const doc = await getDocument(documentId);
    const markdown = this.convertToMarkdown(doc);
    return markdown;
  }
}

// Conversion pipeline
Document → Internal Format → Target Format
         ↓
    [Rich Text, Images, Tables, Formatting]
         ↓
    [PDF: Puppeteer/Chrome Headless]
    [DOCX: docx.js library]
    [Markdown: Custom converter]
```

### Import Handling
```javascript
// Import service
class ImportService {
  async importDocx(file) {
    const content = await this.parseDocx(file);
    const doc = await this.convertToInternalFormat(content);
    return createDocument(doc);
  }
  
  async importPDF(file) {
    // PDF import is lossy - extract text only
    const text = await this.extractTextFromPDF(file);
    return createDocument({ text });
  }
  
  async importHTML(html) {
    const sanitized = this.sanitizeHTML(html);
    const doc = await this.convertToInternalFormat(sanitized);
    return createDocument(doc);
  }
}
```

## 6. Offline Mode

### Offline Architecture
```javascript
// Service worker for offline support
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// IndexedDB for local storage
class OfflineStorage {
  async saveDocument(docId, content) {
    const db = await this.openDB();
    await db.put('documents', { id: docId, content, timestamp: Date.now() });
  }
  
  async getDocument(docId) {
    const db = await this.openDB();
    return await db.get('documents', docId);
  }
  
  async getPendingOperations(docId) {
    const db = await this.openDB();
    return await db.getAll('pending_operations', docId);
  }
}
```

### Sync Strategy
```javascript
// Sync pending operations when online
class SyncManager {
  async syncPendingOperations() {
    const pending = await this.storage.getPendingOperations();
    
    for (const op of pending) {
      try {
        await this.sendOperation(op);
        await this.storage.removePendingOperation(op.id);
      } catch (error) {
        if (error.type === 'conflict') {
          // Resolve conflict using OT
          const resolved = await this.resolveConflict(op);
          await this.sendOperation(resolved);
        }
      }
    }
  }
  
  async resolveConflict(localOp) {
    // Fetch server operations since last sync
    const serverOps = await this.fetchServerOperations(localOp.documentId, localOp.version);
    
    // Transform local operation against server operations
    let transformed = localOp;
    for (const serverOp of serverOps) {
      transformed = this.transform(transformed, serverOp);
    }
    
    return transformed;
  }
}
```

## 7. Real-time Collaboration Features

### Cursor Tracking
```javascript
// Broadcast cursor position
{
  type: 'cursor',
  userId: 'user_123',
  userName: 'Alice',
  position: 150,
  color: '#FF5733'
}

// Render other users' cursors
class CursorManager {
  renderCursors(cursors) {
    cursors.forEach(cursor => {
      const element = this.createCursorElement(cursor);
      const position = this.getPositionInEditor(cursor.position);
      element.style.left = position.x + 'px';
      element.style.top = position.y + 'px';
      element.style.borderColor = cursor.color;
      this.editorElement.appendChild(element);
    });
  }
}
```

### Presence Indicators
```javascript
// User presence
{
  documentId: 'doc_123',
  activeUsers: [
    {
      userId: 'user_456',
      userName: 'Alice',
      avatar: 'https://...',
      lastSeen: 1704672000000,
      isEditing: true
    },
    {
      userId: 'user_789',
      userName: 'Bob',
      avatar: 'https://...',
      lastSeen: 1704672050000,
      isEditing: false
    }
  ]
}

// Update presence every 30 seconds
setInterval(() => {
  sendPresenceUpdate(documentId, userId);
}, 30000);
```

### Selection Highlighting
```javascript
// Broadcast text selection
{
  type: 'selection',
  userId: 'user_123',
  start: 100,
  end: 150,
  color: '#FF5733'
}

// Render selection overlay
class SelectionManager {
  renderSelection(selection) {
    const range = this.createRange(selection.start, selection.end);
    const overlay = this.createOverlay(range, selection.color);
    this.editorElement.appendChild(overlay);
  }
}
```

## 8. Version History and Restore

### Snapshot Strategy
```javascript
// Create snapshots periodically
const SNAPSHOT_INTERVAL = 100; // Every 100 operations

async function maybeCreateSnapshot(documentId, operationCount) {
  if (operationCount % SNAPSHOT_INTERVAL === 0) {
    const content = await getDocumentContent(documentId);
    await createSnapshot(documentId, operationCount, content);
  }
}

// Snapshot storage
{
  documentId: 'doc_123',
  version: 1000,
  content: '...',  // Full document content
  createdAt: 1704672000000,
  size: 524288  // 512KB
}
```

### Restore Implementation
```javascript
// Restore to specific version
async function restoreVersion(documentId, targetVersion) {
  // Find nearest snapshot
  const snapshot = await findNearestSnapshot(documentId, targetVersion);
  
  // Apply operations from snapshot to target version
  const operations = await getOperations(
    documentId,
    snapshot.version,
    targetVersion
  );
  
  let content = snapshot.content;
  for (const op of operations) {
    content = applyOperation(content, op);
  }
  
  return content;
}
```

## 9. Search and Discovery

### Full-Text Search
```javascript
// Index document content in Elasticsearch
{
  documentId: 'doc_123',
  title: 'Project Proposal',
  content: 'Full document text...',
  owner: 'user_456',
  lastModified: 1704672000000,
  tags: ['project', 'proposal', 'business']
}

// Search API
async function searchDocuments(query, filters) {
  const results = await elasticsearch.search({
    index: 'documents',
    body: {
      query: {
        bool: {
          must: [
            { multi_match: { query, fields: ['title^2', 'content'] } }
          ],
          filter: [
            { term: { owner: filters.owner } },
            { range: { lastModified: { gte: filters.since } } }
          ]
        }
      }
    }
  });
  
  return results.hits.hits;
}
```

## 10. Analytics and Insights

### Usage Tracking
```javascript
// Track document events
{
  eventType: 'document_opened',
  documentId: 'doc_123',
  userId: 'user_456',
  timestamp: 1704672000000,
  metadata: {
    source: 'web',
    referrer: 'search'
  }
}

// Aggregate analytics
- Total views per document
- Unique viewers
- Edit frequency
- Collaboration metrics (number of editors)
- Time spent editing
```

## Common Follow-up Questions

### Q1: How would you handle a document with 1000+ concurrent editors?
**Answer**: Implement hierarchical OT with multiple OT servers, use operation batching, and consider read-only mode for viewers beyond a threshold (e.g., 500 editors).

### Q2: How do you prevent data loss if the OT server crashes?
**Answer**: All operations are persisted to Spanner before acknowledgment. On crash, replay operations from the last checkpoint. Use Redis for in-memory state with persistence enabled.

### Q3: How would you implement real-time spell check?
**Answer**: Client-side spell check using browser APIs, with server-side grammar checking via ML models. Send text in batches to avoid overwhelming the server.

### Q4: How do you handle very large documents (100+ pages)?
**Answer**: Implement lazy loading (load visible sections only), use pagination, compress content, and consider splitting into multiple linked documents.

### Q5: How would you add support for tables and images?
**Answer**: Extend OT to handle block-level operations, store images in object storage (S3), use CDN for delivery, and implement separate transformation logic for table operations.

## Summary

Key variations and extensions:
- **Rich text formatting** with attribute-based OT
- **Comments and suggestions** with anchor adjustment
- **Granular permissions** with inheritance
- **Templates** for common document types
- **Export/import** supporting multiple formats
- **Offline mode** with conflict resolution
- **Real-time features** (cursors, presence, selection)
- **Version history** with snapshots and restore
- **Search** using Elasticsearch
- **Analytics** for usage insights

Each feature adds complexity but enhances the collaborative editing experience. Prioritize based on user needs and implementation cost.
