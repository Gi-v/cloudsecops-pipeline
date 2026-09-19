# Kafka on EKS via the Strimzi operator, deliberately instead of Amazon MSK.
#
# Tradeoff (see docs/adr — this mirrors the same MSK-vs-Strimzi reasoning
# infra/k8s/values.yaml's kafka.externalBootstrapServers comment already
# gestures at): MSK is the lower-operational-burden choice — AWS manages
# broker patching, scaling, and monitoring — but it's a second control
# plane and billing line separate from the EKS cluster this stack already
# needs, and this project's Kafka usage (three topics, modest throughput,
# already tolerant of a single-broker demo setup per docker-compose.yml)
# doesn't need MSK's operational ceiling. Strimzi runs Kafka as ordinary
# pods on the same EKS cluster/node group already being paid for, at the
# cost of the app team (not AWS) owning broker upgrades and storage
# management. Re-evaluate this if Kafka throughput ever becomes a real
# operational burden — MSK is a legitimate migration target then, not a
# mistake to have avoided initially.
#
# Scope: this module installs the Strimzi *operator* only. The actual
# `Kafka` custom resource (broker count, storage class, resource requests)
# is deliberately not templated here — those numbers are meaningfully
# different per environment/cluster size, and a one-size-fits-all default
# baked into a reference module is more likely to be silently wrong than
# helpful. Apply a `Kafka` manifest separately once real node capacity is
# known; see the Strimzi docs' own quickstart for the CR shape.

resource "kubernetes_namespace" "kafka" {
  metadata {
    name = var.namespace
  }
}

resource "helm_release" "strimzi" {
  name       = "strimzi-kafka-operator"
  repository = "https://strimzi.io/charts/"
  chart      = "strimzi-kafka-operator"
  version    = var.strimzi_chart_version
  namespace  = kubernetes_namespace.kafka.metadata[0].name

  set {
    name  = "watchAnyNamespace"
    value = "true"
  }
}
