# Distributed Messaging System - Security and Privacy

## Authentication and Authorization

### Authentication Mechanisms
```
1. SASL/PLAIN (Simple):
- Username/password authentication
- Easy to implement
- Not secure without TLS
- Use for development only

Configuration:
security.protocol=SASL_SSL
sasl.mechanism=PLAIN
sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule \
    required username="admin" password="secret";

2. SASL/SCRAM (Recommended):
- Salted Challenge Response Authentication
- Passwords hashed with PBKDF2
- Secure over TLS
- Production-ready

Configuration:
sasl.mechanism=SCRAM-SHA-512
sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule \
    required username="admin" password="secret";

3. SASL/GSSAPI (Kerberos):
- Enterprise authentication
- Single sign-on
- Complex setup
- High security

Configuration:
sasl.mechanism=GSSAPI
sasl.kerberos.service.name=kafka
sasl.jaas.config=com.sun.security.auth.module.Krb5LoginModule \
    required useKeyTab=true keyTab="/path/to/keytab";

4. mTLS (Mutual TLS):
- Certificate-based authentication
- No passwords
- Highest security
- Complex certificate management

Configuration:
security.protocol=SSL
ssl.keystore.location=/path/to/keystore.jks
ssl.keystore.password=password
ssl.truststore.location=/path/to/truststore.jks
ssl.truststore.password=password
```

### Authorization (ACLs)
```
ACL Model:
Principal: User or service identity
Resource: Topic, consumer group, cluster
Operation: Read, write, create, delete, describe
Permission: Allow or deny

Examples:
# Allow user 'alice' to write to topic 'user-events'
kafka-acls --add \
    --allow-principal User:alice \
    --operation Write \
    --topic user-events

# Allow group 'analytics' to read from topic 'user-events'
kafka-acls --add \
    --allow-principal User:analytics \
    --operation Read \
    --topic user-events \
    --group analytics-service

# Allow 'admin' all operations on all topics
kafka-acls --add \
    --allow-principal User:admin \
    --operation All \
    --topic '*' \
    --cluster

ACL Storage:
- Stored in ZooKeeper/KRaft
- Cached in brokers
- Evaluated on every request
- Deny takes precedence over allow
```

## Encryption

### Encryption in Transit (TLS)
```
Broker Configuration:
listeners=SSL://broker1:9093
ssl.keystore.location=/path/to/keystore.jks
ssl.keystore.password=password
ssl.key.password=password
ssl.truststore.location=/path/to/truststore.jks
ssl.truststore.password=password
ssl.client.auth=required  # Mutual TLS

Client Configuration:
security.protocol=SSL
ssl.truststore.location=/path/to/truststore.jks
ssl.truststore.password=password
ssl.keystore.location=/path/to/keystore.jks
ssl.keystore.password=password

Certificate Management:
- Use CA-signed certificates
- Rotate certificates annually
- Monitor expiration dates
- Automate renewal process
```

### Encryption at Rest
```
Disk Encryption:
- LUKS (Linux Unified Key Setup)
- dm-crypt for block devices
- Transparent to Kafka
- OS-level encryption

# Enable LUKS encryption
cryptsetup luksFormat /dev/sdb
cryptsetup luksOpen /dev/sdb kafka_data
mkfs.ext4 /dev/mapper/kafka_data
mount /dev/mapper/kafka_data /var/lib/kafka

Application-Level Encryption:
- Encrypt message payload before sending
- Decrypt after receiving
- End-to-end encryption
- Key management required

Producer:
byte[] encrypted = encrypt(message, key);
producer.send(new ProducerRecord<>("topic", encrypted));

Consumer:
byte[] encrypted = record.value();
Message message = decrypt(encrypted, key);
```

## Data Privacy and Compliance

### GDPR Compliance
```
Requirements:
1. Right to Access:
   - Provide user's messages
   - Export in portable format
   
2. Right to Erasure:
   - Delete user's messages
   - Tombstone records
   
3. Data Minimization:
   - Collect only necessary data
   - Minimize retention period
   
4. Consent Management:
   - Track user consent
   - Respect opt-outs

Implementation:
# Delete user data (log compaction)
producer.send(new ProducerRecord<>(
    "user-events",
    userId,
    null  // Tombstone (delete)
));

# Export user data
consumer.assign(partitions);
consumer.seek(partition, 0);
while (true) {
    records = consumer.poll();
    for (record : records) {
        if (record.key().equals(userId)) {
            export(record);
        }
    }
}
```

### PII Handling
```
Strategies:
1. Pseudonymization:
   - Replace PII with pseudonyms
   - Maintain mapping separately
   - Reversible with key

2. Anonymization:
   - Remove identifying information
   - Irreversible
   - Aggregate data only

3. Tokenization:
   - Replace PII with tokens
   - Store mapping in secure vault
   - Retrieve when needed

4. Field-Level Encryption:
   - Encrypt sensitive fields only
   - Preserve message structure
   - Selective decryption

Example:
{
    "user_id": "hash(user123)",  // Pseudonymized
    "email": "encrypt(alice@example.com)",  // Encrypted
    "age_range": "25-34",  // Anonymized
    "event_type": "login"  // Plain text
}
```

