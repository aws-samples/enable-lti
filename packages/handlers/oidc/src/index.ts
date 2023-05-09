import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
} from 'aws-lambda';
import {
  abort,
  DynamoDBPlatformConfig,
  DynamoDBState,
  LambdaInterface,
  LtiLoginOidc,
  Powertools,
  injectPowertools,
} from '@enable-lti/util';

const CONTROL_PLANE_TABLE_NAME = process.env.CONTROL_PLANE_TABLE_NAME || '';
const DATA_PLANE_TABLE_NAME = process.env.DATA_PLANE_TABLE_NAME || '';
const STATE_TTL = process.env.STATE_TTL || '7200';

const ltiLoginOidc = new LtiLoginOidc();
const powertools = Powertools.getInstance();

export class LambdaFunction implements LambdaInterface {
  @ltiLoginOidc.loginHandler({
    platform: new DynamoDBPlatformConfig(CONTROL_PLANE_TABLE_NAME),
    state: new DynamoDBState(DATA_PLANE_TABLE_NAME, parseInt(STATE_TTL)),
  })
  @injectPowertools(powertools)
  public async handler(
    event: APIGatewayProxyEvent,
    context?: Context,
    callback?: Callback<APIGatewayProxyResult>
  ): Promise<APIGatewayProxyResult> {
    return abort(500, 'Unexpected Path');
  }
}

export const launchLambda = new LambdaFunction();
export const handler = launchLambda.handler;