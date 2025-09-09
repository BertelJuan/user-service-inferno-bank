import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const sqs = new SQSClient({});
const client =  new DynamoDBClient({});
const secretsClient = new SecretsManagerClient({});
const docClient = DynamoDBDocumentClient.from(client);

let cachedSecret;
async function getSecrets() {
  if (cachedSecret) return cachedSecret;
  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: process.env.SECRET_ID })
  );
  cachedSecret = JSON.parse(response.SecretString);
  return cachedSecret;
}

const buildResponse = (statusCode, body) => ({
    statusCode,
    headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
});

export const handler = async (event) => {
    try {
        const body = event.body ? JSON.parse(event.body) : event;
        console.log("Login attempt for email: ", body.email);

        if (!body.email || !body.password) {
            return buildResponse (400, { message: "Email and password are required" });
        }
        
        const result = await docClient.send(new QueryCommand({
            TableName: process.env.USER_TABLE,
            IndexName: "email-index" ,
            KeyConditionExpression: "email = :email" ,
            ExpressionAttributeValues: { ":email": body.email }
        }));

        if (!result.Items || result.Items.length === 0) {
            return buildResponse(401, { message: "Invalid email or password" });
        }

        const user = result.Items[0];
        const { pepper, jwtSecret } = await getSecrets();
        const isValid = await bcrypt.compare(body.password + pepper, user.password);
        if (!isValid) return buildResponse(401, { message: "Invalid email or password" });
        
        const token = jwt.sign( { uuid: user.uuid, email: user.email }, jwtSecret, { expiresIn: "1h" });

        try {
            await sqs.send(new SendMessageCommand({
                QueueUrl: process.env.NOTIFICATION_QUEUE_URL,
                MessageBody: JSON.stringify({
                    type: "USER.LOGIN",
                    email: user.email,
                    data: {
                        date: new Date().toISOString()
                    }
                })
            }));
            console.log("Login notification sent!");
        } catch (error) {
            console.error("Error sending login notify: ", error)
        }

        return buildResponse(200, {
            message: "Login succesful",
            token,
            user: {
                uuid: user.uuid,
                name: user.name,
                lastName: user.lastName,
                email: user.email
            }
        });
    } catch (err) {
        console.error("Login error: ", err);
        return buildResponse(500, { message: "Internal Server Error", error: err.message });
    }
};