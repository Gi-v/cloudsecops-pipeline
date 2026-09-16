"""Synthetic resource generators shared by every simulated collector.

Kept deliberately realistic — field names and value shapes mirror what the real
boto3 / google-cloud / azure-sdk collectors (see `live_aws.py` etc., enabled via
COLLECTOR_MODE=live) would produce, so the same Rego policies evaluate either
source identically.
"""
import random
import uuid

FAKE_ACCOUNT_IDS = ["123456789012", "987654321098", "456789012345"]
AWS_REGIONS = ["us-east-1", "us-west-2", "eu-west-1"]
GCP_REGIONS = ["us-central1", "europe-west1"]
AZURE_REGIONS = ["eastus", "westeurope"]

BUCKET_NAMES = [
    "prod-data-lake", "staging-uploads", "customer-exports", "analytics-raw",
    "backup-archive", "static-assets", "logs-central", "ml-training-data",
]
SERVICE_NAMES = [
    "auth-service", "payments-api", "worker-queue", "eks-cluster-prod",
    "backend-api", "cache-layer", "search-indexer", "notification-svc",
]


def _urn(provider: str, kind: str, name: str) -> str:
    return f"{provider}:{kind}:{name}:{uuid.uuid4().hex[:8]}"


def gen_aws_s3_buckets(n: int = 6) -> list[dict]:
    out = []
    for name in random.sample(BUCKET_NAMES, min(n, len(BUCKET_NAMES))):
        public = random.random() < 0.15
        out.append({
            "resource_urn": f"arn:aws:s3:::{name}",
            "provider": "AWS",
            "resource_type": "aws_s3_bucket",
            "region": random.choice(AWS_REGIONS),
            "account_id": random.choice(FAKE_ACCOUNT_IDS),
            "config": {
                "bucket_name": name,
                "acl": "public-read" if public else "private",
                "public_access_block_enabled": not public,
                "versioning_enabled": random.random() < 0.75,
                "encryption_enabled": random.random() < 0.9,
                "logging_enabled": random.random() < 0.6,
            },
        })
    return out


def gen_aws_security_groups(n: int = 4) -> list[dict]:
    out = []
    for _i in range(n):
        open_ssh = random.random() < 0.2
        open_rdp = random.random() < 0.1
        ingress = []
        if open_ssh:
            ingress.append({"from_port": 22, "to_port": 22, "cidr": "0.0.0.0/0", "protocol": "tcp"})
        if open_rdp:
            ingress.append(
                {"from_port": 3389, "to_port": 3389, "cidr": "0.0.0.0/0", "protocol": "tcp"}
            )
        if not ingress:
            ingress.append(
                {"from_port": 443, "to_port": 443, "cidr": "10.0.0.0/16", "protocol": "tcp"}
            )
        sg_id = f"sg-{uuid.uuid4().hex[:12]}"
        out.append({
            "resource_urn": f"arn:aws:ec2:security-group:{sg_id}",
            "provider": "AWS",
            "resource_type": "aws_security_group",
            "region": random.choice(AWS_REGIONS),
            "account_id": random.choice(FAKE_ACCOUNT_IDS),
            "config": {
                "group_id": sg_id,
                "group_name": f"{random.choice(SERVICE_NAMES)}-sg",
                "ingress_rules": ingress,
            },
        })
    return out


def gen_aws_iam_users(n: int = 5) -> list[dict]:
    out = []
    for i in range(n):
        is_root_like = i == 0
        mfa = random.random() < 0.8 if not is_root_like else random.random() < 0.5
        key_age = random.randint(1, 260)
        out.append({
            "resource_urn": f"arn:aws:iam::user/{'admin' if is_root_like else f'engineer-{i}'}",
            "provider": "AWS",
            "resource_type": "aws_iam_user",
            "region": "global",
            "account_id": random.choice(FAKE_ACCOUNT_IDS),
            "config": {
                "username": "admin" if is_root_like else f"engineer-{i}",
                "mfa_enabled": mfa,
                "access_key_age_days": key_age,
                "is_admin_policy_attached": is_root_like or random.random() < 0.15,
            },
        })
    return out


def gen_aws_ebs_volumes(n: int = 4) -> list[dict]:
    out = []
    for _i in range(n):
        vol_id = f"vol-{uuid.uuid4().hex[:12]}"
        out.append({
            "resource_urn": f"arn:aws:ec2:volume:{vol_id}",
            "provider": "AWS",
            "resource_type": "aws_ebs_volume",
            "region": random.choice(AWS_REGIONS),
            "account_id": random.choice(FAKE_ACCOUNT_IDS),
            "config": {
                "volume_id": vol_id,
                "encrypted": random.random() < 0.85,
                "attached_instance": f"i-{uuid.uuid4().hex[:12]}",
                "size_gb": random.choice([20, 50, 100, 250, 500]),
            },
        })
    return out


