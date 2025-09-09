resource "aws_sqs_queue" "create_request_card_sqs" {
  name = "create-request-card-sqs"
  visibility_timeout_seconds = 30
  message_retention_seconds = 86400
}

resource "aws_sqs_queue" "notification_queue" {
  name = "notification_queue"
}