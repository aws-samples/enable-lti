import 'aws-sdk-client-mock-jest';
import { LTIJwtPayload } from '../src/jwt';
import { PlatformConfig, PlatformConfigRecord } from '../src/platformConfig';
import { LtiCustomError } from '../src';

const joseDecodeJwt = jest.fn();
const joseDecodeProtectedHeader = jest.fn();
const joseCreateRemoteJWKSet = jest.fn();
const joseJwtVerify = jest.fn();
jest.mock('jose', () => ({
  decodeJwt: (jwt: any) => joseDecodeJwt(jwt),
  decodeProtectedHeader: (token: any) => joseDecodeProtectedHeader(token),
  createRemoteJWKSet: (url: any, options?: any) =>
    joseCreateRemoteJWKSet(url, options),
  jwtVerify: (jwt: any, getKey: any, options?: any) =>
    joseJwtVerify(jwt, getKey, options),
}));
const jwtPayload = {
  aud: 'test',
  azp: 'testClientId',
  nonce: 'testNonce',
};
const platform: Partial<PlatformConfig> = {};
const mockPlatformLoad = jest.fn().mockImplementation(function () {
  return {
    clientId: 'testClientId',
    iss: 'testIssuer',
    keySetUrl: 'https://test.com',
  } as PlatformConfigRecord;
});
platform.load = mockPlatformLoad.bind(platform);

