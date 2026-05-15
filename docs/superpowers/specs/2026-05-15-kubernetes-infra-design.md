# Infra Design — Kubernetes Deployment for aipet

**Date:** 2026-05-15

## Overview

Set up an `infra/` folder in the aipet monorepo to build Docker images and deploy all three services to a Kubernetes cluster, using the `aipet_llm_api` infra as a template.

Three services, two deployment targets:

| Service | Type | Deploy target | Domain |
|---------|------|--------------|--------|
| `apps/client` | Static (Webpack/Babylon.js) | S3 + CloudFront | `aipet-v2.jwnwilson.co.uk` |
| `apps/llm-ui` | Static (Vite/React) | S3 + CloudFront | `aipet-admin.jwnwilson.co.uk` |
| `apps/server` | Node.js / Colyseus WebSocket | Docker → ECR → k8s | `aipet-api.jwnwilson.co.uk` |

## Architecture

The two frontend apps are pure static builds — no containers needed. Each gets an S3 bucket (private, OAC-controlled) and a CloudFront distribution with SPA routing (404 → `/index.html`, 200). CI syncs the build output to S3 and invalidates the CloudFront cache on each deploy.

The game server is containerised (Docker multi-stage build) and deployed to the existing k3s cluster via Kubernetes. Traefik handles ingress with TLS termination via cert-manager. WebSocket upgrades work natively with Traefik.

CloudFront distributions use the existing wildcard ACM certificate `*.jwnwilson.co.uk` (already provisioned in `us-east-1`).

## Directory Structure

```
infra/
  setup.sh                          # First-time bootstrap script
  terraform/
    main.tf                         # Wires all modules; calls s3_static twice
    variables.tf                    # aws_region, github_repo, vps_ip, domain vars
    outputs.tf                      # ECR URL, CloudFront domain/distribution IDs, IAM role ARN
    versions.tf
    modules/
      ecr/                          # ECR repo for server image (reused from template)
      iam/                          # GitHub OIDC role: ECR push + S3 deploy + CF invalidation + k8s
      dns/                          # Route53: 2x CloudFront CNAME aliases + 1x VPS A record
      s3_static/                    # S3 bucket + CloudFront + OAC per UI
        main.tf
        variables.tf                # name, domain, acm_certificate_arn
        outputs.tf                  # cloudfront_domain, bucket_name, distribution_id
  k8s/
    deployment.yaml                 # server: 1 replica, ECR image, secrets-backed env vars
    service.yaml                    # ClusterIP, port 80 → 3000
    ingress.yaml                    # Traefik TLS, aipet-api.jwnwilson.co.uk
    hpa.yaml                        # 1–5 replicas, 70% CPU target

apps/server/Dockerfile              # Multi-stage: builder (pnpm build) + runner (node dist/)
```

## Terraform Modules

### `modules/ecr`
Reused directly from the template. Creates one ECR repo (`aipet-server`), a lifecycle policy retaining the last 10 tagged images, and an IAM push policy.

### `modules/iam`
Extends the template's GitHub OIDC module. The GitHub Actions role gains:
- ECR push (server image)
- S3 `PutObject`, `DeleteObject`, `ListBucket` on both UI buckets
- CloudFront `CreateInvalidation` on both distributions
- `kubeconfig` secret for k8s deploy (set manually via setup.sh)

### `modules/dns`
Route53 records:
- `aipet-v2.jwnwilson.co.uk` → CloudFront CNAME (client)
- `aipet-admin.jwnwilson.co.uk` → CloudFront CNAME (llm-ui)
- `aipet-api.jwnwilson.co.uk` → A record pointing to VPS IP (k8s ingress)

### `modules/s3_static` (new)
Per-UI module called twice from `main.tf`:
- Private S3 bucket with versioning enabled
- Origin Access Control (OAC) restricting CloudFront-only access
- CloudFront distribution with:
  - Default root object: `index.html`
  - Custom error response: 404 → `/index.html` (status 200) for SPA routing
  - Wildcard ACM cert (`*.jwnwilson.co.uk`)
  - Price class: `PriceClass_100` (US/EU only — cheapest)
- Bucket policy granting CloudFront OAC read access

## Kubernetes Manifests (server only)

### `deployment.yaml`
- Image: `<ECR_REPOSITORY_URL>:latest` (patched by setup.sh / CI)
- Container port: 3000
- Resources: 200m–1 CPU, 256Mi–512Mi memory
- Liveness/readiness probes: `GET /health` on port 3000, 30s initial delay
- Env vars from `aipet-secrets` k8s Secret:
  - `ANTHROPIC_API_KEY`
  - `AIPET_LLM_URL`

### `service.yaml`
ClusterIP service, port 80 → 3000.

### `ingress.yaml`
Traefik ingress with TLS via cert-manager (`letsencrypt-prod`), host `aipet-api.jwnwilson.co.uk`. No special WebSocket annotations needed — Traefik handles WS upgrades natively.

### `hpa.yaml`
1–5 replicas, scale up at 70% CPU utilisation.

## Dockerfile (apps/server)

Multi-stage build:

```dockerfile
# Stage 1: build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Stage 2: run
FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

Built from the **monorepo root** (not `apps/server/`) so the build context includes both `apps/server/` and `apps/shared/`, which are referenced by the server's `tsconfig.json`. The WORKDIR inside the container is `/app/apps/server`.

## setup.sh

Adapted from the template:
1. `terraform init && terraform apply` — provisions ECR, IAM, S3/CloudFront, DNS
2. Set GitHub Actions secrets: `AWS_ROLE_ARN`, `KUBECONFIG`, `CLIENT_BUCKET`, `CLIENT_CF_DISTRIBUTION_ID`, `LLM_UI_BUCKET`, `LLM_UI_CF_DISTRIBUTION_ID`, `ECR_REPOSITORY_URL`
3. Patch ECR URL into `infra/k8s/deployment.yaml`
4. `kubectl apply -f infra/k8s/`

## CI/CD (GitHub Actions — to be created separately)

Two workflows implied by this infra:

**Server deploy:** build Docker image → push to ECR → `kubectl rollout restart`

**UI deploy:** `pnpm build` → `aws s3 sync dist/ s3://<bucket>` → `aws cloudfront create-invalidation`

Both workflows authenticate via the GitHub OIDC IAM role (no stored AWS keys).

## K8s Secret (manual, one-time)

Before first deploy, create the secret on the cluster:
```bash
kubectl create secret generic aipet-secrets \
  --from-literal=anthropic-api-key=<key> \
  --from-literal=aipet-llm-url=<url>
```

## Out of Scope

- GitHub Actions workflow files (separate task)
- cert-manager / Traefik cluster setup (assumed pre-existing, same as aipet_llm_api)
- ECR credentials secret in k8s (`ecr-credentials`) — assumed pre-existing
