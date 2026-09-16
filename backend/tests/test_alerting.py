"""Unit tests for the critical-alert extraction logic (pure function, no
Kafka/HTTP needed)."""
from app.alerting.notifier import extract_critical_alerts


def test_extracts_one_alert_per_critical_violation():
    enriched = {
        "resource_urn": "arn:aws:s3:::prod-bucket",
        "provider": "AWS",
        "correlation_id": "abc123",
        "violations": [
            {
                "control_id": "CIS-2.1.2",
                "framework": "CIS v2",
                "severity": "CRITICAL",
                "title": "S3 bucket has public-read ACL",
                "description": "desc",
                "remediation": "fix it",
            },
            {
                "control_id": "CIS-1.4",
                "framework": "CIS v2",
                "severity": "MEDIUM",
                "title": "Old access key",
                "description": "desc",
                "remediation": "rotate it",
            },
        ],
        "passed_controls": [],
    }
    alerts = extract_critical_alerts(enriched)
    assert len(alerts) == 1
    assert alerts[0]["control_id"] == "CIS-2.1.2"
    assert alerts[0]["resource_urn"] == "arn:aws:s3:::prod-bucket"
    assert alerts[0]["correlation_id"] == "abc123"


def test_no_critical_violations_returns_empty_list():
    enriched = {
        "resource_urn": "arn:aws:s3:::prod-bucket",
        "provider": "AWS",
        "violations": [
            {
                "control_id": "CIS-1.4",
                "framework": "CIS v2",
                "severity": "MEDIUM",
                "title": "x",
                "description": "x",
                "remediation": "x",
            }
        ],
    }
    assert extract_critical_alerts(enriched) == []


def test_multiple_critical_violations_produce_multiple_alerts():
    enriched = {
        "resource_urn": "sg-test",
        "provider": "AWS",
        "violations": [
            {"control_id": "CIS-5.2", "framework": "CIS v2", "severity": "CRITICAL", "title": "a", "description": "a", "remediation": "a"},
            {"control_id": "CIS-5.3", "framework": "CIS v2", "severity": "CRITICAL", "title": "b", "description": "b", "remediation": "b"},
        ],
    }
    alerts = extract_critical_alerts(enriched)
    assert len(alerts) == 2
    assert {a["control_id"] for a in alerts} == {"CIS-5.2", "CIS-5.3"}


def test_no_violations_key_returns_empty_list():
    assert extract_critical_alerts({"resource_urn": "x", "provider": "AWS"}) == []
