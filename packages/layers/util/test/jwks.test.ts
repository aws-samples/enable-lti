import 'aws-sdk-client-mock-jest';
import { DynamoDBJwkRecord } from '../src/jwks';

jest.mock('uuid', () => ({ v4: () => 'uuid_123456789' }));

const joseExportJWK = jest.fn();
const joseImportSPKI = jest.fn();
jest.mock('jose', () => ({
  exportJWK: (key: any) => joseExportJWK(key),
  importSPKI: (spki: any, alg: any, options: any) =>
    joseImportSPKI(spki, alg, options),
}));

const awsGetInstance = jest.fn();
const awsGetPublicKeyPem = jest.fn();
jest.mock('../src/aws', () => ({
  Aws: {
    getInstance: () => awsGetInstance(),
    getPublicKeyPem: () => awsGetPublicKeyPem(),
  },
}));

describe('DynamoDBJwkRecord.assign', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('can assign successfully', () => {
    const jwk = {
      kmsKeyId: 'testKeyId',
      publicKeyPem: 'testPublicKeyPem',
      ttl: 99,
      kid: 'testKid',
      PK: 'testPK',
    };
    const newJwsKrecord = DynamoDBJwkRecord.assign(jwk);
    expect(newJwsKrecord).toEqual(jwk);
  });

  it('can assign successfully with defaults', () => {
    const jwk = {
      kmsKeyId: 'testKeyId',
      publicKeyPem: 'testPublicKeyPem',
    };
    const newJwsKrecord = DynamoDBJwkRecord.assign(jwk);
    expect(newJwsKrecord).toEqual({
      kmsKeyId: 'testKeyId',
      publicKeyPem: 'testPublicKeyPem',
      ttl: 0,
      kid: 'uuid_123456789',
      PK: 'testKeyId',
    });
  });

  it('can assign extra fields are ignored', () => {
    const jwk = {
      kmsKeyId: 'testKeyId',
      publicKeyPem: 'testPublicKeyPem',
      ttl: 99,
      kid: 'testKid',
      PK: 'testPK',
      extraField: 'ignoreMe',
    };
    const newJwsKrecord = DynamoDBJwkRecord.assign(jwk);
    expect(newJwsKrecord).toEqual({
      kmsKeyId: 'testKeyId',
      publicKeyPem: 'testPublicKeyPem',
      ttl: 99,
      kid: 'testKid',
      PK: 'testPK',
    });
  });

  it('can assign with missing fields', () => {
    const jwk = {};

    const newJwsKrecord = DynamoDBJwkRecord.assign(jwk);
    expect(newJwsKrecord).toEqual({
      PK: 'undefined',
      kid: 'uuid_123456789',
      kmsKeyId: undefined,
      publicKeyPem: undefined,
      ttl: 0,
    });
  });
});

describe('DynamoDBJwkRecord.new', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('can successfully create new JwkRecord', async () => {
    awsGetInstance.mockReturnValue({
      getPublicKeyPem: () => Promise.resolve('testPublicKeyPem'),
    });
    const ddbJWSRecord = await DynamoDBJwkRecord.new('testKeyId');
    expect(ddbJWSRecord).toMatchObject({
      kmsKeyId: 'testKeyId',
      publicKeyPem: 'testPublicKeyPem',
    });
  });

  it('can throw Aws.getInstance error', async () => {
    awsGetInstance.mockImplementation(() => {
      throw new Error('test error');
    });
    await expect(DynamoDBJwkRecord.new('testKeyId')).rejects.toThrow(
      'test error'
    );
  });

  it('can throw aws.getPublicKeyPem error', async () => {
    awsGetInstance.mockReturnValue({
      getPublicKeyPem: () => Promise.reject(new Error('test error')),
    });
    await expect(DynamoDBJwkRecord.new('testKeyId')).rejects.toThrow(
      'test error'
    );
  });

  it('can throws error when publicKeyPem is undefined', async () => {
    awsGetInstance.mockReturnValue({
      getPublicKeyPem: () => Promise.resolve(undefined),
    });
    await expect(DynamoDBJwkRecord.new('testKeyId')).rejects.toThrow(
      "Could not find public key for KMS key id 'testKeyId'"
    );
  });
});

describe('DynamoDBJwkRecord.toJWK', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('can successfully create new JWK', async () => {
    joseImportSPKI.mockReturnValue('testJWK');
    joseExportJWK.mockReturnValue({
      x5c: ['testX5C'],
      n: 'testN',
      e: 'testE',
    });
    const testPublicKeyPem = 'testPublicKeyPem';
    const ddbJWSRecord = DynamoDBJwkRecord.assign({
      kmsKeyId: 'testKeyId',
      publicKeyPem: `-----BEGIN PUBLIC KEY-----\r\n${testPublicKeyPem}\r\n-----END PUBLIC KEY-----`,
    });
    const jwk = await ddbJWSRecord.toJWK();
    expect(jwk).toEqual({
      kid: 'uuid_123456789',
      kty: 'RSA',
      use: 'sig',
      alg: 'RS256',
      n: 'testN',
      e: 'testE',
      x5c: [testPublicKeyPem],
    });
  });

  it('can throw importSPKI error', async () => {
    joseImportSPKI.mockImplementation(() => {
      throw new Error('test error');
    });
    const ddbJWSRecord = DynamoDBJwkRecord.assign({
      kmsKeyId: 'testKeyId',
      publicKeyPem: 'testPublicKeyPem',
    });
    await expect(ddbJWSRecord.toJWK()).rejects.toThrow('test error');
  });

  it('can throw exportJWK error', async () => {
    joseImportSPKI.mockReturnValue('testJWK');
    joseExportJWK.mockImplementation(() => {
      throw new Error('test error');
    });
    const ddbJWSRecord = DynamoDBJwkRecord.assign({
      kmsKeyId: 'testKeyId',
      publicKeyPem: 'testPublicKeyPem',
    });
    await expect(ddbJWSRecord.toJWK()).rejects.toThrow('test error');
  });

  it('can throw error when public key is not in PEM format', async () => {
    joseImportSPKI.mockReturnValue('testJWK');
    joseExportJWK.mockReturnValue({
      x5c: ['testX5C'],
      n: 'testN',
      e: 'testE',
    });
    const ddbJWSRecord = DynamoDBJwkRecord.assign({
      kmsKeyId: 'testKeyId',
      publicKeyPem: 'testPublicKeyPem',
    });
    await expect(ddbJWSRecord.toJWK()).rejects.toThrow(
      "Cannot read properties of null (reading '1')"
    );
  });
});
