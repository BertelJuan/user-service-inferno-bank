resource "aws_lambda_function" "user_register" {
  function_name = "user-register"
  role = aws_iam_role.lambda_exec.arn
  handler = "index.handler"
  runtime = "nodejs22.x"

  filename = "${path.module}/register-user-lambda/user-register.zip"
  source_code_hash = filebase64sha256("${path.module}/register-user-lambda/user-register.zip")

  depends_on = [ aws_dynamodb_table.user_table ]

  environment {
    variables = {
      USER_TABLE = aws_dynamodb_table.user_table.name
      CARD_QUEUE_URL = aws_sqs_queue.create_request_card_sqs.url
      NOTIFICATION_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/683104418449/inferno-bank-dev-notification-email-sqs"
      SECRET_ID = aws_secretsmanager_secret.auth_secrets.id
    }
  }
  timeout = 10
}

resource "aws_lambda_function" "login_user" {
  function_name = "login-user-lambda"
  role = aws_iam_role.lambda_exec.arn
  handler = "index.handler"
  runtime = "nodejs20.x"

  filename = "${path.module}/login-user-lambda/login-user.zip"
  source_code_hash = filebase64sha256("${path.module}/login-user-lambda/login-user.zip")

  environment {
    variables = {
      USER_TABLE = aws_dynamodb_table.user_table.name
      SECRET_ID = aws_secretsmanager_secret.auth_secrets.id
      NOTIFICATION_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/683104418449/inferno-bank-dev-notification-email-sqs"
    }
  }
  timeout = 10
}