package cloudsecops

# CIS AWS Foundations Benchmark v2 — Section 2.1 (S3)

violation[v] {
	input.resource_type == "aws_s3_bucket"
	input.config.acl == "public-read"
	v := {
		"control_id": "CIS-2.1.2",
		"framework": "CIS v2",
		"severity": "CRITICAL",
		"title": "S3 bucket has public-read ACL",
		"description": sprintf("Bucket %s grants public-read access via its ACL.", [input.config.bucket_name]),
		"remediation": "Remove the public-read ACL and enable S3 Block Public Access at the bucket and account level.",
	}
}

passed[control_id] {
	input.resource_type == "aws_s3_bucket"
	input.config.acl != "public-read"
	control_id := "CIS-2.1.2"
}

violation[v] {
	input.resource_type == "aws_s3_bucket"
	not input.config.versioning_enabled
	v := {
		"control_id": "CIS-2.1.1",
		"framework": "CIS v2",
		"severity": "MEDIUM",
		"title": "S3 bucket versioning disabled",
		"description": sprintf("Bucket %s does not have versioning enabled, risking permanent data loss on overwrite/delete.", [input.config.bucket_name]),
		"remediation": "Enable versioning on the bucket to protect against accidental overwrite and deletion.",
	}
}

passed[control_id] {
	input.resource_type == "aws_s3_bucket"
	input.config.versioning_enabled
	control_id := "CIS-2.1.1"
}

violation[v] {
	input.resource_type == "aws_s3_bucket"
	not input.config.encryption_enabled
	v := {
		"control_id": "CIS-2.1.3",
		"framework": "CIS v2",
		"severity": "HIGH",
		"title": "S3 bucket encryption at rest disabled",
		"description": sprintf("Bucket %s does not have default encryption configured.", [input.config.bucket_name]),
		"remediation": "Enable SSE-S3 or SSE-KMS default encryption on the bucket.",
	}
}

passed[control_id] {
	input.resource_type == "aws_s3_bucket"
	input.config.encryption_enabled
	control_id := "CIS-2.1.3"
}
