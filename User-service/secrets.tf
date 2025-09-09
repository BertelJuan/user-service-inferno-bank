resource "aws_secretsmanager_secret" "auth_secrets" {
  name        = "auth-secrets"
  description = "Pepper and JWT secret for auth"
}

resource "aws_secretsmanager_secret_version" "auth_secrets_value" {
  secret_id     = aws_secretsmanager_secret.auth_secrets.id
  secret_string = jsonencode({
    pepper    = "superSecretExtraRandomString"
    jwtSecret = "supersecretjwtkey"
  })
}