# GitHub Actions OIDC — allows workflows to authenticate to AWS without
# storing long-lived access keys. Scoped to main-branch pushes only.

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
