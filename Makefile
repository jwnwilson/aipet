GITHUB_REPO     ?= jwnwilson/aipet
TF_DIR          ?= infra/terraform
AWS_REGION      ?= us-east-1

.PHONY: dev build test aws-env tf-init tf-plan tf-apply tf-destroy tf-deploy help

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

dev: ## Start client + server in dev mode
	pnpm dev

build: ## Build all apps
	pnpm build

test: ## Run all tests
	pnpm test

aws-env: ## Refresh AWS credentials in .env from current AWS profile
	@echo "AWS_ACCESS_KEY_ID=$$(aws configure get aws_access_key_id)" > apps/server/.env.aws
	@echo "AWS_SECRET_ACCESS_KEY=$$(aws configure get aws_secret_access_key)" >> apps/server/.env.aws
	@echo "AWS_SESSION_TOKEN=$$(aws configure get aws_session_token)" >> apps/server/.env.aws
	@echo "AWS_DEFAULT_REGION=$(AWS_REGION)" >> apps/server/.env.aws
	@echo "Written to apps/server/.env.aws"

tf-init: ## Initialise Terraform working directory
	terraform -chdir=$(TF_DIR) init

tf-plan: ## Preview infrastructure changes
	terraform -chdir=$(TF_DIR) plan

tf-apply: ## Apply infrastructure changes
	terraform -chdir=$(TF_DIR) apply

tf-destroy: ## Destroy all infrastructure
	terraform -chdir=$(TF_DIR) destroy

tf-deploy: tf-apply ## Apply infra then push all terraform outputs as GitHub secrets
	gh secret set AWS_ROLE_ARN \
		--repo $(GITHUB_REPO) \
		--body "$$(terraform -chdir=$(TF_DIR) output -raw github_actions_role_arn)" && \
	gh secret set CLIENT_BUCKET \
		--repo $(GITHUB_REPO) \
		--body "$$(terraform -chdir=$(TF_DIR) output -raw client_bucket_name)" && \
	gh secret set CLIENT_CF_DISTRIBUTION_ID \
		--repo $(GITHUB_REPO) \
		--body "$$(terraform -chdir=$(TF_DIR) output -raw client_distribution_id)" && \
	gh secret set LLM_UI_BUCKET \
		--repo $(GITHUB_REPO) \
		--body "$$(terraform -chdir=$(TF_DIR) output -raw llm_ui_bucket_name)" && \
	gh secret set LLM_UI_CF_DISTRIBUTION_ID \
		--repo $(GITHUB_REPO) \
		--body "$$(terraform -chdir=$(TF_DIR) output -raw llm_ui_distribution_id)"
