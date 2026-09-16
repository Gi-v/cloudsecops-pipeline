package cloudsecops

# NIST CSF 2.0 — PR.DS (Data Security)

violation[v] {
	input.resource_type == "aws_ebs_volume"
	not input.config.encrypted
	v := {
		"control_id": "NIST-PR.DS-1",
		"framework": "NIST CSF",
		"severity": "HIGH",
		"title": "EBS volume not encrypted at rest",
		"description": sprintf("Volume %s (%dGB) is unencrypted.", [input.config.volume_id, input.config.size_gb]),
		"remediation": "Enable EBS encryption by default at the account level, and re-create existing unencrypted volumes from an encrypted snapshot.",
	}
}

passed[control_id] {
	input.resource_type == "aws_ebs_volume"
	input.config.encrypted
	control_id := "NIST-PR.DS-1"
}

violation[v] {
	input.resource_type == "gcp_storage_bucket"
	input.config.public_iam
	v := {
		"control_id": "NIST-PR.DS-2",
		"framework": "NIST CSF",
		"severity": "CRITICAL",
		"title": "GCS bucket has public IAM binding",
		"description": sprintf("Bucket %s grants allUsers or allAuthenticatedUsers IAM access.", [input.config.bucket_name]),
		"remediation": "Remove public IAM bindings and enable uniform bucket-level access with least-privilege roles.",
	}
}

passed[control_id] {
	input.resource_type == "gcp_storage_bucket"
	not input.config.public_iam
	control_id := "NIST-PR.DS-2"
}
