# Distributed Task Scheduler - System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Clients                              │
│  (Applications scheduling tasks)                        │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│              API Gateway                                │
│  (Authentication, rate limiting)                        │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│           Scheduler Service Cluster                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │Scheduler1│  │Scheduler2│  │Scheduler3│  ...         │
│  │(Leader)  │  │(Follower)│  │(Follower)│              │
│  └──────────┘  └──────────┘  └──────────┘              │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│              Task Queue (Kafka/RabbitMQ)                │
│  (Pending tasks ready for execution)                    │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│              Worker Pool                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Worker 1 │  │ Worker 2 │  │ Worker 3 │  ...         │
│  └──────────┘  └──────────┘  └──────────┘              │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│           Storage Layer                                 │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │  PostgreSQL  │  │  Redis Cache │                    │
│  │  (Tasks DB)  │  │  (Hot data)  │                    │
│  └──────────────┘  └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

## Scheduler Service Architecture

### Time Wheel Algorithm
```
Efficient task scheduling using hierarchical time wheels:

Level 1: Seconds (60 slots, 1s per slot)
Level 2: Minutes (60 slots, 1m per slot)
Level 3: Hours (24 slots, 1h per slot)
Level 4: Days (30 slots, 1d per slot)

Example: Schedule task for 2h 15m 30s from now
- Place in Level 4, slot 0 (days)
- When day advances, move to Level 3, slot 2 (hours)
- When hour advances, move to Level 2, slot 15 (minutes)
- When minute advances, move to Level 1, slot 30 (seconds)
- When second arrives, execute task

Benefits:
- O(1) insertion and deletion
- O(1) tick processing
- Memory efficient
- Handles millions of tasks
```

### Scheduler Components
```
┌─────────────────────────────────────────────────────────┐
│              Scheduler Service                          │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Time Wheel   │  │ Task Scanner │  │ Task         │  │
│  │ Manager      │  │              │  │ Dispatcher   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                  │                  │         │
│         ▼                  ▼                  ▼         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Cron Parser  │  │ Task Queue   │  │ Worker       │  │
│  │              │  │ Manager      │  │ Registry     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Task Lifecycle
```
1. Task Created
   ├── Validate schedule
   ├── Parse cron expression
   ├── Calculate next execution time
   └── Store in database

2. Task Scheduled
   ├── Load into time wheel
   ├── Set in appropriate slot
   └── Wait for execution time

3. Task Ready
   ├── Time wheel tick reaches task
   ├── Move to execution queue
   └── Notify workers

4. Task Executing
   ├── Worker picks up task
   ├── Execute task logic
   ├── Monitor progress
   └── Handle timeout

5. Task Completed
   ├── Record execution result
   ├── Update task status
   ├── Calculate next run (if recurring)
   └── Reschedule or archive
```

## Leader Election and Coordination

### Raft Consensus for Leader Election
```
Scheduler Cluster:
- 3-5 scheduler instances
- One leader, others followers
- Leader handles task scheduling
- Followers replicate state

Leader Responsibilities:
- Scan database for upcoming tasks
- Maintain time wheel
- Dispatch tasks to queue
- Handle task lifecycle

Follower Responsibilities:
- Replicate leader's state
- Ready to become leader
- Handle read-only queries
- Monitor leader health

Election Process:
1. Leader sends heartbeats every 100ms
2. If no heartbeat for 1 second, start election
3. Candidate requests votes from peers
4. Majority votes → become leader
5. New leader resumes scheduling

Failover Time: <5 seconds
```

### Distributed Locking
```
Ensure exactly-once execution:

Lock Acquisition:
SET task:lock:{task_id} {worker_id} NX EX 300

If successful:
- Worker owns the task
- Execute task
- Release lock on completion

If failed:
- Another worker owns task
- Skip execution
- Prevent duplicates

Lock Extension:
- Long-running tasks extend lock
- Extend every 60 seconds
- Prevent lock expiration

Lock Release:
DEL task:lock:{task_id}

