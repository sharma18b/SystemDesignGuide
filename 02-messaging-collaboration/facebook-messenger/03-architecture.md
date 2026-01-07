# Facebook Messenger - System Architecture

## High-Level Architecture Overview

### System Architecture Principles
- **Microservices Architecture**: Decomposed into 50+ independent services
- **Event-Driven Design**: Asynchronous communication using message queues
- **Horizontal Scalability**: Scale individual components independently
- **Regional Deployment**: Multi-region architecture for global reach
- **Fault Tolerance**: Graceful degradation and automatic recovery
- **Real-time First**: Optimized for low-latency, real-time communication

### Core Architecture Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │   Web Clients   │    │ Desktop Clients │
│  (iOS/Android)  │    │   (Browser)     │    │ (Win/Mac/Linux) │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │     Load Balancer         │
                    │   (Global Traffic Mgr)    │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │      API Gateway          │
                    │  (Auth, Rate Limiting)    │
                    └─────────────┬─────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                       │                        │
┌───────┴────────┐    ┌─────────┴─────────┐    ┌────────┴────────┐
│ WebSocket      │    │   REST API        │    │  GraphQL API    │
│ Gateway        │    │   Services        │    │  Services       │
└───────┬────────┘    └─────────┬─────────┘    └────────┬────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   Message Router    │
                    │   (Core Service)    │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                     │                      │
┌───────┴────────┐  ┌─────────┴─────────┐  ┌────────┴────────┐
│   Presence     │  │   Notification    │  │   Media         │
│   Service      │  │   Service         │  │   Service       │
└───────┬────────┘  └─────────┬─────────┘  └────────┬────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                             │
                    ┌────────┴────────┐
                    │   Data Layer    │
                    │ (Databases/Cache)│
                    └─────────────────┘
```

## Real-time Communication Architecture

### WebSocket Gateway Service
- **Connection Management**: Handle 100M+ concurrent WebSocket connections
- **Load Balancing**: Distribute connections across multiple gateway servers
- **Session Affinity**: Maintain user sessions on specific servers
- **Connection Pooling**: Reuse connections for multiple conversations
- **Heartbeat Monitoring**: Detect and handle dead connections
- **Graceful Shutdown**: Migrate connections during server maintenance

### WebSocket Connection Flow
```
Client                    Gateway                 Message Router
  │                         │                         │
  ├─── WebSocket Handshake ─→│                         │
  │                         ├─── Authenticate ────────→│
  │                         │←─── Auth Response ───────┤
  │←─── Connection Established ─┤                       │
  │                         │                         │
  ├─── Send Message ────────→│                         │
  │                         ├─── Route Message ───────→│
  │                         │                         │
  │                         │←─── Delivery Confirm ────┤
  │←─── Message Delivered ───┤                         │
