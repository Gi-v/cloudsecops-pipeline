"""Unit tests for the pure-Python policy fallback (mirrors the Rego rules).
These run with zero external dependencies — no Docker, no OPA, no DB.
"""
from app.policy_engine.local_fallback import evaluate_local


def test_public_s3_bucket_flagged_critical():
    result = evaluate_local({
        "resource_type": "aws_s3_bucket",
        "config": {"bucket_name": "test", "acl": "public-read", "versioning_enabled": True, "encryption_enabled": True},
    })
    control_ids = [v["control_id"] for v in result["violations"]]
    assert "CIS-2.1.2" in control_ids
    violation = next(v for v in result["violations"] if v["control_id"] == "CIS-2.1.2")
    assert violation["severity"] == "CRITICAL"


def test_private_encrypted_versioned_bucket_passes_all_three():
    result = evaluate_local({
        "resource_type": "aws_s3_bucket",
        "config": {"bucket_name": "test", "acl": "private", "versioning_enabled": True, "encryption_enabled": True},
    })
    assert result["violations"] == []
    assert set(result["passed_controls"]) == {"CIS-2.1.1", "CIS-2.1.2", "CIS-2.1.3"}


def test_ssh_open_to_world_flagged():
    result = evaluate_local({
        "resource_type": "aws_security_group",
        "config": {
            "group_id": "sg-1", "group_name": "test-sg",
            "ingress_rules": [{"from_port": 22, "to_port": 22, "cidr": "0.0.0.0/0", "protocol": "tcp"}],
        },
    })
    control_ids = [v["control_id"] for v in result["violations"]]
    assert "CIS-5.2" in control_ids
    assert "CIS-5.3" not in control_ids  # RDP rule wasn't present, shouldn't fire


def test_ssh_restricted_passes():
    result = evaluate_local({
        "resource_type": "aws_security_group",
        "config": {
            "group_id": "sg-1", "group_name": "test-sg",
            "ingress_rules": [{"from_port": 443, "to_port": 443, "cidr": "10.0.0.0/16", "protocol": "tcp"}],
        },
    })
    assert result["violations"] == []
    assert "CIS-5.2" in result["passed_controls"]
    assert "CIS-5.3" in result["passed_controls"]


def test_iam_user_no_mfa_and_admin_flags_two_controls_two_frameworks():
    result = evaluate_local({
        "resource_type": "aws_iam_user",
        "config": {"username": "root-like", "mfa_enabled": False, "access_key_age_days": 10, "is_admin_policy_attached": True},
    })
    frameworks = {v["framework"] for v in result["violations"]}
    assert "CIS v2" in frameworks
    assert "NIST CSF" in frameworks


def test_azure_public_blob_and_old_tls_both_flagged():
    result = evaluate_local({
        "resource_type": "azure_storage_account",
        "config": {"account_name": "sa1", "public_blob_access_enabled": True, "min_tls_version": "TLS1_0"},
    })
    control_ids = {v["control_id"] for v in result["violations"]}
    assert control_ids == {"ISO-A.9.2.3", "ISO-A.9.4.1"}


def test_unknown_resource_type_returns_empty():
    result = evaluate_local({"resource_type": "unknown_type", "config": {}})
    assert result == {"violations": [], "passed_controls": []}


def test_rdp_open_to_world_flagged():
    result = evaluate_local({
        "resource_type": "aws_security_group",
        "config": {
            "group_id": "sg-1", "group_name": "test-sg",
            "ingress_rules": [{"from_port": 3389, "to_port": 3389, "cidr": "0.0.0.0/0", "protocol": "tcp"}],
        },
    })
    control_ids = [v["control_id"] for v in result["violations"]]
    assert "CIS-5.3" in control_ids
    assert "CIS-5.2" not in control_ids  # SSH rule wasn't present, shouldn't fire


def test_iam_user_mfa_enabled_and_admin_not_attached_pass():
    result = evaluate_local({
        "resource_type": "aws_iam_user",
        "config": {"username": "svc", "mfa_enabled": True, "access_key_age_days": 5, "is_admin_policy_attached": False},
    })
    assert result["violations"] == []
    assert set(result["passed_controls"]) == {"CIS-1.2", "CIS-1.4", "NIST-PR.AC-4"}


def test_azure_private_blob_and_current_tls_pass():
    result = evaluate_local({
        "resource_type": "azure_storage_account",
        "config": {"account_name": "sa1", "public_blob_access_enabled": False, "min_tls_version": "TLS1_2"},
    })
    assert result["violations"] == []
    assert set(result["passed_controls"]) == {"ISO-A.9.2.3", "ISO-A.9.4.1"}


def test_unencrypted_ebs_volume_flagged():
    result = evaluate_local({
        "resource_type": "aws_ebs_volume",
        "config": {"volume_id": "vol-1", "size_gb": 100, "encrypted": False},
    })
    assert [v["control_id"] for v in result["violations"]] == ["NIST-PR.DS-1"]


