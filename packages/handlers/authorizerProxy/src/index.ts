import {
  DynamoDBState,
  DynamoDBStateRecord,
  LambdaInterface,
  LtiCustomError,
  Powertools,
  injectPowertools,
  requiredValueFromCookies,
  tryCatchWrapper,
} from '@enable-lti/util';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

const AUTHORIZER_PROXY_FAILURE = 'AuthorizerProxyFailure';

const DATA_PLANE_TABLE_NAME = process.env.DATA_PLANE_TABLE_NAME || '';
const powertools = Powertools.getInstance();
const dbState: DynamoDBState = new DynamoDBState(DATA_PLANE_TABLE_NAME);

export class LambdaFunction implements LambdaInterface {
  @tryCatchWrapper({
    defaultErrorMetric: AUTHORIZER_PROXY_FAILURE,
    powertools,
  })
  @injectPowertools(powertools)
  public async handler(
    event: APIGatewayProxyEvent
  ): Promise<APIGatewayProxyResult> {
    const eLTIState = requiredValueFromCookies(event.headers, 'state');
    const eLTINonce = requiredValueFromCookies(event.headers, 'nonce');
    let stateRecord = await dbState.load(eLTIState, eLTINonce);
    const code = uuidv4();
    stateRecord = DynamoDBStateRecord.cloneWithNewId(stateRecord, code);
    await dbState.save(stateRecord);
    if (
      !event.queryStringParameters ||
      !event.queryStringParameters.redirect_uri ||
      !event.queryStringParameters.state
    ) {
      throw new LtiCustomError(
        'Required QueryStringParameters missing',
        'MissingKeyInRequest',
        400
      );
    }
    const redirectURL = `${event.queryStringParameters.redirect_uri}?code=${code}&state=${event.queryStringParameters.state}`;
    const response = {
      statusCode: 302,
      headers: {
        Location: redirectURL,
      },
      body: '',
    };
    return response;
  }
}

export const authorizerProxy = new LambdaFunction();
export const handler = authorizerProxy.handler;
