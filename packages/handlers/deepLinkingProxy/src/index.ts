import * as jose from 'jose';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
} from 'aws-lambda';
import {
  LambdaInterface,
  requiredValueFromRequest,
  requiredTruthyValueFromRequest,
  DynamoDBPlatformConfig,
  DynamoDBJwks,
  valueFromRequest,
  isIsoDateString,
  errorResponse,
  LTIJwtPayload,
  REQUEST_ERROR,
  INTERNAL_ERROR,
  DEEP_LINK_PROXY_FAILURE,
  DEEP_LINK_PROXY_SUCCESS,
  JWT_VALIDATION_FAILURE,
  createDeepLinkingMessage,
  ContentItemLTIResourceLink,
  Powertools,
  injectPowertools,
} from '@enable-lti/util';
import { MetricUnits } from '@aws-lambda-powertools/metrics';

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
      powertools.logger.info(JSON.stringify(event.headers));
      let idToken: string | undefined = undefined;
      let resourceLinks: string | undefined = undefined;
      let ltiResourceLinks: ContentItemLTIResourceLink[] | undefined = undefined;
      let payload: LTIJwtPayload | undefined = undefined;
      let kids: jose.JSONWebKeySet | undefined = undefined;
      let kid: string | undefined = undefined;
      try {
        idToken = requiredTruthyValueFromRequest(event, 'id_token');
        resourceLinks = requiredValueFromRequest(event, 'resource_links');
      } catch (e) {
        return errorResponse(
          powertools,
          e as Error,
          400,
          REQUEST_ERROR,
          DEEP_LINK_PROXY_FAILURE
        );
      }
      let timestamp = valueFromRequest(event, 'timestamp');
      if (!timestamp || !isIsoDateString(timestamp)) {
        timestamp = new Date().toISOString();
      }
      try {
        payload = await LTIJwtPayload.load(idToken!, platform)
      } catch (e) {
        return errorResponse(
          powertools,
          e as Error,
          401,
          JWT_VALIDATION_FAILURE,
          DEEP_LINK_PROXY_FAILURE
        );
      }
      
      try {
        ltiResourceLinks = JSON.parse(resourceLinks!)
      } catch (e) {
        return errorResponse(
          powertools,
          new Error('resourceLinks not as expected in request'),
          400,
          REQUEST_ERROR,
          DEEP_LINK_PROXY_FAILURE
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
          DEEP_LINK_PROXY_FAILURE
        );
      }
      try {
        const options = {
          message: 'Successfully registered resource!',
          deepLinkingSettingsData: payload.deepLinkingSettingsData!,
        };
        const message = await createDeepLinkingMessage(
          {
            aud: payload.aud as string,
            iss: payload.iss as string,
            deploymentId: payload.deploymentId as string,
          },
          ltiResourceLinks!,
          options,
          { keyId: KMS_KEY_ID, kid: kid! }
        );
        powertools.logger.info(message);
        const formHtml =
          '<!DOCTYPE html><html><body>' +
          `<form id="ltijs_submit" style="display: none;" action="${payload.deepLinkingSettingsReturnUrl}" method="POST">` +
          `<input type="hidden" name="JWT" value="${message}" />` +
          '</form>' +
          '<script>' +
          'document.getElementById("ltijs_submit").submit()' +
          '</script>' +
          '</body></html>';
          powertools.metrics.addMetric(
            DEEP_LINK_PROXY_SUCCESS,
            MetricUnits.Count,
            1
          );
          return {
            statusCode: 200,
            body: formHtml,
            headers: { 'Content-type': 'text/html' },
          };
      } catch (e) {
        return errorResponse(
          powertools,
          e as Error,
          500,
          INTERNAL_ERROR,
          DEEP_LINK_PROXY_FAILURE
        );
      }
    } finally {
      powertools.metrics.publishStoredMetrics();
    }
  }
}

export const deepLinkingProxy = new LambdaFunction();
export const handler = deepLinkingProxy.handler;
