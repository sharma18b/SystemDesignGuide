# Distributed Task Scheduler - API Design

## REST API

### Create Task
```http
POST /api/v1/tasks
Content-Type: application/json
Authorization: Bearer <token>

{
  "task_name": "daily_report_generation",
  "task_type": "cron",
  "schedule_expression": "0 0 * * *",
  "timezone": "America/New_York",
  "payload": {
    "report_type": "daily",
    "recipients": ["admin@example.com"]
  },
  "timeout_seconds": 300,
  "max_retries": 3,
  "priority": "high",
  "tags": {"team": "analytics", "env": "production"}
}

Response 201 Created:
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "task_name": "daily_report_generation",
  "status": "scheduled",
  "next_execution_time": "2024-01-09T05:00:00Z",  // Converted to UTC
  "created_at": "2024-01-08T10:00:00Z"
}
```

### Get Task
```http
GET /api/v1/tasks/{task_id}

Response 200 OK:
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "task_name": "daily_report_generation",
  "task_type": "cron",
  "schedule_expression": "0 0 * * *",
  "timezone": "America/New_York",
  "next_execution_time": "2024-01-09T05:00:00Z",
  "last_execution_time": "2024-01-08T05:00:00Z",
  "status": "scheduled",
  "enabled": true,
  "payload": {...},
  "timeout_seconds": 300,
  "max_retries": 3,
  "retry_count": 0,
  "priority": "high",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-08T10:00:00Z"
}
```

### List Tasks
```http
GET /api/v1/tasks?status=scheduled&priority=high&limit=20&offset=0

Response 200 OK:
{
  "tasks": [
    {
      "task_id": "...",
      "task_name": "...",
      "status": "scheduled",
      "next_execution_time": "..."
    }
  ],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

### Update Task
```http
PATCH /api/v1/tasks/{task_id}
Content-Type: application/json

{
  "schedule_expression": "0 2 * * *",  // Change to 2 AM
  "enabled": true,
  "priority": "medium"
}

Response 200 OK:
{
  "task_id": "...",
  "updated_fields": ["schedule_expression", "priority"],
  "next_execution_time": "2024-01-09T07:00:00Z",  // Recalculated
  "updated_at": "2024-01-08T10:30:00Z"
}
```

### Delete Task
```http
DELETE /api/v1/tasks/{task_id}

Response 204 No Content
```

### Pause/Resume Task
```http
POST /api/v1/tasks/{task_id}/pause

Response 200 OK:
{
  "task_id": "...",
  "status": "paused",
  "paused_at": "2024-01-08T10:00:00Z"
}

POST /api/v1/tasks/{task_id}/resume

Response 200 OK:
{
  "task_id": "...",
  "status": "scheduled",
  "next_execution_time": "2024-01-09T05:00:00Z",
  "resumed_at": "2024-01-08T10:05:00Z"
}
```

### Trigger Task Immediately
```http
POST /api/v1/tasks/{task_id}/trigger

Response 202 Accepted:
{
  "task_id": "...",
  "execution_id": "...",
  "status": "queued",
  "queued_at": "2024-01-08T10:00:00Z"
}
```

## Task Execution API

### Get Task Executions
```http
GET /api/v1/tasks/{task_id}/executions?limit=10

Response 200 OK:
{
  "executions": [
    {
      "execution_id": "...",
      "task_id": "...",
      "worker_id": "worker-1",
      "started_at": "2024-01-08T05:00:00Z",
      "completed_at": "2024-01-08T05:05:30Z",
      "duration_ms": 330000,
      "status": "success",
      "retry_number": 0
    }
  ],
  "total": 100
}
```

### Get Execution Details
```http
GET /api/v1/executions/{execution_id}

Response 200 OK:
{
  "execution_id": "...",
  "task_id": "...",
  "worker_id": "worker-1",
  "started_at": "2024-01-08T05:00:00Z",
  "completed_at": "2024-01-08T05:05:30Z",
  "duration_ms": 330000,
  "status": "success",
  "result": {
    "records_processed": 10000,
    "output_file": "s3://bucket/report.pdf"
  },
  "retry_number": 0,
  "is_retry": false
}
```

### Get Execution Logs
```http
GET /api/v1/executions/{execution_id}/logs

Response 200 OK:
{
  "execution_id": "...",
  "logs": [
    {
      "timestamp": "2024-01-08T05:00:01Z",
      "level": "INFO",
      "message": "Starting report generation"
    },
    {
      "timestamp": "2024-01-08T05:05:30Z",
      "level": "INFO",
      "message": "Report generated successfully"
    }
  ]
}
```

### Cancel Running Task
```http
POST /api/v1/executions/{execution_id}/cancel

Response 200 OK:
{
  "execution_id": "...",
  "status": "cancelled",
  "cancelled_at": "2024-01-08T05:02:00Z"
}
```

## Task Dependencies API

### Add Dependency
```http
POST /api/v1/tasks/{task_id}/dependencies
Content-Type: application/json

{
  "depends_on_task_id": "parent-task-id",
  "dependency_type": "success"  // success, completion, any
}

Response 201 Created:
{
  "dependency_id": "...",
  "task_id": "...",
  "depends_on_task_id": "...",
  "dependency_type": "success"
}
```

### List Dependencies
```http
GET /api/v1/tasks/{task_id}/dependencies

Response 200 OK:
{
  "dependencies": [
    {
      "dependency_id": "...",
      "depends_on_task_id": "...",
      "depends_on_task_name": "data_processing",
      "dependency_type": "success"
    }
  ]
}
```

### Remove Dependency
```http
DELETE /api/v1/tasks/{task_id}/dependencies/{dependency_id}

