import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
} from 'aws-lambda';
import {
  abort,
  DynamoDBLtiToolConfig,
  InvalidValueError,
  requiredValueFromRequest,
  toolConfigRecord,
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
    const toolConfig = new DynamoDBLtiToolConfig(CONTROL_PLANE_TABLE_NAME);

    try {
      const id = requiredValueFromRequest(event, 'client_id');
      const issuer = requiredValueFromRequest(event, 'issuer');
      const url = requiredValueFromRequest(event, 'url');
      const data = valueFromRequest(event, 'data');

      //Instantiate a new tool instance with the required input pararms and persist to storage
      const toolConfigRecord = await toolConfig.save({
        id,
        issuer,
        url,
        data: data === undefined ? {} : data,
      } as toolConfigRecord);

      //Return a JSON representation of the Configuration
      return {
        statusCode: 200,
        body: JSON.stringify(toolConfigRecord),
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
