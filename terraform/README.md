# Infra: EC2 + Docker deploy

Provisions a single EC2 instance that installs Docker + the Compose plugin, clones this
repo, and runs `docker compose up -d --build` — the same Postgres + app stack as local
Docker Compose, just on a public instance.

## Prerequisites

- AWS credentials configured (`aws configure`, or `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`
  env vars) with permission to create EC2 instances and security groups.
- An existing EC2 key pair in the target region — Terraform does not create or manage the
  private key. Create one via the AWS console or `aws ec2 create-key-pair`.
- [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.5.

## Usage

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # fill in key_name and allowed_ssh_cidr
terraform init
terraform plan
terraform apply
```

Outputs the instance's public IP, an SSH command, and the app URL. The app takes ~1-2
minutes after boot to finish `docker compose up --build` — retry the app URL if it's not
up yet.

## Cleanup

```bash
terraform destroy
```

## Notes

- The security group opens the app port (default 3000) to the internet, and SSH only to
  `allowed_ssh_cidr` — set that to your own IP (`curl ifconfig.me`), never `0.0.0.0/0`.
- Uses the default DB credentials baked into `docker-compose.yml` (`resolve`/`resolve`/`resolve`)
  — fine for a course demo, not for anything real.
- No TLS or domain — this is a bare HTTP demo endpoint.
- `repo_url` must be reachable by the instance at boot (defaults to this repo's HTTPS
  remote) — if the repo is private, either make it public or change the deploy approach
  (e.g. `scp` the source instead of `git clone` in `user_data.sh.tpl`).
- State is local (`terraform.tfstate`) and gitignored — don't commit it, it can contain
  sensitive data.
