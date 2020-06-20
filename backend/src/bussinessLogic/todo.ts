import { TodoItem } from "../models/TodoItem"
import 'source-map-support/register'
import { getAllTodos, createTodo, deleteTodo, updateTodo, getAttachementUrl } from "../dataLayer/todoAccess"
import * as uuid from 'uuid'
import { CreateTodoRequest } from "../requests/CreateTodoRequest"
import { UpdateTodoRequest } from "../requests/UpdateTodoRequest"

export async function getTodosForUser(userId: string): Promise<TodoItem[]> {
    return await getAllTodos(userId)
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

    return await createTodo(newTodo)
}

export async function deleteTodoForUser(todoId: string, userId: string): Promise<string> {
    return await deleteTodo(todoId, userId)
}

export async function updateTodoForUser(parsedBody: UpdateTodoRequest, userId: string, todoId: string): Promise<string> {
    return await updateTodo(parsedBody, userId, todoId)
}

export async function getImageUrl(userId: string, todoId: string): Promise<string> {
    return await getAttachementUrl(userId, todoId)
}