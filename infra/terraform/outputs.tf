output "ecr_repository_url" {
  description = "ECR URL — patch into infra/k8s/deployment.yaml and set as ECR_REPOSITORY_URL GitHub secret"
  value       = module.ecr.repository_url
}

output "github_actions_role_arn" {
  description = "IAM role ARN — set as AWS_ROLE_ARN GitHub secret"
  value       = module.iam.github_actions_role_arn
}

output "client_bucket_name" {
  description = "S3 bucket for game client — set as CLIENT_BUCKET GitHub secret"
  value       = module.s3_client.bucket_name
}

output "client_distribution_id" {
  description = "CloudFront distribution ID for game client — set as CLIENT_CF_DISTRIBUTION_ID GitHub secret"
  value       = module.s3_client.distribution_id
}


output "client_fqdn" {
  value = module.dns.client_fqdn
}

output "server_fqdn" {
  value = module.dns.server_fqdn
}
