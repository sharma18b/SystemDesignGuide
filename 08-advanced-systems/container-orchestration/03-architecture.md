# Container Orchestration System - Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Control Plane                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   API    │  │   etcd   │  │Scheduler │  │Controller│  │
│  │  Server  │  │ (State)  │  │          │  │ Manager  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼─────────────┼─────────────┼─────────────┼─────────┘
        │             │             │             │
        └─────────────┼─────────────┼─────────────┘
                      │
┌─────────────────────┼─────────────────────────────────────┐
│                Data Plane (Worker Nodes)                   │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Node 1                                            │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │   │
│  │  │ Kubelet  │  │Container │  │  Kube    │        │   │
│  │  │          │  │ Runtime  │  │  Proxy   │        │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘        │   │
│  │       │             │             │               │   │
│  │  ┌────┴─────────────┴─────────────┴────┐         │   │
│  │  │         Pods (Containers)            │         │   │
│  │  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐       │         │   │
│  │  │  │Pod1│ │Pod2│ │Pod3│ │Pod4│ ...   │         │   │
│  │  │  └────┘ └────┘ └────┘ └────┘       │         │   │
│  │  └──────────────────────────────────────┘         │   │
│  └────────────────────────────────────────────────────┘   │
│  ... (5,000 nodes total)                                   │
└────────────────────────────────────────────────────────────┘
```

## Control Plane Components

### 1. API Server
**Purpose**: Central management interface for all operations

**Responsibilities**:
```
- REST API for all operations
- Authentication and authorization
- Admission control (validation, mutation)
- Proxy to etcd (read/write state)
- Watch mechanism for real-time updates
- API versioning and compatibility
```

**Architecture**:
```
Client → Load Balancer → API Server → etcd

API Server Features:
- Stateless (can scale horizontally)
- 10 instances for HA
- Request prioritization
- Rate limiting
- Audit logging

Request Flow:
1. Authenticate user
2. Authorize operation
3. Validate request (admission controllers)
4. Mutate request (defaulting, injection)
5. Write to etcd
6. Return response
```

### 2. etcd (Distributed Key-Value Store)
**Purpose**: Store all cluster state

**Architecture**:
```
etcd Cluster:
- 5 nodes (HA)
- Raft consensus protocol
- Leader election
- Strong consistency

Data Stored:
- Pods, Services, Deployments
- ConfigMaps, Secrets
- Nodes, Namespaces
- All Kubernetes objects

Performance:
- Writes: 1,000 writes/second
- Reads: 10,000 reads/second
- Watch streams: 10,000 active
- Database size: 8 GB limit
```

**Raft Consensus**:
```
Leader Election:
1. Nodes start in follower state
2. If no heartbeat: Start election
3. Request votes from peers
4. Majority votes → Become leader
5. Leader sends heartbeats

Write Process:
1. Client sends write to leader
2. Leader appends to log
3. Leader replicates to followers
4. Majority acknowledge → Commit
5. Leader applies to state machine
6. Return success to client

Consistency: Linearizable (strong consistency)
```

### 3. Scheduler
**Purpose**: Assign pods to nodes

**Scheduling Algorithm**:
```
1. Filtering Phase:
   - Remove nodes that don't meet requirements
   - Check resource availability
   - Check node selectors
   - Check taints and tolerations
   - Result: Feasible nodes

2. Scoring Phase:
   - Score each feasible node (0-100)
   - Multiple scoring plugins:
     * Resource balance (CPU, memory)
     * Pod affinity/anti-affinity
     * Node affinity
     * Spread across zones
   - Weighted sum of scores

3. Selection:
   - Pick highest-scoring node
   - Bind pod to node
   - Update etcd

Complexity: O(n log n) where n = 5,000 nodes
Time: <1 second per pod
```

**Scheduling Plugins**:
```
Filter Plugins:
- NodeResourcesFit: Check CPU/memory
- NodeName: Match node name
- NodeSelector: Match labels
- TaintToleration: Check taints

Score Plugins:
- NodeResourcesBalancedAllocation: Balance resources
- ImageLocality: Prefer nodes with image cached
- InterPodAffinity: Co-locate related pods
- NodeAffinity: Prefer certain nodes

Weights:
- Resource balance: 30%
- Image locality: 20%
- Pod affinity: 25%
- Node affinity: 25%
```

### 4. Controller Manager
**Purpose**: Maintain desired state through reconciliation loops

**Controllers**:
```
Deployment Controller:
- Manage ReplicaSets
- Rolling updates
- Rollback support

ReplicaSet Controller:
- Maintain pod count
- Create/delete pods
- Handle pod failures

Node Controller:
- Monitor node health
- Evict pods from failed nodes
- Update node status

Service Controller:
- Manage load balancers
- Update endpoints
- Configure networking

Persistent Volume Controller:
- Provision volumes
- Bind volumes to claims
- Manage volume lifecycle
```

**Reconciliation Loop**:
```
loop:
    desired_state = read_from_etcd()
    actual_state = observe_cluster()
    
    if desired_state != actual_state:
        actions = compute_actions(desired_state, actual_state)
        execute_actions(actions)
        update_status()
    
    sleep(reconciliation_interval)  // 10 seconds
