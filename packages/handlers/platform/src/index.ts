import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
} from 'aws-lambda';
import {
  abort,
  DynamoDBPlatformConfig,
  InvalidValueError,
  PlatformConfigRecord,
  requiredValueFromRequest,
  valueFromRequest,
  handlerWithPowertools,
  Powertools,
} from '@enable-lti/util';

const CONTROL_PLANE_TABLE_NAME = process.env.CONTROL_PLANE_TABLE_NAME || '';
const powertools = Powertools.getInstance();

export const handler = handlerWithPowertools(
  async (
    event: APIGatewayProxyEvent,
    context: Context,
    callback: Callback<APIGatewayProxyResult>
  ): Promise<APIGatewayProxyResult> => {
    const platform = new DynamoDBPlatformConfig(CONTROL_PLANE_TABLE_NAME);
    try {
      const config = {
        authTokenUrl: requiredValueFromRequest(event, 'auth_token_url'),
        authLoginUrl: requiredValueFromRequest(event, 'auth_login_url'),
        accessTokenUrl: requiredValueFromRequest(event, 'access_token_url'),
        clientId: requiredValueFromRequest(event, 'client_id'),
        ltiDeploymentId: valueFromRequest(event, 'lti_deployment_id'),
        iss: requiredValueFromRequest(event, 'iss'),
        keySetUrl: requiredValueFromRequest(event, 'key_set_url'),
      } as PlatformConfigRecord;

      //Instantiate a new platform instance with the required input pararms and persist to storage
      const platformConfigRecord = await platform.save(config);

      //Return a JSON representation of the Configuration
      return {
        statusCode: 200,
        body: JSON.stringify(platformConfigRecord),
      };
    } catch (e) {
      const error = e as Error;
      powertools.logger.error(`${error.name} - ${error.message}`, error);
      if (error instanceof InvalidValueError) {
        return abort(400, `${error.name} - ${error.message}`);
      } else {
        return {
          statusCode: 500,
          body: JSON.stringify((error as Error).message),
        };
      }
    }
  }, powertools
);
