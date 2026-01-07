# Distributed Locking System - System Architecture

## High-Level Architecture Overview

### System Architecture Principles
- **Consensus-Based**: Raft/Paxos for state replication
- **Leader-Based Writes**: Single leader for all writes
- **Quorum Reads**: Majority reads for consistency
- **Session-Based**: Client sessions with heartbeats
- **Watch-Based Notifications**: Event-driven updates
- **Fault Tolerant**: Survive minority node failures

### Core Architecture Components
```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
│  (Microservices, Distributed Systems, Databases)            │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌─────────┴─────────┬─────────────┬─────────────┐
        │                   │             │             │
┌───────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
│  Lock Client   │  │  Lock Client   │  │  Lock Client   │
│   Library      │  │   Library      │  │   Library      │
└───────┬────────┘  └───────┬────────┘  └───────┬────────┘
        │                   │             │
        └─────────┬─────────┴─────────────┘
                  │
        ┌─────────▼─────────┐
        │   Load Balancer   │
        │  (Client-Side)    │
        └─────────┬─────────┘
                  │
    ┌─────────────┼─────────────┬─────────────┐
    │             │             │             │
┌───▼────┐  ┌────▼───┐  ┌─────▼──┐  ┌───────▼────┐
│ Leader │  │Follower│  │Follower│  │  Follower  │
│ Node 1 │  │ Node 2 │  │ Node 3 │  │  Node N    │
└───┬────┘  └────┬───┘  └────┬───┘  └──────┬─────┘
    │            │           │             │
    └────────────┴───────────┴─────────────┘
                 │
        ┌────────▼────────┐
        │  Raft Consensus │
        │  Log Replication│
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │ Persistent Store│
        │  (RocksDB/LevelDB)│
        └─────────────────┘
```

## Raft Consensus Algorithm

### Raft Overview
```
Raft Components:
1. Leader Election
2. Log Replication
3. Safety Guarantees

Node States:
- Leader: Handles all writes, replicates to followers
- Follower: Receives log entries, votes in elections
- Candidate: Requests votes during election

Terms:
- Monotonically increasing election term
- Each term has at most one leader
- Used to detect stale information
```

