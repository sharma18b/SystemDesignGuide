# System Architecture - Live Comment System

## High-Level Architecture Overview

### Core Architecture Principles

**Event-Driven Real-Time Architecture**:
The live comment system is built around an event-driven architecture that prioritizes real-time message delivery with eventual consistency. Unlike traditional messaging systems that focus on reliable delivery, live comments prioritize speed and can tolerate occasional message loss during extreme traffic spikes.

**Microservices with Domain Separation**:
```
Core Services:
├── Comment Ingestion Service (Write Path)
├── Comment Distribution Service (Read Path)  
├── Real-time Connection Manager (WebSocket)
├── Content Moderation Service (ML Pipeline)
├── User Presence Service (Activity Tracking)
├── Event Management Service (Live Events)
└── Analytics and Metrics Service (Observability)
```

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer Layer                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   ALB/NLB   │  │   CloudFlare │  │   Route 53  │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway Layer                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ REST API GW │  │ WebSocket GW │  │ GraphQL GW  │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    Application Services                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Comment    │  │ Connection  │  │ Moderation  │            │
│  │  Service    │  │  Manager    │  │  Service    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Presence   │  │   Event     │  │ Analytics   │            │
│  │  Service    │  │ Management  │  │  Service    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    Message Queue Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │    Kafka    │  │   Redis     │  │  RabbitMQ   │            │
│  │  (Events)   │  │ (Real-time) │  │ (Reliable)  │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Cassandra  │  │ PostgreSQL  │  │    Redis    │            │
│  │ (Comments)  │  │   (Users)   │  │   (Cache)   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Real-Time Communication Architecture

### WebSocket Connection Management

**Connection Pool Architecture**:
```python
class WebSocketConnectionManager:
    def __init__(self):
        self.connection_pools = {}
        self.max_connections_per_server = 50000
        self.heartbeat_interval = 30  # seconds
        
    def manage_connection_lifecycle(self):
        """
        Connection lifecycle management for live comments
        """
        lifecycle_config = {
            'connection_establishment': {
                'authentication_timeout': 5,  # seconds
                'handshake_timeout': 3,
                'initial_buffer_size': 8192
            },
            'active_connection': {
                'heartbeat_interval': 30,
                'idle_timeout': 300,
                'max_message_size': 4096,
                'rate_limit_per_minute': 60
            },
            'connection_termination': {
                'graceful_shutdown_timeout': 10,
                'force_close_timeout': 5,
                'cleanup_delay': 1
            }
        }
        return lifecycle_config
    
    def implement_sticky_sessions(self):
        """
        Sticky session implementation for WebSocket connections
        """
        return {
            'session_affinity': 'client_ip_hash',
            'backup_server_selection': 'least_connections',
            'failover_strategy': 'immediate_reconnect',
            'session_persistence': 'redis_backed'
        }

# Connection distribution strategy
class ConnectionDistribution:
    def __init__(self):
        self.servers = []
        self.load_balancing_algorithm = 'consistent_hashing'
        
    def distribute_connections(self, event_id, user_id):
        """
        Distribute connections based on event and user
        """
        # Hash-based distribution for event affinity
        event_hash = hash(f"{event_id}") % len(self.servers)
        primary_server = self.servers[event_hash]
        
        # Backup server selection
        backup_server = self.servers[(event_hash + 1) % len(self.servers)]
        
        return {
            'primary_server': primary_server,
            'backup_server': backup_server,
            'connection_key': f"{event_id}:{user_id}"
        }
```

### Message Broadcasting Architecture

