output "namespace" {
  value = kubernetes_namespace.kafka.metadata[0].name
}
