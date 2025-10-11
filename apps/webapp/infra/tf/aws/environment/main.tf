terraform {
  backend "s3" {
    region = "eu-west-1"
    bucket = "hexrepo-jwn"
    key = "aipet_fe-environment.tfstate"
  }
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Get the S3 bucket from shared state
data "terraform_remote_state" "shared" {
  backend = "s3"
  config = {
    region = "eu-west-1"
    bucket = "hexrepo-jwn"
    key    = "aipet_fe-shared.tfstate"
  }
}

locals {
  bucket_name = "aipet.jwnwilson.co.uk"
  domain_name = "${var.api_subdomain}.${var.domain}"
}

provider "aws" {
  region  = var.aws_region
}

# Provider for us-east-1 (required for CloudFront certificates)
provider "aws" {
  alias  = "us-east-1"
  region = "us-east-1"
}


module "main_bucket" {
  source = "../../../../../../infra/tf/aws/modules/s3"

  project     = var.project
  name        = local.bucket_name
}

# Route53 hosted zone
data "aws_route53_zone" "hexrepo" {
  name = var.domain
}

# CloudFront module
module "cloudfront" {
  source = "../../../../../../infra/tf/aws/modules/cloudfront"

  project = var.project
  environment = terraform.workspace

  s3_bucket_name                    = local.bucket_name
  s3_bucket_id                      = module.main_bucket.bucket_id
  s3_bucket_arn                     = module.main_bucket.arn
  s3_bucket_regional_domain_name    = module.main_bucket.bucket_regional_domain_name

  domain_aliases = [local.domain_name]
  acm_certificate_arn = aws_acm_certificate.cloudfront_cert.arn

  enable_spa_routing = true
  create_bucket_policy = true
}

# Route53 A record for CloudFront
resource "aws_route53_record" "cloudfront_alias" {
  zone_id = data.aws_route53_zone.hexrepo.zone_id
  name    = local.domain_name
  type    = "A"

  alias {
    name                   = module.cloudfront.distribution_domain_name
    zone_id                = "Z2FDTNDATAQYW2"  # CloudFront hosted zone ID (global)
    evaluate_target_health = false
  }
}

# ACM Certificate for CloudFront (must be in us-east-1)
resource "aws_acm_certificate" "cloudfront_cert" {
  provider = aws.us-east-1
  domain_name       = local.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    PROJECT     = var.project
    ENVIRONMENT = terraform.workspace
    Terraform   = "true"
  }
}

