package cloudsecops

# ISO/IEC 27001 Annex A — A.13 (Communications Security)

violation[v] {
	input.resource_type == "azure_nsg_rule"
	input.config.source_address_prefix == "*"
	input.config.access == "Allow"
	input.config.direction == "Inbound"
	v := {
		"control_id": "ISO-A.13.1.1",
		"framework": "ISO 27001",
		"severity": "CRITICAL",
		"title": "Azure NSG rule allows unrestricted inbound access",
		"description": sprintf("NSG rule %s allows inbound traffic on port %s from any source.", [input.config.rule_name, input.config.destination_port_range]),
		"remediation": "Scope the source address prefix to known ranges; avoid wildcard (*) inbound Allow rules.",
	}
}

passed[control_id] {
	input.resource_type == "azure_nsg_rule"
	not azure_nsg_open
	control_id := "ISO-A.13.1.1"
}

azure_nsg_open {
	input.config.source_address_prefix == "*"
	input.config.access == "Allow"
	input.config.direction == "Inbound"
}

violation[v] {
	input.resource_type == "gcp_compute_instance"
	not input.config.shielded_vm_enabled
	v := {
		"control_id": "ISO-A.9.2.1",
		"framework": "ISO 27001",
		"severity": "LOW",
		"title": "GCE instance without Shielded VM",
		"description": sprintf("Instance %s does not have Shielded VM (secure boot / vTPM) enabled.", [input.config.instance_name]),
		"remediation": "Enable Shielded VM options to protect against boot-level rootkits and bootkits.",
	}
}

passed[control_id] {
	input.resource_type == "gcp_compute_instance"
	input.config.shielded_vm_enabled
	control_id := "ISO-A.9.2.1"
}
