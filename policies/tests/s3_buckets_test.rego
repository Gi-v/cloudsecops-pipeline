package cloudsecops

test_public_s3_bucket_is_flagged {
	violation[v] with input as {
		"resource_type": "aws_s3_bucket",
		"config": {"bucket_name": "test-bucket", "acl": "public-read"},
	}
	v.control_id == "CIS-2.1.2"
}

test_private_s3_bucket_passes {
	passed["CIS-2.1.2"] with input as {
		"resource_type": "aws_s3_bucket",
		"config": {"bucket_name": "test-bucket", "acl": "private"},
	}
}

test_unversioned_bucket_is_flagged {
	violation[v] with input as {
		"resource_type": "aws_s3_bucket",
		"config": {"bucket_name": "test-bucket", "acl": "private", "versioning_enabled": false},
	}
	v.control_id == "CIS-2.1.1"
}

test_unencrypted_bucket_is_flagged {
	violation[v] with input as {
		"resource_type": "aws_s3_bucket",
		"config": {"bucket_name": "test-bucket", "acl": "private", "encryption_enabled": false},
	}
	v.control_id == "CIS-2.1.3"
}
