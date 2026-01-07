# Distributed Locking System - Variations and Follow-ups

## Common Variations

### 1. Read-Write Locks
**Modification**: Support shared read locks and exclusive write locks

**Implementation**:
```
Lock Types:
- Read Lock: Multiple readers allowed
- Write Lock: Exclusive access

Compatibility Matrix:
         Read    Write
Read     ✓       ✗
Write    ✗       ✗
```

### 2. Priority Locks
**Modification**: High-priority clients acquire locks first

**Implementation**:
- Priority queue for waiters
- Preemption for critical operations
- Starvation prevention

### 3. Hierarchical Locks
**Modification**: Lock entire subtrees

**Example**:
```
/app/db/table1  (locks table1)
/app/db/*       (locks all tables)
/app/*          (locks entire app)
```

## Follow-Up Questions

### Q: "How do you prevent deadlocks?"
**Answer**:
```
Prevention Strategies:
1. Lock Ordering: Always acquire in same order
2. Timeouts: Automatic release after timeout
3. Deadlock Detection: Cycle detection in wait graph
4. Try-Lock: Non-blocking acquisition

Implementation:
- Client-side lock ordering
- Server-side timeout enforcement
- Periodic deadlock detection
- Automatic lock release
```

### Q: "How do you handle split-brain?"
**Answer**:
```
Prevention:
- Quorum-based decisions
- Fencing tokens
- Lease-based leadership

Detection:
- Monitor cluster membership
- Track leader elections
- Verify quorum

Resolution:
- Automatic: Minority partition stops serving
- Manual: Operator intervention if needed
```

### Q: "What happens during network partition?"
**Answer**:
```
Scenario: 5-node cluster splits 3-2

Majority Partition (3 nodes):
- Continues operating normally
- Elects new leader if needed
- Serves read/write requests

Minority Partition (2 nodes):
- Cannot form quorum
- Stops accepting writes
- May serve stale reads
- Waits for partition heal

Recovery:
- Automatic when partition heals
- Minority catches up from majority
- No data loss
```

This guide covers common variations and answers typical follow-up questions about distributed locking systems.
