# Variations and Follow-ups - Live Comment System

## Advanced Comment Features

### Threaded Conversations and Replies

**Nested Comment Structure**:
```python
class ThreadedCommentSystem:
    def __init__(self, database, cache):
        self.db = database
        self.cache = cache
        self.max_thread_depth = 5  # Prevent infinite nesting
        
    async def create_reply(self, parent_comment_id, reply_data):
        """
        Create a reply to an existing comment with thread management
        """
        # Get parent comment to validate and determine thread depth
        parent_comment = await self.get_comment_by_id(parent_comment_id)
        if not parent_comment:
            raise CommentNotFoundError("Parent comment not found")
        
        # Calculate thread depth
        thread_depth = await self.calculate_thread_depth(parent_comment_id)
        if thread_depth >= self.max_thread_depth:
            raise MaxDepthExceededError("Maximum thread depth reached")
        
        # Create reply with thread metadata
        reply_data.update({
            'parent_comment_id': parent_comment_id,
            'root_comment_id': parent_comment.get('root_comment_id', parent_comment_id),
            'thread_depth': thread_depth + 1,
            'thread_path': f"{parent_comment.get('thread_path', '')}/{parent_comment_id}"
        })
        
        # Store reply
        reply_id = await self.db.insert_comment(reply_data)
        
        # Update parent comment reply count
        await self.db.increment_reply_count(parent_comment_id)
        
        # Cache thread structure for fast retrieval
        await self.cache_thread_structure(reply_data['root_comment_id'])
        
        return reply_id
    
    async def get_comment_thread(self, root_comment_id, max_depth=3):
        """
        Retrieve complete comment thread with nested structure
        """
        # Check cache first
        cached_thread = await self.cache.get(f"thread:{root_comment_id}")
        if cached_thread:
            return json.loads(cached_thread)
        
        # Build thread from database
        thread = await self.build_thread_recursive(root_comment_id, max_depth)
        
        # Cache the thread structure
        await self.cache.set(
            f"thread:{root_comment_id}",
            json.dumps(thread),
            ex=300  # 5 minutes
        )
        
        return thread
    
    async def build_thread_recursive(self, comment_id, max_depth, current_depth=0):
        """
        Recursively build comment thread structure
        """
        if current_depth >= max_depth:
            return None
            
        # Get comment details
        comment = await self.db.get_comment_with_user_info(comment_id)
        if not comment:
            return None
        
        # Get direct replies
        replies = await self.db.get_replies(comment_id)
        
        # Recursively build reply threads
        comment['replies'] = []
        for reply in replies:
            reply_thread = await self.build_thread_recursive(
                reply['comment_id'], 
                max_depth, 
                current_depth + 1
            )
            if reply_thread:
                comment['replies'].append(reply_thread)
        
        return comment

# Database schema for threaded comments
threaded_comment_schema = """
CREATE TABLE comments (
    comment_id UUID PRIMARY KEY,
    event_id UUID NOT NULL,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES comments(comment_id),
    root_comment_id UUID REFERENCES comments(comment_id),
    thread_depth INTEGER DEFAULT 0,
    thread_path TEXT DEFAULT '',
    reply_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient thread queries
CREATE INDEX idx_comments_parent_id ON comments(parent_comment_id);
CREATE INDEX idx_comments_root_id ON comments(root_comment_id);
CREATE INDEX idx_comments_thread_path ON comments USING GIN(thread_path gin_trgm_ops);
CREATE INDEX idx_comments_event_created ON comments(event_id, created_at DESC);
"""
```

### Rich Media Support

