"""Static metadata describing every control the engine can evaluate — used
by GET /api/policies to list available controls without needing to parse
Rego source at runtime.
"""

def _c(control_id: str, framework: str, resource_type: str, title: str) -> dict[str, str]:
    return {
        "control_id": control_id,
        "framework": framework,
        "resource_type": resource_type,
        "title": title,
    }


CONTROL_CATALOG: list[dict[str, str]] = [
    _c("CIS-2.1.2", "CIS v2", "aws_s3_bucket", "S3 bucket public-read ACL"),
    _c("CIS-2.1.1", "CIS v2", "aws_s3_bucket", "S3 bucket versioning disabled"),
    _c("CIS-2.1.3", "CIS v2", "aws_s3_bucket", "S3 bucket encryption disabled"),
    _c("CIS-1.2", "CIS v2", "aws_iam_user", "IAM user without MFA"),
    _c("CIS-1.4", "CIS v2", "aws_iam_user", "IAM access key age > 90 days"),
    _c("CIS-5.2", "CIS v2", "aws_security_group", "SSH open to 0.0.0.0/0"),
    _c("CIS-5.3", "CIS v2", "aws_security_group", "RDP open to 0.0.0.0/0"),
    _c("CIS-2.9", "CIS v2", "aws_cloudtrail", "CloudTrail not multi-region"),
    _c("NIST-PR.DS-1", "NIST CSF", "aws_ebs_volume", "EBS volume not encrypted"),
    _c("NIST-PR.AC-4", "NIST CSF", "aws_iam_user", "IAM user has admin policy attached"),
    _c("NIST-PR.DS-2", "NIST CSF", "gcp_storage_bucket", "GCS bucket has public IAM binding"),
    _c("NIST-PR.AC-3", "NIST CSF", "gcp_firewall_rule", "GCP firewall allows SSH from anywhere"),
    _c("NIST-PR.AC-6", "NIST CSF", "gcp_compute_instance", "Public GCE instance without OS Login"),
    _c("NIST-DE.CM-1", "NIST CSF", "aws_cloudtrail", "CloudTrail logging disabled"),
    _c("NIST-DE.CM-9", "NIST CSF", "aws_cloudtrail", "CloudTrail log file validation disabled"),
    _c(
        "ISO-A.9.2.3",
        "ISO 27001",
        "azure_storage_account",
        "Storage account allows public blob access",
    ),
    _c("ISO-A.9.4.1", "ISO 27001", "azure_storage_account", "Storage account allows outdated TLS"),
    _c("ISO-A.10.1.1", "ISO 27001", "azure_vm", "VM disk encryption disabled"),
    _c(
        "ISO-A.13.1.1", "ISO 27001", "azure_nsg_rule", "NSG rule allows unrestricted inbound access"
    ),
    _c("ISO-A.9.2.1", "ISO 27001", "gcp_compute_instance", "GCE instance without Shielded VM"),
]

# control_id -> catalog entry, used by the evaluator to look up a passing
# control's framework/title (OPA's `passed[control_id]` rule only returns
# the bare ID, not the framework metadata the violation branch carries).
CONTROL_BY_ID: dict[str, dict[str, str]] = {c["control_id"]: c for c in CONTROL_CATALOG}

SAMPLE_RESOURCES: dict[str, dict] = {
    "aws_s3_bucket": {
        "resource_type": "aws_s3_bucket",
        "config": {
            "bucket_name": "example-bucket",
            "acl": "public-read",
            "versioning_enabled": False,
            "encryption_enabled": False,
        },
    },
    "aws_security_group": {
        "resource_type": "aws_security_group",
        "config": {
            "group_id": "sg-example",
            "group_name": "web-sg",
            "ingress_rules": [
                {"from_port": 22, "to_port": 22, "cidr": "0.0.0.0/0", "protocol": "tcp"}
            ],
        },
    },
    "aws_iam_user": {
        "resource_type": "aws_iam_user",
        "config": {
            "username": "example-user",
            "mfa_enabled": False,
            "access_key_age_days": 120,
            "is_admin_policy_attached": True,
        },
    },
    "azure_storage_account": {
        "resource_type": "azure_storage_account",
        "config": {
            "account_name": "examplesa",
            "public_blob_access_enabled": True,
            "https_only": True,
            "min_tls_version": "TLS1_0",
        },
    },
}
