# Container Orchestration System - API Design

## API Overview

### Base URL
```
https://kubernetes.default.svc.cluster.local
```

### API Groups
```
Core API (v1): /api/v1
Apps API: /apis/apps/v1
Batch API: /apis/batch/v1
Networking: /apis/networking.k8s.io/v1
Storage: /apis/storage.k8s.io/v1
```

### Authentication
```
Methods:
- Bearer tokens (Service Account)
- Client certificates (x509)
- OIDC tokens (external identity)
- Webhook token authentication

Headers:
Authorization: Bearer {token}
```

## Pod APIs

### 1. Create Pod
```
POST /api/v1/namespaces/{namespace}/pods
Content-Type: application/json

Request:
{
  "apiVersion": "v1",
  "kind": "Pod",
  "metadata": {
    "name": "nginx-pod",
    "labels": {"app": "nginx"}
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
    }]
  }
}

Response: 201 Created
{
  "metadata": {
    "name": "nginx-pod",
    "namespace": "default",
    "uid": "uuid",
    "resourceVersion": "12345",
    "creationTimestamp": "2026-01-08T10:00:00Z"
  },
  "status": {
    "phase": "Pending"
  }
}
```

### 2. List Pods
```
GET /api/v1/namespaces/{namespace}/pods?labelSelector=app=nginx&limit=100

Response: 200 OK
{
  "apiVersion": "v1",
  "kind": "PodList",
  "metadata": {
    "resourceVersion": "12345",
    "continue": "eyJyZXNvdXJjZVZlcnNpb24iOiIxMjM0NSJ9"
  },
  "items": [
    {
      "metadata": {"name": "nginx-pod-1", ...},
      "spec": {...},
      "status": {"phase": "Running", ...}
    }
  ]
}
```

### 3. Watch Pods
```
GET /api/v1/namespaces/{namespace}/pods?watch=true

Response: Stream of events
{
  "type": "ADDED",
  "object": {
    "metadata": {"name": "nginx-pod", ...},
    "spec": {...}
  }
}

{
  "type": "MODIFIED",
  "object": {
    "metadata": {"name": "nginx-pod", ...},
    "status": {"phase": "Running"}
  }
}

{
  "type": "DELETED",
  "object": {
    "metadata": {"name": "nginx-pod", ...}
  }
}
```

### 4. Delete Pod
```
DELETE /api/v1/namespaces/{namespace}/pods/{pod_name}

Response: 200 OK
{
  "kind": "Status",
  "status": "Success",
  "details": {
    "name": "nginx-pod",
    "kind": "Pod"
  }
}
```

### 5. Get Pod Logs
```
GET /api/v1/namespaces/{namespace}/pods/{pod_name}/log?container={container_name}&tailLines=100

Response: 200 OK (plain text)
2026-01-08T10:00:00.123Z [INFO] Server started
2026-01-08T10:00:01.456Z [INFO] Listening on port 80
...
```

## Deployment APIs

### 1. Create Deployment
```
POST /apis/apps/v1/namespaces/{namespace}/deployments

Request:
{
  "apiVersion": "apps/v1",
  "kind": "Deployment",
  "metadata": {
    "name": "nginx-deployment"
  },
  "spec": {
    "replicas": 3,
    "selector": {
      "matchLabels": {"app": "nginx"}
    },
    "template": {
      "metadata": {
        "labels": {"app": "nginx"}
      },
      "spec": {
        "containers": [{
          "name": "nginx",
          "image": "nginx:1.21",
          "ports": [{"containerPort": 80}]
        }]
      }
    },
    "strategy": {
      "type": "RollingUpdate",
      "rollingUpdate": {
        "maxSurge": 1,
        "maxUnavailable": 0
      }
    }
  }
}
```

### 2. Update Deployment (Rolling Update)
```
PATCH /apis/apps/v1/namespaces/{namespace}/deployments/{name}
Content-Type: application/strategic-merge-patch+json

Request:
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "nginx",
          "image": "nginx:1.22"
        }]
      }
    }
  }
}

Response: 200 OK (updated deployment)
```

### 3. Scale Deployment
```
PATCH /apis/apps/v1/namespaces/{namespace}/deployments/{name}/scale

Request:
{
  "spec": {
    "replicas": 5
  }
}

Response: 200 OK
{
  "spec": {
    "replicas": 5
  },
  "status": {
    "replicas": 3,
    "readyReplicas": 3
  }
}
```

## Service APIs

### 1. Create Service
```
POST /api/v1/namespaces/{namespace}/services

Request:
{
  "apiVersion": "v1",
  "kind": "Service",
  "metadata": {
    "name": "nginx-service"
  },
  "spec": {
    "type": "LoadBalancer",
    "selector": {"app": "nginx"},
    "ports": [{
      "port": 80,
      "targetPort": 8080,
      "protocol": "TCP"
    }]
  }
}

Response: 201 Created
{
  "spec": {
    "clusterIP": "10.0.0.1",
    "type": "LoadBalancer"
  },
  "status": {
    "loadBalancer": {
      "ingress": [{"ip": "203.0.113.1"}]
    }
  }
}
```

