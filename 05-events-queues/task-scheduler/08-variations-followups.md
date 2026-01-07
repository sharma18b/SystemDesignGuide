# Distributed Task Scheduler - Variations and Follow-ups

## Common Interview Variations

### 1. Handle Task Dependencies
**Question**: "How would you implement task dependencies where Task B must run after Task A completes successfully?"

**Solution**:
```
Dependency Graph:
Task A → Task B → Task C
Task D → Task C

Implementation:
class DependencyManager {
    void scheduleWithDependencies(Task task, List<Task> dependencies) {
        // Store dependencies
        for (Task dep : dependencies) {
            saveDependency(task.id, dep.id, "success");
        }
        
        // Check if all dependencies met
        if (allDependenciesMet(task)) {
            scheduleTask(task);
        } else {
            markAsWaiting(task);
        }
    }
    
    void onTaskComplete(Task task, Status status) {
        // Find dependent tasks
        List<Task> dependents = getDependentTasks(task.id);
        
        for (Task dependent : dependents) {
            Dependency dep = getDependency(dependent.id, task.id);
            
            // Check if dependency satisfied
            if (dep.type == "success" && status == SUCCESS) {
                markDependencySatisfied(dependent.id, task.id);
            } else if (dep.type == "completion") {
                markDependencySatisfied(dependent.id, task.id);
            }
            
            // Schedule if all dependencies met
            if (allDependenciesMet(dependent)) {
                scheduleTask(dependent);
            }
        }
    }
}

DAG Validation:
- Detect cycles before scheduling
- Topological sort for execution order
- Fail fast on circular dependencies

Failure Handling:
- If Task A fails, mark Task B as blocked
- Option to skip or retry
- Configurable failure propagation
```

### 2. Implement Task Priorities with Starvation Prevention
**Question**: "How would you ensure low-priority tasks eventually execute and don't starve?"

**Solution**:
```
Priority Aging:
class PriorityScheduler {
    void agePriorities() {
        // Run every minute
        List<Task> waitingTasks = getWaitingTasks();
        
        for (Task task : waitingTasks) {
            long waitTime = now() - task.queuedAt;
            
            // Increase priority based on wait time
            if (waitTime > 3600) {  // 1 hour
                if (task.priority == LOW) {
                    task.priority = MEDIUM;
                }
            }
            
            if (waitTime > 7200) {  // 2 hours
                if (task.priority == MEDIUM) {
                    task.priority = HIGH;
                }
            }
            
            updateTask(task);
        }
    }
}

Weighted Fair Queuing:
- High priority: 50% of capacity
- Medium priority: 30% of capacity
- Low priority: 20% of capacity (guaranteed minimum)

Starvation Detection:
- Alert if task waits >4 hours
- Automatic priority boost
- Manual intervention option
```

### 3. Handle Long-Running Tasks
**Question**: "How would you handle tasks that run for hours and need to survive worker failures?"

**Solution**:
```
Checkpointing:
class LongRunningTask {
    void execute() {
        State state = loadCheckpoint();
        
        for (int i = state.lastProcessed; i < totalItems; i++) {
            processItem(i);
            
            // Checkpoint every 1000 items
            if (i % 1000 == 0) {
                saveCheckpoint(i);
                extendLock();  // Extend distributed lock
            }
        }
        
        completeTask();
    }
    
    void saveCheckpoint(int progress) {
        redis.set("checkpoint:" + taskId, progress);
    }
    
    State loadCheckpoint() {
        Integer progress = redis.get("checkpoint:" + taskId);
        return new State(progress != null ? progress : 0);
    }
}

Heartbeat Mechanism:
- Worker sends heartbeat every 30 seconds
- Scheduler monitors heartbeats
- If no heartbeat for 2 minutes, reassign task
- New worker resumes from checkpoint

Lock Extension:
- Initial lock: 5 minutes
- Extend every 2 minutes while running
- Release on completion
- Auto-expire if worker dies
```

