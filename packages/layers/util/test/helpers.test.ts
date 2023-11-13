import {
  APIGatewayProxyEvent,
  APIGatewayProxyEventHeaders,
  APIGatewayProxyResult,
} from 'aws-lambda/trigger/api-gateway-proxy';
import 'aws-sdk-client-mock-jest';
import * as axios from 'axios';
import * as jose from 'jose';
import * as nodeUtil from 'util';
import { scoreSubmissionRequestEvent } from '../../../../test/utils/eventGenerator';
import { Aws } from '../src/aws';
import { LtiCustomError } from '../src/customErrors';
import * as helpers from '../src/helpers';
import {
  setParamsFromTokenOrRequestCombined,
  sendSignedGetRequest,
  submitGetRequestToLms,
} from '../src/helpers';
import { LTIJwtPayload } from '../src/jwt';
import { RosterRetrievalLmsParams } from '../src/lmsParams';
import {
  DynamoDBPlatformConfig,
  PlatformConfigRecord,
} from '../src/platformConfig';
import { Powertools } from '../src/powertools';

jest.mock('axios');
const mockSign = jest.fn();
jest.mock('@aws-sdk/signature-v4', () => {
  return {
    SignatureV4: jest.fn().mockImplementation(() => {
      return { sign: mockSign };
    }),
  };
});

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2020, 3, 1));
  jest.spyOn(process.stdout, 'write').mockImplementation(function () {
    return true;
  });
});

