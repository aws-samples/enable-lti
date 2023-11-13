import {
  DynamoDBState,
  LambdaInterface,
  Powertools,
  injectPowertools,
  requiredValueFromRequest,
  tryCatchWrapper,
} from '@enable-lti/util';
import { MetricUnits } from '@aws-lambda-powertools/metrics';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const TOKEN_PROXY_FAILURE = 'TokenProxyFailure';
const DATA_PLANE_TABLE_NAME = process.env.DATA_PLANE_TABLE_NAME || '';
const powertools = Powertools.getInstance();
const dbState = new DynamoDBState(DATA_PLANE_TABLE_NAME);

export class LambdaFunction implements LambdaInterface {
  @tryCatchWrapper({
    defaultErrorMetric: TOKEN_PROXY_FAILURE,
    powertools,
  })
  @injectPowertools(powertools)
  public async handler(
    event: APIGatewayProxyEvent
  ): Promise<APIGatewayProxyResult> {
    const code = requiredValueFromRequest(event, 'code');
    const stateRecord = await dbState.load(code);
    const responseBody = {
      access_token: stateRecord.platform_lti_token,
      id_token: stateRecord.id_token,
      token_type: 'Bearer',
      expires_in: 30,
    };
    const response = {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(responseBody),
    };
    powertools.metrics.addMetric(TOKEN_PROXY_FAILURE, MetricUnits.Count, 0);
    return response;
  }
}

export const tokenProxy = new LambdaFunction();
export const handler = tokenProxy.handler;
