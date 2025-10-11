output "cloudfront_distribution_id" {
  description = "The ID of the CloudFront distribution"
  value       = module.cloudfront.distribution_id
}

output "cloudfront_distribution_domain_name" {
  description = "The domain name of the CloudFront distribution"
  value       = module.cloudfront.distribution_domain_name
}

output "cloudfront_distribution_arn" {
  description = "The ARN of the CloudFront distribution"
  value       = module.cloudfront.distribution_arn
}

output "cloudfront_distribution_aliases" {
  description = "The aliases of the CloudFront distribution"
  value       = module.cloudfront.distribution_aliases
}

output "acm_certificate_arn" {
  description = "The ARN of the ACM certificate for CloudFront"
  value       = aws_acm_certificate.cloudfront_cert.arn
}

output "acm_certificate_validation_records" {
  description = "DNS validation records for the ACM certificate"
  value       = aws_acm_certificate.cloudfront_cert.domain_validation_options
}

output "s3_bucket_name" {
  description = "The name of the S3 bucket"
  value       = local.bucket_name
}

output "domain_name" {
  description = "The domain name for the application"
  value       = local.domain_name
}

