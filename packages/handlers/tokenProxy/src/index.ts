import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
} from 'aws-lambda';
import {
  DynamoDBState,
  LambdaInterface,
  StateRecord,
  requiredValueFromRequest,
  errorResponse,
  SessionNotFound,
  StoreAccessError,
  Powertools,
  injectPowertools,
  REQUEST_ERROR,
  INTERNAL_ERROR,
  SESSION_NOT_FOUND,
} from '@enable-lti/util';
import { MetricUnits } from '@aws-lambda-powertools/metrics';

const DATA_PLANE_TABLE_NAME = process.env.DATA_PLANE_TABLE_NAME || '';

const powertools = Powertools.getInstance();

export class LambdaFunction implements LambdaInterface {
  @injectPowertools(powertools)
  public async handler(
    event: APIGatewayProxyEvent,
    context?: Context,
    callback?: Callback<APIGatewayProxyResult>
  ): Promise<APIGatewayProxyResult> {
    try {
      powertools.logger.info(JSON.stringify(event.headers));
      let code: string | undefined = undefined;
      let dbState: DynamoDBState | undefined = undefined;
      let stateRecord: StateRecord | undefined = undefined;
      try {
        code = requiredValueFromRequest(event, 'code');
      } catch (e) {
        return errorResponse(powertools, e as Error, 400, REQUEST_ERROR);
      }
      try {
        dbState = new DynamoDBState(DATA_PLANE_TABLE_NAME);
        stateRecord = await dbState.load(code!, undefined);
      } catch (e) {
        const error = e as Error;
        if (error instanceof SessionNotFound) {
          return errorResponse(powertools, error, 401, SESSION_NOT_FOUND);
        }
        if (error instanceof StoreAccessError) {
          return errorResponse(powertools, error, 500, INTERNAL_ERROR);
        }
      }
      const responseBody = {
        // eslint-disable-next-line camelcase
        access_token: stateRecord!.platform_lti_token,
        // eslint-disable-next-line camelcase
        id_token: stateRecord!.id_token,
        // eslint-disable-next-line camelcase
        token_type: 'Bearer',
        // eslint-disable-next-line camelcase
        expires_in: 30,
      };
      powertools.logger.debug(JSON.stringify(responseBody));
      const response = {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(responseBody),
      };
      powertools.metrics.addMetric('Success', MetricUnits.Count, 1);
      return response;
    } finally {
      powertools.metrics.publishStoredMetrics();
    }
  }
}

export const tokenProxy = new LambdaFunction();
export const handler = tokenProxy.handler;
