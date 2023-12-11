import { LtiCustomError } from '@enable-lti/util';
import {
  PutItemCommandOutput,
  GetItemCommandInput,
} from '@aws-sdk/client-dynamodb';
import 'aws-sdk-client-mock-jest';
import { Aws } from '../src/aws';
import {
  DynamoDBPlatformConfig,
  DynamoDBPlatformConfigRecord,
} from '../src/platformConfig';

describe('DynamoDBPlatformConfigRecord', () => {
  describe('DynamoDBPlatformConfigRecord Constructor', () => {
    it('should create an instance with all properties', () => {
      const record = new DynamoDBPlatformConfigRecord(
        'testClientId',
        'testIss',
        'testAuthLoginUrl',
        'testAuthTokenUrl',
        'testAccessTokenUrl',
        'testKeySetUrl',
        'testLtiDeploymentId',
        'testPK'
      );

      expect(record.clientId).toBe('testClientId');
      expect(record.iss).toBe('testIss');
      expect(record.authLoginUrl).toBe('testAuthLoginUrl');
      expect(record.authTokenUrl).toBe('testAuthTokenUrl');
      expect(record.accessTokenUrl).toBe('testAccessTokenUrl');
      expect(record.keySetUrl).toBe('testKeySetUrl');
      expect(record.ltiDeploymentId).toBe('testLtiDeploymentId');
      expect(record.PK).toBe('testPK');
    });

    it('should create an instance with default PK if ltiDeploymentId is undefined', () => {
      const record = new DynamoDBPlatformConfigRecord(
        'testClientId',
        'testIss',
        'testAuthLoginUrl',
        'testAuthTokenUrl',
        'testAccessTokenUrl',
        'testKeySetUrl'
      );

      expect(record.PK).toBe('PLATFORM#testClientId#testIss#');
    });
  });

  // Test cases for the assign method
  describe('DynamoDBPlatformConfigRecord assign method', () => {
    it('should create an instance with properties from an incoming object', () => {
      const incoming = {
        clientId: 'testClientId',
        iss: 'testIss',
        authLoginUrl: 'testAuthLoginUrl',
        authTokenUrl: 'testAuthTokenUrl',
        accessTokenUrl: 'testAccessTokenUrl',
        keySetUrl: 'testKeySetUrl',
        ltiDeploymentId: 'testLtiDeploymentId',
      };

      const record = DynamoDBPlatformConfigRecord.assign(incoming);

      expect(record.clientId).toBe('testClientId');
      expect(record.iss).toBe('testIss');
      expect(record.authLoginUrl).toBe('testAuthLoginUrl');
      expect(record.authTokenUrl).toBe('testAuthTokenUrl');
      expect(record.accessTokenUrl).toBe('testAccessTokenUrl');
      expect(record.keySetUrl).toBe('testKeySetUrl');
      expect(record.ltiDeploymentId).toBe('testLtiDeploymentId');
      expect(record.PK).toBe(
        'PLATFORM#testClientId#testIss#testLtiDeploymentId'
      );
    });

    it('should create an instance with default PK if ltiDeploymentId is undefined in incoming object', () => {
      const incoming = {
        clientId: 'testClientId',
        iss: 'testIss',
        authLoginUrl: 'testAuthLoginUrl',
        authTokenUrl: 'testAuthTokenUrl',
        accessTokenUrl: 'testAccessTokenUrl',
        keySetUrl: 'testKeySetUrl',
      };

      const record = DynamoDBPlatformConfigRecord.assign(incoming);

      expect(record.ltiDeploymentId).toBe(undefined);
    });

    it('should assign empty strings if a key is undefined in incoming object', () => {
      const incoming = {};

      const record = DynamoDBPlatformConfigRecord.assign(incoming);

      expect(record.PK).toBe('PLATFORM###');
      expect(record.iss).toBe('');
      expect(record.authTokenUrl).toBe('');
      expect(record.authLoginUrl).toBe('');
      expect(record.accessTokenUrl).toBe('');
      expect(record.keySetUrl).toBe('');
    });
  });
});

describe('DynamoDBPlatformConfig', () => {
  const getItemSpy = jest.spyOn(Aws.prototype, 'getItem');
  const putItemSpy = jest.spyOn(Aws.prototype, 'putItem');

  let configInstance: DynamoDBPlatformConfig;
  let testConfig: Record<string, any>;
  let testRecord: DynamoDBPlatformConfigRecord;

  beforeEach(() => {
    configInstance = new DynamoDBPlatformConfig('testTableName');
    testConfig = {
      clientId: 'testClientId',
      iss: 'testIss',
      authLoginUrl: 'testAuthLoginUrl',
      authTokenUrl: 'testAuthTokenUrl',
      accessTokenUrl: 'testAccessTokenUrl',
      keySetUrl: 'testKeySetUrl',
    };
    testRecord = DynamoDBPlatformConfigRecord.assign(testConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test cases for the load method
  describe('load method', () => {
    it('should load the config successfully on first try with deployment id', async () => {
      const mockClientId = testRecord.clientId;
      const mockIss = testRecord.iss;
      const mockDeploymentId = 'someDeploymentId';
      getItemSpy.mockResolvedValue(testRecord);
      const result = await configInstance.load(
        mockClientId,
        mockIss,
        mockDeploymentId
      );
      expect(result).toBeDefined();
      expect(result).toEqual(testRecord);
      expect(getItemSpy).toHaveBeenCalledTimes(1);
    });

    it('should retry without ltiDeploymentId if an error occurs on the first attempt', async () => {
      const mockClientId = testRecord.clientId;
      const mockIss = testRecord.iss;
      const getItemSpy2 = jest
        .spyOn(Aws.prototype, 'getItem')
        .mockImplementation((input: GetItemCommandInput) => {
          if (input.Key!.PK!.S! === 'PLATFORM#testClientId#testIss#') {
            return Promise.resolve(testRecord);
          } else {
            return Promise.resolve(undefined);
          }
        });
      const result = await configInstance.load(mockClientId, mockIss);
      expect(result).toBeDefined();
      expect(result).toEqual(testRecord);
      expect(getItemSpy2).toHaveBeenCalledTimes(2);
    });

    it('should throw an error if no record is found after retries', async () => {
      const mockClientId = testRecord.clientId;
      const mockIss = testRecord.iss;
      getItemSpy.mockRejectedValue(new Error('Test Error'));
      await expect(
        configInstance.load(mockClientId, mockIss)
      ).rejects.toThrowError(LtiCustomError);
      expect(getItemSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('save method', () => {
    it('should save the config and return the record', async () => {
      putItemSpy.mockResolvedValue({} as PutItemCommandOutput);
      const result = await configInstance.save(testRecord);
      expect(result).toEqual(testRecord);
      expect(putItemSpy).toHaveBeenCalledWith({
        TableName: 'testTableName',
        Item: expect.any(Object),
      });
      expect(putItemSpy).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if an exception occurs while saving', async () => {
      putItemSpy.mockRejectedValue(new Error('Test Error'));
      await expect(configInstance.save(testRecord)).rejects.toThrowError(
        LtiCustomError
      );
      expect(putItemSpy).toHaveBeenCalledTimes(1);
    });
  });
});
