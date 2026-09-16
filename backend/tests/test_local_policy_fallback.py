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
