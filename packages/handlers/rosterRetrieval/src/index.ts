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
  requiredTruthyValueFromRequest,
  PlatformConfigRecord,
  DynamoDBPlatformConfig,
  DynamoDBJwks,
  errorResponse,
  LTIJwtPayload,
  Powertools,
  injectPowertools,
  REQUEST_ERROR,
  INTERNAL_ERROR,
  CONFIG_ISSUE,
  ROSTER_RETRIEVAL_FAILURE,
  ROSTER_RETRIEVAL_SUCCESS,
  ROSTER_RETRIEVAL_WITH_ID_TOKEN,
  ROSTER_RETRIEVAL_WITH_PARAMETER,
} from '@enable-lti/util';
import { MetricUnits } from '@aws-lambda-powertools/metrics';
import axios from 'axios';
import { AxiosError } from 'axios';

const CONTROL_PLANE_TABLE_NAME = process.env.CONTROL_PLANE_TABLE_NAME || '';
const KMS_KEY_ID = process.env.KMS_KEY_ID || '';
const powertools = Powertools.getInstance();

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
      let idToken: string | undefined = undefined;
      let platformConfigRecord: PlatformConfigRecord | undefined = undefined;
      let accessToken: string | undefined = undefined;
      let response = undefined;
      let kids: jose.JSONWebKeySet | undefined = undefined;
      let kid: string | undefined = undefined;
      let jwt;
      let LMSIssuer: string | undefined = undefined;
      let LMSClientId: string | undefined = undefined;
      let LMSDeploymentId: string | undefined = undefined;
      let contextMembershipsUrl: string | undefined = undefined;
      try {
        idToken = requiredTruthyValueFromRequest(event, 'id_token');
        jwt = await LTIJwtPayload.load(idToken!, platform);
        LMSIssuer = jwt.getTruthyClaim('custom:LMS:Issuer');
        LMSClientId = jwt.getTruthyClaim('custom:LMS:ClientId');
        LMSDeploymentId = jwt.getTruthyClaim('custom:LMS:DeploymentId');
        const LMSNamesRoleService = jwt.getTruthyClaim('custom:LMS:NamesRoleService');
        contextMembershipsUrl = JSON.parse(LMSNamesRoleService).context_memberships_url;
        powertools.metrics.addMetric(
          ROSTER_RETRIEVAL_WITH_ID_TOKEN,
          MetricUnits.Count,
          1
        );
      } catch (e) {
        powertools.logger.info("The request does not contain an 'id_token' parameter");
      }
      if (!LMSIssuer || !LMSClientId || !LMSDeploymentId || !contextMembershipsUrl) {
        try {
          LMSIssuer = requiredTruthyValueFromRequest(event, 'issuer');
          LMSClientId = requiredTruthyValueFromRequest(event, 'client_id');
          LMSDeploymentId = requiredTruthyValueFromRequest(event, 'deployment_id');
          contextMembershipsUrl = requiredTruthyValueFromRequest(event, 'context_memberships_url');
          powertools.metrics.addMetric(
            ROSTER_RETRIEVAL_WITH_PARAMETER,
            MetricUnits.Count,
            1
          );
        } catch (e) {
          return errorResponse(
            powertools,
            new Error('Required parameters missing'),
            400,
            REQUEST_ERROR,
            ROSTER_RETRIEVAL_FAILURE
          );
        }
        
      }
      try {
        platformConfigRecord = await platform.load(
          LMSClientId!,
          LMSIssuer!,
          LMSDeploymentId
        );
      } catch (e) {
        const err = e as Error;
        return errorResponse(
          powertools,
          err,
          500,
          CONFIG_ISSUE,
          ROSTER_RETRIEVAL_FAILURE
        );
      }
      //TODO: must change how we store and retrieve keys
      try {
        kids = await jwks.all();
        kid = kids.keys[0].kid;
      } catch (e) {
        return errorResponse(
          powertools,
          e as Error,
          500,
          INTERNAL_ERROR,
          ROSTER_RETRIEVAL_FAILURE
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
        powertools.logger.error('Fail to get client credential');
        return errorResponse(
          powertools,
          e as Error,
          500,
          INTERNAL_ERROR,
          ROSTER_RETRIEVAL_FAILURE
        );
      }
      try {
        response = await axios.get(
          contextMembershipsUrl!,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
      } catch (e) {
        return errorResponse(
          powertools,
          e as Error,
          e as AxiosError && (e as AxiosError).response ? (e as AxiosError).response!.status : 500,
          ROSTER_RETRIEVAL_FAILURE
        );
      }

      if (response.status !== 200) {
        powertools.metrics.addMetric(
          ROSTER_RETRIEVAL_FAILURE,
          MetricUnits.Count,
          1
        );
      } else {
        powertools.metrics.addMetric(
          ROSTER_RETRIEVAL_SUCCESS,
          MetricUnits.Count,
          1
        );
      }

      const apiResponse = {
        statusCode: response.status,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(response.data),
      };
      return apiResponse;
    } finally {
      powertools.metrics.publishStoredMetrics();
    }
  }
}

export const rosterRetrieval = new LambdaFunction();
export const handler = rosterRetrieval.handler;