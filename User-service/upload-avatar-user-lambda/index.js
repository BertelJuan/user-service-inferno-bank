import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const s3 = new S3Client({ region: process.env.APP_REGION || "us-east-1" });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
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
        "Content-Type" : "application/json",
        "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
});

function mimeToExt(mime) {
    if (!mime) return "jpg";
    if (mime.includes("jpeg")) return "jpg";
    if (mime.includes("png")) return "png";
    if (mime.includes("gif")) return "gif";
    return "jpg";
}

export const handler = async (event) => {
    console.log("Incoming event: ", event);

    try {
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return buildResponse(401, { message: "Missing or invalid Authorization header" });
        }

        const rawToken = authHeader.split(" ")[1];
        const token = rawToken.replace(/^"|"$/g, "");
        const secrets = await getSecrets();

        let decoded;
        try {
            decoded = jwt.verify(token, secrets.jwtSecret);
        } catch (error) {
            console.log("JWT verify error: ", error);
            return buildResponse(401, { message: "Invalid or expired token" });
        }

        const userId = event.pathParameters?.user_id;
        if (!userId) {
            return buildResponse(400, { message: "User ID is required in path" });
        }

        if (decoded.uuid !== userId) {
            return buildResponse(403, { message: "You are not allowed to update this user" });
        }

        //Validamos al usuario en el Dynamo aqui
        const userCheck = await dynamo.send(
            new GetCommand({
                TableName: process.env.USER_TABLE,
                Key: {uuid: userId }
            })
        );

        if (!userCheck.Item) {
            return buildResponse(404, { message: "User not found" });
        }

        //Procesamos la Img aqui o_O
        if (!event.body) {
            return buildResponse(400, { message: "Image body is required" });
        }

        //Aqui pa pasar la IMG como base64
        const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
        if (!body.image) {
            return buildResponse(400, { message: "Image (base64) is required" });
        }

        const buffer = Buffer.from(body.image, "base64");
        const ext = mimeToExt(body.fileType || "jpeg");
        const fileKey = `profiles/${userId}-${uuidv4()}.${ext}`;

        await s3.send(
            new PutObjectCommand({
                Bucket: process.env.IMAGE_BUCKET,
                Key: fileKey,
                Body: buffer,
                ContentType: body.fileType || "image/jpeg"
            })
        );

        const command = new GetObjectCommand({
            Bucket: process.env.IMAGE_BUCKET,
            Key: fileKey
        })

        const imageUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); 

        //Actualizamos el Dynamo aqui
        const result = await dynamo.send(
            new UpdateCommand({
                TableName: process.env.USER_TABLE,
                Key: { uuid: userId },
                UpdateExpression: "SET #image = :image",
                ExpressionAttributeNames: { "#image": "image" },
                ExpressionAttributeValues: { ":image": fileKey },
                ReturnValues: "ALL_NEW"
            })
        );

        return buildResponse(200, {
            message: "Profile image updated successfully",
            imageUrl,
            user: result.Attributes
        });
    } catch (error) {
        console.error("Upload image error: ", error);
        return buildResponse(500, { message: "Internal Server Error", error: error.message });
    }
};