**Media Upload and Processing Pipeline**:
```python
class MediaCommentSystem:
    def __init__(self, s3_client, image_processor, video_processor):
        self.s3 = s3_client
        self.image_processor = image_processor
        self.video_processor = video_processor
        self.allowed_formats = {
            'images': ['jpg', 'jpeg', 'png', 'gif', 'webp'],
            'videos': ['mp4', 'webm', 'mov'],
            'audio': ['mp3', 'wav', 'ogg']
        }
        self.max_file_sizes = {
            'image': 10 * 1024 * 1024,    # 10MB
            'video': 100 * 1024 * 1024,   # 100MB
            'audio': 25 * 1024 * 1024     # 25MB
        }
    
    async def upload_media_comment(self, user_id, event_id, media_file, comment_text=""):
        """
        Handle media upload with comment
        """
        # Validate file
        validation_result = await self.validate_media_file(media_file)
        if not validation_result.is_valid:
            raise MediaValidationError(validation_result.error)
        
        # Generate unique file key
        file_extension = media_file.filename.split('.')[-1].lower()
        file_key = f"comments/{event_id}/{user_id}/{uuid.uuid4()}.{file_extension}"
        
        # Upload to S3 with metadata
        upload_result = await self.s3.upload_file(
            media_file.file,
            bucket='live-comments-media',
            key=file_key,
            metadata={
                'user_id': user_id,
                'event_id': event_id,
                'original_filename': media_file.filename,
                'content_type': media_file.content_type
            }
        )
        
        # Process media asynchronously
        processing_task = asyncio.create_task(
            self.process_media_async(file_key, validation_result.media_type)
        )
        
        # Create comment with media reference
        comment_data = {
            'user_id': user_id,
            'event_id': event_id,
            'content': comment_text,
            'media_attachments': [{
                'type': validation_result.media_type,
                'url': upload_result.url,
                'file_key': file_key,
                'processing_status': 'pending',
                'metadata': {
                    'size': media_file.size,
                    'filename': media_file.filename
                }
            }]
        }
        
        comment_id = await self.create_comment(comment_data)
        
        # Update comment when processing completes
        asyncio.create_task(
            self.update_comment_after_processing(comment_id, processing_task)
        )
        
        return comment_id
    
    async def process_media_async(self, file_key, media_type):
        """
        Asynchronous media processing pipeline
        """
        processing_results = {}
        
        try:
            if media_type == 'image':
                # Generate thumbnails and optimize
                processing_results = await self.image_processor.process({
                    'file_key': file_key,
                    'operations': [
                        {'type': 'thumbnail', 'size': '150x150'},
                        {'type': 'thumbnail', 'size': '300x300'},
                        {'type': 'optimize', 'quality': 85},
                        {'type': 'format_conversion', 'format': 'webp'}
                    ]
                })
                
            elif media_type == 'video':
                # Generate video thumbnails and compress
                processing_results = await self.video_processor.process({
                    'file_key': file_key,
                    'operations': [
                        {'type': 'thumbnail', 'timestamp': '00:00:01'},
                        {'type': 'compress', 'bitrate': '1000k'},
                        {'type': 'format_conversion', 'format': 'mp4'}
                    ]
                })
                
            processing_results['status'] = 'completed'
            
        except Exception as e:
            processing_results = {
                'status': 'failed',
                'error': str(e)
            }
        
        return processing_results

# Media comment schema extension
media_comment_schema = """
ALTER TABLE comments ADD COLUMN media_attachments JSONB DEFAULT '[]';

CREATE TABLE media_files (
    file_id UUID PRIMARY KEY,
    comment_id UUID REFERENCES comments(comment_id),
    file_key VARCHAR(500) NOT NULL,
    media_type VARCHAR(20) NOT NULL,
    original_filename VARCHAR(255),
    file_size BIGINT,
    processing_status VARCHAR(20) DEFAULT 'pending',
    processed_variants JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_media_files_comment_id ON media_files(comment_id);
CREATE INDEX idx_media_files_processing_status ON media_files(processing_status);
"""
```

### Real-Time Reactions and Emotions

