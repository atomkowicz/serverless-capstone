import { SNSHandler, SNSEvent } from 'aws-lambda'
import 'source-map-support/register'
import { sendNotificationsToWebsocket } from '../../bussinessLogic/todo'

const stage = process.env.STAGE
const apiId = process.env.API_ID

const connectionParams = {
  apiVersion: "2018-11-29",
  endpoint: `${apiId}.execute-api.us-east-1.amazonaws.com/${stage}`
}

export const handler: SNSHandler = async (event: SNSEvent) => {

  console.log('Processing SNS event ', JSON.stringify(event))

  for (const snsRecord of event.Records) {
    const s3EventStr = snsRecord.Sns.Message
    console.log('Processing event', s3EventStr)
    const s3Event = JSON.parse(s3EventStr)

    await sendNotificationsToWebsocket(s3Event, connectionParams)
  }
}