describe('state load', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  afterAll(() => {
    jest.clearAllMocks();
  });
  it('can load successfully', () => {
    joseDecodeJwt.mockReturnValue(jwtPayload);
    joseJwtVerify.mockReturnValue({ payload: jwtPayload });
    joseDecodeProtectedHeader.mockReturnValue({ alg: 'RS256' });
    joseCreateRemoteJWKSet.mockReturnValue({});
    expect(
      LTIJwtPayload.load('tokenString', platform as PlatformConfig)
    ).resolves.toBeInstanceOf(LTIJwtPayload);
    expect(
      LTIJwtPayload.load('tokenString', platform as PlatformConfig)
    ).resolves.toMatchObject({ _payload: jwtPayload });
  });

  it('handles error on missing aud', () => {
    joseDecodeJwt.mockReturnValue({
      azp: 'testClientId',
      nonce: 'testNonce',
    });
    joseJwtVerify.mockReturnValue({ payload: jwtPayload });
    joseDecodeProtectedHeader.mockReturnValue({ alg: 'RS256' });
    joseCreateRemoteJWKSet.mockReturnValue({});

    expect(
      LTIJwtPayload.load('tokenString', platform as PlatformConfig)
    ).rejects.toBeInstanceOf(LtiCustomError);
  });

  it('handles error on platform.load', () => {
    const platform: Partial<PlatformConfig> = {};
    const mockPlatformLoad = jest.fn().mockImplementation(function () {
      throw new Error('test');
    });
    platform.load = mockPlatformLoad.bind(platform);
    joseDecodeJwt.mockReturnValue(jwtPayload);
    joseJwtVerify.mockReturnValue({ payload: jwtPayload });
    joseDecodeProtectedHeader.mockReturnValue({ alg: 'RS256' });
    joseCreateRemoteJWKSet.mockReturnValue({});
    expect(
      LTIJwtPayload.load('tokenString', platform as PlatformConfig)
    ).rejects.toBeInstanceOf(Error);
  });

  it('loads successfully when payload has string aud', () => {
    joseDecodeJwt.mockReturnValue(jwtPayload);
    joseJwtVerify.mockReturnValue({ payload: jwtPayload });
    joseDecodeProtectedHeader.mockReturnValue({ alg: 'RS256' });
    joseCreateRemoteJWKSet.mockReturnValue({});
    expect(
      LTIJwtPayload.load('tokenString', platform as PlatformConfig)
    ).resolves.toMatchObject({ _payload: jwtPayload });
  });

  it('loads successfully when payload has array aud', () => {
    joseDecodeJwt.mockReturnValue(jwtPayload);
    joseJwtVerify.mockReturnValue({ payload: jwtPayload });
    joseDecodeProtectedHeader.mockReturnValue({ alg: 'RS256' });
    joseCreateRemoteJWKSet.mockReturnValue({});
    expect(
      LTIJwtPayload.load('tokenString', platform as PlatformConfig)
    ).resolves.toMatchObject({ _payload: jwtPayload });
  });

  it('handles error on jose.jwtVerify', () => {
    joseDecodeJwt.mockReturnValue(jwtPayload);
    joseJwtVerify.mockImplementation(() => {
      throw new Error('test');
    });
    joseDecodeProtectedHeader.mockReturnValue({ alg: 'RS256' });
    joseCreateRemoteJWKSet.mockReturnValue({});

    expect(
      LTIJwtPayload.load('tokenString', platform as PlatformConfig)
    ).rejects.toBeInstanceOf(Error);
  });

  it('throws error when payload.aud is array with more than one value and payload.azp is undefined', () => {
    const jwtPayload = {
      azp: undefined,
      nonce: 'testNonce',
      aud: ['test1', 'test2'],
    };
    joseDecodeJwt.mockReturnValue(jwtPayload);
    joseJwtVerify.mockReturnValue({ payload: jwtPayload });
    joseDecodeProtectedHeader.mockReturnValue({ alg: 'RS256' });
    joseCreateRemoteJWKSet.mockReturnValue({});

    expect(
      LTIJwtPayload.load('tokenString', platform as PlatformConfig)
    ).rejects.toBeInstanceOf(Error);
  });

  it('throws error when payload.azp does not match platformConfigRecord.clientId)', () => {
    const platform: Partial<PlatformConfig> = {};
    const mockPlatformLoad = jest.fn().mockImplementation(function () {
      return {
        clientId: 'platformConfigRecord_clientId',
        iss: 'testIssuer',
        keySetUrl: 'https://test.com',
      } as PlatformConfigRecord;
    });
    platform.load = mockPlatformLoad.bind(platform);
    const jwtPayload = {
      azp: 'jwtPayload_azp',
      nonce: 'testNonce',
      aud: 'test',
    };
    joseDecodeJwt.mockReturnValue(jwtPayload);
    joseJwtVerify.mockReturnValue({ payload: jwtPayload });
    joseDecodeProtectedHeader.mockReturnValue({ alg: 'RS256' });
    joseCreateRemoteJWKSet.mockReturnValue({});

    expect(
      LTIJwtPayload.load('tokenString', platform as PlatformConfig)
    ).rejects.toBeInstanceOf(Error);
  });

  it('checks nonce by default', () => {
    const jwtPayload = {
      azp: 'testClientId',
      nonce: undefined,
      aud: 'test',
    };
    joseDecodeJwt.mockReturnValue(jwtPayload);
    joseJwtVerify.mockReturnValue({ payload: jwtPayload });
    joseDecodeProtectedHeader.mockReturnValue({ alg: 'RS256' });
    joseCreateRemoteJWKSet.mockReturnValue({});

    expect(
      LTIJwtPayload.load('tokenString', platform as PlatformConfig)
    ).rejects.toBeInstanceOf(Error);
  });

  it('can ignore nonce', () => {
    const platform: Partial<PlatformConfig> = {};
    const mockPlatformLoad = jest.fn().mockImplementation(function () {
      return {
        clientId: 'testClientId',
        iss: 'testIssuer',
        keySetUrl: 'https://test.com',
      } as PlatformConfigRecord;
    });
    platform.load = mockPlatformLoad.bind(platform);
    const jwtPayload = {
      azp: 'testClientId',
      nonce: undefined,
      aud: 'test',
    };
    joseDecodeJwt.mockReturnValue(jwtPayload);
    joseJwtVerify.mockReturnValue({ payload: jwtPayload });
    joseDecodeProtectedHeader.mockReturnValue({ alg: 'RS256' });
    joseCreateRemoteJWKSet.mockReturnValue({});

    expect(
      LTIJwtPayload.load('tokenString', platform as PlatformConfig, false)
    ).resolves.toMatchObject({ _payload: jwtPayload });
  });
});

describe('jsonParseClaim', () => {
  beforeEach(() => {
    jest.resetModules();
  });
  it('successful parse claim', () => {
    const result = LTIJwtPayload.prototype.jsonParseClaim('{"key":3}', 'key');
    expect(result).toEqual(3);
  });

  it('key not present in json', () => {
    expect(() => {
      LTIJwtPayload.prototype.jsonParseClaim('{"key":3}', 'dummy');
    }).toThrowError('Key is not present in the Json object');
  });

  it('failure in json parsing', () => {
    expect(() => {
      LTIJwtPayload.prototype.jsonParseClaim('{"key:3}', 'dummy');
    }).toThrowError('Unexpected end of JSON input');
  });
});
