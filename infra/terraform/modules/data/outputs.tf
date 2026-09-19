output "postgres_endpoint" {
  value = aws_db_instance.postgres.endpoint
}

output "postgres_security_group_id" {
  value = aws_security_group.postgres.id
}

output "redis_endpoint" {
  value = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "redis_security_group_id" {
  value = aws_security_group.redis.id
}

output "evidence_bucket_name" {
  value = aws_s3_bucket.evidence.bucket
}

output "evidence_bucket_arn" {
  value = aws_s3_bucket.evidence.arn
}