**Emoji Reactions System**:
```python
class ReactionSystem:
    def __init__(self, redis_client, database):
        self.redis = redis_client
        self.db = database
        self.allowed_reactions = {
            'like': '👍',
            'love': '❤️',
            'laugh': '😂',
            'wow': '😮',
            'sad': '😢',
            'angry': '😠',
            'fire': '🔥',
            'clap': '👏'
        }
        
    async def add_reaction(self, comment_id, user_id, reaction_type):
        """
        Add or update user reaction to a comment
        """
        if reaction_type not in self.allowed_reactions:
            raise InvalidReactionError(f"Reaction {reaction_type} not allowed")
        
        # Use Redis for real-time reaction tracking
        reaction_key = f"reactions:{comment_id}"
        user_reaction_key = f"user_reaction:{comment_id}:{user_id}"
        
        # Get user's previous reaction
        previous_reaction = await self.redis.get(user_reaction_key)
        
        # Remove previous reaction count
        if previous_reaction:
            await self.redis.hincrby(reaction_key, previous_reaction, -1)
        
        # Add new reaction
        await self.redis.hincrby(reaction_key, reaction_type, 1)
        await self.redis.set(user_reaction_key, reaction_type, ex=86400)  # 24 hours
        
        # Get updated reaction counts
        reaction_counts = await self.redis.hgetall(reaction_key)
        
        # Broadcast reaction update to all connected users
        await self.broadcast_reaction_update(comment_id, reaction_counts)
        
        # Asynchronously update database
        asyncio.create_task(
            self.update_reaction_in_database(comment_id, user_id, reaction_type, previous_reaction)
        )
        
        return {
            'comment_id': comment_id,
            'user_reaction': reaction_type,
            'total_reactions': reaction_counts
        }
    
    async def get_reaction_summary(self, comment_id):
        """
        Get aggregated reaction summary for a comment
        """
        # Try Redis first for real-time data
        reaction_counts = await self.redis.hgetall(f"reactions:{comment_id}")
        
        if not reaction_counts:
            # Fallback to database
            reaction_counts = await self.db.get_reaction_counts(comment_id)
            
            # Cache in Redis
            if reaction_counts:
                await self.redis.hmset(f"reactions:{comment_id}", reaction_counts)
                await self.redis.expire(f"reactions:{comment_id}", 3600)
        
        # Format response with emoji display
        formatted_reactions = []
        total_reactions = 0
        
        for reaction_type, count in reaction_counts.items():
            count = int(count)
            if count > 0:
                formatted_reactions.append({
                    'type': reaction_type,
                    'emoji': self.allowed_reactions[reaction_type],
                    'count': count
                })
                total_reactions += count
        
        return {
            'comment_id': comment_id,
            'reactions': formatted_reactions,
            'total_count': total_reactions
        }

# Real-time reaction broadcasting
class ReactionBroadcaster:
    def __init__(self, websocket_manager):
        self.ws_manager = websocket_manager
        
    async def broadcast_reaction_update(self, comment_id, reaction_counts):
        """
        Broadcast reaction updates to all connected users
        """
        # Get comment details to find event_id
        comment = await self.get_comment_basic_info(comment_id)
        if not comment:
            return
        
        # Prepare broadcast message
        message = {
            'type': 'reaction_update',
            'comment_id': comment_id,
            'event_id': comment['event_id'],
            'reactions': reaction_counts,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Broadcast to all users watching this event
        await self.ws_manager.broadcast_to_event(comment['event_id'], message)

# Database schema for reactions
reaction_schema = """
CREATE TABLE comment_reactions (
    reaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES comments(comment_id),
    user_id UUID NOT NULL REFERENCES users(user_id),
    reaction_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

-- Materialized view for reaction counts
CREATE MATERIALIZED VIEW comment_reaction_counts AS
SELECT 
    comment_id,
    reaction_type,
    COUNT(*) as count
FROM comment_reactions
GROUP BY comment_id, reaction_type;

CREATE UNIQUE INDEX idx_reaction_counts_comment_type 
ON comment_reaction_counts(comment_id, reaction_type);

-- Refresh materialized view periodically
CREATE OR REPLACE FUNCTION refresh_reaction_counts()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY comment_reaction_counts;
END;
$$ LANGUAGE plpgsql;
"""
```

## Advanced Moderation Features

### AI-Powered Content Moderation

