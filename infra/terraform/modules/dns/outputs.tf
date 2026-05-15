output "client_fqdn" {
  description = "FQDN of the game client"
  value       = aws_route53_record.client.fqdn
}

output "llm_ui_fqdn" {
  description = "FQDN of the llm-ui admin panel"
  value       = aws_route53_record.llm_ui.fqdn
}

output "server_fqdn" {
  description = "FQDN of the game server API"
  value       = aws_route53_record.server.fqdn
}
