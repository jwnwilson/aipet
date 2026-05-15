# Kubernetes Infra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `infra/` in the aipet monorepo to build Docker images and deploy all three services (game client → S3/CloudFront, llm-ui → S3/CloudFront, game server → k8s) using the `aipet_llm_api` infra as a template.

**Architecture:** Two static frontends are deployed to S3+CloudFront (no containers). The game server is containerised via a multi-stage Docker build, pushed to ECR, and run on k3s. Terraform provisions AWS resources (ECR, IAM OIDC role, two S3/CloudFront stacks, Route53 DNS). K8s manifests cover only the server.

**Tech Stack:** Terraform ≥1.5, AWS provider ~5.0, Docker (node:18-alpine), kubectl, Traefik + cert-manager (pre-existing on cluster), pnpm workspaces, TypeScript.

---

## File Map

**New files (all):**

| File | Responsibility |
|------|---------------|
| `apps/server/Dockerfile` | Multi-stage build: compile TS → run Node |
| `infra/setup.sh` | First-time bootstrap: Terraform + GitHub secrets + k8s apply |
| `infra/terraform/versions.tf` | Required Terraform/provider version constraints |
| `infra/terraform/variables.tf` | Input variables for the root module |
| `infra/terraform/outputs.tf` | Outputs: ECR URL, bucket names, distribution IDs, role ARN |
| `infra/terraform/main.tf` | Wires ECR, IAM, two s3_static, DNS modules together |
| `infra/terraform/modules/ecr/main.tf` | ECR repository + lifecycle policy + push IAM policy |
| `infra/terraform/modules/ecr/variables.tf` | `repo_name`, `image_retention_count` |
| `infra/terraform/modules/ecr/outputs.tf` | `repository_url`, `repository_arn`, `ecr_push_policy_arn` |
| `infra/terraform/modules/iam/main.tf` | GitHub OIDC provider + role + ECR/S3/CloudFront policies |
| `infra/terraform/modules/iam/variables.tf` | `repo_name`, `github_repo`, `ecr_push_policy_arn`, bucket/distribution ARNs |
| `infra/terraform/modules/iam/outputs.tf` | `github_actions_role_arn` |
| `infra/terraform/modules/s3_static/main.tf` | S3 bucket + OAC + CloudFront distribution + bucket policy |
| `infra/terraform/modules/s3_static/variables.tf` | `name`, `domain`, `acm_certificate_arn` |
| `infra/terraform/modules/s3_static/outputs.tf` | `bucket_name`, `bucket_arn`, `cloudfront_domain`, `distribution_id`, `distribution_arn` |
| `infra/terraform/modules/dns/main.tf` | Route53: 2× CloudFront CNAME + 1× VPS A record |
| `infra/terraform/modules/dns/variables.tf` | `zone_name`, `vps_ip`, `client_cf_domain`, `llm_ui_cf_domain` |
| `infra/terraform/modules/dns/outputs.tf` | `client_fqdn`, `llm_ui_fqdn`, `server_fqdn` |
| `infra/k8s/deployment.yaml` | Server Deployment: ECR image, secrets env vars, probes |
| `infra/k8s/service.yaml` | ClusterIP service port 80 → 3000 |
| `infra/k8s/ingress.yaml` | Traefik TLS ingress for aipet-api.jwnwilson.co.uk |
| `infra/k8s/hpa.yaml` | HorizontalPodAutoscaler 1–5 replicas at 70% CPU |

---

## Task 1: Scaffold directory structure

**Files:** Create all directories.

- [ ] **Step 1: Create directories**

```bash
mkdir -p infra/terraform/modules/ecr
mkdir -p infra/terraform/modules/iam
mkdir -p infra/terraform/modules/s3_static
mkdir -p infra/terraform/modules/dns
mkdir -p infra/k8s
```

- [ ] **Step 2: Verify**

```bash
find infra -type d | sort
```

