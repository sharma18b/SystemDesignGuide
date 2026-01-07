# Distributed Locking System - API Design

## API Overview

### Core Lock Operations
```
AcquireLock(path, timeout, options)
ReleaseLock(path, fencing_token)
TryLock(path, options)
RenewLock(path, fencing_token, duration)
```

### REST API Endpoints

#### Acquire Lock
```http
POST /api/v1/locks/{path}/acquire
Content-Type: application/json

{
  "session_id": "sess_abc123",
  "timeout_ms": 30000,
  "wait": true,
  "lock_type": "exclusive"
}

Response 200:
{
  "acquired": true,
  "fencing_token": 12345,
  "expires_at": "2024-01-03T19:31:00Z"
}
```

#### Release Lock
```http
POST /api/v1/locks/{path}/release
Content-Type: application/json

{
  "session_id": "sess_abc123",
  "fencing_token": 12345
}

Response 200:
{
  "released": true
}
```

### gRPC Service Definition
```protobuf
service LockService {
  rpc AcquireLock(AcquireLockRequest) returns (AcquireLockResponse);
  rpc ReleaseLock(ReleaseLockRequest) returns (ReleaseLockResponse);
  rpc TryLock(TryLockRequest) returns (TryLockResponse);
  rpc RenewLock(RenewLockRequest) returns (RenewLockResponse);
  rpc CreateSession(CreateSessionRequest) returns (CreateSessionResponse);
  rpc Heartbeat(HeartbeatRequest) returns (HeartbeatResponse);
}
```

### Client Library Example (Python)
```python
from distributed_lock import LockClient

client = LockClient(servers=['node1:2379', 'node2:2379'])

# Acquire lock
with client.lock('/app/resource', timeout=30):
    # Critical section
    process_data()
    
# Lock automatically released

# Leader election
with client.elect_leader('/app/leader'):
    # I am the leader
    perform_leader_duties()
```

This API design provides simple, intuitive interfaces for distributed locking with strong consistency guarantees.