describe('helpers', () => {
  describe('requestBearerClientCredential', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('Should give acces_token as expected', async () => {
      const testAccessToken = 'ACCESS_TOKEN';
      const testClientId = 'testClientId';
      const testAccessTokenUrl = 'testAccessTokenUrl';
      (axios.default.post as jest.Mock).mockResolvedValue({
        status: 200,
        statusText: 'Succesful',
        /* eslint-disable-next-line camelcase */
        data: { access_token: testAccessToken },
      });

      const platform: Partial<PlatformConfigRecord> = {
        iss: 'testIss',
        accessTokenUrl: testAccessTokenUrl,
        clientId: testClientId,
      };

      const httpSpy = jest.spyOn(axios.default, 'post');

      const signSpy = jest.spyOn(Aws.prototype, 'sign');
      const mockSign = new Uint8Array(Buffer.from('FAKE_PUBLIC_KEY'));
      signSpy.mockResolvedValue(mockSign);

      const jsonSpy = jest.spyOn(JSON, 'stringify');

      const result = await helpers.requestBearerClientCredential(
        platform as PlatformConfigRecord,
        'KId',
        'KmsId'
      );

      // Verify inputs to axios post request
      const httpAccessTokenUrl = httpSpy.mock.calls[0][0];
      expect(httpAccessTokenUrl).toEqual(testAccessTokenUrl);

      const httpSearchParam = httpSpy.mock.calls[0][1] as URLSearchParams;
      expect(httpSearchParam.get('grant_type')).toEqual('client_credentials');
      expect(httpSearchParam.get('client_assertion_type')).toEqual(
        'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
      );
      expect(httpSearchParam.get('scope')).toEqual(
        'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly https://purl.imsglobal.org/spec/lti-ags/scope/lineitem https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly https://purl.imsglobal.org/spec/lti-ags/scope/score'
      );
      const actualTokenHttp = httpSearchParam.get('client_assertion');
      const httpTokenParts = actualTokenHttp?.split('.');
      const httpTokenDecode = Buffer.from(
        httpTokenParts![2],
        'base64url'
      ).toString('binary');
      expect(httpTokenDecode).toEqual('FAKE_PUBLIC_KEY');

      // Verify inputs to JSON.stringify function all
      expect(jsonSpy).toHaveBeenCalledTimes(2);
      const actualJWTPayload = jsonSpy.mock.calls[0][0] as jose.JWTPayload;
      expect(actualJWTPayload.aud).toEqual(testAccessTokenUrl);

      expect(actualJWTPayload.iss).toEqual(testClientId);
      expect(actualJWTPayload.sub).toEqual(testClientId);

      const actualHeader = jsonSpy.mock.calls[1][0];
      const expectedHeader = {
        typ: 'JWT',
        alg: 'RS256',
        kid: 'KId',
      };

      expect(actualHeader).toEqual(expectedHeader);

      // Verify inputs to AWS.sign call
      const encodedclientAssertion = signSpy.mock.calls[0][1];
      const observedClientAssertion = new nodeUtil.TextDecoder().decode(
        encodedclientAssertion
      );
      const observedHeaderJson = observedClientAssertion.split('.')[0];
      const observedPayloadB64 = observedClientAssertion.split('.')[1];
      const observedPayloadString = Buffer.from(
        observedPayloadB64,
        'base64url'
      ).toString('binary');
      const observedPayloadJson = JSON.parse(observedPayloadString);
      expect(observedPayloadJson.aud).toEqual(testAccessTokenUrl);
      expect(observedPayloadJson.iss).toEqual(testClientId);
      expect(observedPayloadJson.sub).toEqual(testClientId);
      expect(observedHeaderJson).toEqual(
        Buffer.from(JSON.stringify(expectedHeader)).toString('base64url')
      );

      // Verify final result
      expect(result).toBe(testAccessToken);
    });

    it('Failure in case of missing access token Url', async () => {
      const failureStatus = 400;
      const failureStatusText = 'Failure';
      (axios.default.post as jest.Mock).mockResolvedValue({
        status: failureStatus,
        statusText: failureStatusText,
        data: {},
      });

      const platform: Partial<PlatformConfigRecord> = {
        iss: 'testIss',
        clientId: 'testClientId',
      };

      const signSpy = jest.spyOn(Aws.prototype, 'sign');
      const mockSign = new Uint8Array(Buffer.from('FAKE_PUBLIC_KEY'));
      signSpy.mockResolvedValue(mockSign);

      await expect(
        helpers.requestBearerClientCredential(
          platform as PlatformConfigRecord,
          'KId',
          'KmsId'
        )
      ).rejects.toThrowError(
        `Error retrieving access token from platform ${platform.accessTokenUrl}. ${failureStatus}: ${failureStatusText}`
      );
    });

    it('Failure in case of bad kms Key Id', async () => {
      (axios.default.post as jest.Mock).mockResolvedValue({
        status: 200,
        statusText: 'Succesful',
        /* eslint-disable-next-line camelcase */
        data: { access_token: 'ACCESS_TOKEN' },
      });

      const platform: Partial<PlatformConfigRecord> = {
        iss: 'testIss',
        accessTokenUrl: 'testAccessTokenUrl',
        clientId: 'testClientId',
      };

      const signSpy = jest.spyOn(Aws.prototype, 'sign');

      const FakeError = 'FAKE_ERROR';
      signSpy.mockRejectedValue(new Error(FakeError));
      await expect(
        helpers.requestBearerClientCredential(
          platform as PlatformConfigRecord,
          'KId',
          'badKmsId'
        )
      ).rejects.toThrowError(FakeError);
    });
  });

  describe('abort', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('Should return APIGatewayProxyResult as expected', () => {
      const statusCode = 1;
      const statusMessage = 'TestMessage';
      const result = helpers.abort(statusCode, statusMessage);
      const expectedResult = {
        statusCode: statusCode,
        body: `"${statusMessage}"`,
      } as APIGatewayProxyResult;
      expect(result).toEqual(expectedResult);
    });
  });

  describe('requiredValueFromRequest', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const key = 'KEY';
    it('Should return value from request as expected', async () => {
      const apiGatewayProxyEvent: Partial<APIGatewayProxyEvent> = {
        queryStringParameters: {
          KEY: 'VALUE',
        },
      };

      const result = await helpers.requiredValueFromRequest(
        apiGatewayProxyEvent as APIGatewayProxyEvent,
        key
      );
      expect(result).toEqual('VALUE');
    });

    it('Should throw error if key is not present', () => {
      const apiGatewayProxyEvent: Partial<APIGatewayProxyEvent> = {
        queryStringParameters: {
          BadKey: 'VALUE',
        },
      };

      expect(() => {
        helpers.requiredValueFromRequest(
          apiGatewayProxyEvent as APIGatewayProxyEvent,
          key
        );
      }).toThrowError(`${key} not available in request`);
    });
  });

  describe('requiredTruthyValueFromRequest', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const key = 'KEY';
    it('Should return value from request as expected', async () => {
      const value = 'VALUE';
      const apiGatewayProxyEvent: Partial<APIGatewayProxyEvent> = {
        queryStringParameters: {
          KEY: 'VALUE',
        },
      };

      const result = await helpers.requiredTruthyValueFromRequest(
        apiGatewayProxyEvent as APIGatewayProxyEvent,
        key
      );
      expect(result).toEqual(value);
    });

    it('Should throw error if key is not present', () => {
      const apiGatewayProxyEvent: Partial<APIGatewayProxyEvent> = {
        queryStringParameters: {
          BadKey: 'VALUE',
        },
      };

      expect(() => {
        helpers.requiredTruthyValueFromRequest(
          apiGatewayProxyEvent as APIGatewayProxyEvent,
          key
        );
      }).toThrowError(`${key} not available in request`);
    });

    it('Should throw error if key is present but value is empty', () => {
      const apiGatewayProxyEvent: Partial<APIGatewayProxyEvent> = {
        queryStringParameters: {
          key: '',
        },
      };

      expect(() => {
        helpers.requiredTruthyValueFromRequest(
          apiGatewayProxyEvent as APIGatewayProxyEvent,
          key
        );
      }).toThrowError(`${key} not available in request`);
    });
  });

  describe('requiredAllowedValueFromRequest', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const key = 'KEY';
    it('Should return value from request as expected', () => {
      const value = 'VALUE';
      const apiGatewayProxyEvent: Partial<APIGatewayProxyEvent> = {
        queryStringParameters: {
          KEY: 'VALUE',
        },
      };

      const result = helpers.requiredAllowedValueFromRequest(
        apiGatewayProxyEvent as APIGatewayProxyEvent,
        key,
        [value]
      );
      expect(result).toEqual(value);
    });

    it('Should throw error if key is not present', () => {
      const apiGatewayProxyEvent: Partial<APIGatewayProxyEvent> = {
        queryStringParameters: {
          BadKey: 'VALUE',
        },
      };

      expect(() => {
        helpers.requiredAllowedValueFromRequest(
          apiGatewayProxyEvent as APIGatewayProxyEvent,
          key,
          ['VALUE']
        );
      }).toThrowError(`${key} is invalid in request`);
    });

    it('Should throw error if key is not present', () => {
      const apiGatewayProxyEvent: Partial<APIGatewayProxyEvent> = {
        queryStringParameters: {
          key: 'VALUE',
        },
      };

      expect(() => {
        helpers.requiredAllowedValueFromRequest(
          apiGatewayProxyEvent as APIGatewayProxyEvent,
          key,
          ['ValueAllowed']
        );
      }).toThrowError(`${key} is invalid in request`);
    });
  });

  describe('valueFromCookies', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const cookieKey = 'state';
    it('Should return value from cookie as expected', () => {
      const apiGatewayProxyEventHeaders: Partial<APIGatewayProxyEventHeaders> =
        {
          cookie: `${cookieKey}=stateValue;`,
        };

      const result = helpers.valueFromCookies(
        apiGatewayProxyEventHeaders as APIGatewayProxyEventHeaders,
        cookieKey
      );
      expect(result).toEqual('stateValue');
    });

    it('Return undefined if cookie is not present in header', () => {
      const apiGatewayProxyEventHeaders: Partial<APIGatewayProxyEventHeaders> =
        {};

      const result = helpers.valueFromCookies(
        apiGatewayProxyEventHeaders as APIGatewayProxyEventHeaders,
        cookieKey
      );
      expect(result).toEqual(undefined);
    });

    it("Return undefined if cookie doesn't contain the desired key", () => {
      const apiGatewayProxyEventHeaders: Partial<APIGatewayProxyEventHeaders> =
        {
          cookie: 'RamdonCookie=alpha',
        };

      const result = helpers.valueFromCookies(
        apiGatewayProxyEventHeaders as APIGatewayProxyEventHeaders,
        cookieKey
      );
      expect(result).toEqual(undefined);
    });
  });

  describe('requiredValueFromCookies', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('Should return required value from cookie as expected', () => {
      const apiGatewayProxyEventHeaders: Partial<APIGatewayProxyEventHeaders> =
        {
          cookie: 'state=stateValue;',
        };

      const result = helpers.requiredValueFromCookies(
        apiGatewayProxyEventHeaders as APIGatewayProxyEventHeaders,
        'state'
      );
      expect(result).toEqual('stateValue');
    });

    it('Should throw error if key is not present in the cookie', () => {
      const apiGatewayProxyEventHeaders: Partial<APIGatewayProxyEventHeaders> =
        {
          cookie: 'state=stateValue;',
        };

      expect(() => {
        helpers.requiredValueFromCookies(
          apiGatewayProxyEventHeaders as APIGatewayProxyEventHeaders,
          'newCookie'
        );
      }).toThrowError('newCookie not available in cookie');
    });
  });

  describe('getSignedJWT', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('Should return signed jwt', async () => {
      const signSpy = jest.spyOn(Aws.prototype, 'sign');
      const mockSign = new Uint8Array(Buffer.from('FAKE_PUBLIC_KEY'));
      signSpy.mockResolvedValue(mockSign);

      const result = await helpers.getSignedJWT(
        {},
        { keyId: 'ddd', kid: 'kid' }
      );

      // Verify inputs to AWS sign call.
      const encodedclientAssertion = signSpy.mock.calls[0][1];
      const observedClientAssertion = new nodeUtil.TextDecoder().decode(
        encodedclientAssertion
      );
      const observedHeaderJson = observedClientAssertion.split('.')[0];
      const observedPayloadB64 = observedClientAssertion.split('.')[1];
      const observedPayloadString = Buffer.from(
        observedPayloadB64,
        'base64url'
      ).toString('binary');
      const observedPayloadJson = JSON.parse(observedPayloadString);
      expect(observedPayloadJson).toEqual({});

      const expectedHeader = {
        alg: 'RS256',
        typ: 'JWT',
        kid: 'kid',
      };
      expect(observedHeaderJson).toEqual(
        Buffer.from(JSON.stringify(expectedHeader)).toString('base64url')
      );

      // Verify output from getSignedJWT
      expect(result).toEqual(
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtpZCJ9.e30.RkFLRV9QVUJMSUNfS0VZ'
      );
    });
  });

  describe('awsAmplifyUrlSafeEncode', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('Expected alteration of input string', () => {
      const result = helpers.awsAmplifyUrlSafeEncode('string');
      expect(result).toEqual('-737472696e67');
    });
  });

  describe('isIsoDateString', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('Expected isIsoDateString check', () => {
      const result = helpers.isIsoDateString('2011-10-05T14:48:00.000Z');
      expect(result).toEqual(true);
    });

    it('Expected non Iso string check', () => {
      const result = helpers.isIsoDateString('string');
      expect(result).toEqual(false);
    });
  });

  /* eslint-disable camelcase */
  describe('setParamsFromTokenOrRequestCombined', () => {
    const joseDecodeJwt = jest.fn();
    jest.mock('jose', () => ({
      decodeJwt: (jwt: any) => joseDecodeJwt(jwt),
    }));

    const dummyJwtPayload = {
      identities: [
        {
          userId: 'FakeUserId',
        },
      ],
    };
    const iss = 'iss';
    const client_id = 'cid';
    const deployment_id = 'did';
    const lineItem = 'lineItem';
    const lms_student_id = 'sid';

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('Should throw error if neither token is provided and none of required params are present in body"', async () => {
      const emptyRequestBody = {};
      const requiredTruthyValueFromRequestSpy = jest.spyOn(
        helpers,
        'requiredTruthyValueFromRequest'
      );

      const eventWithoutTokenAndRequestBodyParams = scoreSubmissionRequestEvent(
        JSON.stringify(emptyRequestBody)
      );

      await expect(
        setParamsFromTokenOrRequestCombined(
          eventWithoutTokenAndRequestBodyParams,
          undefined as unknown as DynamoDBPlatformConfig,
          Powertools.getInstance(),
          new RosterRetrievalLmsParams(),
          'LmsParams'
        )
      ).rejects.toThrowError('issuer not available in request');
      expect(requiredTruthyValueFromRequestSpy).toHaveBeenCalledTimes(1);

      const actualEventReceived = requiredTruthyValueFromRequestSpy.mock
        .calls[0][0] as APIGatewayProxyEvent;
      expect(actualEventReceived.body).toEqual(
        JSON.stringify(emptyRequestBody)
      );

      const actualFirstRequestedKey = requiredTruthyValueFromRequestSpy.mock
        .calls[0][1] as string;
      expect(actualFirstRequestedKey).toEqual('issuer');
    });

    it('Should throw error if neither token is provided and partial required params are present in body', async () => {
      const goodObject = {
        id_token: undefined,
        issuer: iss,
        //client_id: client_id,
        deployment_id: deployment_id,
        lineitem: lineItem,
        lms_student_id: '3898ba10-1eca-4558-a722-a3a48308a456', //Missing student id in request
      };
      const requiredTruthyValueFromRequestSpy = jest.spyOn(
        helpers,
        'requiredTruthyValueFromRequest'
      );

      const goodEvent = scoreSubmissionRequestEvent(JSON.stringify(goodObject));

      await expect(
        setParamsFromTokenOrRequestCombined(
          goodEvent,
          undefined as unknown as DynamoDBPlatformConfig,
          Powertools.getInstance(),
          new RosterRetrievalLmsParams(),
          'LmsParams'
        )
      ).rejects.toThrowError('client_id not available in request');
      expect(requiredTruthyValueFromRequestSpy).toHaveBeenCalledTimes(2);
    });

    it('Should pass if token is absent but all required params are present', async () => {
      const goodObject = {
        issuer: iss,
        client_id: client_id,
        deployment_id: deployment_id,
        lineitem: lineItem,
        lms_student_id: lms_student_id,
        context_memberships_url: 'd',
      };
      const requiredTruthyValueFromRequestSpy = jest.spyOn(
        helpers,
        'requiredTruthyValueFromRequest'
      );

      const goodEvent = scoreSubmissionRequestEvent(JSON.stringify(goodObject));

      const lmsParams = new RosterRetrievalLmsParams();
      await setParamsFromTokenOrRequestCombined(
        goodEvent,
        undefined as unknown as DynamoDBPlatformConfig,
        Powertools.getInstance(),
        lmsParams,
        ''
      );
      expect(lmsParams.lmsClientId).toEqual(client_id);
      expect(lmsParams.lmsDeploymentId).toEqual(deployment_id);
      expect(lmsParams.lmsIssuer).toEqual(iss);
      expect(requiredTruthyValueFromRequestSpy).toHaveBeenCalledTimes(4);
    });

    it('Should return values from token if passed id_token is genuine', async () => {
      const validToken = 'someValidToken';

      const goodObject = {
        id_token: validToken,

        // the below values are getting passed in request body, but code should respect the token and not the below values while returning
        issuer: iss,
      };
      const fakeLTIJwtPayload = {
        getTruthyClaim(key: string): string {
          if (key === 'custom:LMS:NamesRoleService') {
            return '{"context_memberships_url": "https://educatetest.instructure.com/api/lti/courses/849/names_and_roles"}' as string;
          } else {
            return key;
          }
        },
        jsonParseClaim(jsonString: string, key: string) {
          return 'FakeContextMembershipsUrl';
        },
      };
      const spyOnJwtCall = jest
        .spyOn(LTIJwtPayload, 'load')
        .mockResolvedValue(fakeLTIJwtPayload as unknown as LTIJwtPayload);
      joseDecodeJwt.mockReturnValue(dummyJwtPayload);
      const goodEvent = scoreSubmissionRequestEvent(JSON.stringify(goodObject));
      const lmsParams = new RosterRetrievalLmsParams();
      const spyGetLmsParams = jest.spyOn(
        RosterRetrievalLmsParams.prototype,
        'setLmsParamsFromJwt'
      );
      await setParamsFromTokenOrRequestCombined(
        goodEvent,
        undefined as unknown as DynamoDBPlatformConfig,
        Powertools.getInstance(),
        lmsParams,
        ''
      );
      expect(spyGetLmsParams).toBeCalledTimes(1);
      expect([
        lmsParams.lmsIssuer,
        lmsParams.lmsClientId,
        lmsParams.lmsDeploymentId,
      ]).toEqual([
        'custom:LMS:Issuer',
        'custom:LMS:ClientId',
        'custom:LMS:DeploymentId',
      ]);
      ValidateJwtPayloadLoadCall(spyOnJwtCall, validToken);
    });

    it('Throw error for RequiredClaimsMissingInToken', async () => {
      const invalidToken = 'someInvalidToken';
      const invalidTokenObject = {
        id_token: invalidToken,
      };

      const spyOnJwtCall = jest.spyOn(LTIJwtPayload, 'load');
      // Mocking truthly claim to throw error, the same error message we expect later
      const fakeLTIJwtPayload = {
        getTruthyClaim(key: string): string {
          throw new Error('CustomErrorMessage');
        },
      };
      spyOnJwtCall.mockResolvedValue(
        fakeLTIJwtPayload as unknown as LTIJwtPayload
      );
      joseDecodeJwt.mockReturnValue(dummyJwtPayload);
      const invalidTokenEvent = scoreSubmissionRequestEvent(
        JSON.stringify(invalidTokenObject)
      );
      await expect(
        setParamsFromTokenOrRequestCombined(
          invalidTokenEvent,
          undefined as unknown as DynamoDBPlatformConfig,
          Powertools.getInstance(),
          new RosterRetrievalLmsParams(),
          ''
        )
      ).rejects.toThrowError(
        new LtiCustomError(
          'CustomErrorMessage',
          'RequiredClaimsMissingInToken',
          401
        )
      );
      ValidateJwtPayloadLoadCall(spyOnJwtCall, invalidToken);
    });

    it('Throw error if decoding jwtpayload from token fails', async () => {
      const invalidToken = 'someInvalidToken';
      const goodObject = {
        id_token: invalidToken,
      };
      const spyOnJwtCall = jest.spyOn(LTIJwtPayload, 'load');
      spyOnJwtCall.mockRejectedValue(new Error('FakeError'));
      const goodEvent = scoreSubmissionRequestEvent(JSON.stringify(goodObject));
      await expect(
        setParamsFromTokenOrRequestCombined(
          goodEvent,
          undefined as unknown as DynamoDBPlatformConfig,
          Powertools.getInstance(),
          new RosterRetrievalLmsParams(),
          ''
        )
      ).rejects.toThrowError(new Error('FakeError'));
      ValidateJwtPayloadLoadCall(spyOnJwtCall, invalidToken);
    });
  });

  function ValidateJwtPayloadLoadCall(
    spyOnJwtCall: jest.SpyInstance,
    expectedTokenValue: string
  ) {
    expect(spyOnJwtCall).toHaveBeenCalledTimes(1);

    const actualSeenToken = spyOnJwtCall.mock.calls[0][0] as string;
    expect(actualSeenToken).toEqual(expectedTokenValue);

    // Platform record used in code execution should not contain any table name
    const actualSeenPlatfromRecord = spyOnJwtCall.mock
      .calls[0][1] as DynamoDBPlatformConfig;
    expect(actualSeenPlatfromRecord).toEqual(undefined);
  }
});

describe('submitGetRequestToLms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Should throw error if neither token is provided and none of required params are present in body"', async () => {
    const axiosSpy = jest.spyOn(axios.default, 'get');
    await submitGetRequestToLms('dummyUrl', 'dummyToken');
    expect(axiosSpy).toHaveBeenCalledTimes(1);
    expect(axiosSpy).toHaveBeenCalledWith('dummyUrl', {
      headers: { Authorization: 'Bearer dummyToken' },
    });
  });
});

describe('sendSignedGetRequest', () => {
  it('should call sigV4.sign', async () => {
    const axiosSpy = jest.spyOn(axios.default, 'get');
    await sendSignedGetRequest('https://example.com');
    expect(mockSign).toHaveBeenCalledTimes(1);
    expect(axiosSpy).toBeCalledTimes(1);
  });
});
