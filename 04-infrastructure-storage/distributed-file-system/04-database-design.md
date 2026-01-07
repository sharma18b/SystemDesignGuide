# Distributed File System - Database Design

## Namespace Schema
```
INode (File/Directory):
  id: int64
  name: string
  type: FILE | DIRECTORY
  parent_id: int64
  permissions: int16
  owner: string
  group: string
  created_at: timestamp
  modified_at: timestamp
  accessed_at: timestamp
  replication_factor: int8
  block_size: int64
  file_size: int64
  blocks: []BlockInfo
```

## Block Metadata
```
BlockInfo:
  block_id: int64
  block_size: int64
  generation_stamp: int64
  checksum: bytes
  locations: []DataNodeInfo
  
DataNodeInfo:
  node_id: string
  hostname: string
  ip_address: string
  rack_id: string
  last_heartbeat: timestamp
```

## Edit Log
```
EditLogEntry:
  transaction_id: int64
  timestamp: timestamp
  operation: CREATE|DELETE|RENAME|APPEND
  path: string
  metadata: map<string, any>
```

## FSImage (Checkpoint)
- Snapshot of entire namespace
- Periodic checkpoint (every hour)
- Merge with edit log
- Fast recovery on restart

## Block Report
```
BlockReport:
  datanode_id: string
  timestamp: timestamp
  blocks: []BlockInfo
  storage_info: StorageInfo
  
StorageInfo:
  capacity: int64
  used: int64
  remaining: int64
  failed_volumes: []string
```

This database design efficiently manages metadata for billions of files and blocks.
