package cloudsecops

# CIS AWS Foundations Benchmark v2 — Section 1 (IAM)

violation[v] {
	input.resource_type == "aws_iam_user"
	not input.config.mfa_enabled
	v := {
		"control_id": "CIS-1.2",
		"framework": "CIS v2",
		"severity": "HIGH",
		"title": "IAM user without MFA",
		"description": sprintf("User %s does not have multi-factor authentication enabled.", [input.config.username]),
		"remediation": "Enforce MFA for all IAM users, especially those with console access.",
	}
}

passed[control_id] {
	input.resource_type == "aws_iam_user"
	input.config.mfa_enabled
	control_id := "CIS-1.2"
}

violation[v] {
	input.resource_type == "aws_iam_user"
	input.config.access_key_age_days > 90
	v := {
		"control_id": "CIS-1.4",
		"framework": "CIS v2",
		"severity": "MEDIUM",
		"title": "IAM access key older than 90 days",
		"description": sprintf("User %s has an access key that is %d days old.", [input.config.username, input.config.access_key_age_days]),
		"remediation": "Rotate access keys at least every 90 days; prefer short-lived credentials via IAM roles where possible.",
	}
}

passed[control_id] {
	input.resource_type == "aws_iam_user"
	input.config.access_key_age_days <= 90
	control_id := "CIS-1.4"
}