**Fan-Out Pattern Implementation**:
```python
class MessageBroadcastSystem:
    def __init__(self):
        self.redis_cluster = RedisCluster()
        self.kafka_producer = KafkaProducer()
        
    def implement_fanout_strategy(self):
        """
        Multi-tier fan-out for efficient message distribution
        """
        fanout_tiers = {
            'tier_1_redis': {
                'purpose': 'Immediate delivery to active connections',
                'latency': '<10ms',
                'capacity': '1M messages/second',
                'persistence': 'memory_only'
            },
            'tier_2_kafka': {
                'purpose': 'Reliable delivery and replay',
                'latency': '<50ms', 
                'capacity': '10M messages/second',
                'persistence': 'disk_backed'
            },
            'tier_3_database': {
                'purpose': 'Long-term storage and history',
                'latency': '<200ms',
                'capacity': '100K writes/second',
                'persistence': 'permanent'
            }
        }
        return fanout_tiers
    
    def broadcast_comment(self, comment, event_id):
        """
        Broadcast comment to all subscribers of an event
        """
        broadcast_pipeline = [
            self._validate_comment(comment),
            self._apply_content_moderation(comment),
            self._enrich_comment_metadata(comment),
            self._publish_to_redis_stream(comment, event_id),
            self._publish_to_kafka_topic(comment, event_id),
            self._store_in_database(comment)
        ]
        
        # Execute pipeline with error handling
        for step in broadcast_pipeline:
            try:
                step()
            except Exception as e:
                self._handle_pipeline_error(step, e)
                
    def _publish_to_redis_stream(self, comment, event_id):
        """
        Publish to Redis streams for real-time delivery
        """
        stream_key = f"event:{event_id}:comments"
        message = {
            'comment_id': comment['id'],
            'user_id': comment['user_id'],
            'content': comment['content'],
            'timestamp': comment['timestamp'],
            'metadata': comment['metadata']
        }
        
        self.redis_cluster.xadd(stream_key, message, maxlen=10000)
```

## Event-Driven Message Processing

### Kafka-Based Event Streaming

**Topic Architecture and Partitioning**:
```python
class KafkaTopicArchitecture:
    def __init__(self):
        self.topic_configuration = self._setup_topic_config()
        
    def _setup_topic_config(self):
        """
        Kafka topic configuration for live comments
        """
        return {
            'comment_events': {
                'partitions': 100,
                'replication_factor': 3,
                'retention_ms': 86400000,  # 24 hours
                'partition_key': 'event_id',
                'compression_type': 'snappy'
            },
            'moderation_events': {
                'partitions': 20,
                'replication_factor': 3,
                'retention_ms': 604800000,  # 7 days
                'partition_key': 'user_id',
                'compression_type': 'gzip'
            },
            'analytics_events': {
                'partitions': 50,
                'replication_factor': 2,
                'retention_ms': 2592000000,  # 30 days
                'partition_key': 'event_type',
                'compression_type': 'lz4'
            }
        }
    
    def implement_event_sourcing(self):
        """
        Event sourcing pattern for comment lifecycle
        """
        event_types = {
            'CommentSubmitted': {
                'schema': {
                    'comment_id': 'string',
                    'event_id': 'string', 
                    'user_id': 'string',
                    'content': 'string',
                    'timestamp': 'long',
                    'client_info': 'object'
                },
                'processing_priority': 'high'
            },
            'CommentModerated': {
                'schema': {
                    'comment_id': 'string',
                    'moderation_action': 'enum',
                    'reason': 'string',
                    'moderator_id': 'string',
                    'timestamp': 'long'
                },
                'processing_priority': 'medium'
            },
            'CommentDelivered': {
                'schema': {
                    'comment_id': 'string',
                    'delivery_count': 'int',
                    'failed_deliveries': 'array',
                    'timestamp': 'long'
                },
                'processing_priority': 'low'
            }
        }
        return event_types

# Event processing pipeline
class EventProcessor:
    def __init__(self):
        self.kafka_consumer = KafkaConsumer()
        self.processing_pipeline = ProcessingPipeline()
        
    def process_comment_events(self):
        """
        Process incoming comment events with parallel processing
        """
        processing_config = {
            'consumer_group': 'comment_processors',
            'max_poll_records': 1000,
            'processing_threads': 16,
            'batch_processing': True,
            'error_handling': 'dead_letter_queue'
        }
        
        while True:
            batch = self.kafka_consumer.poll(timeout_ms=100)
            if batch:
                self._process_batch_parallel(batch)
                
    def _process_batch_parallel(self, batch):
        """
        Parallel processing of comment batches
        """
        with ThreadPoolExecutor(max_workers=16) as executor:
            futures = []
            
            for partition, messages in batch.items():
                future = executor.submit(self._process_partition, messages)
                futures.append(future)
                
            # Wait for all partitions to complete
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    self._handle_processing_error(e)
```

