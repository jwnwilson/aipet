variable "repo_name" {
  description = "Project name — used to prefix IAM resource names"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository in owner/name format — scopes the OIDC trust to main-branch pushes"
  type        = string
}

variable "ecr_push_policy_arn" {
  description = "ARN of the ECR push IAM policy — attached to the GitHub Actions role"
  type        = string
}

variable "client_bucket_arn" {
  description = "ARN of the game client S3 bucket"
  type        = string
}

variable "client_distribution_arn" {
  description = "ARN of the game client CloudFront distribution"
  type        = string
}
