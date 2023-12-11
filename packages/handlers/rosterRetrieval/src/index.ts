import {
  DynamoDBJwks,
  DynamoDBPlatformConfig,
  LambdaInterface,
  Powertools,
  RosterRetrievalLmsParams,
  injectPowertools,
  setParamsFromTokenOrRequestCombined,
  submitRosterRequestToLms,
  tryCatchWrapper,
} from '@enable-lti/util';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const ROSTER_RETRIEVAL_FAILURE = 'RosterRetrievalFailure';

const CONTROL_PLANE_TABLE_NAME = process.env.CONTROL_PLANE_TABLE_NAME || '';
const KMS_KEY_ID = process.env.KMS_KEY_ID || '';
const powertools = Powertools.getInstance();
const platform = new DynamoDBPlatformConfig(CONTROL_PLANE_TABLE_NAME);
const jwks = new DynamoDBJwks(CONTROL_PLANE_TABLE_NAME, KMS_KEY_ID);

export class LambdaFunction implements LambdaInterface {
  @tryCatchWrapper({
    defaultErrorMetric: ROSTER_RETRIEVAL_FAILURE,
    powertools,
  })
  @injectPowertools(powertools)
  public async handler(
    event: APIGatewayProxyEvent
  ): Promise<APIGatewayProxyResult> {
    const rosterRetrievalLmsParams = new RosterRetrievalLmsParams();
    await setParamsFromTokenOrRequestCombined(
      event,
      platform,
      powertools,
      rosterRetrievalLmsParams,
      'rosterRetrieval'
    );

    const platformConfigRecord = await platform.load(
      rosterRetrievalLmsParams.lmsClientId,
      rosterRetrievalLmsParams.lmsIssuer,
      rosterRetrievalLmsParams.lmsDeploymentId
    );

    const response = await submitRosterRequestToLms(
      platformConfigRecord,
      rosterRetrievalLmsParams.contextMembershipsUrl,
      KMS_KEY_ID,
      jwks
    );
    const apiResponse = {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(response.data),
    };

    return apiResponse;
  }
}

export const rosterRetrieval = new LambdaFunction();
export const handler = rosterRetrieval.handler;