### 4. Implement Task Cancellation
**Question**: "How would you cancel a running task gracefully?"

**Solution**:
```
Graceful Cancellation:
class CancellableTask {
    volatile boolean cancelled = false;
    
    void execute() {
        for (Item item : items) {
            // Check cancellation flag
            if (cancelled) {
                cleanup();
                throw new TaskCancelledException();
            }
            
            processItem(item);
        }
    }
    
    void cancel() {
        // Set cancellation flag
        cancelled = true;
        
        // Interrupt thread
        thread.interrupt();
        
        // Wait for graceful shutdown
        thread.join(30000);  // 30 second timeout
        
        // Force kill if still running
        if (thread.isAlive()) {
            thread.stop();  // Last resort
        }
    }
}

Cancellation States:
1. Requested: User requests cancellation
2. Cancelling: Worker processing cancellation
3. Cancelled: Task stopped gracefully
4. Force-Killed: Task forcefully terminated

Cleanup:
- Rollback partial changes
- Release resources
- Update task status
- Notify dependent tasks
```

### 5. Handle Timezone and DST Changes
**Question**: "How would you handle tasks scheduled in different timezones, especially during DST transitions?"

**Solution**:
```
Timezone Handling:
class TimezoneAwareScheduler {
    LocalDateTime getNextExecution(Task task) {
        // Parse cron in task's timezone
        ZoneId zone = ZoneId.of(task.timezone);
        ZonedDateTime now = ZonedDateTime.now(zone);
        
        // Calculate next execution
        CronExpression cron = CronExpression.parse(task.schedule);
        ZonedDateTime next = cron.next(now);
        
        // Convert to UTC for storage
        return next.withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
    }
}

DST Transition Handling:

Spring Forward (2 AM → 3 AM):
- Task scheduled at 2:30 AM doesn't exist
- Options:
  1. Skip execution (recommended)
  2. Execute at 3:00 AM
  3. Execute at 1:30 AM (before transition)

Fall Back (2 AM → 1 AM):
- Task scheduled at 1:30 AM happens twice
- Options:
  1. Execute only first occurrence (recommended)
  2. Execute both occurrences
  3. Execute only second occurrence

Implementation:
if (isDSTTransition(scheduledTime, timezone)) {
    if (isSpringForward) {
        // Skip or adjust forward
        scheduledTime = adjustForSpringForward(scheduledTime);
    } else {
        // Execute only once
        if (alreadyExecutedInDSTWindow(taskId, scheduledTime)) {
            skip();
        }
    }
}
```

### 6. Implement Task Throttling
**Question**: "How would you limit the number of concurrent executions of a specific task type?"

**Solution**:
```
Concurrency Control:
class ThrottledScheduler {
    Map<String, Semaphore> taskTypeSemaphores = new ConcurrentHashMap<>();
    
    void executeTask(Task task) {
        String taskType = task.type;
        int maxConcurrent = getMaxConcurrent(taskType);
        
        // Get or create semaphore
        Semaphore semaphore = taskTypeSemaphores.computeIfAbsent(
            taskType, 
            k -> new Semaphore(maxConcurrent)
        );
        
        // Acquire permit
        if (semaphore.tryAcquire(30, TimeUnit.SECONDS)) {
            try {
                task.execute();
            } finally {
                semaphore.release();
            }
        } else {
            // Requeue task
            requeueTask(task);
        }
    }
}

Distributed Throttling:
// Use Redis for distributed semaphore
class DistributedSemaphore {
    boolean tryAcquire(String key, int maxPermits) {
        String script = 
            "local current = redis.call('GET', KEYS[1]) or '0' " +
            "if tonumber(current) < tonumber(ARGV[1]) then " +
            "  redis.call('INCR', KEYS[1]) " +
            "  return 1 " +
            "else " +
            "  return 0 " +
            "end";
        
        return redis.eval(script, key, maxPermits) == 1;
    }
    
    void release(String key) {
        redis.decr(key);
    }
}

Rate Limiting:
- Limit: 100 executions per minute per task type
- Use sliding window counter
- Queue excess tasks
- Prevent resource exhaustion
```