Expected output:
```
infra
infra/k8s
infra/terraform
infra/terraform/modules
infra/terraform/modules/dns
infra/terraform/modules/ecr
infra/terraform/modules/iam
infra/terraform/modules/s3_static
```

- [ ] **Step 3: Commit**

```bash
git add infra/
git commit -m "chore(infra): scaffold directory structure"
```

---

## Task 2: Server Dockerfile

**Files:**
- Create: `apps/server/Dockerfile`

The server's `tsconfig.json` has `rootDir: ".."` (i.e. `apps/`) and `outDir: "./dist/server"`, so the compiled entry point lands at `apps/server/dist/server/server/src/index.js`. The build context must be the monorepo root to include `apps/shared/`.

- [ ] **Step 1: Create `apps/server/Dockerfile`**

```dockerfile
# Build context: monorepo root
# docker build -f apps/server/Dockerfile .
FROM node:18-alpine AS builder
WORKDIR /app

RUN corepack enable

# Copy workspace descriptors first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/

# Install server dependencies
RUN pnpm install --filter server --frozen-lockfile

# Copy source files needed by tsc (shared is referenced via relative path)
COPY apps/server ./apps/server
COPY apps/shared ./apps/shared

WORKDIR /app/apps/server
RUN pnpm build

FROM node:18-alpine AS runner
WORKDIR /app/apps/server

# Copy compiled output (rootDir=.. means output is under dist/server/server/src/)
COPY --from=builder /app/apps/server/dist/server ./dist/server
# pnpm hoists packages to root node_modules
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/server/node_modules ./node_modules

EXPOSE 3000
CMD ["node", "dist/server/server/src/index.js"]
```

- [ ] **Step 2: Build and test the image from monorepo root**

```bash
docker build -f apps/server/Dockerfile -t aipet-server:local .
```

Expected: build succeeds, image created. If tsc fails because of the `public/` copy in the build script (which doesn't exist), that's fine — it's a warning, not an error.

- [ ] **Step 3: Verify the container starts**

```bash
docker run --rm -e ANTHROPIC_API_KEY=test -e AIPET_LLM_URL=http://localhost:8000 -p 3000:3000 aipet-server:local
```

Expected: server logs `[gameserver] listening on http://localhost:3000` (it will fail to connect to DB/LLM, which is fine — we only need to confirm the binary starts and the entry point path is correct). Stop with Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add apps/server/Dockerfile
git commit -m "feat(infra): add multi-stage Dockerfile for game server"
```

---

## Task 3: ECR Terraform module

**Files:**
- Create: `infra/terraform/modules/ecr/main.tf`
- Create: `infra/terraform/modules/ecr/variables.tf`
- Create: `infra/terraform/modules/ecr/outputs.tf`

Copied directly from `aipet_llm_api/infra/terraform/modules/ecr/` — no changes needed.

- [ ] **Step 1: Create `infra/terraform/modules/ecr/variables.tf`**

```hcl
variable "repo_name" {
  description = "ECR repository name"
  type        = string
}

variable "image_retention_count" {
  description = "Number of tagged images to retain before expiring older ones"
  type        = number
  default     = 10
}
```

- [ ] **Step 2: Create `infra/terraform/modules/ecr/main.tf`**

```hcl
resource "aws_ecr_repository" "this" {
  name                 = var.repo_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "this" {
  repository = aws_ecr_repository.this.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Retain last ${var.image_retention_count} tagged images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = var.image_retention_count
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Expire untagged images older than 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = { type = "expire" }
      }
    ]
  })
}

data "aws_iam_policy_document" "ecr_push" {
  statement {
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [aws_ecr_repository.this.arn]
  }
}

resource "aws_iam_policy" "ecr_push" {
  name   = "${var.repo_name}-ecr-push"
  policy = data.aws_iam_policy_document.ecr_push.json
}
```

- [ ] **Step 3: Create `infra/terraform/modules/ecr/outputs.tf`**

```hcl
output "repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.this.repository_url
}