**Multi-Model Moderation Pipeline**:
```python
class AdvancedModerationSystem:
    def __init__(self):
        self.toxicity_model = ToxicityClassifier()
        self.spam_detector = SpamDetector()
        self.language_detector = LanguageDetector()
        self.sentiment_analyzer = SentimentAnalyzer()
        self.image_moderator = ImageModerator()
        
    async def moderate_comment(self, comment_data):
        """
        Comprehensive AI-powered moderation pipeline
        """
        moderation_results = {
            'comment_id': comment_data['comment_id'],
            'overall_score': 0,
            'individual_scores': {},
            'flags': [],
            'action': 'approve',
            'confidence': 0
        }
        
        # Text content moderation
        if comment_data.get('content'):
            text_results = await self.moderate_text_content(comment_data['content'])
            moderation_results['individual_scores'].update(text_results)
        
        # Media content moderation
        if comment_data.get('media_attachments'):
            media_results = await self.moderate_media_content(comment_data['media_attachments'])
            moderation_results['individual_scores'].update(media_results)
        
        # User behavior analysis
        user_behavior_score = await self.analyze_user_behavior(comment_data['user_id'])
        moderation_results['individual_scores']['user_behavior'] = user_behavior_score
        
        # Calculate overall moderation score
        moderation_results['overall_score'] = self.calculate_overall_score(
            moderation_results['individual_scores']
        )
        
        # Determine action based on score and rules
        moderation_results['action'] = self.determine_moderation_action(
            moderation_results['overall_score'],
            moderation_results['individual_scores']
        )
        
        return moderation_results
    
    async def moderate_text_content(self, content):
        """
        Multi-model text content analysis
        """
        # Run models in parallel for speed
        tasks = [
            self.toxicity_model.predict(content),
            self.spam_detector.predict(content),
            self.language_detector.detect(content),
            self.sentiment_analyzer.analyze(content)
        ]
        
        toxicity_score, spam_score, language_info, sentiment_score = await asyncio.gather(*tasks)
        
        return {
            'toxicity': toxicity_score,
            'spam_probability': spam_score,
            'language': language_info['language'],
            'language_confidence': language_info['confidence'],
            'sentiment': sentiment_score
        }
    
    async def moderate_media_content(self, media_attachments):
        """
        AI-powered media content moderation
        """
        media_scores = {}
        
        for attachment in media_attachments:
            if attachment['type'] == 'image':
                # Image moderation for inappropriate content
                image_analysis = await self.image_moderator.analyze(attachment['url'])
                media_scores[f"image_{attachment['file_key']}"] = {
                    'nsfw_score': image_analysis['nsfw_probability'],
                    'violence_score': image_analysis['violence_probability'],
                    'text_in_image': image_analysis.get('extracted_text', ''),
                    'faces_detected': image_analysis.get('face_count', 0)
                }
        
        return media_scores
    
    def determine_moderation_action(self, overall_score, individual_scores):
        """
        Rule-based action determination
        """
        # High-risk thresholds
        if (individual_scores.get('toxicity', 0) > 0.8 or 
            individual_scores.get('spam_probability', 0) > 0.9):
            return 'block'
        
        # Medium-risk thresholds
        if overall_score > 0.6:
            return 'flag_for_review'
        
        # Low-risk or safe content
        return 'approve'

# Real-time moderation queue
class ModerationQueue:
    def __init__(self, redis_client):
        self.redis = redis_client
        
    async def add_to_moderation_queue(self, comment_data, priority='normal'):
        """
        Add comment to moderation queue with priority
        """
        queue_key = f"moderation_queue:{priority}"
        
        moderation_item = {
            'comment_id': comment_data['comment_id'],
            'event_id': comment_data['event_id'],
            'user_id': comment_data['user_id'],
            'content': comment_data['content'],
            'submitted_at': datetime.utcnow().isoformat(),
            'priority': priority
        }
        
        # Add to priority queue (higher score = higher priority)
        priority_score = {
            'urgent': 100,
            'high': 75,
            'normal': 50,
            'low': 25
        }.get(priority, 50)
        
        await self.redis.zadd(queue_key, {
            json.dumps(moderation_item): priority_score
        })
        
        # Set expiration for queue cleanup
        await self.redis.expire(queue_key, 86400)  # 24 hours
    
    async def get_next_moderation_item(self, moderator_id):
        """
        Get next item from moderation queue for human review
        """
        # Try queues in priority order
        for priority in ['urgent', 'high', 'normal', 'low']:
            queue_key = f"moderation_queue:{priority}"
            
            # Get highest priority item
            items = await self.redis.zrevrange(queue_key, 0, 0, withscores=True)
            
            if items:
                item_data, score = items[0]
                
                # Remove from queue and assign to moderator
                await self.redis.zrem(queue_key, item_data)
                
                # Track assignment
                assignment_key = f"moderation_assignment:{moderator_id}"
                await self.redis.set(assignment_key, item_data, ex=1800)  # 30 minutes
                
                return json.loads(item_data)
        
        return None  # No items in queue
```

