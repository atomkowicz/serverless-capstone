import * as AWS from 'aws-sdk'
import { TodoItem } from "../models/TodoItem"
import { createLogger } from '../utils/logger'
import { UpdateTodoRequest } from '../requests/UpdateTodoRequest';
import { S3Event } from 'aws-lambda';
import { getShortUserId } from '../lambda/utils';

const AWSXRay = require('aws-xray-sdk-core')
const logger = createLogger('todo-data-layer')
const XAWS = AWSXRay.captureAWS(AWS)

const docClient = new XAWS.DynamoDB.DocumentClient()

const s3 = new XAWS.S3({
    signatureVersion: 'v4'
})

const todosTable = process.env.TODOS_TABLE
const connectionsTable = process.env.CONNECTIONS_TABLE
const todosbucket = process.env.TODOS_S3_BUCKET
const thumbnailBucketName = process.env.THUMBNAILS_S3_BUCKET
const signedUrlExpiration = process.env.SIGNED_URL_EXPIRATION

export async function getTodosFromDb(userId: string): Promise<TodoItem[]> {
    logger.info('Fetching todos for user ', {
        user: userId
    })

    const result = await docClient.query({
        TableName: todosTable,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
            ':userId': userId
        },
        ScanIndexForward: false
    }).promise()

    logger.info('Fetching todos for user ', {
        user: userId,
        key: result
    })

    return result.Items as TodoItem[]
}

export async function createTodoInDb(newTodo: TodoItem): Promise<TodoItem> {
    logger.info('Creating todo', { key: newTodo })

    await docClient.put({
        TableName: todosTable,
        Item: newTodo
    }).promise()

    logger.info('Todo Created', { key: newTodo })

    return newTodo
}

export async function deleteTodoFromDb(todoId: string, userId: string): Promise<string> {
    logger.info(`Deleting todo: `, {
        key: todoId,
    })

    await docClient.delete({
        TableName: todosTable,
        Key: {
            userId,
            todoId
        }
    }).promise()

    logger.info(`Todo deleted`, { key: todoId })
    return 'deleted'
}

export async function updateTodoInDb(todo: UpdateTodoRequest, userId: string, todoId: string): Promise<string> {
    logger.info(`Updating todo: ${todoId}`)

    await docClient.update({
        TableName: todosTable,
        Key: {
            "userId": userId,
            "todoId": todoId
        },
        UpdateExpression: "set #name = :name, dueDate = :dueDate, done = :done",
        ExpressionAttributeNames: {
            "#name": "name"
        },
        ExpressionAttributeValues: {
            ":name": todo.name,
            ":dueDate": todo.dueDate,
            ":done": todo.done,
        },
        ReturnValues: "ALL_NEW"
    }).promise()

    logger.info(`Updated todo : ${todoId}`)
    return 'updated'
}

export async function getS3PresignedUrl(userId: string, todoId: string): Promise<string> {
    logger.info('Create presigned url', {
        userId,
        todoId
    })

    const uploadURL = s3.getSignedUrl('putObject', {
        Bucket: todosbucket,
        Key: `${userId}/${todoId}`,
        Expires: signedUrlExpiration
    })

    return uploadURL
}

export async function storeAttachmentUrlInDb(userId: string, todoId: string): Promise<TodoItem> {
    const shortUserId = getShortUserId(userId)

    logger.info(`Updating attachment url in database table for todo ${todoId} for user ${userId}`)

    const updatedTodo = await docClient.update({
        TableName: todosTable,
        Key: {
            "userId": userId,
            "todoId": todoId
        },
        UpdateExpression: "set attachmentUrl = :attachmentUrl",
        ExpressionAttributeValues: {
            ":attachmentUrl": `https://${todosbucket}.s3.amazonaws.com/${shortUserId}/${todoId}`
        },
        ReturnValues: "ALL_NEW"
    }).promise()

    logger.info(`Todo ${todoId} updated with attachment url`)
    return updatedTodo.Attributes as TodoItem
}

export async function storeThumbnailUrlInDb(userId: string, todoId: string): Promise<TodoItem> {
    logger.info(`Updating table with thumbnailurl`)

    const updatedTodo = await docClient.update({
        TableName: todosTable,
        Key: {
            "userId": `google-oauth2|${userId}`,
            "todoId": todoId
        },
        UpdateExpression: "set thumbnailUrl = :thumbnailUrl",
        ExpressionAttributeValues: {
            ":thumbnailUrl": `https://${thumbnailBucketName}.s3.amazonaws.com/${userId}/${todoId}.jpeg`
        },
        ReturnValues: "ALL_NEW"
    }).promise()

    logger.info(`Todo ${todoId} updated with thumbnail url`)
    return updatedTodo.Attributes as TodoItem
}

export async function getImageFromAttachmentsBucket(key: string) {
    logger.info(`Getting full size image from s3 ${todosbucket} with key: ${key}`)

    return await s3.getObject({
        Bucket: todosbucket,
        Key: key
    }).promise()
}

export async function writeImageToThumbnailBucket(key: string, convertedBuffer: Buffer): Promise<void> {
    logger.info(`Writing resized image to to s3 ${thumbnailBucketName} bucket`)

    await s3
        .putObject({
            Bucket: thumbnailBucketName,
            Key: `${key}.jpeg`,
            Body: convertedBuffer
        })
        .promise()
}

export async function storeWebsocketConnectionInDb(item: { [key: string]: string }): Promise<void> {
    logger.info('Storing websocket connection id in db: ', item)

    await docClient.put({
        TableName: connectionsTable,
        Item: item
    }).promise()
}

export async function removeWebsocketConnectionIdFromDb(key: { [key: string]: string }): Promise<void> {
    logger.info('Removing item with key from db: ', key)

    await docClient.delete({
        TableName: connectionsTable,
        Key: key
    }).promise()
}

export async function processS3Event(s3Event: S3Event, connectionParams): Promise<void> {
    const apiGateway = new AWS.ApiGatewayManagementApi(connectionParams)

    for (const record of s3Event.Records) {
        const key = record.s3.object.key
        logger.info('Processing S3 item with key: ', key)

        const connections = await docClient.scan({
            TableName: connectionsTable
        }).promise()

        const payload = {
            imageId: key
        }

        for (const connection of connections.Items) {
            const connectionId = connection.id
            await sendMessageToClient(connectionId, payload, apiGateway)
        }
    }
}

async function sendMessageToClient(connectionId, payload, apiGateway): Promise<void> {
    try {
        logger.info('Sending message to a connection', connectionId + payload)

        await apiGateway.postToConnection({
            ConnectionId: connectionId,
            Data: JSON.stringify(payload),
        }).promise()

    } catch (e) {
        logger.info('Failed to send message', JSON.stringify(e))

        if (e.statusCode === 410) {
            logger.info('Stale connection')

            await docClient.delete({
                TableName: connectionsTable,
                Key: {
                    id: connectionId
                }
            }).promise()
        }
    }
}