## Audit Logging

### Security Audit Trail
```
Events to Log:
- Authentication attempts (success/failure)
- Authorization decisions (allow/deny)
- Topic creation/deletion
- ACL changes
- Configuration changes
- Admin operations

Log Format:
{
    "timestamp": "2024-01-08T10:00:00Z",
    "event_type": "authentication",
    "principal": "User:alice",
    "result": "success",
    "source_ip": "203.0.113.42",
    "resource": "topic:user-events",
    "operation": "Write"
}

Storage:
- Separate audit topic
- Long retention (1 year+)
- Immutable (log compaction disabled)
- Replicated for durability
- Exported to SIEM system

Monitoring:
- Failed authentication attempts
- Unauthorized access attempts
- Unusual access patterns
- Privilege escalation attempts
```

## Network Security

### Network Segmentation
```
Architecture:
┌─────────────────────────────────────┐
│         DMZ (Public)                │
│  ┌──────────────────────────────┐   │
│  │   Load Balancer              │   │
│  └──────────┬───────────────────┘   │
└─────────────┼───────────────────────┘
              │
┌─────────────┼───────────────────────┐
│  Application Tier (Private)         │
│  ┌──────────┴───────────────────┐   │
│  │   Kafka Brokers              │   │
│  │   (Internal network only)    │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘

Firewall Rules:
- Allow 9092 from application tier only
- Allow 9093 (SSL) from trusted networks
- Block all other inbound traffic
- Allow outbound for replication
```

### DDoS Protection
```
Mitigation Strategies:
1. Rate Limiting:
   - Limit connections per IP
   - Limit requests per client
   - Throttle excessive traffic

2. Connection Limits:
   - Max connections per broker
   - Max connections per client
   - Connection timeout

3. Request Quotas:
   - Produce quota: 1MB/s per client
   - Consume quota: 10MB/s per client
   - Enforce at broker level

Configuration:
# Connection limits
max.connections.per.ip=100
max.connections.per.ip.overrides=trusted_ip:1000

# Request quotas
quota.producer.default=1048576  # 1MB/s
quota.consumer.default=10485760  # 10MB/s

# Client-specific quotas
kafka-configs --alter \
    --add-config 'producer_byte_rate=10485760' \
    --entity-type clients \
    --entity-name client-1
```

## Secure Configuration Management

### Secrets Management
```
Options:
1. HashiCorp Vault:
   - Centralized secrets storage
   - Dynamic secrets
   - Audit logging
   - Access control

2. AWS Secrets Manager:
   - Cloud-native
   - Automatic rotation
   - Integration with IAM
   - Encryption at rest

3. Kubernetes Secrets:
   - Native to K8s
   - Base64 encoded
   - RBAC integration
   - Limited features

Implementation:
# Store secrets in Vault
vault kv put secret/kafka/broker \
    keystore_password=secret123 \
    truststore_password=secret456

# Retrieve in application
String password = vault.read("secret/kafka/broker")
    .getData().get("keystore_password");

# Rotate secrets
vault kv put secret/kafka/broker \
    keystore_password=newsecret123
```

### Configuration Validation
```
Security Checklist:
☐ TLS enabled for all connections
☐ Authentication required (SASL/mTLS)
☐ Authorization enabled (ACLs)
☐ Encryption at rest enabled
☐ Audit logging enabled
☐ Strong passwords (12+ characters)
☐ Certificate expiration monitoring
☐ Regular security updates
☐ Network segmentation
☐ Firewall rules configured

Automated Validation:
# Check TLS configuration
if [ "$security_protocol" != "SSL" ] && \
   [ "$security_protocol" != "SASL_SSL" ]; then
    echo "ERROR: TLS not enabled"
    exit 1
fi

# Check authentication
if [ -z "$sasl_mechanism" ]; then
    echo "ERROR: Authentication not configured"
    exit 1
fi
```

## Incident Response

### Security Incident Procedures
```
1. Detection:
   - Monitor audit logs
   - Alert on suspicious activity
   - Automated threat detection

2. Containment:
   - Revoke compromised credentials
   - Block malicious IPs
   - Isolate affected brokers

3. Investigation:
   - Analyze audit logs
   - Identify attack vector
   - Assess damage

4. Recovery:
   - Restore from backups
   - Rotate all credentials
   - Apply security patches

5. Post-Mortem:
   - Document incident
   - Update procedures
   - Implement preventive measures

Runbook:
# Revoke compromised user
kafka-acls --remove \
    --allow-principal User:compromised_user \
    --operation All \
    --topic '*'

# Block malicious IP
iptables -A INPUT -s 198.51.100.42 -j DROP

# Rotate credentials
kafka-configs --alter \
    --entity-type users \
    --entity-name alice \
    --add-config 'SCRAM-SHA-512=[password=newpassword]'
```

This comprehensive security approach ensures the messaging system is protected against threats while maintaining compliance with privacy regulations.
