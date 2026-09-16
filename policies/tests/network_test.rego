package cloudsecops

test_ssh_open_to_world_is_flagged {
	violation[v] with input as {
		"resource_type": "aws_security_group",
		"config": {
			"group_id": "sg-test",
			"group_name": "test-sg",
			"ingress_rules": [{"from_port": 22, "to_port": 22, "cidr": "0.0.0.0/0", "protocol": "tcp"}],
		},
	}
	v.control_id == "CIS-5.2"
	v.severity == "CRITICAL"
}

test_ssh_restricted_to_vpc_passes {
	passed["CIS-5.2"] with input as {
		"resource_type": "aws_security_group",
		"config": {
			"group_id": "sg-test",
			"group_name": "test-sg",
			"ingress_rules": [{"from_port": 443, "to_port": 443, "cidr": "10.0.0.0/16", "protocol": "tcp"}],
		},
	}
}

test_azure_nsg_wildcard_inbound_is_flagged {
	violation[v] with input as {
		"resource_type": "azure_nsg_rule",
		"config": {
			"rule_name": "nsg-test",
			"source_address_prefix": "*",
			"destination_port_range": "22",
			"access": "Allow",
			"direction": "Inbound",
		},
	}
	v.control_id == "ISO-A.13.1.1"
}
