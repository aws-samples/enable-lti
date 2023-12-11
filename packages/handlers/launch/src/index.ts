import { APIGatewayProxyResult, Callback, Context } from 'aws-lambda';
import {
  APIGatewayProxyEventWithLtiLaunchAuth,
  ContentItemLTIResourceLink,
  ContentItemTypes,
  DynamoDBJwks,
  DynamoDBLtiToolConfig,
  DynamoDBPlatformConfig,
  DynamoDBState,
  LTIMessageTypes,
  LambdaInterface,
  LtiCustomError,
  LtiLaunchAuth,
  Powertools,
  awsAmplifyUrlSafeEncode,
  createDeepLinkingMessage,
  injectPowertools,
  tryCatchWrapper,
} from '@enable-lti/util';
import { MetricUnits } from '@aws-lambda-powertools/metrics';
import { v4 as uuidv4 } from 'uuid';

const CONTROL_PLANE_TABLE_NAME = process.env.CONTROL_PLANE_TABLE_NAME || '';
const DATA_PLANE_TABLE_NAME = process.env.DATA_PLANE_TABLE_NAME || '';
const KMS_KEY_ID = process.env.KMS_KEY_ID || '';
const MISSING_CUSTOM_CLAIM = 'MissingCustomClaim';
const LAUNCH_FAILURE = 'LaunchFailure';
const powertools = Powertools.getInstance();
const ltiLaunchAuth = new LtiLaunchAuth({ powertools });
const state = new DynamoDBState(DATA_PLANE_TABLE_NAME);
const platform = new DynamoDBPlatformConfig(CONTROL_PLANE_TABLE_NAME);
const tool = new DynamoDBLtiToolConfig(CONTROL_PLANE_TABLE_NAME);
const jwks = new DynamoDBJwks(CONTROL_PLANE_TABLE_NAME, KMS_KEY_ID);

