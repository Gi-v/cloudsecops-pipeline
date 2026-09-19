variable "name" {
  description = "Cluster name prefix."
  type        = string
}

variable "kubernetes_version" {
  description = "EKS control plane version."
  type        = string
  default     = "1.31"
}

variable "private_subnet_ids" {
  description = "Subnets the control plane ENIs and worker nodes live in — private, matching the Helm chart's own posture of no direct-internet workload pods (egress via the network module's NAT gateway)."
  type        = list(string)
}

variable "node_instance_types" {
  type    = list(string)
  default = ["t3.medium"]
}

variable "node_desired_size" {
  type    = number
  default = 2
}

variable "node_min_size" {
  type    = number
  default = 2
}

variable "node_max_size" {
  type    = number
  default = 6
}

variable "backend_service_account_namespace" {
  description = "K8s namespace the backend's ServiceAccount lives in — must match the Helm release's --namespace so the IRSA trust policy's `sub` condition actually matches at runtime."
  type        = string
  default     = "cloudsecops"
}

variable "backend_service_account_name" {
  description = "K8s ServiceAccount name the backend Deployment's pods run as. Not yet templated into infra/k8s's backend-deployment.yaml — annotating that ServiceAccount with this role's ARN (eks.amazonaws.com/role-arn) is the remaining wiring step to make IRSA live end-to-end."
  type        = string
  default     = "cloudsecops-backend"
}

variable "tags" {
  type    = map(string)
  default = {}
}
