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