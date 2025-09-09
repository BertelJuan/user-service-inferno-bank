output "register_invoke_url" {
  value = "${aws_apigatewayv2_api.http_api.api_endpoint}/${aws_apigatewayv2_stage.dev.name}/register"
}

output "login_invoke_url" {
  value = "${aws_apigatewayv2_api.http_api.api_endpoint}/${aws_apigatewayv2_stage.dev.name}/login"
<<<<<<< HEAD
=======
}

output "update_user_endpoint" {
  description = "Endpoint for updating user profile"
  value = "${aws_apigatewayv2_api.http_api.api_endpoint}/${aws_apigatewayv2_stage.dev.name}/profile/{user_id}"
>>>>>>> e3e7246 (update listo)
}