variable "aws_region" {
  description = "AWS region for ECR and IAM resources"
  type        = string
  default     = "us-east-1"
}

variable "repo_name" {
  description = "Project name — used to prefix all AWS resource names"
  type        = string
  default     = "aipet"
}

variable "image_retention_count" {
  description = "Number of tagged ECR images to retain"
  type        = number
  default     = 10
}

variable "github_repo" {
  description = "GitHub repository in owner/name format (e.g. jwnwilson/aipet) — scopes OIDC trust"
  type        = string
}

variable "vps_ip" {
  description = "Public IP of the VPS running k3s — used for the aipet-api DNS A record"
  type        = string
  default     = "165.22.115.52"
}

variable "acm_certificate_arn" {
  description = "ARN of the wildcard ACM certificate (*.jwnwilson.co.uk) in us-east-1"
  type        = string
}
