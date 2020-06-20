import 'source-map-support/register'
import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda'
import { CreateTodoRequest } from '../../requests/CreateTodoRequest'
import { createTodoForUser } from '../../bussinessLogic/todo'
import { getUserIdFromAuthHeader } from '../../auth/utils'

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

  const parsedBody: CreateTodoRequest = JSON.parse(event.body)
  const userId = getUserIdFromAuthHeader(event.headers.Authorization)

  const newTodo = await createTodoForUser(parsedBody, userId)

  return {
    statusCode: 201,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    },
    body: JSON.stringify({
      item: newTodo
    })
  }
}
