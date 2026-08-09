variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "key_name" {
  description = "Name of an existing EC2 key pair (in the target region) to allow SSH access"
  type        = string
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH into the instance. Use your own IP (e.g. 203.0.113.10/32) — do not leave this as 0.0.0.0/0"
  type        = string
}

variable "app_port" {
  description = "Port the app listens on (must match APP_PORT used by docker-compose.yml)"
  type        = number
  default     = 3000
}

variable "repo_url" {
  description = "Git URL the instance clones and deploys via docker compose"
  type        = string
  default     = "https://github.com/arevikazizyan333-lab/resolve-arevik.git"
}

variable "instance_name" {
  description = "Name tag for the EC2 instance"
  type        = string
  default     = "resolve-tickets"
}
