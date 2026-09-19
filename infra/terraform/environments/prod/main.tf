module "network" {
  source = "../../modules/network"

  name                 = var.name
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  tags                 = var.tags
}

module "eks" {
  source = "../../modules/eks"

  name                = var.name
  kubernetes_version  = var.kubernetes_version
  private_subnet_ids  = module.network.private_subnet_ids
  node_instance_types = var.node_instance_types
  tags                = var.tags
}

module "data" {
  source = "../../modules/data"

  name                       = var.name
  vpc_id                     = module.network.vpc_id
  private_subnet_ids         = module.network.private_subnet_ids
  allowed_security_group_ids = [module.eks.cluster_security_group_id]
  postgres_password          = var.postgres_password
  tags                       = var.tags
}

module "kafka" {
  source = "../../modules/kafka"
}

# Grants the backend's IRSA role (module.eks) access to the evidence bucket
# (module.data) — attached here, once both are in scope, rather than inside
# either module, so neither module needs to know about the other's
# resources directly.
resource "aws_iam_role_policy" "backend_s3_access" {
  name = "${var.name}-backend-s3-access"
  role = module.eks.backend_irsa_role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket",
      ]
      Resource = [
        module.data.evidence_bucket_arn,
        "${module.data.evidence_bucket_arn}/*",
      ]
    }]
  })
}
