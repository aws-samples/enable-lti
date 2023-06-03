import { handler as loginHandler } from '@enable-lti/oidc';
import { handler as launchAuthHandler } from '@enable-lti/launch';
import {
  DynamoDBLtiToolConfig,
  getSignedJWT,
  LtiToolConfigRecord,
  DynamoDBPlatformConfig,
  PlatformConfigRecord,
  DynamoDBJwks,
  APIGatewayProxyEventWithLtiLaunchAuth,
} from '@enable-lti/util';
import {
  loginRequestEvent,
  launchProxyRequestEvent,
} from '../utils/eventGenerator';
import { is200Response, isRedirectResponse } from '../utils/validators';
import {
  platformConfig,
  CLIENT_ID,
  ISS,
  AUTH_TOKEN_URL,
  jwtBodyForLaunch,
  TOOL_OIDC_DOMAIN,
  integToolConfig,
  jwtBodyForDeepLinking,
} from '../utils/models';

/**
 * Specification for first 2 steps in this integ test is below:
 * https://www.imsglobal.org/spec/security/v1p0/#openid_connect_launch_flow
 *
 * Please note that this test is primarily for Canvas LMS platform
 * As we test for more LMS platforms, we will add similar e2e tests for each
 */

describe('CanvasLMS deep linking flow works', () => {
  const CONTROL_TABLE_NAME = process.env.CONTROL_PLANE_TABLE_NAME!;
  const JWK_URL = process.env.JWK_URL!;
  const KMS_KEY_ID = process.env.KMS_KEY_ID!;
  let KID: string | undefined;

  beforeAll(async () => {
    const platform = new DynamoDBPlatformConfig(CONTROL_TABLE_NAME);
    const jwks = new DynamoDBJwks(CONTROL_TABLE_NAME, KMS_KEY_ID);
    const kids = await jwks.all();
    KID = kids.keys[0].kid;
    let platformConfigRecord: PlatformConfigRecord;
    try {
      platformConfigRecord = await platform.load(CLIENT_ID, ISS);
    } catch {
      platformConfigRecord = await platform.save(platformConfig(JWK_URL));
    }
    const tool = new DynamoDBLtiToolConfig(CONTROL_TABLE_NAME);
    let toolConfigRecord: LtiToolConfigRecord;
    try {
      toolConfigRecord = await tool.load(CLIENT_ID, ISS);
    } catch {
      toolConfigRecord = await tool.save(integToolConfig(CLIENT_ID));
    }
  });

  test('user launched tool from CanvasLMS, deep linking flow', async () => {
    //Simulating CanvasLMS calling ELTI for 3rd party login launch flow
    const loginEvent = loginRequestEvent();
    const loginRes = await loginHandler(loginEvent);
    expect(loginRes).toBeDefined();
    expect(isRedirectResponse(loginRes, AUTH_TOKEN_URL)).toBe(true);
    const params = new URLSearchParams(loginRes.headers!.Location as string);
    const state = params.get('state');
    const nonce = params.get('nonce');
    //ELTI has redirected to CanvasLMS auth token url above
    //-------------------------------------------------------
    //now simulating canvasLMS calling back ELTI with token
    expect(state).toBeDefined();
    expect(nonce).toBeDefined();
    const signedJWT = await getSignedJWT(jwtBodyForDeepLinking(nonce!), {
      keyId: KMS_KEY_ID,
      kid: KID!,
    });
    const launchEvent = launchProxyRequestEvent(signedJWT, state!);
    const launchRes = await launchAuthHandler(launchEvent as APIGatewayProxyEventWithLtiLaunchAuth);
    expect(launchRes).toBeDefined();
    expect(is200Response(launchRes)).toBe(true);
  });
});
