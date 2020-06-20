import 'source-map-support/register'
import { getUserIdFromAuthHeader } from '../../auth/utils'
import { APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayProxyHandler } from 'aws-lambda'
import { getImageUrl } from '../../bussinessLogic/todo'

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  
  const todoId = event.pathParameters.todoId
  const userId = getUserIdFromAuthHeader(event.headers.Authorization)

  const uploadUrl = await getImageUrl(userId, todoId)

  return {
    statusCode: 201,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      'Access-Control-Request-Method': "POST"
    },
    body: JSON.stringify({ uploadUrl })
  }
}