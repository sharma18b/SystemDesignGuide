# Container Orchestration System - Database Design

## etcd Schema Design

### Key Structure
```
Kubernetes uses etcd as its primary datastore with hierarchical key structure:

/registry/{resource_type}/{namespace}/{name}

Examples:
/registry/pods/default/nginx-pod
/registry/services/kube-system/kube-dns
/registry/deployments/production/web-app
/registry/configmaps/default/app-config
```

### Resource Storage

#### Pods
```
Key: /registry/pods/{namespace}/{pod_name}
Value: {
  "metadata": {
    "name": "nginx-pod",
    "namespace": "default",
    "uid": "uuid",
    "resourceVersion": "12345",
    "creationTimestamp": "2026-01-08T10:00:00Z",
    "labels": {"app": "nginx", "tier": "frontend"}
  },
  "spec": {
    "containers": [{
      "name": "nginx",
      "image": "nginx:1.21",
      "ports": [{"containerPort": 80}],
      "resources": {
        "requests": {"cpu": "100m", "memory": "128Mi"},
        "limits": {"cpu": "200m", "memory": "256Mi"}
      }
    }],
    "nodeName": "node-1"
  },
  "status": {
    "phase": "Running",
    "podIP": "10.0.1.5",
    "startTime": "2026-01-08T10:00:05Z",
    "containerStatuses": [{
      "name": "nginx",
      "ready": true,
      "restartCount": 0,
      "state": {"running": {"startedAt": "2026-01-08T10:00:05Z"}}
    }]
  }
}
```

#### Services
```
Key: /registry/services/{namespace}/{service_name}
Value: {
  "metadata": {
    "name": "nginx-service",
    "namespace": "default"
  },
  "spec": {
    "type": "ClusterIP",
    "clusterIP": "10.0.0.1",
    "ports": [{
      "port": 80,
      "targetPort": 8080,
      "protocol": "TCP"
    }],
    "selector": {"app": "nginx"}
  },
  "status": {
    "loadBalancer": {}
  }
}
```

#### Nodes
```
Key: /registry/nodes/{node_name}
Value: {
  "metadata": {
    "name": "node-1",
    "labels": {
      "kubernetes.io/hostname": "node-1",
      "node.kubernetes.io/instance-type": "m5.2xlarge",
      "topology.kubernetes.io/zone": "us-west-2a"
    }
  },
  "spec": {
    "podCIDR": "10.0.1.0/24",
    "providerID": "aws:///us-west-2a/i-1234567890"
  },
  "status": {
    "capacity": {
      "cpu": "8",
      "memory": "32Gi",
      "pods": "110"
    },
    "allocatable": {
      "cpu": "7800m",
      "memory": "30Gi",
      "pods": "110"
    },
    "conditions": [{
      "type": "Ready",
      "status": "True",
      "lastHeartbeatTime": "2026-01-08T10:00:00Z"
    }]
  }
}
```

## etcd Optimization

### Key Design Patterns
```
1. Pagination:
   - List operations with limit
   - Continue token for next page
   - Avoid loading all objects

2. Watch Mechanism:
   - Efficient change notification
   - Bookmark for resume
   - Resource version tracking

3. Compaction:
   - Remove old revisions
   - Keep last 5 minutes
   - Reduce database size

4. Defragmentation:
   - Reclaim space
   - Run during low traffic
   - Improve performance
```

### etcd Performance Tuning
```
Configuration:
- Snapshot count: 10,000
- Heartbeat interval: 100ms
- Election timeout: 1000ms
- Max request bytes: 1.5 MB
- Max concurrent streams: 128

Hardware:
- SSD storage (required)
- 8 cores CPU
- 16 GB RAM
- Dedicated disk for WAL
- Low-latency network

Monitoring:
- Write latency (target: <10ms)
- Commit latency (target: <50ms)
- Database size (limit: 8 GB)
- Compaction duration
```

## Caching Layer

