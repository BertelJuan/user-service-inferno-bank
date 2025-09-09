resource "aws_apigatewayv2_api" "http_api" {
  name          = "inferno-user-api-${var.env}"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "register_integration" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.user_register.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "register_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "POST /register"
  target    = "integrations/${aws_apigatewayv2_integration.register_integration.id}"
}

resource "aws_apigatewayv2_stage" "dev" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = var.env
  auto_deploy = true
}

# Permitir que API Gateway invoque la Lambda
resource "aws_lambda_permission" "apigw_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.user_register.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}