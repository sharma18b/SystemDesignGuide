// Enhanced Navigation with Company Tags and Difficulty Levels
const enhancedCategories = [
    {
        id: 'social-feeds',
        folder: '01-social-feeds',
        title: 'Social Feeds & Content Platforms',
        icon: '📱',
        description: 'Social media platforms, content sharing, and community-driven applications',
        problems: 5,
        completed: 5,
        status: 'complete',
        difficulty: 'Medium',
        problems: [
            {
                name: 'twitter',
                title: 'Design Twitter',
                difficulty: 'Hard',
                companies: ['Twitter/X', 'Meta', 'Google', 'Amazon', 'Microsoft'],
                popularity: 'Very High',
                description: 'Design a microblogging platform with real-time feeds, following system, and trending topics'
            },
            {
                name: 'instagram',
                title: 'Design Instagram',
                difficulty: 'Hard',
                companies: ['Meta', 'Google', 'Amazon', 'Snap', 'Pinterest'],
                popularity: 'Very High',
                description: 'Design a photo-sharing platform with feeds, stories, and social interactions'
            },
            {
                name: 'facebook-newsfeed',
                title: 'Design Facebook Newsfeed',
                difficulty: 'Hard',
                companies: ['Meta', 'Google', 'LinkedIn', 'Twitter/X'],
                popularity: 'Very High',
                description: 'Design a personalized content feed with ranking algorithms and real-time updates'
            },
            {
                name: 'reddit-platform',
                title: 'Design Reddit Platform',
                difficulty: 'Medium',
                companies: ['Reddit', 'Meta', 'Google', 'Amazon'],
                popularity: 'High',
                description: 'Design a community-driven platform with voting, comments, and subreddits'
            },
            {
                name: 'youtube-netflix',
                title: 'Design YouTube/Netflix',
                difficulty: 'Hard',
                companies: ['Google', 'Netflix', 'Amazon', 'Meta', 'Disney+'],
                popularity: 'Very High',
                description: 'Design a video streaming platform with recommendations and content delivery'
            }
        ]
    },
    {
        id: 'messaging-collaboration',
        folder: '02-messaging-collaboration',
        title: 'Messaging & Real-time Collaboration',
        icon: '💬',
        description: 'Real-time communication, messaging platforms, and collaborative tools',
        problems: 5,
        completed: 5,
        status: 'complete',
        difficulty: 'Hard',
        problems: [
            {
                name: 'facebook-messenger',
                title: 'Design Facebook Messenger',
                difficulty: 'Hard',
                companies: ['Meta', 'WhatsApp', 'Telegram', 'Signal', 'Discord'],
                popularity: 'Very High',
                description: 'Design a real-time messaging platform with group chats and media sharing'
            },
            {
                name: 'live-comment-system',
                title: 'Design Live Comment System',
                difficulty: 'Medium',
                companies: ['YouTube', 'Twitch', 'Meta', 'Reddit'],
                popularity: 'High',
                description: 'Design a real-time commenting system for live streams and videos'
            },
            {
                name: 'video-conferencing',
                title: 'Design Video Conferencing',
                difficulty: 'Hard',
                companies: ['Zoom', 'Google', 'Microsoft', 'Meta', 'Cisco'],
                popularity: 'Very High',
                description: 'Design a video conferencing platform with screen sharing and recording'
            },
            {
                name: 'team-collaboration',
                title: 'Design Team Collaboration Tool',
                difficulty: 'Medium',
                companies: ['Slack', 'Microsoft', 'Atlassian', 'Asana', 'Monday.com'],
                popularity: 'High',
                description: 'Design a team collaboration platform like Slack with channels and integrations'
            },
            {
                name: 'google-docs',
                title: 'Design Google Docs',
                difficulty: 'Hard',
                companies: ['Google', 'Microsoft', 'Dropbox', 'Notion'],
                popularity: 'Very High',
                description: 'Design a collaborative document editing platform with real-time sync'
            }
        ]
    },
    {
        id: 'ecommerce-payments',
        folder: '03-ecommerce-payments',
        title: 'E-commerce, Payments & Logistics',
        icon: '🛒',
        description: 'Transaction processing, inventory management, and order fulfillment',
        problems: 5,
        completed: 5,
        status: 'complete',
        difficulty: 'Hard',
        problems: [
            {
                name: 'ecommerce-service',
                title: 'Design E-commerce Service',
                difficulty: 'Hard',
                companies: ['Amazon', 'eBay', 'Shopify', 'Walmart', 'Alibaba'],
                popularity: 'Very High',
                description: 'Design an e-commerce platform with product catalog, cart, and checkout'
            },
            {
                name: 'shopify-platform',
                title: 'Design Shopify Platform',
                difficulty: 'Hard',
                companies: ['Shopify', 'Amazon', 'BigCommerce', 'WooCommerce'],
                popularity: 'High',
                description: 'Design a multi-tenant e-commerce platform for merchants'
            },
            {
                name: 'payment-service',
                title: 'Design Payment Service',
                difficulty: 'Hard',
                companies: ['Stripe', 'PayPal', 'Square', 'Amazon', 'Google'],
                popularity: 'Very High',
                description: 'Design a payment processing system with fraud detection and compliance'
            },
            {
                name: 'digital-wallet',
                title: 'Design Digital Wallet',
                difficulty: 'Easy',
                companies: ['PayPal', 'Venmo', 'Cash App', 'Google Pay', 'Apple Pay'],
                popularity: 'High',
                description: 'Design a digital wallet for peer-to-peer payments and transactions'
            },
            {
                name: 'food-delivery',
                title: 'Design Food Delivery Service',
                difficulty: 'Hard',
                companies: ['Uber Eats', 'DoorDash', 'Grubhub', 'Deliveroo', 'Zomato'],
                popularity: 'Very High',
                description: 'Design a food delivery platform with real-time tracking and matching'
            }
        ]
    },
    {
        id: 'infrastructure-storage',
        folder: '04-infrastructure-storage',
        title: 'Core Infrastructure & Storage',
        icon: '🏗️',
        description: 'Fundamental building blocks for distributed systems',
        problems: 5,
        completed: 5,
        status: 'complete',
        difficulty: 'Hard',
        problems: [
            {
                name: 'key-value-store',
                title: 'Design Key-Value Store',
                difficulty: 'Hard',
                companies: ['Amazon', 'Google', 'Meta', 'Microsoft', 'Redis'],
                popularity: 'Very High',
                description: 'Design a distributed key-value store like DynamoDB or Redis'
            },
            {
                name: 'web-cache',
                title: 'Design Web Cache',
                difficulty: 'Easy',
                companies: ['Google', 'Meta', 'Amazon', 'Cloudflare', 'Akamai'],
                popularity: 'High',
                description: 'Design a distributed caching system with eviction policies'
            },
            {
                name: 'distributed-file-system',
                title: 'Design Distributed File System',
                difficulty: 'Hard',
                companies: ['Google', 'Amazon', 'Microsoft', 'Dropbox', 'Meta'],
                popularity: 'High',
                description: 'Design a distributed file storage system like GFS or HDFS'
            },
            {
                name: 'cdn-network',
                title: 'Design CDN Network',
                difficulty: 'Hard',
                companies: ['Cloudflare', 'Akamai', 'Amazon', 'Google', 'Meta'],
                popularity: 'Very High',
                description: 'Design a content delivery network for global content distribution'
            },
            {
                name: 'load-balancer',
                title: 'Design Load Balancer',
                difficulty: 'Medium',
                companies: ['Amazon', 'Google', 'Meta', 'Microsoft', 'Cloudflare'],
                popularity: 'Very High',
                description: 'Design a load balancing system for distributing traffic across servers'
            }
        ]
    },
    {
        id: 'events-queues',
        folder: '05-events-queues',
        title: 'Events, Queues & Rate Limiting',
        icon: '⚡',
        description: 'Event-driven systems, asynchronous processing, and traffic management',
        problems: 5,
        completed: 5,
        status: 'complete',
        difficulty: 'Medium',
        problems: [
            {
                name: 'rate-limiter',
                title: 'Design Rate Limiter',
                difficulty: 'Easy',
                companies: ['Google', 'Amazon', 'Meta', 'Twitter/X', 'Stripe'],
                popularity: 'Very High',
                description: 'Design a rate limiting system to control API request rates'
            },
            {
                name: 'messaging-system',
                title: 'Design Messaging System',
                difficulty: 'Hard',
                companies: ['Amazon', 'Google', 'Meta', 'LinkedIn', 'Kafka'],
                popularity: 'Very High',
                description: 'Design a distributed message queue like Kafka or RabbitMQ'
            },
            {
                name: 'distributed-counter',
                title: 'Design Distributed Counter',
                difficulty: 'Easy',
                companies: ['Google', 'Meta', 'Twitter/X', 'Reddit', 'YouTube'],
                popularity: 'High',
                description: 'Design a distributed counting system for likes, views, and metrics'
            },
            {
                name: 'task-scheduler',
                title: 'Design Task Scheduler',
                difficulty: 'Medium',
                companies: ['Amazon', 'Google', 'Microsoft', 'Airbnb', 'Uber'],
                popularity: 'High',
                description: 'Design a distributed task scheduling system like Cron'
            },
            {
                name: 'webhook-service',
                title: 'Design Webhook Service',
                difficulty: 'Medium',
                companies: ['Stripe', 'GitHub', 'Slack', 'Twilio', 'SendGrid'],
                popularity: 'High',
                description: 'Design a webhook delivery system with retries and reliability'
            }
        ]
    },
    {
        id: 'data-analytics',
        folder: '06-data-analytics',
        title: 'Data, Analytics & Logging',
        icon: '📊',
        description: 'Big data processing, analytics platforms, and monitoring systems',
        problems: 5,
        completed: 5,
        status: 'complete',
        difficulty: 'Hard',
        problems: [
            {
                name: 'web-analytics',
                title: 'Design Web Analytics',
                difficulty: 'Hard',
                companies: ['Google', 'Meta', 'Adobe', 'Mixpanel', 'Amplitude'],
                popularity: 'Very High',
                description: 'Design a web analytics platform like Google Analytics'
            },
            {
                name: 'monitoring-system',
                title: 'Design Monitoring System',
                difficulty: 'Medium',
                companies: ['Datadog', 'New Relic', 'Amazon', 'Google', 'Splunk'],
                popularity: 'High',
                description: 'Design a system monitoring and alerting platform'
            },
            {
                name: 'log-analysis',
                title: 'Design Log Analysis System',
                difficulty: 'Medium',
                companies: ['Splunk', 'Elasticsearch', 'Amazon', 'Google', 'Datadog'],
                popularity: 'High',
                description: 'Design a log aggregation and analysis system'
            },
            {
                name: 'ad-click-aggregation',
                title: 'Design Ad Click Aggregation',
                difficulty: 'Hard',
                companies: ['Google', 'Meta', 'Amazon', 'Microsoft', 'Twitter/X'],
                popularity: 'Very High',
                description: 'Design a real-time ad click tracking and aggregation system'
            },
            {
                name: 'top-k-analysis',
                title: 'Design Top-K Analysis System',
                difficulty: 'Medium',
                companies: ['Google', 'Meta', 'Twitter/X', 'YouTube', 'Spotify'],
                popularity: 'High',
                description: 'Design a system to find top-K trending items in real-time'
            }
        ]
    },
    {
        id: 'coordination-consistency',
        folder: '07-coordination-consistency',
        title: 'IDs, Consistency & Coordination',
        icon: '🔄',
        description: 'Distributed algorithms, consistency mechanisms, and coordination services',
        problems: 5,
        completed: 5,
        status: 'complete',
        difficulty: 'Hard',
        problems: [
            {
                name: 'unique-id-generator',
                title: 'Design Unique ID Generator',
                difficulty: 'Easy',
                companies: ['Twitter/X', 'Instagram', 'Discord', 'MongoDB', 'Snowflake'],
                popularity: 'Very High',
                description: 'Design a distributed unique ID generation system like Twitter Snowflake'
            },
            {
                name: 'distributed-locking',
                title: 'Design Distributed Locking',
                difficulty: 'Medium',
                companies: ['Google', 'Amazon', 'Meta', 'Redis', 'Zookeeper'],
                popularity: 'High',
                description: 'Design a distributed locking mechanism for coordination'
            },
            {
                name: 'resource-allocation',
                title: 'Design Resource Allocation',
                difficulty: 'Hard',
                companies: ['Google', 'Amazon', 'Microsoft', 'Kubernetes', 'Mesos'],
                popularity: 'High',
                description: 'Design a resource allocation system for distributed computing'
            },
            {
                name: 'distributed-tracing',
                title: 'Design Distributed Tracing',
                difficulty: 'Medium',
                companies: ['Google', 'Amazon', 'Uber', 'Datadog', 'Jaeger'],
                popularity: 'High',
                description: 'Design a distributed tracing system for microservices'
            },
            {
                name: 'batch-auditing',
                title: 'Design Batch Auditing Service',
                difficulty: 'Medium',
                companies: ['Amazon', 'Google', 'Microsoft', 'Stripe', 'Square'],
                popularity: 'Medium',
                description: 'Design a batch processing system for auditing and compliance'
            }
        ]
    },
    {
        id: 'advanced-systems',
        folder: '08-advanced-systems',
        title: 'Boss Fight Level Problems',
        icon: '🎯',
        description: 'Complex multi-domain systems requiring advanced architectural thinking',
        problems: 5,
        completed: 5,
        status: 'complete',
        difficulty: 'Expert',
        problems: [
            {
                name: 'uber-backend',
                title: 'Design Uber Backend',
                difficulty: 'Expert',
                companies: ['Uber', 'Lyft', 'DoorDash', 'Grab', 'Didi'],
                popularity: 'Very High',
                description: 'Design a ride-sharing platform with real-time matching and tracking'
            },
            {
                name: 'ticketmaster',
                title: 'Design Ticketmaster',
                difficulty: 'Expert',
                companies: ['Ticketmaster', 'StubHub', 'Eventbrite', 'SeatGeek'],
                popularity: 'High',
                description: 'Design a ticket booking system with high concurrency and fairness'
            },
            {
                name: 'google-search',
                title: 'Design Google Search',
                difficulty: 'Expert',
                companies: ['Google', 'Microsoft', 'Amazon', 'Meta'],
                popularity: 'Very High',
                description: 'Design a web search engine with crawling, indexing, and ranking'
            },
            {
                name: 'stock-trading',
                title: 'Design Stock Trading Platform',
                difficulty: 'Expert',
                companies: ['Robinhood', 'E*TRADE', 'Interactive Brokers', 'Coinbase'],
                popularity: 'High',
                description: 'Design a stock trading platform with low latency and high reliability'
            },
            {
                name: 'container-orchestration',
                title: 'Design Container Orchestration',
                difficulty: 'Expert',
                companies: ['Google', 'Amazon', 'Microsoft', 'Docker', 'Kubernetes'],
                popularity: 'High',
                description: 'Design a container orchestration system like Kubernetes'
            }
        ]
    }
];

// Difficulty color mapping
const difficultyColors = {
    'Easy': { bg: '#D1FAE5', text: '#065F46', border: '#10B981' },
    'Medium': { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
    'Hard': { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' },
    'Expert': { bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' }
};

// Export for use in other scripts
window.enhancedNavigationData = {
    categories: enhancedCategories,
    difficultyColors
};
