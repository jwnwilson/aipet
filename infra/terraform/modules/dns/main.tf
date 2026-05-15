data "aws_route53_zone" "zone" {
  name         = var.zone_name
  private_zone = false
}

resource "aws_route53_record" "client" {
  zone_id = data.aws_route53_zone.zone.zone_id
  name    = "aipet-v2.${trimsuffix(var.zone_name, ".")}"
  type    = "CNAME"
  ttl     = 300
  records = [var.client_cf_domain]
}

resource "aws_route53_record" "llm_ui" {
  zone_id = data.aws_route53_zone.zone.zone_id
  name    = "aipet-admin.${trimsuffix(var.zone_name, ".")}"
  type    = "CNAME"
  ttl     = 300
  records = [var.llm_ui_cf_domain]
}

resource "aws_route53_record" "server" {
  zone_id = data.aws_route53_zone.zone.zone_id
  name    = "aipet-api.${trimsuffix(var.zone_name, ".")}"
  type    = "A"
  ttl     = 300
  records = [var.vps_ip]
}