## Content Moderation Architecture

### Real-Time ML Pipeline

**Multi-Stage Moderation System**:
```python
class ContentModerationPipeline:
    def __init__(self):
        self.ml_models = self._initialize_ml_models()
        self.rule_engine = RuleEngine()
        self.human_review_queue = HumanReviewQueue()
        
    def _initialize_ml_models(self):
        """
        Initialize ML models for content moderation
        """
        return {
            'spam_detection': {
                'model_type': 'gradient_boosting',
                'inference_time_ms': 5,
                'accuracy': 0.95,
                'false_positive_rate': 0.02
            },
            'toxicity_detection': {
                'model_type': 'transformer_bert',
                'inference_time_ms': 15,
                'accuracy': 0.92,
                'false_positive_rate': 0.05
            },
            'language_detection': {
                'model_type': 'fasttext',
                'inference_time_ms': 2,
                'accuracy': 0.98,
                'supported_languages': 50
            }
        }
    
    def moderate_comment(self, comment):
        """
        Multi-stage moderation pipeline
        """
        moderation_stages = [
            self._stage_1_basic_validation,
            self._stage_2_rule_based_filtering,
            self._stage_3_ml_classification,
            self._stage_4_contextual_analysis,
            self._stage_5_final_decision
        ]
        
        moderation_context = {
            'comment': comment,
            'user_history': self._get_user_history(comment['user_id']),
            'event_context': self._get_event_context(comment['event_id']),
            'moderation_scores': {}
        }
        
        for stage in moderation_stages:
            result = stage(moderation_context)
            if result['action'] == 'block':
                return self._block_comment(comment, result['reason'])
            elif result['action'] == 'flag':
                self._flag_for_human_review(comment, result)
                
        return self._approve_comment(comment)
    
    def _stage_3_ml_classification(self, context):
        """
        ML-based content classification
        """
        comment = context['comment']
        
        # Parallel ML inference
        with ThreadPoolExecutor(max_workers=3) as executor:
            spam_future = executor.submit(
                self._classify_spam, comment['content']
            )
            toxicity_future = executor.submit(
                self._classify_toxicity, comment['content']
            )
            language_future = executor.submit(
                self._detect_language, comment['content']
            )
            
            # Collect results
            spam_score = spam_future.result()
            toxicity_score = toxicity_future.result()
            language_info = language_future.result()
            
        context['moderation_scores'].update({
            'spam_score': spam_score,
            'toxicity_score': toxicity_score,
            'language': language_info['language'],
            'language_confidence': language_info['confidence']
        })
        
        # Decision logic
        if spam_score > 0.8 or toxicity_score > 0.7:
            return {'action': 'block', 'reason': 'ml_classification'}
        elif spam_score > 0.6 or toxicity_score > 0.5:
            return {'action': 'flag', 'reason': 'ml_uncertainty'}
        else:
            return {'action': 'continue'}
```

## Caching and Performance Architecture

### Multi-Layer Caching Strategy

