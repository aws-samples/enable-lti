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
import {
  authProxyRequestEvent,
  launchProxyRequestEvent,
  loginRequestEvent,
  logoutRedirectRequestEvent,
  tokenProxyRequestEvent,
} from '../utils/eventGenerator';
import {
  AUTH_TOKEN_URL,
  CLIENT_ID,
  CLIENT_ID_WITH_FORCE_LOGOUT,
  TOOL_OIDC_DOMAIN,
  integToolConfig,
  integToolConfigWithForceLogoutFeature,
  jwtBodyForLaunch,
  platformConfig,
} from '../utils/models';
import { is401Response, isRedirectResponse } from '../utils/validators';

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
    await platform.save(platformConfig(JWK_URL));
    const tool = new DynamoDBLtiToolConfig(CONTROL_TABLE_NAME);
    await tool.save(integToolConfig(CLIENT_ID));
  });

  test('user launched tool from CanvasLMS, OIDC launch flow', async () => {
    //Simulating CanvasLMS calling ELTI for 3rd party login launch flow
    const loginEvent = loginRequestEvent();
    const loginRes = await loginHandler(loginEvent);
    expect(loginRes).toBeDefined();
    expect(isRedirectResponse(loginRes, AUTH_TOKEN_URL)).toBe(true);
    const params = new URLSearchParams(loginRes.headers!.Location as string);
    let eLTIState = params.get('state');
    let eLTINonce = params.get('nonce');

    // Negative cases for login request:
    // Case 1: Bad clientId - config error
    const badLoginEvent = loginRequestEvent('badClientId');
    const badLoginRes = await loginHandler(badLoginEvent);
    expect(badLoginRes).toBeDefined();
    expect(badLoginRes.statusCode).toEqual(400);

    // Case 2: Undefined domain name and path
    const badLoginEventUndefinedDomain = loginRequestEvent();
    badLoginEventUndefinedDomain.requestContext.domainName = undefined;
    const badLoginResUndefinedDomain = await loginHandler(
      badLoginEventUndefinedDomain
    );
    expect(badLoginResUndefinedDomain).toBeDefined();
    expect(badLoginResUndefinedDomain.statusCode).toEqual(400);

    //ELTI has redirected to CanvasLMS auth token url above
    //-------------------------------------------------------
    //now simulating canvasLMS calling back ELTI with token
    expect(eLTIState).toBeDefined();
    expect(eLTINonce).toBeDefined();
    const signedJWT = await getSignedJWT(jwtBodyForLaunch(eLTINonce!), {
      keyId: KMS_KEY_ID,
      kid: KID!,
    });
    const launchEvent = launchProxyRequestEvent(signedJWT, eLTIState!);
    const launchRes = await launchAuthHandler(
      launchEvent as APIGatewayProxyEventWithLtiLaunchAuth
    );
    expect(launchRes).toBeDefined();
    expect(
      isRedirectResponse(launchRes, `${TOOL_OIDC_DOMAIN}oauth2/authorize`)
    ).toBe(true);
    await NegativeCasesInLaunchAuthHandlerStep(
      eLTINonce,
      KMS_KEY_ID,
      KID,
      eLTIState,
      signedJWT
    );

    //ELTI has verified the token and redirected to Tool OIDC above
    //---------------------------------------------------------
    //now simulating Tool OIDC calling ELTI for authorization, we create a code and send
    //https://openid.net/specs/openid-connect-core-1_0.html#CodeFlowSteps
    const cookieArr = launchRes.multiValueHeaders![
      'Set-Cookie'
    ] as Array<string>;
    eLTIState = cookieArr[0].split('=')[1];
    eLTINonce = cookieArr[1].split('=')[1];

    // Negative case for bad state, session not found internally.
    const authProxyEventBadState = authProxyRequestEvent(
      'BadState',
      eLTINonce!
    );
    const authResBadState = await authProxyHandler(authProxyEventBadState);
    expect(authResBadState).toBeDefined();
    expect(authResBadState.statusCode).toEqual(401);

    const authProxyEvent = authProxyRequestEvent(eLTIState!, eLTINonce!);
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
    const rePlayAuthProxyEvent = authProxyRequestEvent(eLTIState!, eLTINonce!);
    const replayAuthProxyRes = await authProxyHandler(rePlayAuthProxyEvent);
    expect(replayAuthProxyRes).toBeDefined();
    expect(replayAuthProxyRes.statusCode).toEqual(401);

    //ELTI has sent a code to Tool OIDCabove
    //--------------------------------------------------
    //now simulating Tool OIDC calling for authentication where ELTI will give the token from canvas LMS
    const tokenProxyEvent = tokenProxyRequestEvent(authCode!);
    const tokenRes = await tokenProxyHandler(tokenProxyEvent);
    expect(tokenRes).toBeDefined();
    expect(tokenRes.statusCode).toEqual(200);
  });
});

async function NegativeCasesInLaunchAuthHandlerStep(
  nonce: string | null,
  KMS_KEY_ID: string,
  KID: string | undefined,
  state: string | null,
  signedJWT: string
) {
  const badState = 'badStatebadStatebadState';
  const launchEventBadState = launchProxyRequestEvent(signedJWT, badState);
  const launchResBadResponse = await launchAuthHandler(
    launchEventBadState as APIGatewayProxyEventWithLtiLaunchAuth
  );
  expect(launchResBadResponse).toBeDefined();
  expect(is401Response(launchResBadResponse)).toBe(true);

  // Negative cases: Issue with targetLinkUri, bad target link uri in the payload inside the token
  const jwtBodyWithBadTargetLinkUri = jwtBodyForLaunch(nonce!);
  jwtBodyWithBadTargetLinkUri[
    'https://purl.imsglobal.org/spec/lti/claim/target_link_uri'
  ] = '';
  const signedJWTWithFaultyTarget_Uri = await getSignedJWT(
    jwtBodyWithBadTargetLinkUri,
    {
      keyId: KMS_KEY_ID,
      kid: KID!,
    }
  );
  const launchEventForBadTargetLinkUri = launchProxyRequestEvent(
    signedJWTWithFaultyTarget_Uri,
    state!
  );
  const launchResForBadTargetLinkUri = await launchAuthHandler(
    launchEventForBadTargetLinkUri as APIGatewayProxyEventWithLtiLaunchAuth
  );
  expect(launchResForBadTargetLinkUri).toBeDefined();
  //expect(launchResForBadTargetLinkUri.statusCode).toEqual(400);
  expect(launchResForBadTargetLinkUri.statusCode).toEqual(401);

  // Negative cases: Issue with the JWT token, JWT_Validation_Failure
  const launchResForBadToken = await launchAuthHandler(
    launchProxyRequestEvent(
      'BadToken',
      state!
    ) as APIGatewayProxyEventWithLtiLaunchAuth
  );
  expect(launchResForBadToken).toBeDefined();
  expect(launchResForBadToken.statusCode).toEqual(401);
}
