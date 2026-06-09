variable "domain" {
  description = "Primary domain name for the certificate"
  type        = string
}

variable "subject_alternative_names" {
  description = "Additional domain names to include as SANs"
  type        = list(string)
  default     = []
}

variable "zone_ids" {
  description = "Map of every domain (primary + SANs) to its Route53 zone ID. Avoids name-based lookups that fail when duplicate zones exist."
  type        = map(string)
  # e.g. {
  #   "aipet-v2.jwnwilson.co.uk" = "Z02258126NTU7FYKTZDL"
  #   "pet-simulator.co.uk"       = "Z10304653JXK1OY0NKA13"
  # }
}
