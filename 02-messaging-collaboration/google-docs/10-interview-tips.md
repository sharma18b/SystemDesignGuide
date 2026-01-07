# Interview Tips for Google Docs System Design

## Overview
Designing a collaborative document editing system like Google Docs is one of the most challenging system design problems. This guide provides strategies for approaching the interview and common pitfalls to avoid.

## Interview Structure (45-60 minutes)

### Phase 1: Requirements Clarification (5-10 minutes)
**Goal**: Understand the scope and constraints

**Key Questions to Ask**:
1. **Scale**: How many daily active users? Concurrent editors per document?
2. **Features**: Real-time collaboration? Offline support? Rich text formatting?
3. **Latency**: What's acceptable latency for seeing others' edits? (100ms? 500ms?)
4. **Consistency**: Strong consistency or eventual consistency?
5. **Conflict Resolution**: How should we handle concurrent edits?
6. **Platform**: Web only? Mobile apps? Desktop apps?

**Red Flags to Avoid**:
- ❌ Jumping into design without clarifying requirements
- ❌ Assuming features without asking (e.g., "I'll assume we need comments")
- ❌ Not discussing scale constraints

### Phase 2: High-Level Design (15-20 minutes)
**Goal**: Present the overall architecture

**What to Cover**:
1. **Client-Server Architecture**: WebSocket for real-time, REST for CRUD
2. **Core Components**: OT Server, Document Service, Storage Layer
3. **Data Flow**: User edit → OT transformation → Broadcast → Database
4. **Key Technologies**: WebSocket, Spanner/PostgreSQL, Redis, CDN

**How to Present**:
```
Start with a simple diagram:

┌─────────┐
│ Client  │ ←→ WebSocket ←→ ┌──────────────┐
│ Browser │                  │  OT Server   │
└─────────┘                  └──────────────┘
                                     ↓
                             ┌──────────────┐
                             │   Database   │
                             │   (Spanner)  │
                             └──────────────┘

Then explain the flow:
1. User types "hello" at position 10
2. Client sends operation to OT server via WebSocket
3. OT server transforms operation against concurrent operations
4. OT server broadcasts to all connected clients
5. OT server persists to database
```

**Red Flags to Avoid**:
- ❌ Diving into implementation details too early
- ❌ Not explaining the data flow
- ❌ Ignoring real-time requirements

### Phase 3: Deep Dive (20-25 minutes)
**Goal**: Demonstrate technical depth

**Topics Interviewers Often Probe**:

#### 1. Operational Transform (Most Important)
**What to Explain**:
- OT is an algorithm for conflict-free collaborative editing
- Transforms concurrent operations to maintain consistency
- Example: Two users insert at same position

**Example to Use**:
```
Initial document: "Hello"
User A: Insert "X" at position 5 → "HelloX"
User B: Insert "Y" at position 5 → "HelloY"

Without OT: Conflict! Which one wins?

With OT:
1. User A's operation arrives first: "HelloX"
2. User B's operation is transformed:
   - Original: Insert "Y" at position 5
   - Transformed: Insert "Y" at position 6 (after "X")
3. Final result: "HelloXY" (consistent for both users)
```

