variable "name" {
  description = "Prefix applied to every resource name/tag in this module."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "availability_zones" {
  description = "AZs to spread public/private subnets across. Multi-AZ so the EKS control plane and RDS's own multi-AZ failover have somewhere to actually fail over to."
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "One CIDR per AZ, for internet-facing resources (NAT gateway, load balancers)."
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "One CIDR per AZ, for everything else (EKS nodes, RDS, ElastiCache) — no public IPs, egress only via the NAT gateway."
  type        = list(string)
}

variable "tags" {
  description = "Common tags merged onto every resource."
  type        = map(string)
  default     = {}
}
