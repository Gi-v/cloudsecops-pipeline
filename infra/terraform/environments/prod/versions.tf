terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = ">= 4.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.30"
    }
    helm = {
      source  = "hashicorp/helm"
      version = ">= 2.13"
    }

    # No backend block here on purpose — a real deployment should configure
    # a remote backend (S3 + DynamoDB lock table, or Terraform Cloud) via
    # `terraform init -backend-config=...` rather than a literal committed
    # here, the same reasoning as this project's own .env vs .env.example
    # split for application secrets.
  }
}

provider "aws" {
  region = var.aws_region
}

# Configured against the EKS cluster this same apply creates — works
# because Terraform resolves the full dependency graph before applying,
# so by the time anything using the kubernetes/helm providers runs, the
# cluster (and the auth token below) already exists.
data "aws_eks_cluster_auth" "this" {
  name = module.eks.cluster_name
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  token                  = data.aws_eks_cluster_auth.this.token
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
    token                  = data.aws_eks_cluster_auth.this.token
  }
}
