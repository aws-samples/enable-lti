import { handler as loginHandler } from '@enable-lti/oidc';
import { handler as launchAuthHandler } from '@enable-lti/launch';
import { handler as authProxyHandler } from '@enable-lti/auth-proxy';
import { handler as tokenProxyHandler } from '@enable-lti/token-proxy';
import {
  DynamoDBLtiToolConfig,
  getSignedJWT,
  LtiToolConfigRecord,
  DynamoDBPlatformConfig,
  PlatformConfigRecord,
  DynamoDBJwks,
  APIGatewayProxyEventWithLtiLaunchAuth,
} from '@enable-lti/util';
//TODO: below utils can be utilized in unit tests as well so move them to util package
import {
  authProxyRequestEvent,
  loginRequestEvent,
  launchProxyRequestEvent,
  tokenProxyRequestEvent,
} from '../utils/eventGenerator';
import { is401Response, isRedirectResponse } from '../utils/validators';
import {
  platformConfig,
  CLIENT_ID,
  ISS,
  AUTH_TOKEN_URL,
  jwtBodyForLaunch,
  TOOL_OIDC_DOMAIN,
  integToolConfig,
} from '../utils/models';

/**
 * Specification for first 2 steps in this integ test is below:
 * https://www.imsglobal.org/spec/security/v1p0/#openid_connect_launch_flow
 *
 * Please note that this test is primarily for Canvas LMS platform
 * As we test for more LMS platforms, we will add similar e2e tests for each
 */

describe('CanvasLMS login launch flow works', () => {
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

  test('user launched tool from CanvasLMS, OIDC launch flow', async () => {
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
    const signedJWT = await getSignedJWT(jwtBodyForLaunch(nonce!), {
      keyId: KMS_KEY_ID,
      kid: KID!,
    });
    const launchEvent = launchProxyRequestEvent(signedJWT, state!);
    const launchRes = await launchAuthHandler(launchEvent as APIGatewayProxyEventWithLtiLaunchAuth);
    expect(launchRes).toBeDefined();
    console.log(launchRes);
    expect(isRedirectResponse(launchRes, TOOL_OIDC_DOMAIN)).toBe(true);
    const badState = 'badStatebadStatebadState';
    const launchEventBadState = launchProxyRequestEvent(signedJWT, badState);
    const launchResBadResponse = await launchAuthHandler(launchEventBadState as APIGatewayProxyEventWithLtiLaunchAuth);
    expect(launchResBadResponse).toBeDefined();
    expect(is401Response(launchResBadResponse)).toBe(true);
    //ELTI has verified the token and redirected to Tool OIDC above
    //---------------------------------------------------------
    //now simulating Tool OIDC calling ELTI for authorization, we create a code and send
    //https://openid.net/specs/openid-connect-core-1_0.html#CodeFlowSteps
    const authProxyEvent = authProxyRequestEvent(state!, nonce!);
    const authRes = await authProxyHandler(authProxyEvent);
    expect(authRes).toBeDefined();
    expect(isRedirectResponse(authRes)).toBe(true);
    const toolOIDCAuthFlowParams = new URLSearchParams(
      authRes.headers!.Location as string
    );
    const authCode = toolOIDCAuthFlowParams.get(
      `${TOOL_OIDC_DOMAIN}/oauth2/idpresponse?code`
    );
    const toolOIDCState = toolOIDCAuthFlowParams.get('state');
    expect(authCode).toBeDefined();
    //ELTI has send a code to Tool OIDCabove
    //--------------------------------------------------
    //now simulating Tool OIDC calling for authentication where ELTI will give the token from canvas LMS
    const tokenProxyEvent = tokenProxyRequestEvent(authCode!);
    const tokenRes = await tokenProxyHandler(tokenProxyEvent);
    expect(tokenRes).toBeDefined();
    expect(tokenRes.statusCode).toEqual(200);
  });
});