```

### Alternative Communication Protocols

#### Server-Sent Events (SSE)
- **Use Case**: One-way server-to-client communication
- **Advantages**: Simpler than WebSocket, automatic reconnection
- **Disadvantages**: HTTP overhead, no client-to-server real-time
- **Implementation**: Fallback for environments blocking WebSocket

#### Long Polling
- **Use Case**: Environments with WebSocket/SSE restrictions
- **Mechanism**: HTTP requests with long timeout waiting for events
- **Advantages**: Works through all proxies and firewalls
- **Disadvantages**: Higher latency, more server resources

#### HTTP/2 Server Push
- **Use Case**: Modern browsers with HTTP/2 support
- **Advantages**: Multiplexing, header compression
- **Disadvantages**: Limited browser support, complex implementation

## Message Routing and Delivery System

### Message Router Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Ingestion     │    │   Processing    │    │   Delivery      │
│   Service       │    │   Pipeline      │    │   Service       │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Message Queue  │    │  Content Filter │    │  Recipient      │
│   (Kafka)       │    │  Spam Detection │    │  Resolution     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Persistence   │    │   Analytics     │    │   Push          │
│   Service       │    │   Service       │    │   Notification  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Message Processing Pipeline
1. **Message Ingestion**: Receive message from client via WebSocket/HTTP
2. **Validation**: Verify message format, size limits, user permissions
3. **Spam Detection**: Real-time ML-based spam and abuse detection
4. **Content Moderation**: Scan for inappropriate content using AI
5. **Recipient Resolution**: Determine all recipients for the message
6. **Persistence**: Store message in database with proper sharding
7. **Delivery**: Route message to all online recipients
8. **Notification**: Send push notifications to offline recipients
9. **Analytics**: Update metrics and user engagement data

### Message Delivery Guarantees
- **At-Least-Once**: Every message delivered at least once to recipients
- **Idempotency**: Duplicate messages handled gracefully by clients
- **Ordering**: Messages delivered in send order within conversations
- **Acknowledgments**: Server and client ACKs for reliable delivery
- **Retry Logic**: Exponential backoff for failed deliveries
- **Dead Letter Queue**: Handle permanently failed messages

## Presence Service Architecture

### Presence System Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Presence      │    │   Presence      │    │   Presence      │
│   Collector     │    │   Aggregator    │    │   Distributor   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Device Events  │    │  User Status    │    │  Subscriber     │
│  (Heartbeats)   │    │  Computation    │    │  Notification   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Presence States and Transitions
- **Online**: User actively using the application
- **Away**: User inactive for 5+ minutes but app open
- **Offline**: User closed app or lost network connection
- **Last Seen**: Timestamp of last activity for offline users
- **Typing**: Real-time typing indicator in specific conversations
- **Custom Status**: User-defined status messages and emoji

### Presence Update Flow
1. **Heartbeat Collection**: Clients send periodic heartbeats (30s interval)
2. **Activity Detection**: Monitor user interactions and app state
3. **Status Computation**: Aggregate status from all user devices
4. **Change Detection**: Identify presence state changes
5. **Subscriber Notification**: Notify friends/contacts of status changes
6. **Cache Updates**: Update presence cache for fast lookups
7. **Persistence**: Store last seen timestamps for offline users

### Presence Scaling Challenges
- **Fan-out Problem**: Popular users have millions of subscribers
- **Update Frequency**: Balance freshness vs system load
- **Cross-Device Consistency**: Aggregate presence from multiple devices
- **Privacy Controls**: Respect user privacy settings for presence
- **Geographic Distribution**: Consistent presence across regions

## Notification Service Architecture

### Push Notification Pipeline
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Trigger       │    │   Notification  │    │   Delivery      │
│   Detection     │    │   Composer      │    │   Gateway       │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Event Stream   │    │  Template       │    │   Platform      │
│  Processing     │    │  Engine         │    │   Adapters      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User          │    │   Localization  │    │   APNs/FCM      │
│   Preferences   │    │   Service       │    │   Integration   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Notification Types and Channels
- **Push Notifications**: Mobile (APNs/FCM), Desktop (native)
- **Email Notifications**: Digest emails for missed messages
- **SMS Notifications**: Critical alerts and 2FA codes
- **In-App Notifications**: Banners and badges within the app
- **Web Notifications**: Browser notifications for web clients

### Notification Personalization
- **User Preferences**: Per-conversation notification settings
- **Smart Filtering**: ML-based importance scoring
- **Quiet Hours**: Respect user's do-not-disturb schedules
- **Frequency Capping**: Prevent notification spam
- **Localization**: Multi-language notification content
- **Rich Content**: Images, actions, and interactive elements

## Data Storage Architecture

### Database Sharding Strategy
```
┌─────────────────────────────────────────────────────────────┐
│                    Message Database Cluster                 │
├─────────────────────────────────────────────────────────────┤
│  Shard 1        │  Shard 2        │  ...  │  Shard N       │
│  Conv 1-1000    │  Conv 1001-2000 │       │  Conv N-1000   │
│  ┌───────────┐  │  ┌───────────┐  │       │  ┌───────────┐ │
│  │ Primary   │  │  │ Primary   │  │       │  │ Primary   │ │
│  │ Replica 1 │  │  │ Replica 1 │  │       │  │ Replica 1 │ │
│  │ Replica 2 │  │  │ Replica 2 │  │       │  │ Replica 2 │ │
│  └───────────┘  │  └───────────┘  │       │  └───────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Storage Tiers and Data Lifecycle
- **Hot Storage**: Recent messages (<30 days) on NVMe SSD
- **Warm Storage**: Older messages (30 days - 1 year) on SATA SSD
- **Cold Storage**: Archive messages (>1 year) on object storage
- **Backup Storage**: Cross-region replicas for disaster recovery
- **Compliance Storage**: Immutable storage for legal requirements

### Caching Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │    │   Distributed   │    │   Database      │
│   Cache (L1)    │    │   Cache (L2)    │    │   Cache (L3)    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  In-Memory      │    │  Redis Cluster  │    │  Database       │
│  (Recent Msgs)  │    │  (Hot Data)     │    │  Buffer Pool    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Service Mesh and Inter-Service Communication

### Service Discovery and Load Balancing
- **Service Registry**: Consul/etcd for service discovery
- **Load Balancing**: Envoy proxy with intelligent routing
- **Circuit Breakers**: Prevent cascade failures
- **Retry Policies**: Exponential backoff with jitter
- **Timeout Management**: Per-service timeout configuration
- **Health Checks**: Continuous service health monitoring

### Security and Authentication
- **mTLS**: Mutual TLS for all inter-service communication
- **JWT Tokens**: Stateless authentication tokens
- **OAuth 2.0**: Third-party integration authentication
- **Rate Limiting**: Per-user and per-service rate limits
- **API Gateway**: Centralized security policy enforcement
- **Audit Logging**: Comprehensive security event logging

### Monitoring and Observability
- **Distributed Tracing**: Jaeger for request tracing
- **Metrics Collection**: Prometheus for system metrics
- **Log Aggregation**: ELK stack for centralized logging
- **Alerting**: PagerDuty integration for critical alerts
- **Dashboards**: Grafana for real-time system monitoring
- **SLA Monitoring**: Track and alert on SLA violations

This comprehensive architecture provides the foundation for building a scalable, reliable, and performant messaging platform capable of serving billions of users worldwide.