output "repository_arn" {
  description = "ECR repository ARN"
  value       = aws_ecr_repository.this.arn
}

output "ecr_push_policy_arn" {
  description = "IAM policy ARN granting ECR push"
  value       = aws_iam_policy.ecr_push.arn
}
```

- [ ] **Step 4: Check HCL syntax**

```bash
terraform fmt -check infra/terraform/modules/ecr/
```

Expected: no output (all files already formatted). If files need formatting, run `terraform fmt infra/terraform/modules/ecr/` and re-check.

- [ ] **Step 5: Commit**

```bash
git add infra/terraform/modules/ecr/
git commit -m "feat(infra): add ECR Terraform module"
```

---

## Task 4: IAM Terraform module

**Files:**
- Create: `infra/terraform/modules/iam/variables.tf`
- Create: `infra/terraform/modules/iam/main.tf`
- Create: `infra/terraform/modules/iam/outputs.tf`

Adapted from the template: removes the S3 model-read policy (not needed), adds S3 UI deploy + CloudFront invalidation permissions.

- [ ] **Step 1: Create `infra/terraform/modules/iam/variables.tf`**

```hcl
variable "repo_name" {
  description = "Project name — used to prefix IAM resource names"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository in owner/name format — scopes the OIDC trust to main-branch pushes"
  type        = string
}

variable "ecr_push_policy_arn" {
  description = "ARN of the ECR push IAM policy — attached to the GitHub Actions role"
  type        = string
}

variable "client_bucket_arn" {
  description = "ARN of the game client S3 bucket"
  type        = string
}

variable "llm_ui_bucket_arn" {
  description = "ARN of the llm-ui S3 bucket"
  type        = string
}

variable "client_distribution_arn" {
  description = "ARN of the game client CloudFront distribution"
  type        = string
}

variable "llm_ui_distribution_arn" {
  description = "ARN of the llm-ui CloudFront distribution"
  type        = string
}
```

- [ ] **Step 2: Create `infra/terraform/modules/iam/main.tf`**

```hcl
# GitHub Actions OIDC — allows workflows to authenticate to AWS without
# storing long-lived access keys. Scoped to main-branch pushes and PRs.

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]
}

data "aws_iam_policy_document" "github_actions_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_repo}:ref:refs/heads/main",
        "repo:${var.github_repo}:pull_request",
      ]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "${var.repo_name}-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume.json
}

resource "aws_iam_role_policy_attachment" "ecr_push" {
  role       = aws_iam_role.github_actions.name
  policy_arn = var.ecr_push_policy_arn
}

data "aws_iam_policy_document" "ui_deploy" {
  statement {
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [var.client_bucket_arn, var.llm_ui_bucket_arn]
  }

  statement {
    effect    = "Allow"
    actions   = ["s3:PutObject", "s3:DeleteObject"]
    resources = ["${var.client_bucket_arn}/*", "${var.llm_ui_bucket_arn}/*"]
  }

  statement {
    effect    = "Allow"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [var.client_distribution_arn, var.llm_ui_distribution_arn]
  }
}

resource "aws_iam_policy" "ui_deploy" {
  name   = "${var.repo_name}-ui-deploy"
  policy = data.aws_iam_policy_document.ui_deploy.json
}

resource "aws_iam_role_policy_attachment" "ui_deploy" {
  role       = aws_iam_role.github_actions.name
  policy_arn = aws_iam_policy.ui_deploy.arn
}
```

- [ ] **Step 3: Create `infra/terraform/modules/iam/outputs.tf`**

```hcl
output "github_actions_role_arn" {
  description = "IAM role ARN for GitHub Actions OIDC"
  value       = aws_iam_role.github_actions.arn
}
```

- [ ] **Step 4: Check HCL syntax**

```bash
terraform fmt -check infra/terraform/modules/iam/
```

Expected: no output. Run `terraform fmt infra/terraform/modules/iam/` to fix if needed.

- [ ] **Step 5: Commit**

```bash
git add infra/terraform/modules/iam/
git commit -m "feat(infra): add IAM Terraform module with OIDC + S3/CF deploy permissions"
```

---

## Task 5: S3 static Terraform module

**Files:**
- Create: `infra/terraform/modules/s3_static/variables.tf`
- Create: `infra/terraform/modules/s3_static/main.tf`
- Create: `infra/terraform/modules/s3_static/outputs.tf`

New module — called twice from root (once per UI). Uses CloudFront OAC (Origin Access Control) which is the current AWS best practice over OAI.

- [ ] **Step 1: Create `infra/terraform/modules/s3_static/variables.tf`**

```hcl
variable "name" {
  description = "Short name for this static site — used as the S3 bucket name and in resource names"
  type        = string
}