## Performance Optimization Features

### Intelligent Comment Filtering and Ranking

**Smart Comment Ranking Algorithm**:
```python
class CommentRankingSystem:
    def __init__(self, ml_model, user_preference_service):
        self.ranking_model = ml_model
        self.user_prefs = user_preference_service
        
    async def rank_comments_for_user(self, event_id, user_id, comments):
        """
        Personalized comment ranking based on user preferences and engagement
        """
        # Get user preference profile
        user_profile = await self.user_prefs.get_user_profile(user_id)
        
        # Calculate ranking scores for each comment
        ranked_comments = []
        
        for comment in comments:
            # Base engagement score
            engagement_score = self.calculate_engagement_score(comment)
            
            # Relevance score based on content
            relevance_score = await self.calculate_relevance_score(comment, user_profile)
            
            # Recency score (newer comments get boost)
            recency_score = self.calculate_recency_score(comment['created_at'])
            
            # User relationship score (friends, followed users)
            relationship_score = await self.calculate_relationship_score(
                comment['user_id'], user_id
            )
            
            # Combined ranking score
            final_score = (
                engagement_score * 0.3 +
                relevance_score * 0.25 +
                recency_score * 0.25 +
                relationship_score * 0.2
            )
            
            ranked_comments.append({
                **comment,
                'ranking_score': final_score,
                'score_breakdown': {
                    'engagement': engagement_score,
                    'relevance': relevance_score,
                    'recency': recency_score,
                    'relationship': relationship_score
                }
            })
        
        # Sort by ranking score
        ranked_comments.sort(key=lambda x: x['ranking_score'], reverse=True)
        
        return ranked_comments
    
    def calculate_engagement_score(self, comment):
        """
        Calculate engagement score based on likes, replies, reactions
        """
        like_count = comment.get('like_count', 0)
        reply_count = comment.get('reply_count', 0)
        reaction_count = sum(comment.get('reactions', {}).values())
        
        # Weighted engagement score
        engagement_score = (
            like_count * 1.0 +
            reply_count * 2.0 +  # Replies are more valuable
            reaction_count * 0.5
        )
        
        # Normalize to 0-1 scale
        return min(engagement_score / 100, 1.0)
    
    async def calculate_relevance_score(self, comment, user_profile):
        """
        Calculate content relevance based on user interests
        """
        # Use ML model to calculate semantic similarity
        comment_embedding = await self.ranking_model.get_text_embedding(comment['content'])
        user_interest_embedding = user_profile.get('interest_embedding')
        
        if user_interest_embedding:
            similarity_score = self.cosine_similarity(comment_embedding, user_interest_embedding)
            return max(0, similarity_score)
        
        return 0.5  # Neutral score if no user profile

# Adaptive comment loading
class AdaptiveCommentLoader:
    def __init__(self, performance_monitor):
        self.perf_monitor = performance_monitor
        
    async def load_comments_adaptively(self, event_id, user_id, connection_quality):
        """
        Adapt comment loading based on connection quality and device performance
        """
        # Determine optimal loading strategy
        if connection_quality == 'high':
            # Load full comments with media
            batch_size = 50
            include_media = True
            include_threads = True
        elif connection_quality == 'medium':
            # Load text-only comments, lazy load media
            batch_size = 30
            include_media = False
            include_threads = True
        else:  # low quality
            # Minimal loading for slow connections
            batch_size = 15
            include_media = False
            include_threads = False
        
        # Load comments with adaptive strategy
        comments = await self.load_comments_batch(
            event_id, 
            batch_size, 
            include_media, 
            include_threads
        )
        
        return {
            'comments': comments,
            'loading_strategy': {
                'batch_size': batch_size,
                'include_media': include_media,
                'include_threads': include_threads,
                'connection_quality': connection_quality
            }
        }
```

These advanced features and variations demonstrate how the live comment system can be extended to support rich interactions, intelligent content management, and optimized performance for different use cases and user scenarios.
