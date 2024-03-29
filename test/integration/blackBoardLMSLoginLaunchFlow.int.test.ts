import { handler as authProxyHandler } from '@enable-lti/auth-proxy';
import { handler as launchAuthHandler } from '@enable-lti/launch';
import { handler as loginHandler } from '@enable-lti/oidc';
import { handler as tokenProxyHandler } from '@enable-lti/token-proxy';
import {
  APIGatewayProxyEventWithLtiLaunchAuth,
  DynamoDBJwks,
  DynamoDBLtiToolConfig,
  DynamoDBPlatformConfig,
  getSignedJWT,
} from '@enable-lti/util';
import axios from 'axios';
import {
  authProxyRequestEvent,
  bbLaunchProxyRequestEvent,
  bbLoginRequestEvent,
  tokenProxyRequestEvent,
} from '../utils/eventGenerator';
import {
  ACCESS_TOKEN_URL,
  AUTH_TOKEN_URL,
  CLIENT_ID,
  DEPLOYMENT_ID,
  TOOL_OIDC_DOMAIN,
  integToolConfig,
  jwtBodyForLaunch,
  platformConfig,
} from '../utils/models';
import {
  is401Response,
  is500Response,
  isRedirectResponse,
} from '../utils/validators';

jest.mock('axios');

/**
 * Specification for first 2 steps in this integ test is below:
 * https://www.imsglobal.org/spec/security/v1p0/#openid_connect_launch_flow
 *
 * Please note that this test is primarily for Canvas LMS platform
 * As we test for more LMS platforms, we will add similar e2e tests for each
 */

