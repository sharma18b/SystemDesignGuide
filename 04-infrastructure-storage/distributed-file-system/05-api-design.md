# Distributed File System - API Design

## File Operations API

### Create File
```
POST /api/v1/files
{
  "path": "/user/data/file.txt",
  "replication": 3,
  "block_size": 134217728,
  "permissions": "0644"
}

Response: 201 Created
{
  "file_id": "12345",
  "blocks": [
    {"block_id": "blk_001", "locations": ["dn1", "dn2", "dn3"]},
    {"block_id": "blk_002", "locations": ["dn2", "dn3", "dn4"]}
  ]
}
```

### Read File
```
GET /api/v1/files?path=/user/data/file.txt

Response: 200 OK
{
  "file_id": "12345",
  "size": 268435456,
  "blocks": [
    {"block_id": "blk_001", "size": 134217728, "locations": ["dn1", "dn2", "dn3"]},
    {"block_id": "blk_002", "size": 134217728, "locations": ["dn2", "dn3", "dn4"]}
  ]
}
```

### Delete File
```
DELETE /api/v1/files?path=/user/data/file.txt

Response: 204 No Content
```

### List Directory
```
GET /api/v1/files?path=/user/data&list=true

Response: 200 OK
{
  "entries": [
    {"name": "file1.txt", "type": "FILE", "size": 1024},
    {"name": "subdir", "type": "DIRECTORY"}
  ]
}
```

## Block Operations API

### Get Block Locations
```
GET /api/v1/blocks/{block_id}/locations

Response: 200 OK
{
  "block_id": "blk_001",
  "locations": [
    {"node_id": "dn1", "hostname": "datanode1.example.com"},
    {"node_id": "dn2", "hostname": "datanode2.example.com"},
    {"node_id": "dn3", "hostname": "datanode3.example.com"}
  ]
}
```

### Report Block
```
POST /api/v1/datanodes/{node_id}/blocks
{
  "blocks": ["blk_001", "blk_002", "blk_003"],
  "storage": {
    "capacity": 10995116277760,
    "used": 5497558138880,
    "remaining": 5497558138880
  }
}

Response: 200 OK
```

## Admin API

### Cluster Status
```
GET /api/v1/admin/status

Response: 200 OK
{
  "total_capacity": 10995116277760,
  "used": 5497558138880,
  "remaining": 5497558138880,
  "live_nodes": 1000,
  "dead_nodes": 0,
  "under_replicated_blocks": 0
}
```

This API design provides comprehensive file system operations for clients and administrators.
