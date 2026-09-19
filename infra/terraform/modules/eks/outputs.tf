output "cluster_name" {
  value = aws_eks_cluster.this.name
}

output "cluster_endpoint" {
  value = aws_eks_cluster.this.endpoint
}

output "cluster_certificate_authority_data" {
  value = aws_eks_cluster.this.certificate_authority[0].data
}

output "cluster_security_group_id" {
  description = "EKS's own auto-managed cluster security group — every node/pod's traffic is associated with it, so it's what RDS/ElastiCache's security groups should allow ingress from."
  value       = aws_eks_cluster.this.vpc_config[0].cluster_security_group_id
}

output "oidc_provider_arn" {
  value = aws_iam_openid_connect_provider.eks.arn
}

output "backend_irsa_role_arn" {
  value = aws_iam_role.backend_irsa.arn
}

output "backend_irsa_role_name" {
  value = aws_iam_role.backend_irsa.name
}
