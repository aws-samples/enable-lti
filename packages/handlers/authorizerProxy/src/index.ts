import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
} from 'aws-lambda';
import {
  DynamoDBState,
  DynamoDBStateRecord,
  LambdaInterface,
  StateRecord,
  requiredValueFromCookies,
  errorResponse,
  SessionNotFound,
  StoreAccessError,
  Powertools,
  injectPowertools,
  INTERNAL_ERROR,
  SUCCESS,
  SESSION_NOT_FOUND,
} from '@enable-lti/util';
import { v4 as uuidv4 } from 'uuid';
import { MetricUnits } from '@aws-lambda-powertools/metrics';

const DATA_PLANE_TABLE_NAME = process.env.DATA_PLANE_TABLE_NAME || '';
const powertools = Powertools.getInstance();
const dbState = new DynamoDBState(DATA_PLANE_TABLE_NAME);

export class LambdaFunction implements LambdaInterface {
  @injectPowertools(powertools)
  public async handler(
    event: APIGatewayProxyEvent,
    context?: Context,
    callback?: Callback<APIGatewayProxyResult>
  ): Promise<APIGatewayProxyResult> {
    try {
      let eLTIState: string | undefined = undefined;
      let eLTINonce: string | undefined = undefined;
      let stateRecord: StateRecord | undefined = undefined;
      try {
        eLTIState = requiredValueFromCookies(event.headers, 'state');
        eLTINonce = requiredValueFromCookies(event.headers, 'nonce');
      } catch (e) {
        const error = e as Error;
        return errorResponse(
          powertools,
          new Error('State missing in request'),
          400,
          'RequestError'
        );
      }
      try {
        stateRecord = await dbState.load(eLTIState!, eLTINonce!);
      } catch (e) {
        const error = e as Error;
        if (error instanceof SessionNotFound) {
          return errorResponse(powertools, error, 401, SESSION_NOT_FOUND);
        }
        if (error instanceof StoreAccessError) {
          return errorResponse(powertools, error, 500, INTERNAL_ERROR);
        }
      }
      const code = uuidv4();
      stateRecord = DynamoDBStateRecord.cloneWithNewId(stateRecord!, code);
      try {
        await dbState!.save(stateRecord);
      } catch (e) {
        return errorResponse(powertools, e as Error, 500, INTERNAL_ERROR);
      }
      const redirectURL = `${
        event.queryStringParameters!.redirect_uri
      }?code=${code}&state=${event.queryStringParameters!.state}`;
      const response = {
        statusCode: 302,
        headers: {
          Location: redirectURL,
        },
        body: '',
      };
      powertools.metrics.addMetric(SUCCESS, MetricUnits.Count, 1);
      return response;
    } finally {
      powertools.metrics.publishStoredMetrics();
    }
  }
}

export const authorizerProxy = new LambdaFunction();
export const handler = authorizerProxy.handler;
