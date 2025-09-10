output "register_invoke_url" {
  value = "${aws_apigatewayv2_api.http_api.api_endpoint}/${aws_apigatewayv2_stage.dev.name}/register"
}

output "login_invoke_url" {
  value = "${aws_apigatewayv2_api.http_api.api_endpoint}/${aws_apigatewayv2_stage.dev.name}/login"
}

output "update_user_endpoint" {
  description = "Endpoint for updating user profile"
  value = "${aws_apigatewayv2_api.http_api.api_endpoint}/${aws_apigatewayv2_stage.dev.name}/profile/{user_id}"
}

output "upload_avatar_endpoint" {
  value = "${aws_apigatewayv2_api.http_api.api_endpoint}/${aws_apigatewayv2_stage.dev.name}/profile/{user_id}/avatar"
}

output "profile_images_bucket" {
  description = "Nombre unico del bucket de imagenes de perfil"
  value = aws_s3_bucket.profile_images.bucket
}

output "profile_images_bucket_url" {
  description = "URL base publica para acceder a las imagenes"
  value = "https://${aws_s3_bucket.profile_images.bucket}.s3.amazonaws.com"
}



output "get_profile_endpoint" {
  description = "Endpoint to retrieve user profile by ID"
  value = "${aws_apigatewayv2_api.http_api.api_endpoint}/${aws_apigatewayv2_stage.dev.name}/profile/{user_id}"
}