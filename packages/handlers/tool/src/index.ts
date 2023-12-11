import {
  DynamoDBLtiToolConfig,
  LtiCustomError,
  Powertools,
  errorResponse,
  handlerWithPowertools,
  requiredValueFromRequest,
  toolConfigRecord,
  valueFromRequest,
} from '@enable-lti/util';
import { MetricUnits } from '@aws-lambda-powertools/metrics';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const TOOL_FAILURE = 'ToolFailure';
const CONTROL_PLANE_TABLE_NAME = process.env.CONTROL_PLANE_TABLE_NAME || '';
const powertools = Powertools.getInstance();
const toolConfig = new DynamoDBLtiToolConfig(CONTROL_PLANE_TABLE_NAME);

export const handler = handlerWithPowertools(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      const id = requiredValueFromRequest(event, 'client_id');
      const issuer = requiredValueFromRequest(event, 'issuer');
      const url = requiredValueFromRequest(event, 'url');
      const data = valueFromRequest(event, 'data');
      const features = valueFromRequest(event, 'features');

      //Instantiate a new tool instance with the required input pararms and persist to storage
      const toolConfigRecord = await toolConfig.save({
        id,
        issuer,
        url,
        data: data === undefined ? {} : data,
        features: features === undefined ? [] : features,
      } as toolConfigRecord);

      powertools.metrics.addMetric(TOOL_FAILURE, MetricUnits.Count, 0);

      //Return a JSON representation of the Configuration
      return {
        statusCode: 200,
        body: JSON.stringify(toolConfigRecord),
      };
    } catch (e) {
      const error = e as Error;
      powertools.logger.error(`${error.name} - ${error.message}`, error);
      if (error instanceof LtiCustomError) {
        return errorResponse({
          pt: powertools,
          err: e as Error,
          statusCode: error.statusCode,
          metricString: error.customMetric,
          businessMetric: TOOL_FAILURE,
        });
      } else {
        return errorResponse({
          pt: powertools,
          err: e as Error,
          statusCode: 500,
          metricString: 'FailedSaveToolConfig',
          businessMetric: TOOL_FAILURE,
        });
      }
    }
  },
  powertools
);
