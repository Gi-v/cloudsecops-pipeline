"""Static metadata describing every control the engine can evaluate — used
by GET /api/policies to list available controls without needing to parse
Rego source at runtime.
"""

CONTROL_CATALOG: list[dict[str, str]] = [
    {"control_id": "CIS-2.1.2", "framework": "CIS v2", "resource_type": "aws_s3_bucket", "title": "S3 bucket public-read ACL"},
    {"control_id": "CIS-2.1.1", "framework": "CIS v2", "resource_type": "aws_s3_bucket", "title": "S3 bucket versioning disabled"},
    {"control_id": "CIS-2.1.3", "framework": "CIS v2", "resource_type": "aws_s3_bucket", "title": "S3 bucket encryption disabled"},
    {"control_id": "CIS-1.2", "framework": "CIS v2", "resource_type": "aws_iam_user", "title": "IAM user without MFA"},
    {"control_id": "CIS-1.4", "framework": "CIS v2", "resource_type": "aws_iam_user", "title": "IAM access key age > 90 days"},
    {"control_id": "CIS-5.2", "framework": "CIS v2", "resource_type": "aws_security_group", "title": "SSH open to 0.0.0.0/0"},
    {"control_id": "CIS-5.3", "framework": "CIS v2", "resource_type": "aws_security_group", "title": "RDP open to 0.0.0.0/0"},
    {"control_id": "CIS-2.9", "framework": "CIS v2", "resource_type": "aws_cloudtrail", "title": "CloudTrail not multi-region"},
    {"control_id": "NIST-PR.DS-1", "framework": "NIST CSF", "resource_type": "aws_ebs_volume", "title": "EBS volume not encrypted"},
    {"control_id": "NIST-PR.AC-4", "framework": "NIST CSF", "resource_type": "aws_iam_user", "title": "IAM user has admin policy attached"},
    {"control_id": "NIST-PR.DS-2", "framework": "NIST CSF", "resource_type": "gcp_storage_bucket", "title": "GCS bucket has public IAM binding"},
    {"control_id": "NIST-PR.AC-3", "framework": "NIST CSF", "resource_type": "gcp_firewall_rule", "title": "GCP firewall allows SSH from anywhere"},
    {"control_id": "NIST-PR.AC-6", "framework": "NIST CSF", "resource_type": "gcp_compute_instance", "title": "Public GCE instance without OS Login"},
    {"control_id": "NIST-DE.CM-1", "framework": "NIST CSF", "resource_type": "aws_cloudtrail", "title": "CloudTrail logging disabled"},
    {"control_id": "NIST-DE.CM-9", "framework": "NIST CSF", "resource_type": "aws_cloudtrail", "title": "CloudTrail log file validation disabled"},
    {"control_id": "ISO-A.9.2.3", "framework": "ISO 27001", "resource_type": "azure_storage_account", "title": "Storage account allows public blob access"},
    {"control_id": "ISO-A.9.4.1", "framework": "ISO 27001", "resource_type": "azure_storage_account", "title": "Storage account allows outdated TLS"},
    {"control_id": "ISO-A.10.1.1", "framework": "ISO 27001", "resource_type": "azure_vm", "title": "VM disk encryption disabled"},
    {"control_id": "ISO-A.13.1.1", "framework": "ISO 27001", "resource_type": "azure_nsg_rule", "title": "NSG rule allows unrestricted inbound access"},
    {"control_id": "ISO-A.9.2.1", "framework": "ISO 27001", "resource_type": "gcp_compute_instance", "title": "GCE instance without Shielded VM"},
]

# control_id -> catalog entry, used by the evaluator to look up a passing
# control's framework/title (OPA's `passed[control_id]` rule only returns
# the bare ID, not the framework metadata the violation branch carries).
CONTROL_BY_ID: dict[str, dict[str, str]] = {c["control_id"]: c for c in CONTROL_CATALOG}

SAMPLE_RESOURCES: dict[str, dict] = {
    "aws_s3_bucket": {
        "resource_type": "aws_s3_bucket",
        "config": {"bucket_name": "example-bucket", "acl": "public-read", "versioning_enabled": False, "encryption_enabled": False},
    },
    "aws_security_group": {
        "resource_type": "aws_security_group",
        "config": {
            "group_id": "sg-example",
            "group_name": "web-sg",
            "ingress_rules": [{"from_port": 22, "to_port": 22, "cidr": "0.0.0.0/0", "protocol": "tcp"}],
        },
    },
    "aws_iam_user": {
        "resource_type": "aws_iam_user",
        "config": {"username": "example-user", "mfa_enabled": False, "access_key_age_days": 120, "is_admin_policy_attached": True},
    },
    "azure_storage_account": {
        "resource_type": "azure_storage_account",
        "config": {"account_name": "examplesa", "public_blob_access_enabled": True, "https_only": True, "min_tls_version": "TLS1_0"},
    },
}
