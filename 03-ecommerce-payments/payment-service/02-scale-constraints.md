# Payment Service Scale and Constraints

## Overview (2 mins)
Payment processing systems operate under unique constraints due to financial regulations, security requirements, and the need for real-time processing across global networks. Understanding these constraints is crucial for designing a system that can handle billions in transaction volume while maintaining compliance and security.

## Transaction Volume and Scale (4 mins)

### Peak Transaction Scenarios
```python
# Black Friday / Cyber Monday traffic patterns
PEAK_SCENARIOS = {
    'black_friday': {
        'duration': '24 hours',
        'peak_multiplier': '10x normal traffic',
        'transactions_per_second': 50000,
        'total_volume': '$2 billion',
        'geographic_concentration': 'US-heavy traffic'
    },
    'singles_day': {
        'duration': '24 hours', 
        'peak_multiplier': '15x normal traffic',
        'transactions_per_second': 75000,
        'total_volume': '$3 billion',
        'geographic_concentration': 'Asia-Pacific heavy'
    },
    'regular_peak': {
        'duration': '2-4 hours daily',
        'peak_multiplier': '3x normal traffic',
        'transactions_per_second': 15000,
        'total_volume': '$100 million',
        'pattern': 'Lunch time and evening shopping'
    }
}

# Annual growth projections
GROWTH_PROJECTIONS = {
    'year_1': {
        'merchants': 100000,
        'monthly_volume': '$1 billion',
        'transactions_per_day': 10000000
    },
    'year_3': {
        'merchants': 500000,
        'monthly_volume': '$10 billion', 
        'transactions_per_day': 100000000
    },
    'year_5': {
        'merchants': 1000000,
        'monthly_volume': '$50 billion',
        'transactions_per_day': 500000000
    }
}
```

### Geographic Distribution Challenges
```python
GEOGRAPHIC_CONSTRAINTS = {
    'north_america': {
        'transaction_percentage': 40,
        'peak_hours': '12:00-14:00, 19:00-21:00 EST',
        'primary_payment_methods': ['credit_card', 'debit_card', 'paypal'],
        'regulatory_requirements': ['PCI_DSS', 'SOX', 'CCPA'],
        'settlement_time': 'T+1'
    },
    'europe': {
        'transaction_percentage': 30,
        'peak_hours': '12:00-14:00, 18:00-20:00 CET',
        'primary_payment_methods': ['sepa', 'credit_card', 'ideal', 'sofort'],
        'regulatory_requirements': ['PCI_DSS', 'GDPR', 'PSD2'],
        'settlement_time': 'T+1 to T+2'
    },
    'asia_pacific': {
        'transaction_percentage': 25,
        'peak_hours': '11:00-13:00, 19:00-21:00 JST',
        'primary_payment_methods': ['alipay', 'wechat_pay', 'credit_card'],
        'regulatory_requirements': ['Local_banking_laws', 'Data_localization'],
        'settlement_time': 'T+2 to T+3'
    },
    'rest_of_world': {
        'transaction_percentage': 5,
        'challenges': ['Currency_volatility', 'Banking_infrastructure', 'Compliance_complexity'],
        'settlement_time': 'T+3 to T+7'
    }
}
```

## Performance and Latency Constraints (4 mins)

### Real-time Processing Requirements
```python
# Payment authorization flow timing constraints
AUTHORIZATION_FLOW_TIMING = {
    'total_authorization_time': {
        'target': '< 500ms',
        'p95': '< 800ms',
        'p99': '< 1200ms',
        'timeout': '30 seconds'
    },
    'breakdown': {
        'fraud_check': '< 100ms',
        'card_network_call': '< 200ms',
        'database_operations': '< 50ms',
        'business_logic': '< 50ms',
        'response_formatting': '< 10ms',
        'network_overhead': '< 90ms'
    }
}

# Settlement processing constraints
SETTLEMENT_CONSTRAINTS = {
    'domestic_ach': {
        'processing_time': '1-3 business days',
        'cutoff_times': ['2:00 PM EST', '5:00 PM EST'],
        'batch_processing': True,
        'reversal_window': '24 hours'
    },
    'wire_transfers': {
        'processing_time': 'Same day if before 3:00 PM',
        'international_time': '1-5 business days',
        'cost': '$15-50 per transfer',
        'irrevocable': True
    },
    'card_settlements': {
        'processing_time': 'T+1 to T+2',
        'interchange_fees': '1.5% - 3.5%',
        'chargeback_window': '120 days',
        'dispute_resolution': '45-90 days'
    }
}
```

