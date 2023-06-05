import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import * as data from '../../../../test/utils/data';
import { CLIENT_ID, DEPLOYMENT_ID, ISS, jwtBodyForDeepLinking } from '../../../../test/utils/models';
import { ContentItemLTIResourceLink, ContentItemTypes, createDeepLinkingMessage } from '../src/ltiDeepLinking';
import {
    KMSClient,
    SignCommand
} from '@aws-sdk/client-kms';
import { v4 as uuidv4 } from 'uuid';
import * as jose from 'jose';

const kmsMock = mockClient(KMSClient);

beforeEach(() => {
    kmsMock.reset();
});

describe('ltiDeepLinking Tests', () => {

    it('createDeepLinkingMessage', async () => {
        const nonce = uuidv4();
        const payload = jwtBodyForDeepLinking(nonce);

        kmsMock.on(SignCommand).resolves(data.signResponse);

        const ltiResourceLinks: ContentItemLTIResourceLink[] = [{
            type: ContentItemTypes.LTIResourceLink,
            title: 'Test 1',
            url: 'http://test'
        }];

        const options = {
            message: 'Successfully registered resource!',
            deepLinkingSettingsData: '',
        };

        const message = await createDeepLinkingMessage(
            {
                aud: payload.aud,
                iss: payload.iss,
                deploymentId: DEPLOYMENT_ID
            },
            ltiResourceLinks,
            options,
            { keyId: data.jwksGetPublicKey.KeyId!, kid: 'f2cafabe-8d1b-423c-9082-53201c279a0a' }
        );

        const decodedMessage: Record<string, any> = jose.decodeJwt(message);

        expect(kmsMock).toHaveReceivedCommandTimes(SignCommand, 1);
        expect(Array.isArray(decodedMessage.iss)).toBeFalsy();
        expect(decodedMessage.iss).toEqual(CLIENT_ID);
        expect(Array.isArray(decodedMessage.aud)).toBeFalsy();
        expect(decodedMessage.aud).toEqual(ISS);
        expect(decodedMessage['https://purl.imsglobal.org/spec/lti-dl/claim/content_items'][0]['title']).toEqual('Test 1');
    });
});
