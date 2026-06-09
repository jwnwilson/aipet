variable "name" {
  description = "Short name for this static site — used as the S3 bucket name and in resource names"
  type        = string
}

variable "domains" {
  description = "List of domain names for CloudFront aliases (first entry is the primary)"
  type        = list(string)
}

variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate in us-east-1 covering all domains in var.domains"
  type        = string
}
