import * as jose from 'jose';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
} from 'aws-lambda';
import {
  LambdaInterface,
  requestBearerClientCredential,
  requiredValueFromRequest,
  requiredTruthyValueFromRequest,
  PlatformConfigRecord,
  DynamoDBPlatformConfig,
  DynamoDBJwks,
  requiredAllowedValueFromRequest,
  valueFromRequest,
  isIsoDateString,
  errorResponse,
  LTIJwtPayload,
  Powertools,
  injectPowertools,
  REQUEST_ERROR,
  INTERNAL_ERROR,
  CONFIG_ISSUE,
  SCORE_SUBMISSION_FAILURE,
  SCORE_SUBMISSION_SUCCESS,
  JWT_VALIDATION_FAILURE,
} from '@enable-lti/util';
import { MetricUnits } from '@aws-lambda-powertools/metrics';
import axios from 'axios';

const CONTROL_PLANE_TABLE_NAME = process.env.CONTROL_PLANE_TABLE_NAME || '';
const KMS_KEY_ID = process.env.KMS_KEY_ID || '';

const powertools = Powertools.getInstance();

// const enums are not iterable
enum GradingProgress {
  FullyGraded = 'FullyGraded',
  Pending = 'Pending',
  PendingManual = 'PendingManual',
  Failed = 'Failed',
  NotReady = 'NotReady',
}
enum ActivityProgress {
  Initialized = 'Initialized',
  Started = 'Started',
  InProgress = 'InProgress',
  Submitted = 'Submitted',
  Completed = 'Completed',
}
export class LambdaFunction implements LambdaInterface {
  // eslint-disable-next-line require-await
  @injectPowertools(powertools)
  public async handler(
    event: APIGatewayProxyEvent,
    context?: Context,
    callback?: Callback<APIGatewayProxyResult>
  ): Promise<APIGatewayProxyResult> {
    try {
      const platform = new DynamoDBPlatformConfig(CONTROL_PLANE_TABLE_NAME);
      const jwks = new DynamoDBJwks(CONTROL_PLANE_TABLE_NAME, KMS_KEY_ID);
      powertools.logger.info(JSON.stringify(event.headers));
      let idToken: string | undefined = undefined;
      let scoreGiven: number = 0;
      let scoreMaximum: number = 0;
      let comment: string | undefined = undefined;
      let activityProgress: string | undefined = undefined;
      let gradingProgress: string | undefined = undefined;
      let lineitem: string | undefined = undefined;
      let LMSStudentId: string | undefined = undefined;
      let platformConfigRecord: PlatformConfigRecord | undefined = undefined;
      let accessToken: string | undefined = undefined;
      let response = undefined;
      let kids: jose.JSONWebKeySet | undefined = undefined;
      let kid: string | undefined = undefined;
      try {
        idToken = requiredTruthyValueFromRequest(event, 'id_token');
        scoreGiven = requiredValueFromRequest(event, 'score_given');
        scoreMaximum = requiredValueFromRequest(event, 'score_maximum');
        comment = requiredValueFromRequest(event, 'comment');
        activityProgress = requiredAllowedValueFromRequest(
          event,
          'activity_progress',
          Object.keys(ActivityProgress)
        );
        gradingProgress = requiredAllowedValueFromRequest(
          event,
          'grading_progress',
          Object.keys(GradingProgress)
        );
      } catch (e) {
        return errorResponse(
          powertools,
          e as Error,
          400,
          REQUEST_ERROR,
          SCORE_SUBMISSION_FAILURE
        );
      }
      let timestamp = valueFromRequest(event, 'timestamp');
      if (!timestamp || !isIsoDateString(timestamp)) {
        timestamp = new Date().toISOString();
      }
      let jwt;
      try {
        jwt = await LTIJwtPayload.verifyToken(idToken!, platform);
      } catch (e) {
        return errorResponse(
          powertools,
          e as Error,
          401,
          JWT_VALIDATION_FAILURE,
          SCORE_SUBMISSION_FAILURE
        );
      }
      if (scoreGiven < 0 || scoreGiven > 100 * scoreMaximum) {
        return errorResponse(
          powertools,
          new Error('scoreGiven is not as expected'),
          400,
          REQUEST_ERROR,
          SCORE_SUBMISSION_FAILURE
        );
      }
      const unverified: Record<string, any> = jose.decodeJwt(idToken!);
      powertools.logger.debug(JSON.stringify(unverified));
      const LMSIssuer = unverified['custom:LMS:Issuer'];
      const LMSClientId = unverified['custom:LMS:ClientId'];
      const LMSDeploymentId = unverified['custom:LMS:DeploymentId'];
      if (!LMSIssuer || !LMSClientId || !LMSDeploymentId) {
        return errorResponse(
          powertools,
          new Error('Required claims missing in token'),
          400,
          REQUEST_ERROR,
          SCORE_SUBMISSION_FAILURE
        );
      }
      try {
        lineitem = JSON.parse(unverified['custom:LMS:Endpoint']).lineitem;
        LMSStudentId = unverified.identities[0].userId;
      } catch (e) {
        return errorResponse(
          powertools,
          new Error('Lineitem or student id not as expected in token'),
          400,
          REQUEST_ERROR,
          SCORE_SUBMISSION_FAILURE
        );
      }
      try {
        platformConfigRecord = await platform.load(
          LMSClientId,
          LMSIssuer,
          LMSDeploymentId
        );
      } catch (e) {
        const err = e as Error;
        return errorResponse(
          powertools,
          err,
          500,
          CONFIG_ISSUE,
          SCORE_SUBMISSION_FAILURE
        );
      }
      try {
        kids = await jwks.all();
        kid = kids.keys[0].kid;
      } catch (e) {
        return errorResponse(
          powertools,
          e as Error,
          500,
          INTERNAL_ERROR,
          SCORE_SUBMISSION_FAILURE
        );
      }
      try {
        accessToken = await requestBearerClientCredential(
          platformConfigRecord,
          kid!,
          KMS_KEY_ID,
          powertools
        );
      } catch (e) {
        return errorResponse(
          powertools,
          e as Error,
          500,
          INTERNAL_ERROR,
          SCORE_SUBMISSION_FAILURE
        );
      }
      try {
        response = await axios.post(
          `${lineitem}/scores`,
          {
            userId: LMSStudentId,
            scoreGiven,
            scoreMaximum,
            comment,
            timestamp,
            activityProgress,
            gradingProgress,
          },
          {
            headers: {
              'Content-Type': 'application/vnd.ims.lis.v1.score+json',
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
      } catch (e) {
        return errorResponse(
          powertools,
          e as Error,
          500,
          SCORE_SUBMISSION_FAILURE
        );
      }
      powertools.logger.info(
        'Response from LMS scoring endpoint',
        response.data
      );
      if (response.status != 200) {
        powertools.metrics.addMetric(
          SCORE_SUBMISSION_FAILURE,
          MetricUnits.Count,
          1
        );
      } else {
        powertools.metrics.addMetric(
          SCORE_SUBMISSION_SUCCESS,
          MetricUnits.Count,
          1
        );
      }
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
    } finally {
      powertools.metrics.publishStoredMetrics();
    }
  }
}

export const scoreSubmission = new LambdaFunction();
export const handler = scoreSubmission.handler;
