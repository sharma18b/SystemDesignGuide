# Load Balancer - Database Design

## Backend Server Registry
```
BackendServer:
  server_id: string
  hostname: string
  ip_address: string
  port: int
  weight: int
  status: HEALTHY|UNHEALTHY|DRAINING
  health_check_url: string
  last_health_check: timestamp
  connection_count: int
  response_time_ms: float
```

## Health Check Configuration
```
HealthCheck:
  interval_seconds: int
  timeout_seconds: int
  unhealthy_threshold: int
  healthy_threshold: int
  path: string
  expected_status: int
```

## Session Store
```
Session:
  session_id: string
  client_ip: string
  backend_server_id: string
  created_at: timestamp
  expires_at: timestamp
```

## Metrics
```
Metrics:
  timestamp: timestamp
  requests_per_second: int
  active_connections: int
  backend_response_time: float
  error_rate: float
```

This database design efficiently manages load balancer configuration and state.
