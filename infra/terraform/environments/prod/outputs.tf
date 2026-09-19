output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "backend_irsa_role_arn" {
  description = "Annotate the backend's k8s ServiceAccount with eks.amazonaws.com/role-arn = this value to complete IRSA wiring (see infra/terraform/README.md)."
  value       = module.eks.backend_irsa_role_arn
}

output "postgres_endpoint" {
  value = module.data.postgres_endpoint
}

output "redis_endpoint" {
  value = module.data.redis_endpoint
}

output "evidence_bucket_name" {
  value = module.data.evidence_bucket_name
}
