import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const sqs = new SQSClient({});
const client = new DynamoDBClient({});
const secretsClient = new SecretsManagerClient({});
const docClient = DynamoDBDocumentClient.from(client);

const buildResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  },
  body: JSON.stringify(body)
});

let cachedSecret;
async function getSecrets() {
  if (cachedSecret) return cachedSecret;
  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: process.env.SECRET_ID })
  );
  cachedSecret = JSON.parse(response.SecretString);
  return cachedSecret;
}

export const handler = async (event) => {
  console.log("Incoming event:", event);

  let body;
  try {
    body = event.body ? JSON.parse(event.body) : event;
    console.log("Parded body: ", body);

    if (!body.name || !body.lastName || !body.email || !body.password || !body.document) {
      return buildResponse(400, { message: "All fields (name, lastName, email, password, document) are required" });
    }

    //Aqui para revisar si el email ya existe
    const checkEmail = await docClient.send(
      new QueryCommand({
        TableName: process.env.USER_TABLE,
        IndexName: "email-index",
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: { ":email": body.email }
      })
    );

    if (checkEmail.Count > 0) {
      return buildResponse(400, { message: "Email alredy exists" });
    }
    console.log("Step 2: checkEmail result:", checkEmail);

    const { pepper } = await getSecrets();
    const hashedPassword = await bcrypt.hash(body.password + pepper, 10); //Pa hashear la contra
    const userId = crypto.randomUUID(); //Pa generar UUID único

    await docClient.send(new PutCommand({
      TableName: process.env.USER_TABLE,
      Item: {
        uuid: userId,
        name: body.name,
        lastName: body.lastName,
        email: body.email,
        password: hashedPassword,
        document: body.document,
        address: null,
        phone: null,
        image: null
      },
      ConditionExpression: "attribute_not_exists(#uuid)",
      ExpressionAttributeNames: { "#uuid": "uuid" }
    }));

    try {
      //Este es el mesaje para crear la card DEBIT
      await sqs.send(new SendMessageCommand({
        QueueUrl: process.env.CARD_QUEUE_URL,
        MessageBody: JSON.stringify({
          userId: userId,
          request: "DEBIT"
        })
      }));
  
      //Este es el mesaje para crear la card CREDIT
      await sqs.send(new SendMessageCommand({
        QueueUrl: process.env.CARD_QUEUE_URL,
        MessageBody: JSON.stringify({
          userId: userId,
          request: "CREDIT"
        })
      }));

      console.log("Step 5: Card messages sent!");
    } catch (error) {
      console.log("Error sending card messages: ", error);
    }

    try {
      await sqs.send(new SendMessageCommand({
        QueueUrl: process.env.NOTIFICATION_QUEUE_URL,
        MessageBody: JSON.stringify({
          type: "WELCOME",
          email: body.email,
          data: {
            fullName: `${body.name} ${body.lastName}`
          }
        })
      }));
      console.log("Step 6: Welcome message sent!");
    } catch (error) {
      console.error("Error sending notify:", error);
    }


    return buildResponse(201, {
      message: "User created successfully",
      user: {
        uuid: userId,
        name: body.name,
        lastName: body.lastName,
        email: body.email,
        document: body.document
      }
    });

  } catch (err) {
    console.error("register error: ", err);

    return buildResponse(500, { message: "Internal Server Error", error: err.message });
    }
};
