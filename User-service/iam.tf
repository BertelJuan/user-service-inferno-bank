resource "aws_iam_role" "lambda_exec" {
  name = "lambda-exec-role"
  force_detach_policies = true

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_dynamodb" {
  name = "lambda-dynamodb-write"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
        {
          Effect = "Allow",
          Action = [
            "dynamodb:PutItem",
            "dynamodb:GetItem",
            "dynamodb:UpdateItem",
            "dynamodb:Scan",
            "dynamodb:Query"
        ],
        Resource = [
            aws_dynamodb_table.user_table.arn,
            "${aws_dynamodb_table.user_table.arn}/index/*"
            ]
        }
        ]
    })
}

resource "aws_iam_role_policy_attachment" "lambda_kms_access" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/AWSKeyManagementServicePowerUser"
}

resource "aws_iam_role_policy" "lambda_sqs_access" {
  name = "lambda-sqs-write"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17",
    
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "sqs:SendMessage"
          ],
        Resource = [
          aws_sqs_queue.create_request_card_sqs.arn,
          aws_sqs_queue.notification_queue.arn,
          "arn:aws:sqs:us-east-1:683104418449:inferno-bank-dev-notification-email-sqs"          
        ]
      }
    ]
  })
}

data "aws_caller_identity" "current" {}
resource "aws_s3_bucket" "profile_images" {
  bucket = "profile-images-${var.env}-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "public_access" {
  bucket = aws_s3_bucket.profile_images.id
  block_public_acls = false
  block_public_policy = false
  ignore_public_acls = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "allow_public_read" {
  bucket = aws_s3_bucket.profile_images.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = "*"
      Action = ["s3:GetObject"]
      Resource = "${aws_s3_bucket.profile_images.arn}/*"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_s3_access" {
  role = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

resource "aws_iam_role_policy" "lambda_secretsmanager_access" {
  name = "lambda-secretsmanager-access"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "secretsmanager:GetSecretValue"
        ],
        Resource = [
          aws_secretsmanager_secret.auth_secrets.arn
        ]
      }
    ]
  })
}