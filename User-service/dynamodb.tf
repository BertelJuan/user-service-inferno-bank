resource "aws_dynamodb_table" "user_table" {
    name  = "inferno_user_table"
    billing_mode = "PAY_PER_REQUEST"
    hash_key = "uuid"

    attribute {
      name = "uuid"
      type = "S"
    }
    attribute {
      name = "email"
      type = "S"
    }

    global_secondary_index {
      name = "email-index"
      hash_key = "email"
      projection_type = "ALL"
    }

    tags = {
      Project = "inferno-bank"
      Service = "user-service"
      Env = var.env
    }
}