### API Server Cache
```
In-Memory Cache:
- Cache frequently accessed objects
- Reduce etcd load
- Serve reads from cache
- Invalidate on writes

Cache Strategy:
- Cache pods, services, nodes
- TTL: 30 seconds
- Size: 10 GB per API server
- Hit rate: 80%

Benefits:
- Reduced etcd load (80% reduction)
- Faster API responses (<10ms)
- Better scalability
```

### Informer Cache (Client-Side)
```
Informer Pattern:
- List all objects initially
- Watch for changes
- Maintain local cache
- Serve from cache

Implementation:
informer = NewInformer(
    listFunc,
    watchFunc,
    resyncPeriod: 30 seconds
)

Benefits:
- No repeated API calls
- Real-time updates
- Reduced API server load
- Efficient client-side caching
```

## Auxiliary Storage

### Container Registry
```
Registry: Docker Hub, ECR, GCR, Harbor

Storage:
- Image layers: 5 TB
- Manifests: 100 GB
- Metadata: 10 GB

Caching:
- Node-local image cache
- Pull-through cache
- Reduce registry load

Performance:
- Image pull: 10 images/second per node
- Bandwidth: 1 Gbps per node
- Parallel pulls: 5 concurrent
```

### Persistent Volumes
```
Volume Types:
- Local: Node-local SSD
- NFS: Network file system
- Cloud: EBS, GCE PD
- Distributed: Ceph, GlusterFS

Metadata (etcd):
Key: /registry/persistentvolumes/{pv_name}
Value: {
  "spec": {
    "capacity": {"storage": "100Gi"},
    "accessModes": ["ReadWriteOnce"],
    "storageClassName": "fast-ssd",
    "hostPath": {"path": "/mnt/data"}
  },
  "status": {
    "phase": "Bound"
  }
}

Volume Binding:
- Static: Pre-created PVs
- Dynamic: Provision on demand
- Binding: Match PVC to PV
```

## Backup and Recovery

### etcd Backup
```
Backup Strategy:
- Snapshot every hour
- Retention: 24 hours
- Cross-region replication
- Encrypted backups

Backup Process:
etcdctl snapshot save backup.db
etcdctl snapshot status backup.db

Restore Process:
etcdctl snapshot restore backup.db \
  --data-dir=/var/lib/etcd-restore

Recovery Time: <5 minutes
```

### Disaster Recovery
```
Scenario: Complete cluster failure

Recovery Steps:
1. Restore etcd from backup
2. Start control plane components
3. Nodes reconnect automatically
4. Kubelet reconciles pod state
5. Controllers recreate missing resources

Recovery Time: <10 minutes
Data Loss: <1 minute (last backup)
```

## Data Consistency

### Consistency Models
```
Strong Consistency (etcd):
- All writes go through Raft
- Linearizable reads
- Guaranteed ordering

Eventual Consistency (Status):
- Pod status updates
- Node status updates
- Endpoint updates
- 5-10 second lag acceptable

Optimistic Concurrency:
- Resource version for updates
- Conflict detection
- Retry on conflict
```

### Conflict Resolution
```
Update Conflict:
1. Client reads object (version: 100)
2. Client modifies object
3. Client updates with version 100
4. If current version != 100: Conflict
5. Client retries with new version

Implementation:
PUT /api/v1/namespaces/default/pods/nginx
{
  "metadata": {
    "resourceVersion": "100"
  },
  ...
}

Response: 409 Conflict (if version mismatch)
```

## Data Retention

### Retention Policies
```
Active Resources:
- Pods, Services, Deployments: Until deleted
- Nodes: Until deregistered

Events:
- Retention: 1 hour
- Separate etcd instance
- Prevent main etcd bloat

Audit Logs:
- Retention: 1 year
- External storage (S3)
- Compliance requirement

Metrics:
- Recent: 15 days (Prometheus)
- Historical: 1 year (long-term storage)
```

This database design ensures Kubernetes can manage massive clusters efficiently while maintaining consistency, performance, and reliability through etcd's distributed consensus and intelligent caching strategies.
