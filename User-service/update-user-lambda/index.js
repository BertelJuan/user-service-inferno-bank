import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import jwt from "jsonwebtoken";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new DynamoDBClient({});
const sqsClient = new SQSClient({});
const doClient = DynamoDBDocumentClient.from(client);
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

async function getSecrets() {
    const response = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: process.env.SECRET_ID })
    );
    return JSON.parse(response.SecretString);
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
    console.log("Incoming event: ", event);

    try {
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        if(!authHeader || !authHeader.startsWith("Bearer ")) {
            return buildResponse(401, { message: "Missing or invalid Authorization header" });
        }

        const rawToken = authHeader.split(" ")[1];
        const token = rawToken.replace(/^"|"$/g, "");
        const secrets = await getSecrets();

        let decoded;
        try {
            decoded = jwt.verify(token, secrets.jwtSecret);
        } catch (error) {
            return buildResponse(401, { message: "Invalid or expired token" });
        }

        const userId = event.pathParameters?.user_id;
        if (!userId) {
            return buildResponse(400, { message: "User ID is required in path" });
        }

        if (decoded.uuid !== userId) {
            return buildResponse(403, { message: "You are not allowed to update this user" });
        }

        const body = event.body ? JSON.parse(event.body) : {};
        console.log("Parsed body: ", body);

        if (!body.address && !body.phone) {
            return buildResponse(400, { message: "At least one field (address or phone) is required" });
        }

        //Para validar si existe el usuario
        const userCheck = await doClient.send(
            new GetCommand({
                TableName: process.env.USER_TABLE,
                Key: { uuid: userId }
            })
        );

        if (!userCheck.Item) {
            return buildResponse(404, { message: "User not found" });
        }

        const updateExp = [];
        const expAttrNames = {};
        const expAttrValues = {};

        if (body.address) {
            updateExp.push("#address = :address");
            expAttrNames["#address"] = "address";
            expAttrValues[":address"] = body.address;
        }

        if (body.phone) {
            updateExp.push("#phone = :phone");
            expAttrNames["#phone"] = "phone";
            expAttrValues[":phone"] = body.phone;
        }

        const params = {
            TableName: process.env.USER_TABLE,
            Key: { uuid: userId },
            UpdateExpression: "SET " + updateExp.join(", "),
            ExpressionAttributeNames: expAttrNames,
            ExpressionAttributeValues: expAttrValues,
            ReturnValues: "ALL_NEW"
        };

        const result = await doClient.send(new UpdateCommand(params));
        console.log("Update result: ", result);

        const notificationMessage = {
            type: "USER.UPDATE",
            data: {
                userId: result.Attributes.uuid,
                email: result.Attributes.email,
                updatedFields: Object.keys(body),
                timestamp: new Date().toISOString()
            }
        };

        await sqsClient.send(new SendMessageCommand({
            QueueUrl: process.env.NOTIFICATION_QUEUE_URL,
            MessageBody: JSON.stringify(notificationMessage)
        }));

        return buildResponse(200, {
            message: "User updated successfully",
            user: {
                uuid: result.Attributes.uuid,
                name: result.Attributes.name,
                lastName: result.Attributes.lastName,
                email: result.Attributes.email,
                document: result.Attributes.document,
                address: result.Attributes.address,
                phone: result.Attributes.phone,
                image: result.Attributes.image
            }
        });
    } catch (error) {
        console.error("Update user error: ", error);
        return buildResponse(500, { message: "Internal Server Error", error: error.message });
    }
}