def gen_aws_cloudtrail() -> list[dict]:
    return [{
        "resource_urn": "arn:aws:cloudtrail:trail:org-trail",
        "provider": "AWS",
        "resource_type": "aws_cloudtrail",
        "region": "us-east-1",
        "account_id": random.choice(FAKE_ACCOUNT_IDS),
        "config": {
            "trail_name": "org-trail",
            "is_multi_region": random.random() < 0.85,
            "logging_enabled": True,
            "log_file_validation_enabled": random.random() < 0.9,
        },
    }]


def gen_gcp_storage_buckets(n: int = 4) -> list[dict]:
    out = []
    for name in random.sample(BUCKET_NAMES, min(n, len(BUCKET_NAMES))):
        public = random.random() < 0.1
        out.append({
            "resource_urn": f"gcp:storage:bucket:{name}",
            "provider": "GCP",
            "resource_type": "gcp_storage_bucket",
            "region": random.choice(GCP_REGIONS),
            "account_id": "cloudsecops-demo-project",
            "config": {
                "bucket_name": name,
                "public_iam": public,
                "uniform_bucket_level_access": random.random() < 0.8,
                "versioning_enabled": random.random() < 0.7,
            },
        })
    return out


def gen_gcp_firewall_rules(n: int = 3) -> list[dict]:
    out = []
    for _i in range(n):
        open_rule = random.random() < 0.2
        fw_id = f"fw-{uuid.uuid4().hex[:10]}"
        out.append({
            "resource_urn": f"gcp:compute:firewall:{fw_id}",
            "provider": "GCP",
            "resource_type": "gcp_firewall_rule",
            "region": "global",
            "account_id": "cloudsecops-demo-project",
            "config": {
                "rule_name": fw_id,
                "source_ranges": ["0.0.0.0/0"] if open_rule else ["10.128.0.0/20"],
                "allowed_ports": [22, 3389] if open_rule else [443],
                "direction": "INGRESS",
            },
        })
    return out


def gen_gcp_compute_instances(n: int = 4) -> list[dict]:
    out = []
    for _i in range(n):
        inst_id = f"gce-{uuid.uuid4().hex[:10]}"
        out.append({
            "resource_urn": f"gcp:compute:instance:{inst_id}",
            "provider": "GCP",
            "resource_type": "gcp_compute_instance",
            "region": random.choice(GCP_REGIONS),
            "account_id": "cloudsecops-demo-project",
            "config": {
                "instance_name": inst_id,
                "shielded_vm_enabled": random.random() < 0.75,
                "os_login_enabled": random.random() < 0.8,
                "public_ip_assigned": random.random() < 0.3,
            },
        })
    return out


def gen_azure_vms(n: int = 4) -> list[dict]:
    out = []
    for _i in range(n):
        vm_id = f"vm-{uuid.uuid4().hex[:10]}"
        out.append({
            "resource_urn": f"azure:compute:vm:{vm_id}",
            "provider": "AZURE",
            "resource_type": "azure_vm",
            "region": random.choice(AZURE_REGIONS),
            "account_id": "cloudsecops-demo-subscription",
            "config": {
                "vm_name": vm_id,
                "disk_encryption_enabled": random.random() < 0.8,
                "managed_identity_enabled": random.random() < 0.7,
                "public_ip_assigned": random.random() < 0.25,
            },
        })
    return out


def gen_azure_storage_accounts(n: int = 3) -> list[dict]:
    out = []
    for _i in range(n):
        sa_id = f"sa{uuid.uuid4().hex[:10]}"
        public = random.random() < 0.12
        out.append({
            "resource_urn": f"azure:storage:account:{sa_id}",
            "provider": "AZURE",
            "resource_type": "azure_storage_account",
            "region": random.choice(AZURE_REGIONS),
            "account_id": "cloudsecops-demo-subscription",
            "config": {
                "account_name": sa_id,
                "public_blob_access_enabled": public,
                "https_only": random.random() < 0.95,
                "min_tls_version": random.choice(["TLS1_0", "TLS1_2"]),
            },
        })
    return out


def gen_azure_nsg_rules(n: int = 3) -> list[dict]:
    out = []
    for _i in range(n):
        open_rule = random.random() < 0.18
        nsg_id = f"nsg-{uuid.uuid4().hex[:10]}"
        out.append({
            "resource_urn": f"azure:network:nsg:{nsg_id}",
            "provider": "AZURE",
            "resource_type": "azure_nsg_rule",
            "region": "global",
            "account_id": "cloudsecops-demo-subscription",
            "config": {
                "rule_name": nsg_id,
                "source_address_prefix": "*" if open_rule else "10.0.0.0/16",
                "destination_port_range": "22" if open_rule else "443",
                "access": "Allow",
                "direction": "Inbound",
            },
        })
    return out
