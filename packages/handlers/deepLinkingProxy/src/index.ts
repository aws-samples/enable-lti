import {
  ContentItemLTIResourceLink,
  DynamoDBJwks,
  DynamoDBLtiToolConfig,
  DynamoDBPlatformConfig,
  LTIJwtPayload,
  LambdaInterface,
  LtiCustomError,
  Powertools,
  createDeepLinkingMessage,
  injectPowertools,
  requiredTruthyValueFromRequest,
  requiredValueFromRequest,
  sendSignedGetRequest,
  tryCatchWrapper,
} from '@enable-lti/util';
import { MetricUnits } from '@aws-lambda-powertools/metrics';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as jose from 'jose';
import { v4 as uuidv4 } from 'uuid';

const CONTROL_PLANE_TABLE_NAME = process.env.CONTROL_PLANE_TABLE_NAME || '';
const KMS_KEY_ID = process.env.KMS_KEY_ID || '';
const platform = new DynamoDBPlatformConfig(CONTROL_PLANE_TABLE_NAME);
const tool = new DynamoDBLtiToolConfig(CONTROL_PLANE_TABLE_NAME);
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
    const LMSIssuer = payload.getTruthyClaim('custom:LMS:Issuer');
    const LMSClientId = payload
      .getTruthyClaim('custom:LMS:ClientId')
      .replace('[', '')
      .replace(']', '');
    const LMSDeploymentId = payload.getTruthyClaim('custom:LMS:DeploymentId');
    const LMSDeepLinkSettings = JSON.parse(
      payload.getTruthyClaim('custom:LMS:DLSettings')
    );
    const LMSDeepLinkReturnURL = LMSDeepLinkSettings.deep_link_return_url;
    const toolConfigRecord = await tool.load(LMSClientId, LMSIssuer);

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
    const areResourceLinksValid = await verifyResourceLinks(
      ltiResourceLinks,
      toolConfigRecord.cmpResourceLinkAPIURL()
    );
    if (areResourceLinksValid) {
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
      powertools.metrics.addMetric(
        DEEP_LINK_PROXY_FAILURE,
        MetricUnits.Count,
        0
      );
      return {
        statusCode: 200,
        body: formHtml,
        headers: {
          'Content-type': 'text/html',
          'Content-Security-Policy': `default-src 'self'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'`,
        },
      };
    } else {
      throw new LtiCustomError(
        'resourceLinks selection is tampered in CMP UI',
        'ResourceLinksTampered',
        403
      );
    }
  }
}

export const deepLinkingProxy = new LambdaFunction();
export const handler = deepLinkingProxy.handler;

export const verifyResourceLinks = async (
  ltiResourceLinks: ContentItemLTIResourceLink[],
  CMPResourceLinksURL: string | undefined
) => {
  if (!CMPResourceLinksURL) {
    throw new LtiCustomError(
      'Tool config is missing Resource Link URL',
      DEEP_LINK_PROXY_FAILURE,
      500
    );
  }
  let response;
  try {
    response = await sendSignedGetRequest(CMPResourceLinksURL);
  } catch (e) {
    throw new LtiCustomError(
      (e as Error).message,
      DEEP_LINK_PROXY_FAILURE,
      500
    );
  }
  if (!response || response.status !== 200) {
    throw new LtiCustomError(
      `Failed to get CMP resource links for verification ${CMPResourceLinksURL}`,
      DEEP_LINK_PROXY_FAILURE,
      500
    );
  }
  const responseData = response.data as ContentItemLTIResourceLink[];
  for (const ltiResourceLink of ltiResourceLinks) {
    if (responseData.findIndex((rl) => rl.url === ltiResourceLink.url) === -1) {
      return false;
    }
  }
  return true;
};
