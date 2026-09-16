"""Pure-Python mirror of the Rego policies in policies/*.rego.

Used only when OPA is unreachable, so the API remains fully functional in a
zero-dependency local run (`uvicorn app.main:app` with no Docker). This is a
fallback, not the source of truth — the Rego files are canonical; keep this
in sync manually when adding a control (a CI check in
`infra/github-actions/ci.yml` diffs control_id sets between the two to catch
drift).
"""
from typing import Any

Violation = dict[str, Any]


def _v(control_id: str, framework: str, severity: str, title: str, description: str, remediation: str) -> Violation:
    return {
        "control_id": control_id,
        "framework": framework,
        "severity": severity,
        "title": title,
        "description": description,
        "remediation": remediation,
    }


def evaluate_local(resource: dict[str, Any]) -> dict[str, Any]:
    rtype = resource.get("resource_type")
    cfg = resource.get("config", {})
    violations: list[Violation] = []
    passed: list[str] = []

    if rtype == "aws_s3_bucket":
        name = cfg.get("bucket_name", "unknown")
        if cfg.get("acl") == "public-read":
            violations.append(_v("CIS-2.1.2", "CIS v2", "CRITICAL",
                "S3 bucket has public-read ACL",
                f"Bucket {name} grants public-read access via its ACL.",
                "Remove the public-read ACL and enable S3 Block Public Access."))
        else:
            passed.append("CIS-2.1.2")

        if not cfg.get("versioning_enabled"):
            violations.append(_v("CIS-2.1.1", "CIS v2", "MEDIUM",
                "S3 bucket versioning disabled",
                f"Bucket {name} does not have versioning enabled.",
                "Enable versioning to protect against accidental overwrite/deletion."))
        else:
            passed.append("CIS-2.1.1")

        if not cfg.get("encryption_enabled"):
            violations.append(_v("CIS-2.1.3", "CIS v2", "HIGH",
                "S3 bucket encryption at rest disabled",
                f"Bucket {name} does not have default encryption configured.",
                "Enable SSE-S3 or SSE-KMS default encryption on the bucket."))
        else:
            passed.append("CIS-2.1.3")

    elif rtype == "aws_iam_user":
        user = cfg.get("username", "unknown")
        if not cfg.get("mfa_enabled"):
            violations.append(_v("CIS-1.2", "CIS v2", "HIGH",
                "IAM user without MFA",
                f"User {user} does not have multi-factor authentication enabled.",
                "Enforce MFA for all IAM users."))
        else:
            passed.append("CIS-1.2")

        if cfg.get("access_key_age_days", 0) > 90:
            violations.append(_v("CIS-1.4", "CIS v2", "MEDIUM",
                "IAM access key older than 90 days",
                f"User {user} has an access key that is {cfg.get('access_key_age_days')} days old.",
                "Rotate access keys at least every 90 days."))
        else:
            passed.append("CIS-1.4")

        if cfg.get("is_admin_policy_attached"):
            violations.append(_v("NIST-PR.AC-4", "NIST CSF", "HIGH",
                "IAM user has administrator policy attached",
                f"User {user} has an admin-equivalent policy attached, violating least privilege.",
                "Replace broad admin policies with scoped, task-specific IAM policies."))
        else:
            passed.append("NIST-PR.AC-4")

    elif rtype == "aws_security_group":
        gid, gname = cfg.get("group_id", "unknown"), cfg.get("group_name", "unknown")
        ingress = cfg.get("ingress_rules", [])
        open_ssh = any(r.get("from_port", 999) <= 22 <= r.get("to_port", 0) and r.get("cidr") == "0.0.0.0/0" for r in ingress)
        open_rdp = any(r.get("from_port", 9999) <= 3389 <= r.get("to_port", 0) and r.get("cidr") == "0.0.0.0/0" for r in ingress)

        if open_ssh:
            violations.append(_v("CIS-5.2", "CIS v2", "CRITICAL",
                "Security group allows SSH from 0.0.0.0/0",
                f"Security group {gname} ({gid}) permits inbound SSH from any IP address.",
                "Restrict SSH ingress to known, trusted CIDR ranges."))
        else:
            passed.append("CIS-5.2")

        if open_rdp:
            violations.append(_v("CIS-5.3", "CIS v2", "CRITICAL",
                "Security group allows RDP from 0.0.0.0/0",
                f"Security group {gname} ({gid}) permits inbound RDP from any IP address.",
                "Restrict RDP ingress to known, trusted CIDR ranges."))
        else:
            passed.append("CIS-5.3")

    elif rtype == "aws_ebs_volume":
        if not cfg.get("encrypted"):
            violations.append(_v("NIST-PR.DS-1", "NIST CSF", "HIGH",
                "EBS volume not encrypted at rest",
                f"Volume {cfg.get('volume_id')} ({cfg.get('size_gb')}GB) is unencrypted.",
                "Enable EBS encryption by default at the account level."))
        else:
            passed.append("NIST-PR.DS-1")

    elif rtype == "aws_cloudtrail":
        name = cfg.get("trail_name", "unknown")
        if not cfg.get("is_multi_region"):
            violations.append(_v("CIS-2.9", "CIS v2", "HIGH",
                "CloudTrail is not multi-region",
                f"Trail {name} is single-region, missing events from other regions.",
                "Enable multi-region logging on the CloudTrail trail."))
        else:
            passed.append("CIS-2.9")

        if not cfg.get("logging_enabled"):
            violations.append(_v("NIST-DE.CM-1", "NIST CSF", "HIGH",
                "CloudTrail logging disabled",
                f"Trail {name} exists but logging is turned off.",
                "Re-enable CloudTrail logging immediately."))
        else:
            passed.append("NIST-DE.CM-1")

        if not cfg.get("log_file_validation_enabled"):
            violations.append(_v("NIST-DE.CM-9", "NIST CSF", "MEDIUM",
                "CloudTrail log file validation disabled",
                f"Trail {name} does not have log file integrity validation enabled.",
                "Enable log file validation."))
        else:
            passed.append("NIST-DE.CM-9")

    elif rtype == "gcp_storage_bucket":
        if cfg.get("public_iam"):
            violations.append(_v("NIST-PR.DS-2", "NIST CSF", "CRITICAL",
                "GCS bucket has public IAM binding",
                f"Bucket {cfg.get('bucket_name')} grants allUsers/allAuthenticatedUsers IAM access.",
                "Remove public IAM bindings and enable uniform bucket-level access."))
        else:
            passed.append("NIST-PR.DS-2")

    elif rtype == "gcp_firewall_rule":
        open_ssh = "0.0.0.0/0" in cfg.get("source_ranges", []) and 22 in cfg.get("allowed_ports", [])
        if open_ssh:
            violations.append(_v("NIST-PR.AC-3", "NIST CSF", "CRITICAL",
                "GCP firewall allows SSH from anywhere",
                f"Firewall rule {cfg.get('rule_name')} allows inbound SSH (22) from 0.0.0.0/0.",
                "Restrict the source range or require IAP TCP forwarding."))
        else:
            passed.append("NIST-PR.AC-3")

    elif rtype == "gcp_compute_instance":
        name = cfg.get("instance_name", "unknown")
        if cfg.get("public_ip_assigned") and not cfg.get("os_login_enabled"):
            violations.append(_v("NIST-PR.AC-6", "NIST CSF", "MEDIUM",
                "Public GCE instance without OS Login",
                f"Instance {name} has a public IP but OS Login is disabled.",
                "Enable OS Login (or IAP) for centralized SSH access control."))
        else:
            passed.append("NIST-PR.AC-6")

        if not cfg.get("shielded_vm_enabled"):
            violations.append(_v("ISO-A.9.2.1", "ISO 27001", "LOW",
                "GCE instance without Shielded VM",
                f"Instance {name} does not have Shielded VM enabled.",
                "Enable Shielded VM options (secure boot / vTPM)."))
        else:
            passed.append("ISO-A.9.2.1")

    elif rtype == "azure_storage_account":
        name = cfg.get("account_name", "unknown")
        if cfg.get("public_blob_access_enabled"):
            violations.append(_v("ISO-A.9.2.3", "ISO 27001", "CRITICAL",
                "Azure storage account allows public blob access",
                f"Storage account {name} permits anonymous public read access to blobs.",
                "Disable public blob access; use SAS tokens or private endpoints."))
        else:
            passed.append("ISO-A.9.2.3")

        if cfg.get("min_tls_version") != "TLS1_2":
            violations.append(_v("ISO-A.9.4.1", "ISO 27001", "MEDIUM",
                "Azure storage account allows outdated TLS",
                f"Storage account {name} has minimum TLS version set to {cfg.get('min_tls_version')}.",
                "Set the minimum TLS version to TLS1_2 or higher."))
        else:
            passed.append("ISO-A.9.4.1")

    elif rtype == "azure_vm":
        if not cfg.get("disk_encryption_enabled"):
            violations.append(_v("ISO-A.10.1.1", "ISO 27001", "HIGH",
                "Azure VM disk encryption disabled",
                f"VM {cfg.get('vm_name')} does not have Azure Disk Encryption enabled.",
                "Enable Azure Disk Encryption for all VM disks."))
        else:
            passed.append("ISO-A.10.1.1")

    elif rtype == "azure_nsg_rule":
        is_open = (
            cfg.get("source_address_prefix") == "*"
            and cfg.get("access") == "Allow"
            and cfg.get("direction") == "Inbound"
        )
        if is_open:
            violations.append(_v("ISO-A.13.1.1", "ISO 27001", "CRITICAL",
                "Azure NSG rule allows unrestricted inbound access",
                f"NSG rule {cfg.get('rule_name')} allows inbound traffic on port {cfg.get('destination_port_range')} from any source.",
                "Scope the source address prefix to known ranges."))
        else:
            passed.append("ISO-A.13.1.1")

    return {"violations": violations, "passed_controls": passed}
