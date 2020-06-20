import * as AWS from 'aws-sdk'
import { TodoItem } from "../models/TodoItem"
import { createLogger } from '../utils/logger'
import { UpdateTodoRequest } from '../requests/UpdateTodoRequest';

const AWSXRay = require('aws-xray-sdk-core')
const XAWS = AWSXRay.captureAWS(AWS)
const docClient = new XAWS.DynamoDB.DocumentClient()

const todosTable = process.env.TODOS_TABLE
const logger = createLogger('todo-data-layer')

const todosbucket = process.env.TODOS_S3_BUCKET
const signedUrlExpiration = process.env.SIGNED_URL_EXPIRATION

const s3 = new XAWS.S3({
    signatureVersion: 'v4'
})

export async function getAllTodos(userId: string): Promise<TodoItem[]> {

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

export async function createTodo(newTodo: TodoItem): Promise<TodoItem> {

    await docClient.put({
        TableName: todosTable,
        Item: newTodo
    }).promise()

    logger.info('Todo Created', { key: newTodo })

    return newTodo
}

export async function deleteTodo(todoId: string, userId: string): Promise<string> {

    await docClient.delete({
        TableName: todosTable,
        Key: {
            userId,
            todoId
        }
    }).promise()

    logger.info(`Todo deleted`, {
        key: todoId,
    })

    return 'deleted'
}

export async function updateTodo(todo: UpdateTodoRequest, userId: string, todoId: string): Promise<string> {

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

export async function getAttachementUrl(userId: string, todoId: string): Promise<string> {
    const attachmentUrl = await getS3PresignedUrl(userId, todoId)
    await amendAttachemntUrl(userId, todoId)
    return attachmentUrl;
}

export async function getS3PresignedUrl(userId: string, todoId: string): Promise<string> {
    logger.info('Create presigned url',{
      userId: userId,
      todoId: todoId
    })
  
    const uploadURL = s3.getSignedUrl('putObject', {
      Bucket: todosbucket,
      Key: `${userId}/${todoId}`,
      Expires: signedUrlExpiration
    })
    
    return uploadURL
  }
  
  export async function amendAttachemntUrl(userId: string, todoId: string): Promise<TodoItem> {
    
    const updatedTodo = await docClient.update({
      TableName: todosTable,
      Key: {
        "userId": userId,
        "todoId": todoId
      },
      UpdateExpression: "set attachmentUrl = :attachmentUrl",
      ExpressionAttributeValues: {
        ":attachmentUrl" : `https://${todosbucket}.s3.amazonaws.com/${userId}/${todoId}`
      },
      ReturnValues: "ALL_NEW"
    }).promise()
  
    logger.info(`Todo ${todoId} updated with attachment url`)
    
    return updatedTodo.Attributes as TodoItem
  }