```

## Data Plane Components

### 1. Kubelet (Node Agent)
**Purpose**: Manage containers on a node

**Responsibilities**:
```
- Register node with API server
- Watch for pod assignments
- Start/stop containers via runtime
- Monitor container health
- Report node/pod status
- Manage volumes
- Execute probes (liveness, readiness)
```

**Pod Lifecycle**:
```
1. Kubelet watches API server for new pods
2. Pull container images
3. Create pod sandbox (network namespace)
4. Start init containers (sequential)
5. Start app containers (parallel)
6. Monitor container health
7. Restart on failure
8. Report status to API server
```

### 2. Container Runtime (containerd)
**Purpose**: Run containers

**Operations**:
```
- Pull images from registry
- Create containers
- Start/stop containers
- Execute commands in containers
- Stream logs
- Collect metrics

CRI (Container Runtime Interface):
- Standard interface
- Pluggable runtimes
- containerd, CRI-O, Docker
```

### 3. Kube-Proxy (Network Proxy)
**Purpose**: Implement service networking

**Modes**:
```
iptables Mode:
- Create iptables rules
- NAT for service IPs
- Load balance to pods
- Simple but slow at scale

IPVS Mode:
- Use IPVS (IP Virtual Server)
- Kernel-level load balancing
- Better performance
- Supports 10K+ services

eBPF Mode:
- Use eBPF programs
- Kernel bypass
- Lowest latency
- Best performance
```

**Service Implementation**:
```
Service: ClusterIP 10.0.0.1:80
Endpoints: [Pod1:8080, Pod2:8080, Pod3:8080]

iptables Rules:
-A KUBE-SERVICES -d 10.0.0.1/32 -p tcp -m tcp --dport 80 -j KUBE-SVC-XXX
-A KUBE-SVC-XXX -m statistic --mode random --probability 0.33 -j KUBE-SEP-1
-A KUBE-SVC-XXX -m statistic --mode random --probability 0.50 -j KUBE-SEP-2
-A KUBE-SVC-XXX -j KUBE-SEP-3
-A KUBE-SEP-1 -p tcp -m tcp -j DNAT --to-destination Pod1:8080
-A KUBE-SEP-2 -p tcp -m tcp -j DNAT --to-destination Pod2:8080
-A KUBE-SEP-3 -p tcp -m tcp -j DNAT --to-destination Pod3:8080

Result: Random load balancing across pods
```

## Networking Architecture

### Pod Networking (CNI)
```
Requirements:
- Every pod gets unique IP
- Pods can communicate without NAT
- Nodes can communicate with pods
- Pods can communicate with external

Implementation (Calico):
- BGP routing between nodes
- IP-in-IP tunneling (optional)
- Network policies with iptables
- IPAM (IP Address Management)

IP Allocation:
- Cluster CIDR: 10.0.0.0/8
- Per-node CIDR: 10.0.X.0/24 (254 IPs)
- Total capacity: 16M IPs
```

### Service Mesh (Optional)
```
Technology: Istio / Linkerd

Features:
- Traffic management (routing, retries)
- Security (mTLS, authorization)
- Observability (metrics, tracing)
- Resilience (circuit breakers, timeouts)

Architecture:
- Sidecar proxy per pod (Envoy)
- Control plane (Istiod)
- Telemetry collection

Overhead:
- CPU: 0.5 cores per pod
- Memory: 50 MB per pod
- Latency: 1-2ms additional
```

## Storage Architecture

### Persistent Volume Subsystem
```
Components:
- PersistentVolume (PV): Cluster resource
- PersistentVolumeClaim (PVC): User request
- StorageClass: Dynamic provisioning

Workflow:
1. User creates PVC
2. Scheduler finds matching PV or provisions new
3. Bind PVC to PV
4. Kubelet mounts volume to pod
5. Container uses volume

Volume Plugins:
- Local: Node-local storage
- NFS: Network file system
- Cloud: EBS, GCE PD, Azure Disk
- Distributed: Ceph, GlusterFS
```

## Monitoring and Observability

### Metrics Collection
```
Metrics Server:
- Collect CPU/memory from kubelets
- Aggregate cluster metrics
- Expose via API
- Used by HPA (autoscaling)

Prometheus:
- Scrape metrics from all components
- Time-series database
- Alerting rules
- Grafana dashboards

Key Metrics:
- Node CPU/memory usage
- Pod CPU/memory usage
- API server latency
- etcd performance
- Network throughput
```

### Logging
```
Log Collection:
- Container logs via kubelet
- Node logs via DaemonSet
- Control plane logs

Log Aggregation:
- Fluentd/Fluent Bit
- Elasticsearch for storage
- Kibana for visualization

Log Retention:
- Recent logs: 7 days
- Archived logs: 90 days
- Compliance logs: 7 years
```

This architecture provides a comprehensive container orchestration system capable of managing hundreds of thousands of containers across thousands of nodes with high availability and performance.