describe('BlackBoardLMS login launch flow works', () => {
  const CONTROL_TABLE_NAME = process.env.CONTROL_PLANE_TABLE_NAME!;
  const JWK_URL = process.env.JWK_URL!;
  const KMS_KEY_ID = process.env.KMS_KEY_ID!;
  let KID: string | undefined;

  beforeAll(async () => {
    const platform = new DynamoDBPlatformConfig(CONTROL_TABLE_NAME);
    const jwks = new DynamoDBJwks(CONTROL_TABLE_NAME, KMS_KEY_ID);
    const kids = await jwks.all();
    KID = kids.keys[0].kid;
    await platform.save(platformConfig(JWK_URL, CLIENT_ID, DEPLOYMENT_ID));
    const tool = new DynamoDBLtiToolConfig(CONTROL_TABLE_NAME);
    await tool.save(integToolConfig(CLIENT_ID));
    jest.setTimeout(30000);
  });

  test('user launched tool from BlackBoardLMS, fail at bearer token', async () => {
    const loginEvent = bbLoginRequestEvent();
    const loginRes = await loginHandler(loginEvent);
    expect(loginRes).toBeDefined();
    expect(isRedirectResponse(loginRes, AUTH_TOKEN_URL)).toBe(true);
    const params = new URLSearchParams(loginRes.headers!.Location as string);
    const eLTIState = params.get('state');
    const eLTINonce = params.get('nonce');
    //ELTI has redirected to CanvasLMS auth token url above
    //-------------------------------------------------------
    //now simulating canvasLMS calling back ELTI with token
    expect(eLTIState).toBeDefined();
    expect(eLTINonce).toBeDefined();
    const signedJWT = await getSignedJWT(jwtBodyForLaunch(eLTINonce!), {
      keyId: KMS_KEY_ID,
      kid: KID!,
    });
    (axios.post as jest.Mock).mockRejectedValueOnce(
      new Error('BB failed to give Bearer Token')
    );
    const launchEvent = bbLaunchProxyRequestEvent(signedJWT, eLTIState!);
    const launchResNoAuthToken = await launchAuthHandler(
      launchEvent as APIGatewayProxyEventWithLtiLaunchAuth
    );
    console.log(launchResNoAuthToken);
    expect(is500Response(launchResNoAuthToken)).toBe(true);
    jest.clearAllMocks();
  });

  test('user launched tool from BlackBoardLMS, OIDC launch flow', async () => {
    //Simulating CanvasLMS calling ELTI for 3rd party login launch flow
    const loginEvent = bbLoginRequestEvent();
    const loginRes = await loginHandler(loginEvent);
    expect(loginRes).toBeDefined();
    expect(isRedirectResponse(loginRes, AUTH_TOKEN_URL)).toBe(true);
    const params = new URLSearchParams(loginRes.headers!.Location as string);
    let eLTIState = params.get('state');
    let eLTINonce = params.get('nonce');
    //ELTI has redirected to CanvasLMS auth token url above
    //-------------------------------------------------------
    //now simulating canvasLMS calling back ELTI with token
    expect(eLTIState).toBeDefined();
    expect(eLTINonce).toBeDefined();
    const signedJWT = await getSignedJWT(jwtBodyForLaunch(eLTINonce!), {
      keyId: KMS_KEY_ID,
      kid: KID!,
    });
    const badState = 'badStatebadStatebadState';
    const launchEventBadState = bbLaunchProxyRequestEvent(signedJWT, badState);
    const launchResBadResponse = await launchAuthHandler(
      launchEventBadState as APIGatewayProxyEventWithLtiLaunchAuth
    );
    expect(launchResBadResponse).toBeDefined();
    expect(is401Response(launchResBadResponse)).toBe(true);
    //Good launch response

    const launchEvent = bbLaunchProxyRequestEvent(signedJWT, eLTIState!);
    (axios.post as jest.Mock).mockResolvedValueOnce({
      status: 200,
      data: { access_token: 'ACCESS_TOKEN' },
    });
    const launchRes = await launchAuthHandler(
      launchEvent as APIGatewayProxyEventWithLtiLaunchAuth
    );
    expect(launchRes).toBeDefined();
    expect(axios.post).toHaveBeenCalledWith(
      ACCESS_TOKEN_URL,
      expect.anything()
    );
    expect(isRedirectResponse(launchRes, TOOL_OIDC_DOMAIN)).toBe(true);
    jest.clearAllMocks();

    //ELTI has verified the token and redirected to Tool OIDC above
    //---------------------------------------------------------
    //now simulating Tool OIDC calling ELTI for authorization, we create a code and send
    //https://openid.net/specs/openid-connect-core-1_0.html#CodeFlowSteps
    const cookieArr = launchRes.multiValueHeaders![
      'Set-Cookie'
    ] as Array<string>;
    eLTIState = cookieArr[0].split('=')[1];
    eLTINonce = cookieArr[1].split('=')[1];
    const authProxyEvent = authProxyRequestEvent(eLTIState, eLTINonce);
    const authRes = await authProxyHandler(authProxyEvent);
    expect(authRes).toBeDefined();
    expect(isRedirectResponse(authRes)).toBe(true);
    const toolOIDCAuthFlowParams = new URLSearchParams(
      authRes.headers!.Location as string
    );
    const authCode = toolOIDCAuthFlowParams.get(
      `${TOOL_OIDC_DOMAIN}/oauth2/idpresponse?code`
    );
    expect(authCode).toBeDefined();

    // Negative case: nonce is already used so re-playing should error
    const rePlayAuthProxyEvent = authProxyRequestEvent(eLTIState, eLTINonce);
    const replayAuthProxyRes = await authProxyHandler(rePlayAuthProxyEvent);
    expect(replayAuthProxyRes).toBeDefined();
    expect(replayAuthProxyRes.statusCode).toEqual(401);

    //ELTI has send a code to Tool OIDCabove
    //--------------------------------------------------
    //now simulating Tool OIDC calling for authentication where ELTI will give the token from canvas LMS
    const tokenProxyEvent = tokenProxyRequestEvent(authCode!);
    const tokenRes = await tokenProxyHandler(tokenProxyEvent);
    expect(tokenRes).toBeDefined();
    expect(tokenRes.statusCode).toEqual(200);

    //Negative test re-using the authCode
    const replayTokenRes = await tokenProxyHandler(tokenProxyEvent);
    expect(replayTokenRes).toBeDefined();
    expect(replayTokenRes.statusCode).toEqual(401);
  });
  jest.resetAllMocks();
});
