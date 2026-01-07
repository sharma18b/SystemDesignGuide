# Distributed Unique ID Generator - System Architecture

## High-Level Architecture Overview

### System Architecture Principles
- **Coordination-Free Design**: No inter-node communication required
- **Stateless Nodes**: Each node operates independently
- **Time-Based Ordering**: Leverage timestamps for sortability
- **Horizontal Scalability**: Add nodes without coordination
- **High Availability**: No single point of failure
- **Low Latency**: Sub-millisecond ID generation

### Core Architecture Components
```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
│  (Web Services, Mobile Apps, Microservices, Databases)      │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer Layer                       │
│         (HAProxy, NGINX, AWS ALB, Geographic Routing)        │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌─────────┴─────────┬─────────────┬─────────────┐
        │                   │             │             │
        ▼                   ▼             ▼             ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ ID Generator │   │ ID Generator │   │ ID Generator │   │ ID Generator │
│   Node 1     │   │   Node 2     │   │   Node 3     │   │   Node N     │
│ Worker ID: 1 │   │ Worker ID: 2 │   │ Worker ID: 3 │   │ Worker ID: N │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │                  │
       └──────────────────┴──────────────────┴──────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │   Configuration Store    │
                    │  (Zookeeper, etcd, Consul)│
                    │   (Optional for dynamic  │
                    │    worker ID assignment) │
                    └──────────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │   Monitoring & Metrics   │
                    │  (Prometheus, Grafana)   │
                    └──────────────────────────┘
```

## Snowflake ID Format Design

### 64-Bit ID Structure
```
┌─────────────────────────────────────────────────────────────┐
│                     64-bit Snowflake ID                      │
├──────┬──────────────────────────┬──────────┬──────────┬─────┤
│ Sign │      Timestamp (41)      │ DC (5)   │ Worker(5)│Seq(12)│
│  1   │    41 bits = 69 years    │ 5 bits   │ 5 bits   │12 bits│
│      │                          │ 32 DCs   │32 workers│4096/ms│
└──────┴──────────────────────────┴──────────┴──────────┴─────┘

Bit Allocation:
- Bit 63: Sign bit (always 0 for positive numbers)
- Bits 62-22: Timestamp (milliseconds since custom epoch)
- Bits 21-17: Datacenter ID (0-31)
- Bits 16-12: Worker ID (0-31)
- Bits 11-0: Sequence number (0-4095)

Example ID: 1234567890123456789
Binary: 0001 0001 0001 0110 1010 0111 0011 1100 1010 0111 0011 1100 1010 0101
        │    └─────── Timestamp ──────┘ │DC│ │Wkr│ │─ Sequence ─│
```

### ID Generation Algorithm
```python
class SnowflakeIDGenerator:
    def __init__(self, datacenter_id, worker_id, epoch=1609459200000):
        self.datacenter_id = datacenter_id  # 0-31
        self.worker_id = worker_id          # 0-31
        self.epoch = epoch                  # Custom epoch (2021-01-01)
        self.sequence = 0
        self.last_timestamp = -1
        
    def generate_id(self):
        timestamp = self.current_timestamp()
        
        # Handle clock moving backwards
        if timestamp < self.last_timestamp:
            raise Exception(f"Clock moved backwards. Refusing to generate ID")
        
        # Same millisecond - increment sequence
        if timestamp == self.last_timestamp:
            self.sequence = (self.sequence + 1) & 0xFFF  # 12-bit mask
            
            # Sequence overflow - wait for next millisecond
            if self.sequence == 0:
                timestamp = self.wait_next_millis(self.last_timestamp)
        else:
            # New millisecond - reset sequence
            self.sequence = 0
        
        self.last_timestamp = timestamp
        
        # Construct ID
        id = ((timestamp - self.epoch) << 22) | \
             (self.datacenter_id << 17) | \
             (self.worker_id << 12) | \
             self.sequence
        
        return id
    
    def current_timestamp(self):
        return int(time.time() * 1000)  # Milliseconds
    
    def wait_next_millis(self, last_timestamp):
        timestamp = self.current_timestamp()
        while timestamp <= last_timestamp:
            timestamp = self.current_timestamp()
        return timestamp
```

## Alternative ID Generation Strategies

### Instagram-Style IDs
```
┌─────────────────────────────────────────────────────────────┐
│                     64-bit Instagram ID                      │
├──────────────────────────────────┬──────────────────────────┤
│      Timestamp (41 bits)         │   Shard ID + Sequence    │
│   Milliseconds since epoch       │   (23 bits combined)     │
└──────────────────────────────────┴──────────────────────────┘

Advantages:
- Simpler structure (no datacenter/worker split)
- More sequence space (23 bits vs 12 bits)
- Shard-aware for database partitioning

Disadvantages:
- Less metadata embedded
- Harder to debug (no explicit worker ID)
```

