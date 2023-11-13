import 'aws-sdk-client-mock-jest';
import * as helpers from '../src/helpers';
import {
  ContentItemLTIResourceLink,
  ContentItemTypes,
  createDeepLinkingMessage,
} from '../src/ltiDeepLinking';

const mockGetSignedJWT = jest
  .spyOn(helpers, 'getSignedJWT')
  .mockResolvedValue('token_string');

const receivedToken = {
  aud: 'testAud',
  iss: 'testIss',
  deploymentId: 'testDeploymentId',
};
const contentItems: ContentItemLTIResourceLink[] = [
  {
    type: ContentItemTypes.LTIResourceLink,
    url: 'testUrl',
  },
];
const options = {
  message: 'testMessage',
  deepLinkingSettingsData: 'deepLinkingSettingsData',
};
const keyDetails = { keyId: 'keyId', kid: 'kid' };
const jwtBody = {
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400,
  iss: 'testIss',
  aud: ['testAud'],
  'https://purl.imsglobal.org/spec/lti/claim/deployment_id': 'testDeploymentId',
  'https://purl.imsglobal.org/spec/lti-dl/claim/content_items': contentItems,
  'https://purl.imsglobal.org/spec/lti-dl/claim/msg': options.message,
  'https://purl.imsglobal.org/spec/lti-dl/claim/data':
    options.deepLinkingSettingsData,
};
describe('createDeepLinkingMessage', () => {
  beforeEach(() => {
    jest.resetModules();
  });
  it('method works as expected', async () => {
    const signedJWT = await createDeepLinkingMessage(
      receivedToken,
      contentItems,
      options,
      keyDetails
    );
    expect(mockGetSignedJWT).toHaveBeenCalledTimes(1);
    expect(mockGetSignedJWT).toHaveBeenCalledWith(
      expect.objectContaining(jwtBody),
      keyDetails
    );
    expect(signedJWT).toBe('token_string');
  });
});
