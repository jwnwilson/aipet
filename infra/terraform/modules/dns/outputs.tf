output "client_fqdn" {
  description = "FQDN of the game client"
  value       = aws_route53_record.client.fqdn
}

output "server_fqdn" {
  description = "FQDN of the game server API"
  value       = aws_route53_record.server.fqdn
}