Response 204 No Content
```

## Bulk Operations API

### Bulk Create Tasks
```http
POST /api/v1/tasks/bulk
Content-Type: application/json

{
  "tasks": [
    {
      "task_name": "task1",
      "task_type": "one_time",
      "next_execution_time": "2024-01-08T15:00:00Z",
      "payload": {...}
    },
    {
      "task_name": "task2",
      "task_type": "one_time",
      "next_execution_time": "2024-01-08T16:00:00Z",
      "payload": {...}
    }
  ]
}

Response 201 Created:
{
  "created": 2,
  "failed": 0,
  "task_ids": ["...", "..."]
}
```

### Bulk Delete Tasks
```http
POST /api/v1/tasks/bulk-delete
Content-Type: application/json

{
  "task_ids": ["task-id-1", "task-id-2", "task-id-3"]
}

Response 200 OK:
{
  "deleted": 3,
  "failed": 0
}
```

## Monitoring API

### Get System Status
```http
GET /api/v1/status

Response 200 OK:
{
  "status": "healthy",
  "scheduler": {
    "leader": "scheduler-1",
    "followers": ["scheduler-2", "scheduler-3"],
    "tasks_scheduled": 1000000,
    "tasks_pending": 5000
  },
  "workers": {
    "total": 100,
    "active": 98,
    "inactive": 2,
    "total_capacity": 1000,
    "current_load": 650
  },
  "queue": {
    "high_priority": 10,
    "medium_priority": 100,
    "low_priority": 500
  }
}
```

### Get Task Statistics
```http
GET /api/v1/tasks/{task_id}/stats

Response 200 OK:
{
  "task_id": "...",
  "total_executions": 100,
  "successful_executions": 98,
  "failed_executions": 2,
  "success_rate": 0.98,
  "average_duration_ms": 5000,
  "p50_duration_ms": 4500,
  "p95_duration_ms": 7000,
  "p99_duration_ms": 9000,
  "last_7_days": {
    "executions": 7,
    "success_rate": 1.0
  }
}
```

### Get Worker Status
```http
GET /api/v1/workers

Response 200 OK:
{
  "workers": [
    {
      "worker_id": "worker-1",
      "status": "active",
      "capacity": 10,
      "current_load": 7,
      "last_heartbeat": "2024-01-08T10:00:00Z",
      "uptime_seconds": 86400
    }
  ],
  "total": 100
}
```

## Client SDKs

### Python SDK
```python
from task_scheduler import TaskSchedulerClient

# Initialize client
client = TaskSchedulerClient(
    base_url="https://api.example.com",
    api_key="your_api_key"
)

# Create task
task = client.create_task(
    task_name="daily_report",
    task_type="cron",
    schedule_expression="0 0 * * *",
    timezone="America/New_York",
    payload={"report_type": "daily"}
)
print(f"Task created: {task.task_id}")

# Get task status
task = client.get_task(task.task_id)
print(f"Status: {task.status}")
print(f"Next execution: {task.next_execution_time}")

# List executions
executions = client.get_executions(task.task_id, limit=10)
for execution in executions:
    print(f"Execution {execution.execution_id}: {execution.status}")

# Trigger task immediately
execution = client.trigger_task(task.task_id)
print(f"Triggered execution: {execution.execution_id}")

# Delete task
client.delete_task(task.task_id)
```

### JavaScript SDK
```javascript
import { TaskSchedulerClient } from 'task-scheduler-sdk';

// Initialize client
const client = new TaskSchedulerClient({
  baseUrl: 'https://api.example.com',
  apiKey: 'your_api_key'
});

// Create task
const task = await client.createTask({
  taskName: 'daily_report',
  taskType: 'cron',
  scheduleExpression: '0 0 * * *',
  timezone: 'America/New_York',
  payload: { reportType: 'daily' }
});
console.log(`Task created: ${task.taskId}`);

// Get task status
const taskStatus = await client.getTask(task.taskId);
console.log(`Status: ${taskStatus.status}`);

// List executions
const executions = await client.getExecutions(task.taskId, { limit: 10 });
executions.forEach(execution => {
  console.log(`Execution ${execution.executionId}: ${execution.status}`);
});

// Trigger task immediately
const execution = await client.triggerTask(task.taskId);
console.log(`Triggered execution: ${execution.executionId}`);

// Delete task
await client.deleteTask(task.taskId);
```

### Java SDK
```java
import com.example.TaskSchedulerClient;

// Initialize client
TaskSchedulerClient client = new TaskSchedulerClient.Builder()
    .baseUrl("https://api.example.com")
    .apiKey("your_api_key")
    .build();

// Create task
Task task = client.createTask(Task.builder()
    .taskName("daily_report")
    .taskType(TaskType.CRON)
    .scheduleExpression("0 0 * * *")
    .timezone("America/New_York")
    .payload(Map.of("reportType", "daily"))
    .build());
System.out.println("Task created: " + task.getTaskId());

// Get task status
Task taskStatus = client.getTask(task.getTaskId());
System.out.println("Status: " + taskStatus.getStatus());

// List executions
List<Execution> executions = client.getExecutions(task.getTaskId(), 10);
for (Execution execution : executions) {
    System.out.println("Execution " + execution.getExecutionId() + ": " + execution.getStatus());
}

// Trigger task immediately
Execution execution = client.triggerTask(task.getTaskId());
System.out.println("Triggered execution: " + execution.getExecutionId());

// Delete task
client.deleteTask(task.getTaskId());
```

This comprehensive API design provides flexible, efficient, and developer-friendly interfaces for distributed task scheduling operations.
