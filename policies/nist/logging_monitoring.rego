package cloudsecops

# NIST CSF 2.0 — DE.CM (Continuous Monitoring)
# Deliberately maps the same CloudTrail resource evaluated by CIS-2.9 to a
# distinct NIST control — this overlap is what ADR-002 refers to when it says
# frameworks address the same underlying control with different vocabularies.

violation[v] {
	input.resource_type == "aws_cloudtrail"
	not input.config.logging_enabled
	v := {
		"control_id": "NIST-DE.CM-1",
		"framework": "NIST CSF",
		"severity": "HIGH",
		"title": "CloudTrail logging disabled",
		"description": sprintf("Trail %s exists but logging is turned off.", [input.config.trail_name]),
		"remediation": "Re-enable CloudTrail logging immediately; investigate why it was disabled.",
	}
}

passed[control_id] {
	input.resource_type == "aws_cloudtrail"
	input.config.logging_enabled
	control_id := "NIST-DE.CM-1"
}

violation[v] {
	input.resource_type == "aws_cloudtrail"
	not input.config.log_file_validation_enabled
	v := {
		"control_id": "NIST-DE.CM-9",
		"framework": "NIST CSF",
		"severity": "MEDIUM",
		"title": "CloudTrail log file validation disabled",
		"description": sprintf("Trail %s does not have log file integrity validation enabled.", [input.config.trail_name]),
		"remediation": "Enable log file validation so tampering with delivered log files is detectable.",
	}
}

passed[control_id] {
	input.resource_type == "aws_cloudtrail"
	input.config.log_file_validation_enabled
	control_id := "NIST-DE.CM-9"
}