### Network and Infrastructure Constraints
```python
INFRASTRUCTURE_CONSTRAINTS = {
    'card_network_limits': {
        'visa': {
            'max_tps': 65000,
            'timeout': '30 seconds',
            'retry_policy': '3 attempts with exponential backoff',
            'maintenance_windows': 'Sunday 2:00-6:00 AM EST'
        },
        'mastercard': {
            'max_tps': 45000,
            'timeout': '25 seconds',
            'retry_policy': '2 attempts',
            'maintenance_windows': 'Saturday 11:00 PM - Sunday 5:00 AM EST'
        }
    },
    'banking_network_limits': {
        'ach_network': {
            'daily_cutoffs': ['8:30 AM', '1:00 PM', '4:00 PM', '6:00 PM EST'],
            'weekend_processing': False,
            'holiday_schedule': 'Federal Reserve calendar',
            'file_size_limits': '10MB per batch'
        },
        'swift_network': {
            'operating_hours': '24/7 except maintenance',
            'message_limits': '10,000 characters',
            'processing_time': '15 minutes to 5 days',
            'correspondent_bank_delays': 'Additional 1-2 days'
        }
    }
}
```

## Security and Compliance Constraints (4 mins)

### PCI DSS Compliance Requirements
```python
PCI_DSS_CONSTRAINTS = {
    'data_protection': {
        'cardholder_data_storage': 'Prohibited - use tokenization',
        'encryption_requirements': 'AES-256 minimum',
        'key_management': 'Hardware Security Modules (HSM)',
        'network_segmentation': 'Isolated payment processing environment',
        'access_controls': 'Role-based with MFA'
    },
    'operational_requirements': {
        'vulnerability_scanning': 'Quarterly external, monthly internal',
        'penetration_testing': 'Annual by qualified assessor',
        'log_monitoring': 'Real-time security event monitoring',
        'incident_response': '< 1 hour for security incidents',
        'compliance_reporting': 'Annual Report on Compliance (ROC)'
    },
    'development_constraints': {
        'secure_coding': 'OWASP Top 10 compliance',
        'code_reviews': 'Security-focused code reviews',
        'testing': 'Security testing in CI/CD pipeline',
        'deployment': 'Immutable infrastructure only',
        'change_management': 'All changes require security approval'
    }
}
```

### Regulatory Compliance Constraints
```python
REGULATORY_CONSTRAINTS = {
    'anti_money_laundering': {
        'transaction_monitoring': 'Real-time AML screening',
        'suspicious_activity_reporting': 'File SARs within 30 days',
        'customer_due_diligence': 'Enhanced KYC for high-risk customers',
        'record_keeping': '5-year transaction history retention',
        'training_requirements': 'Annual AML training for all staff'
    },
    'know_your_customer': {
        'identity_verification': 'Government ID + address verification',
        'business_verification': 'Articles of incorporation + beneficial ownership',
        'ongoing_monitoring': 'Periodic re-verification of high-risk accounts',
        'sanctions_screening': 'Real-time OFAC and global sanctions lists',
        'documentation': 'Maintain KYC documentation for 5+ years'
    },
    'data_privacy': {
        'gdpr_compliance': 'Right to be forgotten, data portability',
        'ccpa_compliance': 'California consumer privacy rights',
        'data_localization': 'Store EU data in EU, China data in China',
        'consent_management': 'Granular consent for data processing',
        'breach_notification': '72 hours to regulators, 30 days to customers'
    }
}
```

## Technical Architecture Constraints (3 mins)