### UUID v1 (Time-Based)
```
┌─────────────────────────────────────────────────────────────┐
│                     128-bit UUID v1                          │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ Time Low(32) │Time Mid(16)  │Time High(16) │Clock+Node(64)  │
│              │              │ + Version    │                │
└──────────────┴──────────────┴──────────────┴────────────────┘

Advantages:
- Standardized format (RFC 4122)
- 128-bit space (virtually unlimited)
- Includes MAC address for uniqueness

Disadvantages:
- Larger storage (16 bytes vs 8 bytes)
- Privacy concerns (MAC address exposure)
- Not sortable in standard form
```

### ULID (Universally Unique Lexicographically Sortable ID)
```
┌─────────────────────────────────────────────────────────────┐
│                     128-bit ULID                             │
├──────────────────────────────────┬──────────────────────────┤
│      Timestamp (48 bits)         │   Randomness (80 bits)   │
│   Milliseconds since epoch       │   Cryptographically      │
│                                  │   secure random          │
└──────────────────────────────────┴──────────────────────────┘

String Representation: 01ARZ3NDEKTSV4RRFFQ69G5FAV
                       └─ Timestamp ─┘└─ Randomness ─┘

Advantages:
- Lexicographically sortable
- Case-insensitive base32 encoding
- No coordination required
- 128-bit space

Disadvantages:
- Larger storage than Snowflake
- Random component (no embedded metadata)
```

## Multi-Datacenter Architecture

### Geographic Distribution
```
┌─────────────────────────────────────────────────────────────┐
│                    Global Architecture                       │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   US-East DC     │  │   EU-West DC     │  │   APAC DC        │
│   DC ID: 0       │  │   DC ID: 1       │  │   DC ID: 2       │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ Worker 0-9       │  │ Worker 0-9       │  │ Worker 0-9       │
│ (10 nodes)       │  │ (10 nodes)       │  │ (10 nodes)       │
│                  │  │                  │  │                  │
│ Load Balancer    │  │ Load Balancer    │  │ Load Balancer    │
│ Health Checks    │  │ Health Checks    │  │ Health Checks    │
│ Monitoring       │  │ Monitoring       │  │ Monitoring       │
└──────────────────┘  └──────────────────┘  └──────────────────┘
         │                     │                     │
         └─────────────────────┴─────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │  Global Monitoring  │
                    │  & Configuration    │
                    └─────────────────────┘
```

### Datacenter Failover Strategy
```
Normal Operation:
Client → GeoDNS → Nearest DC → ID Generator

Datacenter Failure:
Client → GeoDNS → Next Nearest DC → ID Generator
                  (Automatic failover)

Benefits:
- No coordination between DCs
- Independent operation
- Automatic geographic routing
- Graceful degradation
```

## Worker ID Management

### Static Worker ID Assignment
```
Configuration File (config.yaml):
datacenter_id: 0
worker_id: 5
epoch: 1609459200000  # 2021-01-01 00:00:00 UTC
port: 8080

Advantages:
- Simple configuration
- No external dependencies
- Fast startup
- Predictable behavior

Disadvantages:
- Manual management
- Risk of conflicts
- Difficult to scale dynamically
```

### Dynamic Worker ID Assignment
```
┌─────────────────────────────────────────────────────────────┐
│              Dynamic Worker ID Assignment Flow               │
└─────────────────────────────────────────────────────────────┘

1. Node Startup
   ├─→ Connect to Zookeeper/etcd
   ├─→ Request available worker ID
   ├─→ Create ephemeral node: /workers/dc0/worker5
   └─→ Start ID generation

2. Node Operation
   ├─→ Maintain heartbeat to coordination service
   ├─→ Renew ephemeral node lease
   └─→ Monitor for worker ID conflicts

3. Node Shutdown
   ├─→ Graceful shutdown signal
   ├─→ Stop accepting new requests
   ├─→ Complete in-flight requests
   ├─→ Release worker ID (delete ephemeral node)
   └─→ Exit

4. Node Failure
   ├─→ Heartbeat timeout
   ├─→ Ephemeral node deleted automatically
   ├─→ Worker ID becomes available
   └─→ New node can claim ID after grace period

Zookeeper Structure:
/id-generator
  /datacenters
    /dc0
      /workers
        /worker0 (ephemeral, node: server1.example.com)
        /worker1 (ephemeral, node: server2.example.com)
        /worker2 (ephemeral, node: server3.example.com)
    /dc1
      /workers
        /worker0 (ephemeral, node: server4.example.com)
```

## Clock Synchronization and Time Management

