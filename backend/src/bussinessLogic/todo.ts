import 'source-map-support/register'
import * as uuid from 'uuid'
import Jimp from 'jimp/es'
import { TodoItem } from "../models/TodoItem"
import {
    getTodosFromDb,
    createTodoInDb,
    deleteTodoFromDb,
    updateTodoInDb,
    storeThumbnailUrlInDb,
    storeWebsocketConnectionInDb,
    removeWebsocketConnectionIdFromDb,
    processS3Event,
    getImageFromAttachmentsBucket,
    writeImageToThumbnailBucket,
    getS3PresignedUrl,
    storeAttachmentUrlInDb
} from "../dataLayer/todoAccess"
import { CreateTodoRequest } from "../requests/CreateTodoRequest"
import { UpdateTodoRequest } from "../requests/UpdateTodoRequest"
import { getShortUserId } from "../lambda/utils"
import { S3Event } from 'aws-lambda'

export async function getTodosForUser(userId: string): Promise<TodoItem[]> {
    return await getTodosFromDb(userId)
}

export async function createTodoForUser(parsedBody: CreateTodoRequest, userId: string): Promise<TodoItem> {
    const todoId = uuid.v4()
    const timestamp = new Date().toISOString()

    const newTodo = {
        todoId: todoId,
        userId: userId,
        createdAt: timestamp,
        ...parsedBody,
        done: false
    }

    return await createTodoInDb(newTodo)
}

export async function deleteTodoForUser(todoId: string, userId: string): Promise<string> {
    return await deleteTodoFromDb(todoId, userId)
}

export async function updateTodoForUser(parsedBody: UpdateTodoRequest, userId: string, todoId: string): Promise<string> {
    return await updateTodoInDb(parsedBody, userId, todoId)
}

export async function getImageUrl(userId: string, todoId: string): Promise<string> {
    const shortUserId = getShortUserId(userId)
    const attachmentUrl = await getS3PresignedUrl(shortUserId, todoId)
    await storeAttachmentUrlInDb(userId, todoId)
    return attachmentUrl;
}

export async function updateTodoWithThumbnailUrl(key: string): Promise<TodoItem> {
    const userId = key.split("/")[0]
    const todoId = key.split("/")[1]
    return await storeThumbnailUrlInDb(userId, todoId)
}

export async function storeWebsocketConnection(connectionId: string): Promise<void> {
    const timestamp = new Date().toISOString()

    const item = {
        id: connectionId,
        timestamp
    }

    return await storeWebsocketConnectionInDb(item)
}

export async function removeWebsocketConnection(connectionId: string): Promise<void> {
    const key = {
        id: connectionId
    }
    return await removeWebsocketConnectionIdFromDb(key)
}

export async function sendNotificationsToWebsocket(s3Event: S3Event, connectionParams: { [key: string]: string }): Promise<void> {
    return await processS3Event(s3Event, connectionParams)
}

export async function putThumbnailToBucket(key: string): Promise<void> {
    const response = await getImageFromAttachmentsBucket(key)
    const body = response.Body
    const image = await Jimp.read(body)
    image.resize(100, 100)
    const convertedBuffer = await image.getBufferAsync(Jimp.AUTO)

    await writeImageToThumbnailBucket(key, convertedBuffer)
}

