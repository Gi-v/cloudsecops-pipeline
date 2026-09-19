# RDS Postgres + ElastiCache Redis + an S3 bucket — the production
# counterparts of docker-compose.yml's postgres/redis/minio containers and
# the Helm chart's postgres.yaml/redis.yaml/minio.yaml templates. Kafka is
# deliberately NOT provisioned here as an AWS-managed service (MSK) — see
# ../kafka/main.tf and this module's README section for the Strimzi-on-EKS
# tradeoff that decision represents.

resource "aws_security_group" "postgres" {
  name_prefix = "${var.name}-postgres-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.allowed_security_group_ids
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = merge(var.tags, { Name = "${var.name}-postgres-sg" })
}

resource "aws_db_subnet_group" "postgres" {
  name       = "${var.name}-postgres"
  subnet_ids = var.private_subnet_ids
  tags       = var.tags
}

resource "aws_db_instance" "postgres" {
  identifier     = "${var.name}-postgres"
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.postgres_instance_class

  allocated_storage      = var.postgres_allocated_storage_gb
  storage_type           = "gp3"
  storage_encrypted      = true
  multi_az               = var.postgres_multi_az
  db_name                = var.postgres_database_name
  username               = var.postgres_username
  password               = var.postgres_password
  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  vpc_security_group_ids = [aws_security_group.postgres.id]

  backup_retention_period   = 7
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.name}-postgres-final"
  deletion_protection       = true

  tags = var.tags
}

resource "aws_security_group" "redis" {
  name_prefix = "${var.name}-redis-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_group_ids
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = merge(var.tags, { Name = "${var.name}-redis-sg" })
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.name}-redis"
  subnet_ids = var.private_subnet_ids
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id         = "${var.name}-redis"
  engine             = "redis"
  engine_version     = "7.1"
  node_type          = var.redis_node_type
  num_cache_nodes    = 1
  port               = 6379
  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]
  # Single node, no cluster-mode/replication — the app's own rate limiter
  # (app/core/rate_limit.py) already degrades gracefully to in-memory
  # limiting if Redis is unreachable, so this is a convenience layer, not
  # a hard dependency worth the extra cost/complexity of a replication
  # group for this reference module. Upgrade to aws_elasticache_replication_group
  # if Redis starts backing anything that needs real availability.

  tags = var.tags
}

# Evidence store bucket — replaces MinIO in production (values.yaml's own
# minio block already documents this as the intended prod swap).
# app/evidence/store.py talks to either transparently since MinIO speaks
# the S3 API.
resource "aws_s3_bucket" "evidence" {
  bucket = "${var.name}-evidence-store"
  tags   = var.tags
}

resource "aws_s3_bucket_versioning" "evidence" {
  bucket = aws_s3_bucket.evidence.id
  versioning_configuration {
    # Versioning, not object lock: this project's own tamper-evidence
    # mechanism is the SHA-256 hash chain (ADR-003), which detects
    # tampering rather than physically preventing it — S3 Object Lock
    # (WORM) would be a stronger, separate guarantee worth adding if this
    # evidence store ever needs to satisfy a compliance regime that
    # requires immutability at the storage layer itself, not just detection.
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "evidence" {
  bucket                  = aws_s3_bucket.evidence.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
