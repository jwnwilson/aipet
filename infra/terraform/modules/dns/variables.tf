variable "zone_name" {
  description = "Route 53 hosted zone name (trailing dot required, e.g. jwnwilson.co.uk.)"
  type        = string
  default     = "jwnwilson.co.uk."
}

variable "vps_ip" {
  description = "Public IP of the VPS running the k3s cluster — used for the server A record"
  type        = string
}

variable "client_cf_domain" {
  description = "CloudFront domain name for the game client (output of s3_static module)"
  type        = string
}

variable "llm_ui_cf_domain" {
  description = "CloudFront domain name for llm-ui (output of s3_static module)"
  type        = string
}
