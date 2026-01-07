# Load Balancer - Scale and Constraints

## Traffic Scale
- **Requests**: 100 billion requests/day
- **Peak Traffic**: 1.5M requests/sec
- **Concurrent Connections**: 10M connections
- **New Connections**: 100K/sec
- **Backend Servers**: 10,000 servers

## Load Balancer Capacity
- **LB Instances**: 100 instances
- **Per-LB Throughput**: 100K requests/sec
- **Per-LB Connections**: 100K concurrent
- **Per-LB Bandwidth**: 10Gbps

## Performance Targets
- **Latency Overhead**: <1ms
- **Throughput**: 1M+ requests/sec cluster
- **Availability**: 99.99%
- **Failover Time**: <5 seconds

## Cost
- **Infrastructure**: $50K/month
- **Bandwidth**: $20K/month
- **Total**: $70K/month
- **Cost per Request**: $0.0000007