Dead Lock Detection:
- Lock expires after 5 minutes
- Task marked as failed
- Available for retry
```

## Task Queue Architecture

### Priority Queue Implementation
```
Three priority queues:

High Priority Queue:
- Critical tasks
- SLA: Execute within 1 second
- Workers poll every 100ms

Medium Priority Queue:
- Standard tasks
- SLA: Execute within 5 seconds
- Workers poll every 500ms

Low Priority Queue:
- Background tasks
- SLA: Execute within 30 seconds
- Workers poll every 5 seconds

Worker Polling Strategy:
while (true) {
    task = pollHighPriority();
    if (task == null) {
        task = pollMediumPriority();
    }
    if (task == null) {
        task = pollLowPriority();
    }
    if (task != null) {
        execute(task);
    }
    sleep(100ms);
}
```

### Task Distribution
```
Push Model (Recommended):
- Scheduler pushes tasks to queue
- Workers pull from queue
- Decoupled architecture
- Better load balancing

Pull Model:
- Workers query scheduler
- Scheduler assigns tasks
- Tighter coupling
- More coordination overhead

Hybrid Model:
- Push for high priority
- Pull for low priority
- Best of both worlds
```

## Worker Architecture

### Worker Components
```
┌─────────────────────────────────────────────────────────┐
│                    Worker Node                          │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Task Poller  │  │ Task         │  │ Heartbeat    │  │
│  │              │  │ Executor     │  │ Manager      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                  │                  │         │
│         ▼                  ▼                  ▼         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Task Queue   │  │ Thread Pool  │  │ Health       │  │
│  │ (Local)      │  │              │  │ Monitor      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Task Execution
```
Execution Flow:
1. Worker polls task queue
2. Acquire distributed lock
3. Load task details
4. Execute in thread pool
5. Monitor execution
6. Handle timeout
7. Record result
8. Release lock
9. Update status

Timeout Handling:
- Set execution timeout
- Monitor task progress
- Kill if exceeds timeout
- Mark as failed
- Retry if configured

Resource Management:
- Thread pool: 10-100 threads
- Memory limit: 2 GB per worker
- CPU limit: 4 cores per worker
- Graceful shutdown on overload
```

## Cron Expression Parsing

### Cron Parser
```
Cron Format: * * * * * (minute hour day month weekday)

Examples:
0 0 * * * → Daily at midnight
*/5 * * * * → Every 5 minutes
0 9-17 * * 1-5 → 9 AM to 5 PM, Monday to Friday
0 0 1 * * → First day of every month

Parser Implementation:
class CronParser {
    LocalDateTime getNextExecution(String cron, LocalDateTime from) {
        CronExpression expr = CronExpression.parse(cron);
        return expr.next(from);
    }
    
    boolean matches(String cron, LocalDateTime time) {
        CronExpression expr = CronExpression.parse(cron);
        return expr.matches(time);
    }
}

Timezone Handling:
- Store timezone with task
- Convert to UTC for storage
- Convert to local for display
- Handle DST transitions
```

## Monitoring and Observability

### Key Metrics
```
Scheduler Metrics:
- Tasks scheduled per second
- Time wheel size
- Queue depth
- Leader election count
- Scheduling latency

Worker Metrics:
- Tasks executed per second
- Execution duration (P50, P95, P99)
- Success rate
- Failure rate
- Worker utilization

System Metrics:
- Total active tasks
- Overdue tasks
- Failed tasks
- Retry count
- Lock contention
```

### Distributed Tracing
```
Trace task lifecycle:

Span 1: Task Creation
- Duration: 50ms
- Tags: task_id, schedule

Span 2: Task Scheduling
- Duration: 100ms
- Tags: scheduler_id, queue

Span 3: Task Execution
- Duration: 5000ms
- Tags: worker_id, result

Span 4: Result Recording
- Duration: 30ms
- Tags: status, duration

Total Trace: 5180ms
Identify bottlenecks and optimize
```

This architecture provides a robust, scalable foundation for distributed task scheduling with precise timing and fault tolerance.
