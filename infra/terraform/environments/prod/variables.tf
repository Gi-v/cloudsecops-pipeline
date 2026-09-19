variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "name" {
  description = "Prefix applied to every resource name/tag across all modules."
  type        = string
  default     = "cloudsecops-prod"
}

variable "availability_zones" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b"]
}

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.20.0.0/24", "10.20.1.0/24"]
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.20.10.0/24", "10.20.11.0/24"]
}

variable "kubernetes_version" {
  type    = string
  default = "1.31"
}

variable "node_instance_types" {
  type    = list(string)
  default = ["t3.medium"]
}

variable "postgres_password" {
  description = "Set via TF_VAR_postgres_password or a secrets-manager-backed variable — never in a checked-in .tfvars. See terraform.tfvars.example."
  type        = string
  sensitive   = true
}

variable "tags" {
  type = map(string)
  default = {
    Project   = "cloudsecops-pipeline"
    ManagedBy = "terraform"
  }
}
