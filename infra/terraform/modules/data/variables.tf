variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "allowed_security_group_ids" {
  description = "Security groups allowed to reach Postgres/Redis — pass the EKS node group's security group here from the root module."
  type        = list(string)
  default     = []
}

variable "postgres_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "postgres_allocated_storage_gb" {
  type    = number
  default = 50
}

variable "postgres_multi_az" {
  description = "RDS Multi-AZ standby — off by default to keep the reference module's ballpark cost realistic for a demo/staging use; flip on for anything with real uptime requirements."
  type        = bool
  default     = false
}

variable "postgres_database_name" {
  type    = string
  default = "cloudsecops"
}

variable "postgres_username" {
  type    = string
  default = "cloudsecops"
}

variable "postgres_password" {
  description = "Never set via a literal in a checked-in .tfvars — see terraform.tfvars.example's own comment. Pass via TF_VAR_postgres_password or a secrets-manager-backed variable in real use."
  type        = string
  sensitive   = true
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "tags" {
  type    = map(string)
  default = {}
}
