.PHONY: venv test lint
.DEFAULT_GOAL = help
.EXPORT_ALL_VARIABLES:

TF_VAR_environment=${ENVIRONMENT}
TF_VAR_aws_access_key=${AWS_ACCESS_KEY_ID}
TF_VAR_aws_secret_key=${AWS_SECRET_ACCESS_KEY}
TF_VAR_aws_region=${AWS_DEFAULT_REGION}

VENV := .venv
MKFILE_DIR := $(dir $(realpath $(lastword $(MAKEFILE_LIST))))

tf_workspace:
	@cd infra/tf/aws/environment && \
	terraform workspace select -or-create=true $(ENVIRONMENT) 

tf_init:
	@echo "Initializing Terraform infra"
	@rm -rf ./infra/tf/aws/environment/.terraform
	cd infra/tf/aws/environment  && terraform init -input=false -upgrade

tf_setup: tf_init
	@echo "Applying Inital project Terraform infra"
	cd infra/tf/aws/shared && terraform apply

tf_plan:
	@echo "Planning Terraform infra"
	cd infra/tf/aws/environment && terraform plan

tf_apply:
	@echo "Applying Terraform infra"
	cd infra/tf/aws/environment  && terraform apply

tf_apply_no_input:
	@echo "Applying Terraform infra"
	cd infra/tf/aws/environment && terraform apply -auto-approve

tf_destroy:
	@echo "Destroying Terraform infra"
	cd infra/tf/aws/environment  && terraform destroy

tf_refresh: tf_workspace
	@cd infra/tf/aws/environment && terraform refresh

tf_output: tf_workspace
	@cd infra/tf/aws/environment && terraform output -json