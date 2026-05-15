GITHUB_REPO     ?= jwnwilson/aipet
TF_DIR          ?= infra/terraform
AWS_REGION      ?= us-east-1
ENV_FILE        ?= apps/server/.env

# Load .env before running a command
LOAD_ENV = set -a && . $(ENV_FILE) && set +a &&

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

aws-env: ## Write current AWS session credentials into apps/server/.env
	@grep -v '^AWS_' $(ENV_FILE) > $(ENV_FILE).tmp && mv $(ENV_FILE).tmp $(ENV_FILE) || true
	@aws configure export-credentials --format env-no-export \
		| grep -v '^AWS_CREDENTIAL_EXPIRATION' >> $(ENV_FILE)
	@echo "AWS_DEFAULT_REGION=$(AWS_REGION)" >> $(ENV_FILE)
	@echo "AWS credentials written to $(ENV_FILE)"

tf-init: ## Initialise Terraform working directory
	$(LOAD_ENV) terraform -chdir=$(TF_DIR) init

tf-plan: ## Preview infrastructure changes
	$(LOAD_ENV) terraform -chdir=$(TF_DIR) plan

tf-apply: ## Apply infrastructure changes
	$(LOAD_ENV) terraform -chdir=$(TF_DIR) apply

tf-destroy: ## Destroy all infrastructure
	$(LOAD_ENV) terraform -chdir=$(TF_DIR) destroy

tf-deploy: tf-apply ## Apply infra then push all terraform outputs as GitHub secrets
	$(LOAD_ENV) \
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
