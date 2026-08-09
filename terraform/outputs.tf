output "public_ip" {
  description = "Public IP of the instance"
  value       = aws_instance.app.public_ip
}

output "ssh_command" {
  description = "SSH into the instance (replace <path-to-key> with your local .pem path)"
  value       = "ssh -i <path-to-${var.key_name}.pem> ec2-user@${aws_instance.app.public_ip}"
}

output "app_url" {
  description = "App URL. Takes ~1-2 min after boot for docker compose to finish building/starting"
  value       = "http://${aws_instance.app.public_ip}:${var.app_port}"
}