**Cache Hierarchy Implementation**:
```python
class CacheArchitecture:
    def __init__(self):
        self.l1_cache = LocalCache()  # In-memory
        self.l2_cache = RedisCluster()  # Distributed
        self.l3_cache = CDNCache()  # Edge
        
    def implement_cache_hierarchy(self):
        """
        Three-tier caching for optimal performance
        """
        cache_tiers = {
            'l1_local_cache': {
                'type': 'in_memory_lru',
                'size_mb': 512,
                'ttl_seconds': 60,
                'hit_ratio_target': 0.8,
                'use_cases': ['recent_comments', 'user_sessions']
            },
            'l2_distributed_cache': {
                'type': 'redis_cluster',
                'size_gb': 100,
                'ttl_seconds': 3600,
                'hit_ratio_target': 0.9,
                'use_cases': ['event_metadata', 'user_profiles', 'comment_threads']
            },
            'l3_edge_cache': {
                'type': 'cdn_cache',
                'size_tb': 10,
                'ttl_seconds': 86400,
                'hit_ratio_target': 0.95,
                'use_cases': ['static_content', 'popular_comments', 'media_files']
            }
        }
        return cache_tiers
    
    def cache_comment_data(self, comment, event_id):
        """
        Cache comment data across all tiers
        """
        cache_operations = [
            # L1 Cache - Recent comments for active connections
            {
                'cache': self.l1_cache,
                'key': f"recent_comments:{event_id}",
                'operation': 'list_append',
                'data': comment,
                'ttl': 60
            },
            # L2 Cache - Event comment stream
            {
                'cache': self.l2_cache,
                'key': f"event_stream:{event_id}",
                'operation': 'sorted_set_add',
                'data': comment,
                'score': comment['timestamp'],
                'ttl': 3600
            },
            # L3 Cache - Popular comments
            {
                'cache': self.l3_cache,
                'key': f"popular_comments:{event_id}",
                'operation': 'conditional_cache',
                'data': comment,
                'condition': lambda c: c.get('likes', 0) > 100,
                'ttl': 86400
            }
        ]
        
        # Execute cache operations asynchronously
        for operation in cache_operations:
            self._execute_cache_operation_async(operation)
```

## Monitoring and Observability Architecture

### Comprehensive Monitoring Stack

**Metrics and Alerting System**:
```python
class MonitoringArchitecture:
    def __init__(self):
        self.metrics_collector = PrometheusCollector()
        self.log_aggregator = ElasticsearchCluster()
        self.alerting_system = AlertManager()
        
    def setup_monitoring_stack(self):
        """
        Comprehensive monitoring for live comment system
        """
        monitoring_components = {
            'metrics_collection': {
                'prometheus': {
                    'scrape_interval': '5s',
                    'retention': '30d',
                    'high_cardinality_metrics': True
                },
                'custom_metrics': [
                    'comments_per_second_by_event',
                    'websocket_connections_by_server',
                    'moderation_latency_p99',
                    'cache_hit_ratio_by_tier'
                ]
            },
            'log_aggregation': {
                'elasticsearch': {
                    'index_pattern': 'live-comments-*',
                    'retention_days': 90,
                    'shard_strategy': 'time_based'
                },
                'log_types': [
                    'application_logs',
                    'access_logs', 
                    'error_logs',
                    'audit_logs'
                ]
            },
            'distributed_tracing': {
                'jaeger': {
                    'sampling_rate': 0.1,
                    'trace_retention': '7d'
                },
                'trace_contexts': [
                    'comment_submission_flow',
                    'moderation_pipeline',
                    'broadcast_delivery'
                ]
            }
        }
        return monitoring_components
    
    def implement_sli_slo_monitoring(self):
        """
        Service Level Indicators and Objectives monitoring
        """
        sli_slo_config = {
            'comment_submission_latency': {
                'sli': 'histogram_quantile(0.95, comment_submission_duration_seconds)',
                'slo': '200ms',
                'error_budget': '0.1%',
                'alert_threshold': '0.05%'
            },
            'comment_delivery_success_rate': {
                'sli': 'rate(comment_delivery_success_total) / rate(comment_delivery_attempts_total)',
                'slo': '99.5%',
                'error_budget': '0.5%',
                'alert_threshold': '0.25%'
            },
            'system_availability': {
                'sli': 'up',
                'slo': '99.95%',
                'error_budget': '0.05%',
                'alert_threshold': '0.025%'
            }
        }
        return sli_slo_config
```

This architecture provides a robust foundation for handling the extreme scale and real-time requirements of a live comment system, with careful attention to performance, reliability, and observability at every layer.
