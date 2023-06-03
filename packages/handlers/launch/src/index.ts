import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
} from 'aws-lambda';
import {
  abort,
  DynamoDBJwks,
  DynamoDBLtiToolConfig,
  DynamoDBPlatformConfig,
  DynamoDBState,
  LambdaInterface,
  LTIMessageTypes,
  ContentItemLTIResourceLink,
  ContentItemTypes,
  createDeepLinkingMessage,
  awsAmplifyUrlSafeEncode,
  errorResponse,
  INTERNAL_ERROR,
  REQUEST_ERROR,
  TOOL_REDIRECT_SUCCESS,
  TOOL_REDIRECT_FAILURE,
  DEEP_LINK_FAILURE,
  DEEP_LINK_SUCCESS,
  APIGatewayProxyEventWithLtiLaunchAuth,
  LtiLaunchAuth,
  Powertools,
  injectPowertools,
} from '@enable-lti/util';
import { MetricUnits } from '@aws-lambda-powertools/metrics';

const CONTROL_PLANE_TABLE_NAME = process.env.CONTROL_PLANE_TABLE_NAME || '';
const DATA_PLANE_TABLE_NAME = process.env.DATA_PLANE_TABLE_NAME || '';
const KMS_KEY_ID = process.env.KMS_KEY_ID || '';

const powertools = Powertools.getInstance();
const ltiLaunchAuth = new LtiLaunchAuth({ powertools });

export class LambdaFunction implements LambdaInterface {
  @ltiLaunchAuth.launchAuthHandler({
    platform: new DynamoDBPlatformConfig(CONTROL_PLANE_TABLE_NAME),
    state: new DynamoDBState(DATA_PLANE_TABLE_NAME),
    tool: new DynamoDBLtiToolConfig(CONTROL_PLANE_TABLE_NAME),
    jwks: new DynamoDBJwks(CONTROL_PLANE_TABLE_NAME, KMS_KEY_ID),
    kmsKeyId: KMS_KEY_ID,
  })
  @injectPowertools(powertools)
  public async handler(
    event: APIGatewayProxyEventWithLtiLaunchAuth,
    context?: Context,
    callback?: Callback<APIGatewayProxyResult>
  ): Promise<APIGatewayProxyResult> {
    try {
      const tool = event.toolRecord;
      const state = event.stateRecord;
      const payload = event.payload;
      const kid = event.kid;
      switch (payload.messageType as LTIMessageTypes) {
        case LTIMessageTypes.LTIResourceLink: {
          powertools.logger.info('Starting TargetLink Launch Flow');
          const targetPath = awsAmplifyUrlSafeEncode(
            `/${payload.targetLinkUri!.split(tool.url)[1]}`
          );
          if (!targetPath) {
            return errorResponse(
              powertools,
              new Error('Issue with TargetLinkUrl'),
              400,
              REQUEST_ERROR,
              TOOL_REDIRECT_FAILURE
            );
          }
          const toolOIDCURL = tool.toolOIDCAuthorizeURL(tool.url, targetPath, payload.targetLinkUri);
          powertools.logger.info(toolOIDCURL);
          powertools.metrics.addMetric(
            TOOL_REDIRECT_SUCCESS,
            MetricUnits.Count,
            1
          );
          return {
            statusCode: 302,
            body: '',
            multiValueHeaders: {
              'Set-Cookie': [`state=${state.id}; nonce=${state.nonce};`],
            },
            headers: {
              Location: `${toolOIDCURL}?id_token=${state.id_token}`,
            },
          };
        }
        case LTIMessageTypes.LTIDeepLinkingRequest: {
          try {
            powertools.logger.info('Starting Deeplinking Flow');
            const ltiResourceLinks: ContentItemLTIResourceLink[] =
              tool.data.LTIResourceLinks!.map((item) => {
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
                deepLinkingSettingsData: payload.deepLinkingSettingsData!,
              };
              const message = await createDeepLinkingMessage(
                {
                  aud: payload.aud as string,
                  iss: payload.iss as string,
                  deploymentId: payload.deploymentId as string,
                },
                ltiResourceLinks,
                options,
                { keyId: KMS_KEY_ID, kid }
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
                DEEP_LINK_SUCCESS,
                MetricUnits.Count,
                1
              );
              return {
                statusCode: 200,
                body: formHtml,
                headers: { 'Content-type': 'text/html' },
              };
            }
            else {
              const targetPath = awsAmplifyUrlSafeEncode(
                `/${payload.targetLinkUri!.split(tool.url)[1]}`
              );
              if (!targetPath) {
                return errorResponse(
                  powertools,
                  new Error('Issue with TargetLinkUrl'),
                  400,
                  REQUEST_ERROR,
                  TOOL_REDIRECT_FAILURE
                );
              }
              const toolOIDCURL = tool.toolOIDCAuthorizeURL(tool.url, targetPath, payload.targetLinkUri);
              powertools.metrics.addMetric(
                DEEP_LINK_SUCCESS,
                MetricUnits.Count,
                1
              );
              return {
                statusCode: 302,
                body: '',
                multiValueHeaders: {
                  'Set-Cookie': [`state=${state.id}; nonce=${state.nonce};`],
                },
                headers: {
                  Location: `${toolOIDCURL}?id_token=${state.id_token}`,
                },
              }
            }
          } catch (e: any) {
            return errorResponse(
              powertools,
              e as Error,
              500,
              INTERNAL_ERROR,
              DEEP_LINK_FAILURE
            );
          }
        }
        default: {
          powertools.logger.error('UnknownLTIMessageType', LTIMessageTypes);
          return abort(400, 'Unknown');
        }
      }
    } finally {
      powertools.metrics.publishStoredMetrics();
    }
  }
}

export const launchLambda = new LambdaFunction();
export const handler = launchLambda.handler;
