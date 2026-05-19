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
echo "  kubectl create secret generic aipet-server-secrets \\"
echo "    --from-literal=anthropic-api-key=<key> \\"
echo "    --from-literal=aipet-llm-url=<url> \\"
echo "    --from-literal=auth0-domain=<domain> \\"
echo "    --from-literal=auth0-m2m-client-id=<client-id> \\"
echo "    --from-literal=auth0-m2m-client-secret=<client-secret> \\"
echo "    --from-literal=auth0-m2m-audience=<audience>"
