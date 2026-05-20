provider "aws" {
  region = var.aws_region
}

module "ecr" {
  source                = "./modules/ecr"
  repo_name             = "${var.repo_name}-server"
  image_retention_count = var.image_retention_count
}

module "acm_client" {
  source  = "./modules/acm"
  domain  = "aipet-v2.jwnwilson.co.uk"
}

module "s3_client" {
  source              = "./modules/s3_static"
  name                = "${var.repo_name}-client"
  domain              = "aipet-v2.jwnwilson.co.uk"
  acm_certificate_arn = module.acm_client.certificate_arn
}

module "iam" {
  source                  = "./modules/iam"
  repo_name               = var.repo_name
  github_repo             = var.github_repo
  ecr_push_policy_arn     = module.ecr.ecr_push_policy_arn
  client_bucket_arn       = module.s3_client.bucket_arn
  client_distribution_arn = module.s3_client.distribution_arn
}

module "dns" {
  source           = "./modules/dns"
  vps_ip           = var.vps_ip
  client_cf_domain = module.s3_client.cloudfront_domain
}
