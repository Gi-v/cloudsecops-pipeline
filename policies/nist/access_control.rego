package cloudsecops

# NIST CSF 2.0 — PR.AC (Identity Management & Access Control)

violation[v] {
	input.resource_type == "aws_iam_user"
	input.config.is_admin_policy_attached
	v := {
		"control_id": "NIST-PR.AC-4",
		"framework": "NIST CSF",
		"severity": "HIGH",
		"title": "IAM user has administrator policy attached",
		"description": sprintf("User %s has an admin-equivalent policy attached, violating least privilege.", [input.config.username]),
		"remediation": "Replace broad admin policies with scoped, task-specific IAM policies. Use permission boundaries for break-glass accounts.",
	}
}

passed[control_id] {
	input.resource_type == "aws_iam_user"
	not input.config.is_admin_policy_attached
	control_id := "NIST-PR.AC-4"
}

violation[v] {
	input.resource_type == "gcp_firewall_rule"
	input.config.source_ranges[_] == "0.0.0.0/0"
	port := input.config.allowed_ports[_]
	port == 22
	v := {
		"control_id": "NIST-PR.AC-3",
		"framework": "NIST CSF",
		"severity": "CRITICAL",
		"title": "GCP firewall allows SSH from anywhere",
		"description": sprintf("Firewall rule %s allows inbound SSH (22) from 0.0.0.0/0.", [input.config.rule_name]),
		"remediation": "Restrict the source range to a trusted CIDR, or require IAP TCP forwarding for SSH access.",
	}
}

passed[control_id] {
	input.resource_type == "gcp_firewall_rule"
	not gcp_open_ssh
	control_id := "NIST-PR.AC-3"
}

gcp_open_ssh {
	input.config.source_ranges[_] == "0.0.0.0/0"
	input.config.allowed_ports[_] == 22
}

violation[v] {
	input.resource_type == "gcp_compute_instance"
	input.config.public_ip_assigned
	not input.config.os_login_enabled
	v := {
		"control_id": "NIST-PR.AC-6",
		"framework": "NIST CSF",
		"severity": "MEDIUM",
		"title": "Public GCE instance without OS Login",
		"description": sprintf("Instance %s has a public IP but OS Login is disabled, weakening SSH key management.", [input.config.instance_name]),
		"remediation": "Enable OS Login (or IAP) for centralized, revocable SSH access control.",
	}
}

passed[control_id] {
	input.resource_type == "gcp_compute_instance"
	not gcp_public_no_oslogin
	control_id := "NIST-PR.AC-6"
}

gcp_public_no_oslogin {
	input.config.public_ip_assigned
	not input.config.os_login_enabled
}
