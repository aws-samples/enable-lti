import { APIGatewayProxyEvent, APIGatewayProxyResult, Callback, Context } from 'aws-lambda';
import { DynamoDBJwks, handlerWithPowertools, Powertools } from '@enable-lti/util';

const powertools = Powertools.getInstance();

export const handler = handlerWithPowertools(async (event: APIGatewayProxyEvent,
    context: Context,
    callback: Callback<APIGatewayProxyResult>): Promise<APIGatewayProxyResult> => {
    const jwks = new DynamoDBJwks(process.env.CONTROL_PLANE_TABLE_NAME!, process.env.KMS_KEY_ID!);
    powertools.logger.info(`jwks\n${jwks}`);
    const keys = await jwks.all();
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keys)
    };
}, powertools);