### 2. Get Endpoints
```
GET /api/v1/namespaces/{namespace}/endpoints/{service_name}

Response: 200 OK
{
  "subsets": [{
    "addresses": [
      {"ip": "10.0.1.5", "nodeName": "node-1", "targetRef": {"kind": "Pod", "name": "nginx-pod-1"}},
      {"ip": "10.0.1.6", "nodeName": "node-2", "targetRef": {"kind": "Pod", "name": "nginx-pod-2"}}
    ],
    "ports": [{"port": 8080, "protocol": "TCP"}]
  }]
}
```

## Node APIs

### 1. List Nodes
```
GET /api/v1/nodes

Response: 200 OK
{
  "items": [
    {
      "metadata": {"name": "node-1"},
      "status": {
        "capacity": {"cpu": "8", "memory": "32Gi"},
        "allocatable": {"cpu": "7800m", "memory": "30Gi"},
        "conditions": [{"type": "Ready", "status": "True"}]
      }
    }
  ]
}
```

### 2. Cordon Node (Mark Unschedulable)
```
PATCH /api/v1/nodes/{node_name}

Request:
{
  "spec": {
    "unschedulable": true
  }
}

Response: 200 OK
```

### 3. Drain Node (Evict Pods)
```
POST /api/v1/namespaces/{namespace}/pods/{pod_name}/eviction

Request:
{
  "apiVersion": "policy/v1",
  "kind": "Eviction",
  "metadata": {"name": "nginx-pod"}
}

Response: 201 Created
```

## ConfigMap and Secret APIs

### 1. Create ConfigMap
```
POST /api/v1/namespaces/{namespace}/configmaps

Request:
{
  "metadata": {"name": "app-config"},
  "data": {
    "database_url": "postgres://db:5432",
    "log_level": "info"
  }
}
```

### 2. Create Secret
```
POST /api/v1/namespaces/{namespace}/secrets

Request:
{
  "metadata": {"name": "db-secret"},
  "type": "Opaque",
  "data": {
    "username": "YWRtaW4=",  // base64 encoded
    "password": "cGFzc3dvcmQ="
  }
}
```

## Metrics APIs

### 1. Node Metrics
```
GET /apis/metrics.k8s.io/v1beta1/nodes

Response: 200 OK
{
  "items": [{
    "metadata": {"name": "node-1"},
    "timestamp": "2026-01-08T10:00:00Z",
    "window": "30s",
    "usage": {
      "cpu": "2500m",
      "memory": "10Gi"
    }
  }]
}
```

### 2. Pod Metrics
```
GET /apis/metrics.k8s.io/v1beta1/namespaces/{namespace}/pods

Response: 200 OK
{
  "items": [{
    "metadata": {"name": "nginx-pod"},
    "timestamp": "2026-01-08T10:00:00Z",
    "containers": [{
      "name": "nginx",
      "usage": {
        "cpu": "100m",
        "memory": "128Mi"
      }
    }]
  }]
}
```

## Custom Resource Definitions (CRDs)

### Define Custom Resource
```
POST /apis/apiextensions.k8s.io/v1/customresourcedefinitions

Request:
{
  "metadata": {"name": "databases.example.com"},
  "spec": {
    "group": "example.com",
    "versions": [{
      "name": "v1",
      "served": true,
      "storage": true,
      "schema": {
        "openAPIV3Schema": {
          "type": "object",
          "properties": {
            "spec": {
              "type": "object",
              "properties": {
                "size": {"type": "string"},
                "version": {"type": "string"}
              }
            }
          }
        }
      }
    }],
    "scope": "Namespaced",
    "names": {
      "plural": "databases",
      "singular": "database",
      "kind": "Database"
    }
  }
}
```

### Use Custom Resource
```
POST /apis/example.com/v1/namespaces/{namespace}/databases

Request:
{
  "apiVersion": "example.com/v1",
  "kind": "Database",
  "metadata": {"name": "my-db"},
  "spec": {
    "size": "10Gi",
    "version": "14.5"
  }
}
```

## Rate Limiting

### Rate Limits
```
Per User:
- List: 100 requests/minute
- Get: 1000 requests/minute
- Create/Update: 50 requests/minute
- Delete: 50 requests/minute

Per Service Account:
- Higher limits for system components
- Kubelet: 10,000 requests/minute
- Controller: 5,000 requests/minute

Headers:
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704715200
```

## Error Responses

### Standard Error Format
```json
{
  "kind": "Status",
  "apiVersion": "v1",
  "status": "Failure",
  "message": "pods \"nginx-pod\" not found",
  "reason": "NotFound",
  "details": {
    "name": "nginx-pod",
    "kind": "pods"
  },
  "code": 404
}
```

### HTTP Status Codes
```
200 OK - Success
201 Created - Resource created
204 No Content - Deleted successfully
400 Bad Request - Invalid request
401 Unauthorized - Authentication required
403 Forbidden - Insufficient permissions
404 Not Found - Resource not found
409 Conflict - Resource version conflict
422 Unprocessable Entity - Validation error
429 Too Many Requests - Rate limit
500 Internal Server Error - Server error
503 Service Unavailable - API server overloaded
```

This API design provides comprehensive cluster management functionality with RESTful APIs, real-time watch mechanisms, and extensibility through custom resources.