### Database and Storage Constraints
```python
DATABASE_CONSTRAINTS = {
    'transaction_data': {
        'consistency_requirements': 'ACID compliance mandatory',
        'retention_period': '7 years minimum',
        'backup_requirements': 'Point-in-time recovery, cross-region replication',
        'encryption': 'Transparent Data Encryption (TDE)',
        'audit_logging': 'All data access must be logged'
    },
    'performance_requirements': {
        'read_latency': '< 10ms for account lookups',
        'write_latency': '< 50ms for transaction recording',
        'throughput': '100,000 writes/second sustained',
        'availability': '99.99% uptime requirement',
        'scalability': 'Linear scaling to 10x current volume'
    },
    'data_partitioning': {
        'strategy': 'Partition by merchant_id and date',
        'hot_data': 'Last 90 days in memory',
        'warm_data': 'Last 2 years on SSD',
        'cold_data': 'Older data on archival storage',
        'cross_partition_queries': 'Minimize for performance'
    }
}
```

### Integration Constraints
```python
INTEGRATION_CONSTRAINTS = {
    'third_party_apis': {
        'rate_limits': {
            'fraud_services': '1000 requests/second',
            'currency_conversion': '100 requests/second',
            'identity_verification': '50 requests/second'
        },
        'sla_requirements': {
            'uptime': '99.9% minimum',
            'response_time': '< 200ms',
            'error_rate': '< 0.1%'
        },
        'failover_requirements': {
            'backup_providers': 'Minimum 2 backup providers',
            'automatic_failover': '< 30 seconds',
            'manual_override': 'Available for emergency situations'
        }
    },
    'webhook_constraints': {
        'delivery_guarantees': 'At-least-once delivery',
        'retry_policy': 'Exponential backoff up to 24 hours',
        'ordering': 'No guaranteed ordering across events',
        'security': 'HMAC signature verification required',
        'rate_limiting': 'Respect merchant rate limits'
    }
}
```

## Operational Constraints (3 mins)

### Monitoring and Alerting Requirements
```python
MONITORING_CONSTRAINTS = {
    'real_time_metrics': {
        'transaction_success_rate': 'Alert if < 95%',
        'authorization_latency': 'Alert if p95 > 800ms',
        'fraud_detection_rate': 'Alert if < 99%',
        'system_availability': 'Alert if < 99.99%',
        'error_rates': 'Alert if > 0.1%'
    },
    'financial_reconciliation': {
        'daily_reconciliation': 'Must complete by 6:00 AM',
        'discrepancy_threshold': '$1000 triggers investigation',
        'settlement_tracking': 'Track all funds movement',
        'audit_trail': 'Immutable logs for all financial operations',
        'regulatory_reporting': 'Automated compliance reports'
    },
    'incident_response': {
        'severity_1': 'Payment processing down - 15 minute response',
        'severity_2': 'Degraded performance - 1 hour response',
        'severity_3': 'Non-critical issues - 4 hour response',
        'escalation_procedures': 'Auto-escalate if not acknowledged',
        'communication_plan': 'Status page updates within 5 minutes'
    }
}
```

### Disaster Recovery Constraints
```python
DISASTER_RECOVERY_CONSTRAINTS = {
    'rto_rpo_requirements': {
        'recovery_time_objective': '< 1 hour for critical systems',
        'recovery_point_objective': '< 5 minutes data loss maximum',
        'backup_frequency': 'Continuous replication + hourly snapshots',
        'testing_frequency': 'Quarterly DR drills',
        'geographic_distribution': 'Multi-region active-active setup'
    },
    'business_continuity': {
        'alternative_processing': 'Manual processing procedures',
        'communication_channels': 'Multiple channels for stakeholder updates',
        'vendor_dependencies': 'Backup providers for critical services',
        'staff_availability': '24/7 on-call rotation',
        'regulatory_notification': 'Notify regulators within 4 hours'
    }
}
```

## Cost and Resource Constraints

### Infrastructure Costs
- **Compute**: $500K/month for processing infrastructure
- **Storage**: $100K/month for transaction data storage
- **Network**: $200K/month for global connectivity
- **Security**: $300K/month for compliance and fraud prevention
- **Third-party Services**: $400K/month for card network fees and APIs

### Operational Costs
- **Compliance**: $2M/year for audits, certifications, legal
- **Staff**: $10M/year for engineering, operations, support
- **Insurance**: $1M/year for cyber liability and E&O coverage
- **Facilities**: $500K/year for secure data centers and offices

These constraints shape every architectural decision and require careful balance between performance, security, compliance, and cost considerations.