def test_encrypted_ebs_volume_passes():
    result = evaluate_local({
        "resource_type": "aws_ebs_volume",
        "config": {"volume_id": "vol-1", "size_gb": 100, "encrypted": True},
    })
    assert result["violations"] == []
    assert result["passed_controls"] == ["NIST-PR.DS-1"]


def test_cloudtrail_single_region_no_logging_no_validation_flags_all_three():
    result = evaluate_local({
        "resource_type": "aws_cloudtrail",
        "config": {
            "trail_name": "trail-1", "is_multi_region": False,
            "logging_enabled": False, "log_file_validation_enabled": False,
        },
    })
    control_ids = {v["control_id"] for v in result["violations"]}
    assert control_ids == {"CIS-2.9", "NIST-DE.CM-1", "NIST-DE.CM-9"}


def test_cloudtrail_fully_configured_passes():
    result = evaluate_local({
        "resource_type": "aws_cloudtrail",
        "config": {
            "trail_name": "trail-1", "is_multi_region": True,
            "logging_enabled": True, "log_file_validation_enabled": True,
        },
    })
    assert result["violations"] == []
    assert set(result["passed_controls"]) == {"CIS-2.9", "NIST-DE.CM-1", "NIST-DE.CM-9"}


def test_gcs_bucket_public_iam_flagged_critical():
    result = evaluate_local({
        "resource_type": "gcp_storage_bucket",
        "config": {"bucket_name": "public-bucket", "public_iam": True},
    })
    assert result["violations"][0]["control_id"] == "NIST-PR.DS-2"
    assert result["violations"][0]["severity"] == "CRITICAL"


def test_gcs_bucket_private_passes():
    result = evaluate_local({
        "resource_type": "gcp_storage_bucket",
        "config": {"bucket_name": "private-bucket", "public_iam": False},
    })
    assert result["violations"] == []
    assert result["passed_controls"] == ["NIST-PR.DS-2"]


def test_gcp_firewall_ssh_from_anywhere_flagged():
    result = evaluate_local({
        "resource_type": "gcp_firewall_rule",
        "config": {
            "rule_name": "allow-ssh", "source_ranges": ["0.0.0.0/0"], "allowed_ports": [22, 80],
        },
    })
    assert result["violations"][0]["control_id"] == "NIST-PR.AC-3"


def test_gcp_firewall_restricted_passes():
    result = evaluate_local({
        "resource_type": "gcp_firewall_rule",
        "config": {
            "rule_name": "allow-internal", "source_ranges": ["10.0.0.0/8"], "allowed_ports": [22],
        },
    })
    assert result["violations"] == []
    assert result["passed_controls"] == ["NIST-PR.AC-3"]


def test_gce_public_ip_without_os_login_and_no_shielded_vm_both_flagged():
    result = evaluate_local({
        "resource_type": "gcp_compute_instance",
        "config": {
            "instance_name": "web-1", "public_ip_assigned": True,
            "os_login_enabled": False, "shielded_vm_enabled": False,
        },
    })
    control_ids = {v["control_id"] for v in result["violations"]}
    assert control_ids == {"NIST-PR.AC-6", "ISO-A.9.2.1"}


def test_gce_private_with_shielded_vm_passes():
    result = evaluate_local({
        "resource_type": "gcp_compute_instance",
        "config": {
            "instance_name": "internal-1", "public_ip_assigned": False,
            "os_login_enabled": False, "shielded_vm_enabled": True,
        },
    })
    assert result["violations"] == []
    assert set(result["passed_controls"]) == {"NIST-PR.AC-6", "ISO-A.9.2.1"}


def test_azure_vm_disk_not_encrypted_flagged():
    result = evaluate_local({
        "resource_type": "azure_vm",
        "config": {"vm_name": "vm-1", "disk_encryption_enabled": False},
    })
    assert result["violations"][0]["control_id"] == "ISO-A.10.1.1"


def test_azure_vm_disk_encrypted_passes():
    result = evaluate_local({
        "resource_type": "azure_vm",
        "config": {"vm_name": "vm-1", "disk_encryption_enabled": True},
    })
    assert result["violations"] == []
    assert result["passed_controls"] == ["ISO-A.10.1.1"]


def test_azure_nsg_rule_unrestricted_inbound_flagged():
    result = evaluate_local({
        "resource_type": "azure_nsg_rule",
        "config": {
            "rule_name": "allow-all", "source_address_prefix": "*",
            "access": "Allow", "direction": "Inbound", "destination_port_range": "*",
        },
    })
    assert result["violations"][0]["control_id"] == "ISO-A.13.1.1"


def test_azure_nsg_rule_scoped_source_passes():
    result = evaluate_local({
        "resource_type": "azure_nsg_rule",
        "config": {
            "rule_name": "allow-vnet", "source_address_prefix": "10.0.0.0/16",
            "access": "Allow", "direction": "Inbound", "destination_port_range": "443",
        },
    })
    assert result["violations"] == []
    assert result["passed_controls"] == ["ISO-A.13.1.1"]
