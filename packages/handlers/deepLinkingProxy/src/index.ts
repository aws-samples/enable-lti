import {
  ContentItemLTIResourceLink,
  DynamoDBJwks,
  DynamoDBPlatformConfig,
  LTIJwtPayload,
  LambdaInterface,
  LtiCustomError,
  Powertools,
  createDeepLinkingMessage,
  injectPowertools,
  requiredTruthyValueFromRequest,
  requiredValueFromRequest,
  tryCatchWrapper,
} from '@enable-lti/util';
import { MetricUnits } from '@aws-lambda-powertools/metrics';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as jose from 'jose';
import { v4 as uuidv4 } from 'uuid';

const CONTROL_PLANE_TABLE_NAME = process.env.CONTROL_PLANE_TABLE_NAME || '';
const KMS_KEY_ID = process.env.KMS_KEY_ID || '';
const platform = new DynamoDBPlatformConfig(CONTROL_PLANE_TABLE_NAME);
const jwks = new DynamoDBJwks(CONTROL_PLANE_TABLE_NAME, KMS_KEY_ID);
const DEEP_LINK_PROXY_FAILURE = 'DeepLinkProxyFailure';
const powertools = Powertools.getInstance();

export class LambdaFunction implements LambdaInterface {
  @tryCatchWrapper({
    defaultErrorMetric: DEEP_LINK_PROXY_FAILURE,
    powertools,
  })
  @injectPowertools(powertools)
  public async handler(
    event: APIGatewayProxyEvent
  ): Promise<APIGatewayProxyResult> {
    let payload: LTIJwtPayload | undefined = undefined;
    let kids: jose.JSONWebKeySet | undefined = undefined;
    let kid: string | undefined = undefined;
    const idToken = requiredTruthyValueFromRequest(event, 'id_token');
    const resourceLinks = requiredValueFromRequest(event, 'resource_links');
    let ltiResourceLinks: ContentItemLTIResourceLink[] = [];
    try {
      ltiResourceLinks = JSON.parse(resourceLinks);
    } catch (e) {
      throw new LtiCustomError(
        (e as Error).message,
        'InvalidResourceLinks',
        400
      );
    }
    try {
      payload = await LTIJwtPayload.load(idToken, platform, false);
    } catch (e) {
      throw new LtiCustomError(
        (e as Error).message,
        'JWTValidationFailure',
        401
      );
    }
    let LMSIssuer;
    let LMSClientId;
    let LMSDeploymentId;
    let LMSDeepLinkSettings;
    try {
      LMSIssuer = payload.getTruthyClaim('custom:LMS:Issuer');
      LMSClientId = payload
        .getTruthyClaim('custom:LMS:ClientId')
        .replace('[', '')
        .replace(']', '');
      LMSDeploymentId = payload.getTruthyClaim('custom:LMS:DeploymentId');
      LMSDeepLinkSettings = JSON.parse(
        payload.getTruthyClaim('custom:LMS:DLSettings')
      );
    } catch (e) {
      powertools.logger.info(
        'Integration is not using tool side OIDC flow with custom claims'
      );
      if (
        !payload.iss ||
        !payload.aud ||
        !payload.deploymentId ||
        !payload.deepLinkingSettingsReturnUrl ||
        !payload.deepLinkingSettingsData
      ) {
        throw new LtiCustomError(
          'Failed to get required claims from token',
          'RequiredClaimsMissingInToken',
          400
        );
      }
      LMSIssuer = payload.iss;
      if (typeof payload.aud === 'string') {
        LMSClientId = payload.aud;
      } else {
        LMSClientId = payload.aud[0];
      }
      LMSDeploymentId = payload.deploymentId;
      LMSDeepLinkSettings = {
        deep_link_return_url: payload.deepLinkingSettingsReturnUrl,
        data: payload.deepLinkingSettingsData,
      };
    }
    const LMSDeepLinkReturnURL = LMSDeepLinkSettings.deep_link_return_url;
    try {
      kids = await jwks.all();
      kid = kids.keys[0].kid;
    } catch (e) {
      throw new LtiCustomError((e as Error).message, 'FailedToGetJWKS', 500);
    }
    if (!kid) {
      throw new LtiCustomError(
        'Failed to get kid from JWKS',
        'FailedToGetJWKS',
        500
      );
    }
    const message = await createDeepLinkingMessage(
      {
        aud: LMSIssuer,
        iss: LMSClientId,
        deploymentId: LMSDeploymentId,
      },
      ltiResourceLinks,
      {
        message: 'Successfully registered resource!',
        deepLinkingSettingsData: LMSDeepLinkSettings.data,
      },
      { keyId: KMS_KEY_ID, kid: kid }
    );
    // Nonce is required for 'style-src' and 'script-src' to prevent using 'unsafe-inline'
    const nonce = uuidv4();
    const formHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style nonce="${nonce}">
          form {
            display: none;
          }
        </style>
      </head>
      <body>
        <form id="ltijs_submit" action="${LMSDeepLinkReturnURL}" method="POST">
          <input type="hidden" name="JWT" value="${message}" />
        </form>
        <script nonce="${nonce}">
          document.getElementById("ltijs_submit").submit()
        </script>
      </body>
      </html>
    `;
    powertools.metrics.addMetric(DEEP_LINK_PROXY_FAILURE, MetricUnits.Count, 0);
    return {
      statusCode: 200,
      body: formHtml,
      headers: {
        'Content-type': 'text/html',
        'Content-Security-Policy': `default-src 'self'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'`,
      },
    };
  }
}

export const deepLinkingProxy = new LambdaFunction();
export const handler = deepLinkingProxy.handler;
