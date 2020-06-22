import { SNSEvent, SNSHandler, S3EventRecord } from 'aws-lambda'
import 'source-map-support/register'
import { updateTodoWithThumbnailUrl, putThumbnailToBucket } from '../../bussinessLogic/todo'

export const handler: SNSHandler = async (event: SNSEvent) => {
    console.log('Processing SNS event ', JSON.stringify(event))
    for (const snsRecord of event.Records) {
        const s3EventStr = snsRecord.Sns.Message
        console.log('Processing S3 event', s3EventStr)
        const s3Event = JSON.parse(s3EventStr)

        for (const record of s3Event.Records) {
            await processImage(record) // A function that should resize each image
        }
    }
}

async function processImage(record: S3EventRecord) {
    const key = record.s3.object.key
    await updateTodoWithThumbnailUrl(key)
    await putThumbnailToBucket(key)
}