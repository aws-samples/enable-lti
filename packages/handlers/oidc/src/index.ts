import {
  DynamoDBPlatformConfig,
  DynamoDBState,
  LambdaInterface,
  LtiLoginOidc,
  Powertools,
  injectPowertools,
  tryCatchWrapper,
} from '@enable-lti/util';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
} from 'aws-lambda';

const CONTROL_PLANE_TABLE_NAME = process.env.CONTROL_PLANE_TABLE_NAME || '';
const DATA_PLANE_TABLE_NAME = process.env.DATA_PLANE_TABLE_NAME || '';
const STATE_TTL = process.env.STATE_TTL || '7200';

const OIDC_FAILURE = 'OidcFailure';

const ltiLoginOidc = new LtiLoginOidc();
const powertools = Powertools.getInstance();
const platform = new DynamoDBPlatformConfig(CONTROL_PLANE_TABLE_NAME);
const state = new DynamoDBState(DATA_PLANE_TABLE_NAME, parseInt(STATE_TTL));

export class LambdaFunction implements LambdaInterface {
  @tryCatchWrapper({
    defaultErrorMetric: OIDC_FAILURE,
    powertools,
  })
  @ltiLoginOidc.loginHandler({
    platform,
    state,
  })
  @injectPowertools(powertools)
  public handler(
    event: APIGatewayProxyEvent,
    context?: Context,
    callback?: Callback<APIGatewayProxyResult>
  ): Promise<APIGatewayProxyResult> {
    return Promise.resolve({
      statusCode: 500,
      body: JSON.stringify({ message: 'Unexpected Path' }),
    });
  }
}

export const oidcLambda = new LambdaFunction();
export const handler = oidcLambda.handler;