### 7. Implement Task Retries with Different Strategies
**Question**: "How would you implement different retry strategies for different types of failures?"

**Solution**:
```
Retry Strategy:
class RetryManager {
    void handleFailure(Task task, Exception error) {
        RetryPolicy policy = getRetryPolicy(task, error);
        
        if (shouldRetry(task, policy)) {
            long delay = calculateDelay(task, policy);
            scheduleRetry(task, delay);
        } else {
            moveToDeadLetterQueue(task, error);
        }
    }
    
    RetryPolicy getRetryPolicy(Task task, Exception error) {
        if (error instanceof NetworkException) {
            return new ExponentialBackoffPolicy(
                baseDelay: 1000,
                maxDelay: 60000,
                maxRetries: 5
            );
        } else if (error instanceof RateLimitException) {
            return new FixedDelayPolicy(
                delay: 60000,  // 1 minute
                maxRetries: 10
            );
        } else if (error instanceof ValidationException) {
            return new NoRetryPolicy();  // Don't retry
        } else {
            return new LinearBackoffPolicy(
                baseDelay: 5000,
                increment: 5000,
                maxRetries: 3
            );
        }
    }
    
    long calculateDelay(Task task, RetryPolicy policy) {
        int retryCount = task.retryCount;
        
        if (policy instanceof ExponentialBackoffPolicy) {
            long delay = policy.baseDelay * Math.pow(2, retryCount);
            // Add jitter to prevent thundering herd
            delay += random.nextInt(1000);
            return Math.min(delay, policy.maxDelay);
        } else if (policy instanceof LinearBackoffPolicy) {
            return policy.baseDelay + (retryCount * policy.increment);
        } else {
            return policy.delay;
        }
    }
}

Circuit Breaker:
- If task fails 10 times in a row, open circuit
- Stop retrying for 5 minutes
- Try one execution (half-open)
- If succeeds, close circuit
- If fails, open circuit again
```

### 8. Implement Task Scheduling with Resource Constraints
**Question**: "How would you schedule tasks that require specific resources (e.g., GPU, memory)?"

**Solution**:
```
Resource-Aware Scheduling:
class ResourceScheduler {
    void scheduleTask(Task task) {
        ResourceRequirements req = task.requirements;
        
        // Find workers with required resources
        List<Worker> candidates = workers.stream()
            .filter(w -> w.hasResources(req))
            .filter(w -> w.availableCapacity() >= req.capacity)
            .collect(Collectors.toList());
        
        if (candidates.isEmpty()) {
            // Queue task until resources available
            queueTask(task);
        } else {
            // Select best worker
            Worker worker = selectWorker(candidates, req);
            
            // Reserve resources
            worker.reserveResources(req);
            
            // Dispatch task
            dispatchTask(task, worker);
        }
    }
    
    Worker selectWorker(List<Worker> candidates, ResourceRequirements req) {
        // Bin packing: Select worker with least remaining capacity
        // to minimize fragmentation
        return candidates.stream()
            .min(Comparator.comparing(w -> 
                w.availableCapacity() - req.capacity))
            .orElse(candidates.get(0));
    }
}

Resource Types:
- CPU cores
- Memory (GB)
- GPU count
- Disk space
- Network bandwidth

Worker Registration:
{
  "worker_id": "worker-1",
  "resources": {
    "cpu_cores": 16,
    "memory_gb": 64,
    "gpu_count": 2,
    "disk_gb": 1000
  },
  "available": {
    "cpu_cores": 12,
    "memory_gb": 48,
    "gpu_count": 1,
    "disk_gb": 800
  }
}
```

These variations demonstrate deep understanding of distributed task scheduling challenges and practical solutions for real-world scenarios.
