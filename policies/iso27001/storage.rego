package cloudsecops

# ISO/IEC 27001 Annex A — A.9 (Access Control) & A.10 (Cryptography)

violation[v] {
	input.resource_type == "azure_storage_account"
	input.config.public_blob_access_enabled
	v := {
		"control_id": "ISO-A.9.2.3",
		"framework": "ISO 27001",
		"severity": "CRITICAL",
		"title": "Azure storage account allows public blob access",
		"description": sprintf("Storage account %s permits anonymous public read access to blobs.", [input.config.account_name]),
		"remediation": "Disable public blob access at the storage account level; use SAS tokens or private endpoints instead.",
	}
}

passed[control_id] {
	input.resource_type == "azure_storage_account"
	not input.config.public_blob_access_enabled
	control_id := "ISO-A.9.2.3"
}

violation[v] {
	input.resource_type == "azure_storage_account"
	input.config.min_tls_version != "TLS1_2"
	v := {
		"control_id": "ISO-A.9.4.1",
		"framework": "ISO 27001",
		"severity": "MEDIUM",
		"title": "Azure storage account allows outdated TLS",
		"description": sprintf("Storage account %s has minimum TLS version set to %s.", [input.config.account_name, input.config.min_tls_version]),
		"remediation": "Set the minimum TLS version to TLS1_2 or higher.",
	}
}

passed[control_id] {
	input.resource_type == "azure_storage_account"
	input.config.min_tls_version == "TLS1_2"
	control_id := "ISO-A.9.4.1"
}

violation[v] {
	input.resource_type == "azure_vm"
	not input.config.disk_encryption_enabled
	v := {
		"control_id": "ISO-A.10.1.1",
		"framework": "ISO 27001",
		"severity": "HIGH",
		"title": "Azure VM disk encryption disabled",
		"description": sprintf("VM %s does not have Azure Disk Encryption enabled.", [input.config.vm_name]),
		"remediation": "Enable Azure Disk Encryption (or confirm platform-managed encryption meets policy) for all VM disks.",
	}
}

passed[control_id] {
	input.resource_type == "azure_vm"
	input.config.disk_encryption_enabled
	control_id := "ISO-A.10.1.1"
}
