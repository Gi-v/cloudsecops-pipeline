variable "namespace" {
  description = "Namespace to install the Strimzi operator into."
  type        = string
  default     = "kafka"
}

variable "strimzi_chart_version" {
  type    = string
  default = "0.45.0"
}