export class LambdaFunction implements LambdaInterface {
  @tryCatchWrapper({
    defaultErrorMetric: LAUNCH_FAILURE,
    powertools,
  })
  @ltiLaunchAuth.launchAuthHandler({
    platform,
    state,
    tool,
    jwks,
    kmsKeyId: KMS_KEY_ID,
  })
  @injectPowertools(powertools)
  public async handler(
    event: APIGatewayProxyEventWithLtiLaunchAuth,
    context?: Context,
    callback?: Callback<APIGatewayProxyResult>
  ): Promise<APIGatewayProxyResult> {
    const tool = event.toolRecord;
    const stateRecord = event.stateRecord;
    const payload = event.payload;
    const kid = event.kid;
    powertools.logger.info(
      `Custom Claim: ${JSON.stringify(payload.customClaim)}`
    );
    if (!payload.courseId || !payload.lmsUserId) {
      powertools.logger.info('Missing courseId or lmsUserId');
      powertools.metrics.addMetric(MISSING_CUSTOM_CLAIM, MetricUnits.Count, 1);
    } else {
      powertools.metrics.addMetric(MISSING_CUSTOM_CLAIM, MetricUnits.Count, 0);
    }
    switch (payload.messageType as LTIMessageTypes) {
      case LTIMessageTypes.LTIResourceLink: {
        if (!payload.targetLinkUri) {
          powertools.logger.error('Missing targetLinkUri');
          throw new LtiCustomError(
            'Missing targetLinkUri in token',
            'RequiredClaimsMissingInToken',
            400
          );
        }
        powertools.logger.info('Starting TargetLink Launch Flow');
        const targetPath = awsAmplifyUrlSafeEncode(
          `/${payload.targetLinkUri!.split(tool.url)[1]}`
        );
        if (!targetPath) {
          throw new LtiCustomError(
            'Issue with TargetLinkUrl',
            'IssueWithTargetLinkUrl',
            400
          );
        }
        const toolOIDCURL = tool.toolOIDCAuthorizeURL(
          stateRecord.id,
          payload.targetLinkUri,
          stateRecord.nonce
        );
        powertools.logger.info(toolOIDCURL);
        stateRecord.nonce = uuidv4();
        stateRecord.nonce_count = 0;
        await state.save(stateRecord);
        powertools.metrics.addMetric(LAUNCH_FAILURE, MetricUnits.Count, 0);
        return {
          statusCode: 302,
          body: '',
          multiValueHeaders: {
            'Set-Cookie': [
              `state=${stateRecord.id}; SameSite=None; Secure`,
              `nonce=${stateRecord.nonce}; SameSite=None; Secure`,
            ],
          },
          headers: {
            Location: `${toolOIDCURL}?id_token=${stateRecord.id_token}`,
          },
        };
      }
      case LTIMessageTypes.LTIDeepLinkingRequest: {
        powertools.logger.info('Starting Deeplinking Flow');
        if (!tool.data.LTIResourceLinks) {
          throw new LtiCustomError(
            'CMP not enabled and resourcelinks not configured in toolconfig',
            'ConfigurationIssue',
            500
          );
        }
        if (
          !payload.deepLinkingSettingsData ||
          !payload.iss ||
          !payload.deploymentId
        ) {
          throw new LtiCustomError(
            'Token missing required claims',
            'RequiredClaimsMissingInToken',
            400
          );
        }
        const ltiResourceLinks: ContentItemLTIResourceLink[] =
          tool.data.LTIResourceLinks.map((item) => {
            return {
              type: ContentItemTypes.LTIResourceLink,
              title: item.title,
              url: item.url,
              lineItem: item.lineItem,
            };
          }) || [];
        if (ltiResourceLinks.length > 0) {
          const options = {
            message: 'Successfully registered resource!',
            deepLinkingSettingsData: payload.deepLinkingSettingsData,
          };
          const message = await createDeepLinkingMessage(
            {
              aud: payload.iss as string,
              iss: payload.aud as string,
              deploymentId: payload.deploymentId as string,
            },
            ltiResourceLinks,
            options,
            { keyId: KMS_KEY_ID, kid }
          );
          powertools.logger.info(message);
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
              <form id="ltijs_submit" action="${payload.deepLinkingSettingsReturnUrl}" method="POST">
                <input type="hidden" name="JWT" value="${message}" />
              </form>
              <script nonce="${nonce}">
                document.getElementById("ltijs_submit").submit()
              </script>
            </body>
            </html>
          `;
          powertools.metrics.addMetric(LAUNCH_FAILURE, MetricUnits.Count, 0);
          return {
            statusCode: 200,
            body: formHtml,
            headers: {
              'Content-type': 'text/html',
              'Content-Security-Policy': `default-src 'self'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'`,
            },
          };
        } else {
          const targetPath = awsAmplifyUrlSafeEncode(
            `/${payload.targetLinkUri!.split(tool.url)[1]}`
          );
          if (!targetPath) {
            throw new LtiCustomError(
              'Issue with TargetLinkUrl',
              'IssueWithTargetLinkUrl',
              400
            );
          }
          const toolOIDCURL = tool.toolOIDCAuthorizeURL(
            targetPath,
            payload.targetLinkUri
          );
          powertools.metrics.addMetric(LAUNCH_FAILURE, MetricUnits.Count, 0);
          return {
            statusCode: 302,
            body: '',
            multiValueHeaders: {
              'Set-Cookie': [
                `state=${stateRecord.id}; SameSite=None; Secure`,
                `nonce=${stateRecord.nonce}; SameSite=None; Secure`,
              ],
            },
            headers: {
              Location: `${toolOIDCURL}?id_token=${stateRecord.id_token}`,
            },
          };
        }
      }
      default: {
        powertools.logger.error('UnknownLTIMessageType', LTIMessageTypes);
        throw new LtiCustomError(
          'Unknown LTI Message Type',
          'UnknownLTIMessageType',
          400
        );
      }
    }
  }
}

export const launchLambda = new LambdaFunction();
export const handler = launchLambda.handler;
