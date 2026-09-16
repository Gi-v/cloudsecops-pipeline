package cloudsecops

# CIS AWS Foundations Benchmark v2 — Section 5 (Networking)

violation[v] {
	input.resource_type == "aws_security_group"
	rule := input.config.ingress_rules[_]
	rule.from_port <= 22
	rule.to_port >= 22
	rule.cidr == "0.0.0.0/0"
	v := {
		"control_id": "CIS-5.2",
		"framework": "CIS v2",
		"severity": "CRITICAL",
		"title": "Security group allows SSH from 0.0.0.0/0",
		"description": sprintf("Security group %s (%s) permits inbound SSH from any IP address.", [input.config.group_name, input.config.group_id]),
		"remediation": "Restrict SSH ingress to known, trusted CIDR ranges or require access via a bastion/SSM Session Manager.",
	}
}

violation[v] {
	input.resource_type == "aws_security_group"
	rule := input.config.ingress_rules[_]
	rule.from_port <= 3389
	rule.to_port >= 3389
	rule.cidr == "0.0.0.0/0"
	v := {
		"control_id": "CIS-5.3",
		"framework": "CIS v2",
		"severity": "CRITICAL",
		"title": "Security group allows RDP from 0.0.0.0/0",
		"description": sprintf("Security group %s (%s) permits inbound RDP from any IP address.", [input.config.group_name, input.config.group_id]),
		"remediation": "Restrict RDP ingress to known, trusted CIDR ranges or a bastion host.",
	}
}

passed[control_id] {
	input.resource_type == "aws_security_group"
	not open_ssh
	control_id := "CIS-5.2"
}

passed[control_id] {
	input.resource_type == "aws_security_group"
	not open_rdp
	control_id := "CIS-5.3"
}

open_ssh {
	rule := input.config.ingress_rules[_]
	rule.from_port <= 22
	rule.to_port >= 22
	rule.cidr == "0.0.0.0/0"
}

open_rdp {
	rule := input.config.ingress_rules[_]
	rule.from_port <= 3389
	rule.to_port >= 3389
	rule.cidr == "0.0.0.0/0"
}

violation[v] {
	input.resource_type == "aws_cloudtrail"
	not input.config.is_multi_region
	v := {
		"control_id": "CIS-2.9",
		"framework": "CIS v2",
		"severity": "HIGH",
		"title": "CloudTrail is not multi-region",
		"description": sprintf("Trail %s is single-region, missing events from other regions.", [input.config.trail_name]),
		"remediation": "Enable multi-region logging on the CloudTrail trail.",
	}
}

passed[control_id] {
	input.resource_type == "aws_cloudtrail"
	input.config.is_multi_region
	control_id := "CIS-2.9"
}
