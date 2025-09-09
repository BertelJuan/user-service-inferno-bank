variable "region" {
  type    = string
  default = "us-east-1"
}

variable "env" {
  type    = string
  default = "dev"
}

variable "user_table_name" {
  type    = string
  default = "inferno-user-table-dev"
}