**Key Points**:
- O(n²) complexity for n concurrent operations
- Requires central server for coordination
- Alternative: CRDT (mention but don't deep dive unless asked)

#### 2. WebSocket Scaling
**What to Explain**:
- Each server handles 50K connections
- Use sticky sessions (route user to same server)
- Load balancer with consistent hashing
- Horizontal scaling by adding more servers

**Capacity Calculation**:
```
5M concurrent users
÷ 50K connections per server
= 100 servers needed
× 3 regions
= 300 servers globally
```

#### 3. Database Design
**What to Explain**:
- Spanner for strong consistency (document state)
- Bigtable for revision history (append-only)
- Redis for OT state and presence (in-memory)

**Schema to Present**:
```sql
-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  title VARCHAR(255),
  content TEXT,
  version INT,
  owner_id UUID,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Operations table (for OT)
CREATE TABLE operations (
  id UUID PRIMARY KEY,
  document_id UUID,
  user_id UUID,
  type VARCHAR(20),  -- insert, delete, format
  position INT,
  content TEXT,
  version INT,
  timestamp TIMESTAMP
);
```

#### 4. Conflict Resolution
**What to Explain**:
- OT handles conflicts automatically
- Transform operations to preserve intent
- Last-writer-wins for metadata (title, permissions)

**Common Follow-up**: "What if the OT server crashes?"
**Answer**: Operations are persisted before acknowledgment. On restart, replay from last checkpoint.

### Phase 4: Scaling and Optimization (10-15 minutes)
**Goal**: Show you can handle massive scale

**Topics to Cover**:

#### 1. Hot Document Problem
**Problem**: Document with 1000+ concurrent editors
**Solution**:
- Hierarchical OT (multiple OT servers with coordinator)
- Operation batching (send 10 ops together instead of individually)
- Read-only mode for viewers (don't send operations)

#### 2. Global Distribution
**Problem**: Users in different continents
**Solution**:
- Regional OT servers (US, EU, Asia)
- Local operations have low latency (10-20ms)
- Cross-region operations have higher latency (100-200ms)
- Acceptable tradeoff for global collaboration

#### 3. Caching Strategy
**Layers**:
- L1: Client-side (IndexedDB) - 60% hit rate
- L2: Redis - 35% hit rate
- L3: CDN (for exports) - 90% hit rate
- Overall: 95% cache hit rate

#### 4. Cost Optimization
**Mention**:
- Reserved instances for compute (40% savings)
- Compression for storage and network (70% reduction)
- Tiered storage for old revisions (cold storage)

## Common Interview Questions and Answers

### Q1: "How does Operational Transform work?"
**Answer Structure**:
1. Define the problem (concurrent edits)
2. Explain transformation with example
3. Mention complexity (O(n²))
4. Discuss alternative (CRDT)

**Example Answer**:
"OT is an algorithm that transforms concurrent operations to maintain consistency. For example, if two users insert text at the same position, OT transforms the second operation to account for the first. The complexity is O(n²) for n concurrent operations, which is why we limit concurrent editors to 100 per document. An alternative is CRDT, which has O(n) complexity but larger operation size."

### Q2: "How do you handle offline editing?"
**Answer Structure**:
1. Local storage (IndexedDB)
2. Queue operations while offline
3. Sync when online
4. Conflict resolution using OT

**Example Answer**:
"We store the document in IndexedDB on the client. When offline, operations are queued locally. When the user comes back online, we fetch server operations since last sync, transform our local operations against them using OT, and send the transformed operations to the server. This ensures consistency even after offline editing."

### Q3: "How do you scale WebSocket connections?"
**Answer Structure**:
1. Connection limits per server (50K)
2. Sticky sessions with load balancer
3. Horizontal scaling
4. Connection pooling

**Example Answer**:
"Each server can handle about 50K WebSocket connections. We use a load balancer with consistent hashing to route users to the same server (sticky sessions). To scale, we add more servers horizontally. For 5M concurrent users, we need about 100 servers per region, or 300 globally across 3 regions."

### Q4: "What database would you use and why?"
**Answer Structure**:
1. Requirements (strong consistency, global distribution)
2. Choice (Spanner)
3. Alternatives (PostgreSQL, MongoDB)
4. Tradeoffs

**Example Answer**:
"I'd use Google Spanner for document state because it provides strong consistency with global distribution. This ensures all users see the same document state. For revision history, I'd use Bigtable for its append-only efficiency. For OT state and presence, I'd use Redis for low latency. Alternatives like PostgreSQL work for single-region deployments, but don't scale globally."

### Q5: "How do you handle a document with 1000 concurrent editors?"
**Answer Structure**:
1. Acknowledge the challenge (O(n²) complexity)
2. Hierarchical OT solution
3. Operation batching
4. Read-only mode for excess users

**Example Answer**:
"With 1000 editors, OT complexity becomes a bottleneck (1M transformations). I'd implement hierarchical OT with multiple OT servers coordinated by a master. Each server handles 100 editors. I'd also batch operations (send 10 at once) to reduce network overhead. For viewers beyond 500, I'd offer read-only mode to reduce load."

### Q6: "How do you ensure data consistency across regions?"
**Answer Structure**:
1. Spanner's global consistency
2. Regional OT servers
3. Synchronous replication for writes
4. Acceptable latency tradeoff

**Example Answer**:
"Spanner provides strong consistency across regions using TrueTime API. For real-time collaboration, I use regional OT servers that handle local operations with low latency (10-20ms). Cross-region operations take longer (100-200ms) due to synchronous replication, but this is acceptable for global collaboration. Users see local changes immediately and remote changes with slight delay."

### Q7: "How would you implement version history?"
**Answer Structure**:
1. Store all operations (append-only)
2. Snapshots every N operations
3. Restore by replaying operations
4. Compression and tiering

**Example Answer**:
"I'd store all operations in an append-only log in Bigtable. Every 100 operations, I'd create a snapshot of the full document. To restore version N, I find the nearest snapshot and replay operations from snapshot to N. Old revisions are compressed and moved to cold storage after 90 days. This balances storage cost with restore performance."

### Q8: "What happens if the OT server crashes?"
**Answer Structure**:
1. Operations persisted before acknowledgment
2. Replay from last checkpoint
3. Redis persistence for in-memory state
4. Failover to replica

**Example Answer**:
"All operations are persisted to Spanner before acknowledgment, so no data loss occurs. The OT server maintains in-memory state in Redis with persistence enabled. On crash, a replica takes over and replays operations from the last checkpoint. Users may see a brief disconnection (1-2 seconds) but no data loss."

## Key Concepts to Master

### 1. Operational Transform
- **What**: Algorithm for conflict-free collaborative editing
- **Why**: Maintains consistency with concurrent edits
- **How**: Transform operations against each other
- **Complexity**: O(n²) for n concurrent operations
- **Alternative**: CRDT (O(n) but larger operations)

### 2. WebSocket vs HTTP
- **WebSocket**: Full-duplex, low latency, persistent connection
- **HTTP**: Request-response, higher latency, stateless
- **When to use WebSocket**: Real-time collaboration
- **When to use HTTP**: CRUD operations, file uploads

### 3. Strong vs Eventual Consistency
- **Strong**: All users see same state (Spanner)
- **Eventual**: Temporary inconsistencies (Cassandra)
- **Tradeoff**: Consistency vs latency vs availability
- **Choice**: Strong for document state, eventual for presence

### 4. Caching Strategy
- **Multi-level**: Client, Redis, CDN
- **Invalidation**: Write-through, TTL-based
- **Hit rate**: Target 95%+ to reduce database load

### 5. Scaling Patterns
- **Horizontal**: Add more servers
- **Vertical**: Bigger servers (limited)
- **Sharding**: Partition by document ID
- **Replication**: Multiple copies for reads

## Common Mistakes to Avoid

### 1. Not Discussing OT
❌ "We'll just use last-writer-wins for conflicts"
✅ "We'll use Operational Transform to handle concurrent edits"

**Why**: OT is the core of collaborative editing. Not mentioning it shows lack of depth.

### 2. Ignoring Real-Time Requirements
❌ "Users can refresh to see updates"
✅ "We'll use WebSocket for real-time synchronization"

**Why**: Real-time is a fundamental requirement for Google Docs.

### 3. Oversimplifying Conflict Resolution
❌ "We'll lock the document when someone is editing"
✅ "We'll use OT to transform concurrent operations"

**Why**: Locking defeats the purpose of collaborative editing.

### 4. Not Considering Scale
❌ "We'll use a single server for everything"
✅ "We'll need 300 WebSocket servers for 5M concurrent users"

**Why**: Scale is a key constraint that affects architecture decisions.

### 5. Forgetting About Offline Mode
❌ "Users must be online to edit"
✅ "We'll support offline editing with sync on reconnection"

**Why**: Offline support is expected in modern applications.

### 6. Ignoring Security
❌ Not mentioning encryption or access control
✅ "We'll use TLS for transit, AES-256 for rest, and RBAC for access control"

**Why**: Security is critical for document editing systems.

## How to Stand Out

### 1. Mention Specific Technologies
Instead of: "We'll use a database"
Say: "We'll use Spanner for strong consistency and global distribution"

### 2. Provide Numbers
Instead of: "We'll need multiple servers"
Say: "We'll need 100 servers per region for 5M concurrent users at 50K connections per server"

### 3. Discuss Tradeoffs
Instead of: "We'll use OT"
Say: "We'll use OT over CRDT because it provides better user experience despite O(n²) complexity"

### 4. Consider Edge Cases
- What if 1000 users edit simultaneously?
- What if the OT server crashes?
- What if a user edits offline for a week?
- What if someone pastes 1MB of text?

### 5. Think About Operations
- How do we monitor OT server health?
- How do we debug conflicts?
- How do we handle schema migrations?
- How do we test OT correctness?

## Time Management Tips

### Allocate Time Wisely
- Requirements: 10% (5 minutes)
- High-level design: 30% (15 minutes)
- Deep dive: 40% (20 minutes)
- Scaling: 20% (10 minutes)

### If Running Out of Time
**Prioritize**:
1. OT explanation (most important)
2. WebSocket architecture
3. Database design
4. Scaling strategy

**Skip if needed**:
- Monitoring and alerting
- Deployment strategy
- Cost optimization
- Advanced features (comments, suggestions)

### If Ahead of Schedule
**Discuss**:
- Rich text formatting
- Comments and suggestions
- Version history
- Offline mode
- Security and compliance

## Final Checklist

Before ending the interview, ensure you've covered:

- [ ] Operational Transform explanation with example
- [ ] WebSocket architecture for real-time sync
- [ ] Database choice with justification (Spanner)
- [ ] Conflict resolution strategy
- [ ] Scaling approach (horizontal, regional)
- [ ] Caching strategy (multi-level)
- [ ] Offline support (IndexedDB, sync)
- [ ] Security basics (encryption, access control)
- [ ] At least one tradeoff discussion
- [ ] Capacity calculations with numbers

## Summary

**Key Takeaways**:
1. **Master OT**: It's the heart of collaborative editing
2. **Think Real-Time**: WebSocket, low latency, immediate updates
3. **Scale Matters**: Calculate capacity, discuss bottlenecks
4. **Tradeoffs**: OT vs CRDT, strong vs eventual consistency
5. **Be Specific**: Name technologies, provide numbers
6. **Consider Edge Cases**: Hot documents, crashes, offline editing
7. **Security**: Don't forget encryption and access control

**Success Formula**:
- Clear communication > Perfect solution
- Tradeoff discussion > Single approach
- Specific examples > Generic statements
- Capacity calculations > Hand-waving
- Asking questions > Making assumptions

Good luck with your interview! Remember, the interviewer wants to see your thought process, not just the final design.