variable "domain" {
  description = "Full domain name served by this CloudFront distribution (e.g. aipet-v2.jwnwilson.co.uk)"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate in us-east-1 covering this domain (e.g. wildcard *.jwnwilson.co.uk)"
  type        = string
}
```

- [ ] **Step 2: Create `infra/terraform/modules/s3_static/main.tf`**

```hcl
resource "aws_s3_bucket" "this" {
  bucket = var.name
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "this" {
  name                              = var.name
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  default_root_object = "index.html"
  aliases             = [var.domain]

  origin {
    domain_name              = aws_s3_bucket.this.bucket_regional_domain_name
    origin_id                = "s3-${var.name}"
    origin_access_control_id = aws_cloudfront_origin_access_control.this.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-${var.name}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  # SPA routing: 404s from S3 served as index.html so React Router works
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  price_class = "PriceClass_100"
}

data "aws_iam_policy_document" "cf_oac" {
  statement {
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.this.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.this.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "this" {
  bucket = aws_s3_bucket.this.id
  policy = data.aws_iam_policy_document.cf_oac.json
}
```

- [ ] **Step 3: Create `infra/terraform/modules/s3_static/outputs.tf`**

```hcl
output "bucket_name" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.this.id
}

output "bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.this.arn
}

output "cloudfront_domain" {
  description = "CloudFront distribution domain name (for DNS CNAME)"
  value       = aws_cloudfront_distribution.this.domain_name
}

output "distribution_id" {
  description = "CloudFront distribution ID (for cache invalidation in CI)"
  value       = aws_cloudfront_distribution.this.id
}

output "distribution_arn" {
  description = "CloudFront distribution ARN (for IAM policy)"
  value       = aws_cloudfront_distribution.this.arn
}
```

- [ ] **Step 4: Check HCL syntax**

```bash
terraform fmt -check infra/terraform/modules/s3_static/
```

Expected: no output. Run `terraform fmt infra/terraform/modules/s3_static/` to fix if needed.

- [ ] **Step 5: Commit**

```bash
git add infra/terraform/modules/s3_static/
git commit -m "feat(infra): add s3_static Terraform module for SPA hosting"
```

---

## Task 6: DNS Terraform module

**Files:**
- Create: `infra/terraform/modules/dns/variables.tf`
- Create: `infra/terraform/modules/dns/main.tf`
- Create: `infra/terraform/modules/dns/outputs.tf`

Adapted from the template: adds two CloudFront CNAME records (client + llm-ui) alongside the existing VPS A record for the server.

- [ ] **Step 1: Create `infra/terraform/modules/dns/variables.tf`**

```hcl
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
```

- [ ] **Step 2: Create `infra/terraform/modules/dns/main.tf`**

```hcl
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
```

- [ ] **Step 3: Create `infra/terraform/modules/dns/outputs.tf`**

```hcl
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
```

- [ ] **Step 4: Check HCL syntax**

```bash
terraform fmt -check infra/terraform/modules/dns/
```

Expected: no output. Run `terraform fmt infra/terraform/modules/dns/` to fix if needed.

- [ ] **Step 5: Commit**

```bash
git add infra/terraform/modules/dns/
git commit -m "feat(infra): add DNS Terraform module for three services"
```

---

## Task 7: Terraform root

**Files:**
- Create: `infra/terraform/versions.tf`
- Create: `infra/terraform/variables.tf`
- Create: `infra/terraform/main.tf`
- Create: `infra/terraform/outputs.tf`

- [ ] **Step 1: Create `infra/terraform/versions.tf`**

```hcl
terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
```

- [ ] **Step 2: Create `infra/terraform/variables.tf`**

```hcl
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
```

- [ ] **Step 3: Create `infra/terraform/main.tf`**

```hcl
provider "aws" {
  region = var.aws_region
}

module "ecr" {
  source                = "./modules/ecr"
  repo_name             = "${var.repo_name}-server"
  image_retention_count = var.image_retention_count
}

module "s3_client" {
  source              = "./modules/s3_static"
  name                = "${var.repo_name}-client"
  domain              = "aipet-v2.jwnwilson.co.uk"
  acm_certificate_arn = var.acm_certificate_arn
}

module "s3_llm_ui" {
  source              = "./modules/s3_static"
  name                = "${var.repo_name}-llm-ui"
  domain              = "aipet-admin.jwnwilson.co.uk"
  acm_certificate_arn = var.acm_certificate_arn
}

module "iam" {
  source                  = "./modules/iam"
  repo_name               = var.repo_name
  github_repo             = var.github_repo
  ecr_push_policy_arn     = module.ecr.ecr_push_policy_arn
  client_bucket_arn       = module.s3_client.bucket_arn
  llm_ui_bucket_arn       = module.s3_llm_ui.bucket_arn
  client_distribution_arn = module.s3_client.distribution_arn
  llm_ui_distribution_arn = module.s3_llm_ui.distribution_arn
}

module "dns" {
  source           = "./modules/dns"
  vps_ip           = var.vps_ip
  client_cf_domain = module.s3_client.cloudfront_domain
  llm_ui_cf_domain = module.s3_llm_ui.cloudfront_domain
}
```

- [ ] **Step 4: Create `infra/terraform/outputs.tf`**

```hcl
output "ecr_repository_url" {
  description = "ECR URL — patch into infra/k8s/deployment.yaml and set as ECR_REPOSITORY_URL GitHub secret"
  value       = module.ecr.repository_url
}

output "github_actions_role_arn" {
  description = "IAM role ARN — set as AWS_ROLE_ARN GitHub secret"
  value       = module.iam.github_actions_role_arn
}

output "client_bucket_name" {
  description = "S3 bucket for game client — set as CLIENT_BUCKET GitHub secret"
  value       = module.s3_client.bucket_name
}

output "client_distribution_id" {
  description = "CloudFront distribution ID for game client — set as CLIENT_CF_DISTRIBUTION_ID GitHub secret"
  value       = module.s3_client.distribution_id
}

output "llm_ui_bucket_name" {
  description = "S3 bucket for llm-ui — set as LLM_UI_BUCKET GitHub secret"
  value       = module.s3_llm_ui.bucket_name
}

output "llm_ui_distribution_id" {
  description = "CloudFront distribution ID for llm-ui — set as LLM_UI_CF_DISTRIBUTION_ID GitHub secret"
  value       = module.s3_llm_ui.distribution_id
}

output "client_fqdn" {
  value = module.dns.client_fqdn
}

output "llm_ui_fqdn" {
  value = module.dns.llm_ui_fqdn
}

output "server_fqdn" {
  value = module.dns.server_fqdn
}
```

- [ ] **Step 5: Initialise and validate the full root module**

```bash
cd infra/terraform && terraform init -backend=false && terraform validate
```

Expected: Terraform downloads the AWS provider, then prints `Success! The configuration is valid.` This is the first full validate — all four modules are wired together here so cross-module type errors are caught.

- [ ] **Step 6: Commit**

```bash
git add infra/terraform/
git commit -m "feat(infra): add Terraform root module wiring ECR, IAM, S3, DNS"
```

---

## Task 8: Kubernetes manifests

**Files:**
- Create: `infra/k8s/deployment.yaml`
- Create: `infra/k8s/service.yaml`
- Create: `infra/k8s/ingress.yaml`
- Create: `infra/k8s/hpa.yaml`

- [ ] **Step 1: Create `infra/k8s/deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aipet-server
  labels:
    app: aipet-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: aipet-server
  template:
    metadata:
      labels:
        app: aipet-server
    spec:
      imagePullSecrets:
        - name: ecr-credentials
      containers:
        - name: aipet-server
          # Replace with: terraform -chdir=infra/terraform output -raw ecr_repository_url
          image: <ECR_REPOSITORY_URL>:latest
          ports:
            - containerPort: 3000
          env:
            - name: ANTHROPIC_API_KEY
              valueFrom:
                secretKeyRef:
                  name: aipet-secrets
                  key: anthropic-api-key
            - name: AIPET_LLM_URL
              valueFrom:
                secretKeyRef:
                  name: aipet-secrets
                  key: aipet-llm-url
          resources:
            requests:
              cpu: "200m"
              memory: "256Mi"
            limits:
              cpu: "1"
              memory: "512Mi"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 30
            timeoutSeconds: 5
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 10
            timeoutSeconds: 5
```

- [ ] **Step 2: Add a `/health` endpoint to the server**

The liveness/readiness probes above require a `GET /health` endpoint. Check if one exists:

```bash
grep -rn "health\|/health" apps/server/src/api.ts apps/server/src/index.ts 2>/dev/null | head -10
```

If no `/health` route exists, add it to `apps/server/src/api.ts` (or wherever Express routes are defined). Find the router setup:

```bash
grep -n "router\|app\.\(get\|post\|use\)" apps/server/src/api.ts | head -20
```

Add the health route alongside existing routes:

```typescript
router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
```

- [ ] **Step 3: Create `infra/k8s/service.yaml`**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: aipet-server
spec:
  selector:
    app: aipet-server
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: ClusterIP
```

- [ ] **Step 4: Create `infra/k8s/ingress.yaml`**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: aipet-server
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
    - hosts:
        - aipet-api.jwnwilson.co.uk
      secretName: aipet-server-tls
  rules:
    - host: "aipet-api.jwnwilson.co.uk"
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: aipet-server
                port:
                  number: 80
```

- [ ] **Step 5: Create `infra/k8s/hpa.yaml`**

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: aipet-server
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: aipet-server
  minReplicas: 1
  maxReplicas: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

- [ ] **Step 6: Validate manifests (dry run)**

```bash
kubectl apply --dry-run=client -f infra/k8s/
```

Expected: each manifest prints `configured (dry run)` with no errors. If kubectl is not configured against the cluster, use:

```bash
kubectl apply --dry-run=client --validate=false -f infra/k8s/
```

- [ ] **Step 7: Commit**

```bash
git add infra/k8s/ apps/server/src/api.ts
git commit -m "feat(infra): add k8s manifests for game server + health endpoint"
```

---

## Task 9: setup.sh

**Files:**
- Create: `infra/setup.sh`

Adapted from the template to handle three services: patches ECR URL into the deployment manifest, sets six GitHub secrets (role ARN + four S3/CF IDs + KUBECONFIG).

- [ ] **Step 1: Create `infra/setup.sh`**

```bash
#!/usr/bin/env bash
# First-time CI/CD bootstrap for aipet.
# Run from the repo root: bash infra/setup.sh <github_repo> <acm_certificate_arn>
# Example: bash infra/setup.sh jwnwilson/aipet arn:aws:acm:us-east-1:123456789:certificate/abc
#
# Prerequisites:
#   - AWS CLI configured (aws configure or AWS_* env vars)
#   - GitHub CLI authenticated (gh auth login)
#   - Terraform >= 1.5 installed
#   - kubectl configured against your k3s cluster

set -euo pipefail

GITHUB_REPO="${1:?Usage: $0 <owner/repo> <acm_certificate_arn>}"
ACM_CERT_ARN="${2:?Usage: $0 <owner/repo> <acm_certificate_arn>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/terraform"
K8S_DIR="$SCRIPT_DIR/k8s"

echo "=== 1. Provision AWS resources ==="
cd "$TERRAFORM_DIR"
terraform init -input=false
terraform apply -input=false -auto-approve \
  -var="github_repo=$GITHUB_REPO" \
  -var="acm_certificate_arn=$ACM_CERT_ARN"

ROLE_ARN=$(terraform output -raw github_actions_role_arn)
ECR_URL=$(terraform output -raw ecr_repository_url)
CLIENT_BUCKET=$(terraform output -raw client_bucket_name)
CLIENT_CF_ID=$(terraform output -raw client_distribution_id)
LLM_UI_BUCKET=$(terraform output -raw llm_ui_bucket_name)
LLM_UI_CF_ID=$(terraform output -raw llm_ui_distribution_id)

echo "=== 2. Set GitHub Actions secrets ==="
gh secret set AWS_ROLE_ARN              --repo "$GITHUB_REPO" --body "$ROLE_ARN"
gh secret set ECR_REPOSITORY_URL        --repo "$GITHUB_REPO" --body "$ECR_URL"
gh secret set CLIENT_BUCKET             --repo "$GITHUB_REPO" --body "$CLIENT_BUCKET"
gh secret set CLIENT_CF_DISTRIBUTION_ID --repo "$GITHUB_REPO" --body "$CLIENT_CF_ID"
gh secret set LLM_UI_BUCKET             --repo "$GITHUB_REPO" --body "$LLM_UI_BUCKET"
gh secret set LLM_UI_CF_DISTRIBUTION_ID --repo "$GITHUB_REPO" --body "$LLM_UI_CF_ID"
gh secret set KUBECONFIG                --repo "$GITHUB_REPO" --body "$(kubectl config view --raw | base64)"

echo "=== 3. Patch ECR URL into k8s deployment manifest ==="
cd "$K8S_DIR"
sed -i.bak "s|<ECR_REPOSITORY_URL>|$ECR_URL|g" deployment.yaml
rm -f deployment.yaml.bak

echo "=== 4. Apply k8s manifests ==="
kubectl apply -f "$K8S_DIR/"

echo ""
echo "Done."
echo "  ECR URL         : $ECR_URL"
echo "  IAM role ARN    : $ROLE_ARN"
echo "  Client bucket   : $CLIENT_BUCKET  (CF: $CLIENT_CF_ID)"
echo "  LLM-UI bucket   : $LLM_UI_BUCKET  (CF: $LLM_UI_CF_ID)"
echo ""
echo "One-time cluster step — create the k8s secret before deploying:"
echo "  kubectl create secret generic aipet-secrets \\"
echo "    --from-literal=anthropic-api-key=<key> \\"
echo "    --from-literal=aipet-llm-url=<url>"
```

- [ ] **Step 2: Make executable**

```bash
chmod +x infra/setup.sh
```

- [ ] **Step 3: Smoke-test the script syntax**

```bash
bash -n infra/setup.sh
```

Expected: no output (no syntax errors).

- [ ] **Step 4: Commit**

```bash
git add infra/setup.sh
git commit -m "feat(infra): add setup.sh bootstrap script for three-service deployment"
```

---

## Self-review notes

- All Terraform `validate` steps use `-backend=false` so they work without AWS credentials.
- The Dockerfile entry point (`dist/server/server/src/index.js`) is derived from `tsconfig.json` `rootDir: ".."` + `outDir: "./dist/server"`. If tsc output path differs on the first build, adjust `CMD` accordingly.
- The `ecr-credentials` imagePullSecret in deployment.yaml is assumed pre-existing on the cluster (same pattern as `aipet_llm_api`).
- GitHub Actions workflow files (for CI/CD automation) are out of scope — this plan covers only the infra scaffolding.
