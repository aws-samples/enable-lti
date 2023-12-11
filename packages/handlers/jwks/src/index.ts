import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
} from 'aws-lambda';
import {
  DynamoDBJwks,
  Powertools,
  injectPowertools,
  tryCatchWrapper,
  LambdaInterface,
} from '@enable-lti/util';

const JWKS_FAILURE = 'JwksFailure';

const powertools = Powertools.getInstance();
const jwks = new DynamoDBJwks(
  process.env.CONTROL_PLANE_TABLE_NAME!,
  process.env.KMS_KEY_ID!
);

export class LambdaFunction implements LambdaInterface {
  @tryCatchWrapper({
    defaultErrorMetric: JWKS_FAILURE,
    powertools,
  })
  @injectPowertools(powertools)
  public async handler(
    event: APIGatewayProxyEvent,
    context?: Context,
    callback?: Callback<APIGatewayProxyResult>
  ): Promise<APIGatewayProxyResult> {
    const keys = await jwks.all();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(keys),
    };
  }
}

export const jwksFunc = new LambdaFunction();
export const handler = jwksFunc.handler;
