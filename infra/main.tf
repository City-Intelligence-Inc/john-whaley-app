terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

resource "aws_dynamodb_table" "applicants" {
  name         = "john-whaley-applicants"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "applicant_id"

  attribute {
    name = "applicant_id"
    type = "S"
  }

  attribute {
    name = "session_id"
    type = "S"
  }

  global_secondary_index {
    name            = "session-index"
    hash_key        = "session_id"
    projection_type = "ALL"
  }

  tags = {
    Project = "john-whaley-app"
  }
}

resource "aws_dynamodb_table" "sessions" {
  name         = "john-whaley-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "session_id"

  attribute {
    name = "session_id"
    type = "S"
  }

  tags = {
    Project = "john-whaley-app"
  }
}

resource "aws_dynamodb_table" "settings" {
  name         = "john-whaley-settings"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "setting_id"

  attribute {
    name = "setting_id"
    type = "S"
  }

  tags = {
    Project = "john-whaley-app"
  }
}

# --- ECR ---

resource "aws_ecr_repository" "backend" {
  name         = "john-whaley-backend"
  force_delete = true

  tags = {
    Project = "john-whaley-app"
  }
}

# --- IAM: App Runner ECR access role ---

resource "aws_iam_role" "apprunner_ecr_access" {
  name = "john-whaley-apprunner-ecr-access"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "build.apprunner.amazonaws.com"
      }
    }]
  })

  tags = {
    Project = "john-whaley-app"
  }
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr_access" {
  role       = aws_iam_role.apprunner_ecr_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# --- IAM: App Runner instance role (DynamoDB access) ---

resource "aws_iam_role" "apprunner_instance" {
  name = "john-whaley-apprunner-instance"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "tasks.apprunner.amazonaws.com"
      }
    }]
  })

  tags = {
    Project = "john-whaley-app"
  }
}

resource "aws_iam_policy" "dynamodb_access" {
  name = "john-whaley-dynamodb-access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:Scan",
        "dynamodb:Query"
      ]
      Effect   = "Allow"
      Resource = [
        aws_dynamodb_table.applicants.arn,
        "${aws_dynamodb_table.applicants.arn}/index/*",
        aws_dynamodb_table.settings.arn,
        aws_dynamodb_table.sessions.arn,
      ]
    }]
  })

  tags = {
    Project = "john-whaley-app"
  }
}

resource "aws_iam_role_policy_attachment" "apprunner_dynamodb" {
  role       = aws_iam_role.apprunner_instance.name
  policy_arn = aws_iam_policy.dynamodb_access.arn
}

# --- App Runner ---

resource "aws_apprunner_service" "backend" {
  service_name = "john-whaley-backend"

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_ecr_access.arn
    }

    image_repository {
      image_identifier      = "${aws_ecr_repository.backend.repository_url}:latest"
      image_repository_type = "ECR"

      image_configuration {
        port = "8000"
      }
    }

    auto_deployments_enabled = false
  }

  instance_configuration {
    cpu               = "1024"
    memory            = "2048"
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  tags = {
    Project = "john-whaley-app"
  }
}

# --- Outputs ---

output "ecr_repository_url" {
  value = aws_ecr_repository.backend.repository_url
}

output "apprunner_service_url" {
  value = "https://${aws_apprunner_service.backend.service_url}"
}
