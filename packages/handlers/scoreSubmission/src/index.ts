import {
  DynamoDBJwks,
  DynamoDBPlatformConfig,
  LambdaInterface,
  Powertools,
  ScoreSubmissionLmsParams,
  injectPowertools,
  setParamsFromTokenOrRequestCombined,
  submitScoreToLms,
  tryCatchWrapper,
} from '@enable-lti/util';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const SCORE_SUBMISSION_FAILURE = 'ScoreSubmissionFailure';
const CONTROL_PLANE_TABLE_NAME = process.env.CONTROL_PLANE_TABLE_NAME || '';
const KMS_KEY_ID = process.env.KMS_KEY_ID || '';
const powertools = Powertools.getInstance();
const platform = new DynamoDBPlatformConfig(CONTROL_PLANE_TABLE_NAME);
const jwks = new DynamoDBJwks(CONTROL_PLANE_TABLE_NAME, KMS_KEY_ID);

export class LambdaFunction implements LambdaInterface {
  @tryCatchWrapper({
    defaultErrorMetric: SCORE_SUBMISSION_FAILURE,
    powertools,
  })
  @injectPowertools(powertools)
  public async handler(
    event: APIGatewayProxyEvent
  ): Promise<APIGatewayProxyResult> {
    const scoreSubParams = new ScoreSubmissionLmsParams();
    await setParamsFromTokenOrRequestCombined(
      event,
      platform,
      powertools,
      scoreSubParams,
      'scoreSubmission'
    );

    const platformConfigRecord = await platform.load(
      scoreSubParams.lmsClientId,
      scoreSubParams.lmsIssuer,
      scoreSubParams.lmsDeploymentId
    );

    const response = await submitScoreToLms(
      platformConfigRecord,
      scoreSubParams.lineitem,
      scoreSubParams.lmsStudentId,
      scoreSubParams.scoreGiven,
      scoreSubParams.scoreMaximum,
      scoreSubParams.comment,
      scoreSubParams.timestamp,
      scoreSubParams.activityProgress,
      scoreSubParams.gradingProgress,
      jwks,
      KMS_KEY_ID
    );

    const apiResponse = {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Successfully submitted score to LMS platform',
      }),
    };

    return apiResponse;
  }
}

export const scoreSubmission = new LambdaFunction();
export const handler = scoreSubmission.handler;
