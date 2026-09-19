# Terraform — AWS Reference Module

**Status: built and validated (`terraform fmt -check`, `terraform validate`), never applied.**
No AWS account or credentials were used to produce this — provisioning real infrastructure is
a real-cost, real-credentials action that needs a human's own explicit go-ahead against their
own account, not something to do unilaterally. This module exists to show what "actually
deploy to the cloud" looks like as reviewable, correct code, with the local `kind` cluster
(see `infra/k8s/README.md`) remaining this project's actual, live-verified deploy target.

## What this provisions

| CloudSecOps component | Local (docker-compose) | This module's AWS resource |
|---|---|---|
| Backend + frontend runtime | Docker containers | EKS managed node group (`modules/eks`) |
| Postgres | `postgres:16-alpine` container | RDS Postgres 16 (`modules/data`) |
| Redis | `redis:8-alpine` container | ElastiCache Redis (`modules/data`) |
| MinIO (evidence store) | MinIO container | S3 bucket, versioned + encrypted + public access blocked (`modules/data`) |
| Kafka + Zookeeper | Confluent containers | Strimzi operator on the same EKS cluster (`modules/kafka`) — **not** MSK, see below |
| Network | Docker's own bridge network | VPC, multi-AZ public/private subnets, one NAT gateway (`modules/network`) |
| Evidence-store credentials | Static `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` | IRSA — the backend pod assumes a real IAM role via its ServiceAccount token, no static AWS keys anywhere (`modules/eks`'s `backend_irsa` role) |

## Module layout

```
infra/terraform/
├── modules/
│   ├── network/   VPC, public/private subnets, NAT gateway
│   ├── eks/       EKS cluster + managed node group + OIDC provider + backend IRSA role
│   ├── data/      RDS Postgres, ElastiCache Redis, S3 evidence bucket
│   └── kafka/     Strimzi operator (Helm release) on the EKS cluster
└── environments/
    └── prod/      Root module wiring the four above together + provider config
```

## Why Strimzi on EKS instead of Amazon MSK

MSK is the lower-operational-burden choice — AWS manages broker patching, scaling, and
monitoring — but it's a second control plane and billing line separate from the EKS cluster
this stack already needs. This project's Kafka usage is three topics at modest throughput,
already proven to run fine as a single broker in `docker-compose.yml`'s local stack. Strimzi
runs Kafka as ordinary pods on the same node group already being paid for, at the cost of the
app team (not AWS) owning broker upgrades and storage management. `modules/kafka` installs
only the Strimzi *operator* — the actual `Kafka` custom resource (broker count, storage class)
is deliberately left for a follow-up once real node capacity is known, since a one-size-fits-all
broker sizing baked into a reference module is more likely wrong than helpful.

## IRSA wiring — what's done vs. what's left

`modules/eks` creates the OIDC provider and an IAM role (`backend_irsa`) trusted for
`system:serviceaccount:cloudsecops:cloudsecops-backend` (configurable). `environments/prod`
attaches an S3-access policy to that role once the evidence bucket exists. **Not yet done**:
the Helm chart's `backend-deployment.yaml` doesn't create or annotate a dedicated
ServiceAccount with `eks.amazonaws.com/role-arn` — today it runs under `default`. Closing that
gap means adding a `serviceAccount.yaml` template to `infra/k8s/` and setting
`spec.template.spec.serviceAccountName` on the backend Deployment, annotated with this
module's `backend_irsa_role_arn` output — a real remaining step, called out here rather than
silently implied as finished.

## Estimated cost (us-east-1, on-demand, rough order of magnitude)

| Resource | ~Monthly |
|---|---|
| EKS control plane | $73 |
| 2× `t3.medium` node group (on-demand) | ~$60 |
| RDS `db.t4g.medium`, single-AZ, 50GB gp3 | ~$70 |
| ElastiCache `cache.t4g.micro` | ~$12 |
| NAT gateway (hourly + data processing) | ~$35+ |
| S3 (evidence store, usage-dependent) | a few dollars at this project's scale |
| **Total** | **roughly $250–300/month** before data transfer and Kafka's own node cost (shares the existing node group, not separately priced above) |

This is a ballpark for sizing intuition, not a quote — actual cost depends on data transfer,
snapshot retention, and whether `postgres_multi_az` is turned on (roughly doubles the RDS line).

## Usage

```bash
cd infra/terraform/environments/prod
cp terraform.tfvars.example terraform.tfvars   # fill in non-secret values
export TF_VAR_postgres_password="a real generated password — never in a file"

terraform init
terraform fmt -check -recursive ..             # from environments/prod, checks the whole tree
terraform validate

# Never run in this project without the account owner's own explicit go-ahead:
# terraform plan
# terraform apply
```

## Secrets

Nothing here reads a `.tfvars` for the one real secret (`postgres_password`) — it's read from
`TF_VAR_postgres_password` (or a secrets-manager-backed variable in a real CI pipeline)
specifically so it's never in a file at all, checked in or not. `terraform.tfvars.example` is
tracked; `terraform.tfvars` is gitignored, mirroring this project's existing `.env`/`.env.example`
split for application secrets.