### NTP Synchronization Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                  NTP Synchronization Layer                   │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ NTP Server 1 │  │ NTP Server 2 │  │ NTP Server 3 │
│ (Primary)    │  │ (Secondary)  │  │ (Tertiary)   │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┴─────────────────┘
                         │
              ┌──────────┴──────────┐
              │   ID Generator Node │
              │   - ntpd daemon     │
              │   - Clock monitor   │
              │   - Drift detection │
              └─────────────────────┘

Clock Monitoring:
- Check clock drift every 10 seconds
- Alert if drift > 100ms
- Refuse ID generation if drift > 1 second
- Log all clock adjustments
```

### Handling Clock Regression
```python
class ClockManager:
    def __init__(self):
        self.last_timestamp = 0
        self.clock_regression_count = 0
        
    def get_timestamp(self):
        current = int(time.time() * 1000)
        
        if current < self.last_timestamp:
            # Clock moved backwards
            regression = self.last_timestamp - current
            self.clock_regression_count += 1
            
            if regression < 5:  # Less than 5ms
                # Small regression - wait it out
                time.sleep(regression / 1000.0)
                return self.last_timestamp
            elif regression < 1000:  # Less than 1 second
                # Medium regression - use last timestamp
                logging.warning(f"Clock regression: {regression}ms")
                return self.last_timestamp
            else:
                # Large regression - refuse to generate
                raise ClockRegressionError(
                    f"Clock moved backwards by {regression}ms"
                )
        
        self.last_timestamp = current
        return current
```

## API Design and Service Interface

### REST API Endpoints
```
GET /api/v1/id
- Generate single ID
- Response: {"id": 1234567890123456789}

GET /api/v1/ids?count=100
- Generate multiple IDs
- Response: {"ids": [123..., 456..., 789...]}

GET /api/v1/parse?id=1234567890123456789
- Parse ID components
- Response: {
    "timestamp": "2024-01-03T19:30:00Z",
    "datacenter_id": 0,
    "worker_id": 5,
    "sequence": 42
  }

GET /api/v1/health
- Health check endpoint
- Response: {
    "status": "healthy",
    "worker_id": 5,
    "datacenter_id": 0,
    "uptime_seconds": 86400,
    "ids_generated": 1000000
  }

GET /api/v1/metrics
- Prometheus metrics endpoint
- Response: Prometheus format metrics
```

### gRPC Service Definition
```protobuf
syntax = "proto3";

service IDGenerator {
  rpc GenerateID(GenerateIDRequest) returns (GenerateIDResponse);
  rpc GenerateBatch(GenerateBatchRequest) returns (GenerateBatchResponse);
  rpc ParseID(ParseIDRequest) returns (ParseIDResponse);
  rpc HealthCheck(HealthCheckRequest) returns (HealthCheckResponse);
}

message GenerateIDRequest {}

message GenerateIDResponse {
  int64 id = 1;
}

message GenerateBatchRequest {
  int32 count = 1;  // Number of IDs to generate
}

message GenerateBatchResponse {
  repeated int64 ids = 1;
}

message ParseIDRequest {
  int64 id = 1;
}

message ParseIDResponse {
  int64 timestamp_ms = 1;
  int32 datacenter_id = 2;
  int32 worker_id = 3;
  int32 sequence = 4;
}

message HealthCheckRequest {}

message HealthCheckResponse {
  string status = 1;
  int32 worker_id = 2;
  int32 datacenter_id = 3;
  int64 uptime_seconds = 4;
  int64 ids_generated = 5;
}
```

## Monitoring and Observability

### Key Metrics to Track
```
Performance Metrics:
- id_generation_latency_ms (histogram)
- id_generation_rate (counter)
- sequence_overflow_count (counter)
- clock_regression_count (counter)

Resource Metrics:
- cpu_usage_percent (gauge)
- memory_usage_bytes (gauge)
- goroutines_count (gauge)

Health Metrics:
- uptime_seconds (gauge)
- last_id_timestamp (gauge)
- clock_drift_ms (gauge)
- ntp_sync_status (gauge)

Business Metrics:
- total_ids_generated (counter)
- ids_per_second (gauge)
- error_rate (counter)
```

### Alerting Rules
```yaml
alerts:
  - name: HighClockDrift
    condition: clock_drift_ms > 100
    severity: warning
    action: Page on-call engineer
    
  - name: ClockRegression
    condition: clock_regression_count > 10 in 1m
    severity: critical
    action: Page on-call engineer
    
  - name: SequenceOverflow
    condition: sequence_overflow_count > 100 in 1m
    severity: warning
    action: Scale up workers
    
  - name: HighLatency
    condition: p99(id_generation_latency_ms) > 10
    severity: warning
    action: Investigate performance
```

This comprehensive architecture provides a robust, scalable, and efficient foundation for distributed unique ID generation across multiple datacenters with high availability and low latency.
