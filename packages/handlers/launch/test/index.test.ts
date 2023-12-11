import { handler } from '../src/index';
import { simpleLaunchProxyRequestEvent } from './payloads/learn';
import {
  LTIJwtPayload,
  DynamoDBState,
  APIGatewayProxyEventWithLtiLaunchAuth,
  PlatformConfigRecord,
  DynamoDBStateRecord,
  DynamoDBLtiToolConfig,
  LtiToolConfigRecord,
  DynamoDBJwks,
} from '@enable-lti/util';
import { JSONWebKeySet } from 'jose';
const toolRedirectURL = 'https://toolRedirectURL';
const mockPlatformConfigRecord: PlatformConfigRecord = {
  clientId: 'testClientId',
  iss: 'testIssuer',
  keySetUrl: 'https://test.com',
  authLoginUrl: 'https://test.com',
  authTokenUrl: 'https://test.com',
  accessTokenUrl: 'https://test.com',
  ltiDeploymentId: 'testDeploymentId',
};
const mockToolConfigRecord = {
  id: 'someId',
  issuer: 'testIssuer',
  url: 'https://test.com',
  data: { LTIResourceLinks: [] },
  features: [],
  toolOIDCAuthorizeURL: (target: string, nonce: string) => {
    return toolRedirectURL;
  },
  isFeatureEnabled: (inStr: string) => {
    return false;
  },
  toolOIDCLogoutURL: (target: string, nonce: string) => {
    return toolRedirectURL;
  },
};
const mockLTIJwtPayload = {
  nonce: 'test_nonce',
  platformConfigRecord: mockPlatformConfigRecord,
  messageType: 'LtiResourceLinkRequest',
  targetLinkUri: 'https://test.com/resourceLink',
};
const mockStateRecord = {
  id_token: 'test_id_token',
};
const mockKeys = {
  keys: [
    {
      kid: 'test_kid',
    },
  ],
};
const spyJWTLoad = jest
  .spyOn(LTIJwtPayload, 'load')
  .mockResolvedValue(mockLTIJwtPayload as LTIJwtPayload);
const spyStateLoad = jest
  .spyOn(DynamoDBState.prototype, 'load')
  .mockResolvedValue(mockStateRecord as DynamoDBStateRecord);
const spyStateSave = jest
  .spyOn(DynamoDBState.prototype, 'save')
  .mockResolvedValue(mockStateRecord as DynamoDBStateRecord);
const spyToolLoad = jest
  .spyOn(DynamoDBLtiToolConfig.prototype, 'load')
  .mockResolvedValue(mockToolConfigRecord as unknown as LtiToolConfigRecord);
const spyJwks = jest
  .spyOn(DynamoDBJwks.prototype, 'all')
  .mockResolvedValue(mockKeys as unknown as JSONWebKeySet);
describe('launch', () => {
  afterAll(() => {
    jest.resetAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Can launch', async () => {
    const launchRes = await handler(
      simpleLaunchProxyRequestEvent() as APIGatewayProxyEventWithLtiLaunchAuth
    );
    expect(spyJWTLoad).toHaveBeenCalledTimes(1);
    expect(spyStateLoad).toHaveBeenCalledTimes(1);
    expect(spyStateSave).toHaveBeenCalledTimes(2);
    expect(spyToolLoad).toHaveBeenCalledTimes(1);
    expect(spyJwks).toHaveBeenCalledTimes(1);
    expect(launchRes).toBeDefined();
    expect(launchRes.statusCode).toBe(302);
    expect(launchRes.headers?.Location).toBe(
      `${toolRedirectURL}?id_token=test_id_token`
    );
  });
});
