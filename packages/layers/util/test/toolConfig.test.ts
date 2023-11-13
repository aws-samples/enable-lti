import 'aws-sdk-client-mock-jest';
import {
  DynamoDBLtiToolConfig,
  DynamoDBLtiToolConfigRecord,
  eLTIFeature,
  toolConfigRecord,
} from '../src/toolConfig';
import { Aws } from '../src/aws';

import { PutItemCommandOutput } from '@aws-sdk/client-dynamodb';

describe('DynamoDBLtiToolConfigRecord', () => {
  const sampleCMPFeature = {
    name: 'CMPDeepLinkingRedirect',
    enabled: true,
    data: {
      cmpDomain: 'https://cmp.domain.com/',
      cmpResourceLinksAPI: 'https://cmp.resource-links.com/api/client-id',
      oidc: {
        domain: 'https://oidc-provider.com/',
        idpName: 'sampleIdp',
        clientId: 'sampleClientId',
      },
    },
  };
  // Sample data for testing
  const sampleConfigData = {
    id: 'sampleId',
    issuer: 'sampleIssuer',
    url: 'https://sample-url.com',
    PK: 'samplePK',
    data: {
      OIDC: {
        domain: 'https://oidc-provider.com/',
        idpName: 'sampleIdp',
        clientId: 'sampleClientId',
      },
    },
    features: [
      { name: 'ForceLogout', enabled: true },
      sampleCMPFeature,
    ] as eLTIFeature[],
  };

  describe('constructor', () => {
    it('should create an instance with provided values', () => {
      const config = new DynamoDBLtiToolConfigRecord(
        sampleConfigData.id,
        sampleConfigData.issuer,
        sampleConfigData.url,
        sampleConfigData.PK,
        sampleConfigData.data,
        sampleConfigData.features
      );

      expect(config).toBeDefined();
      expect(config.id).toBe(sampleConfigData.id);
      expect(config.issuer).toBe(sampleConfigData.issuer);
      expect(config.url).toBe(sampleConfigData.url);
      expect(config.PK).toBe(sampleConfigData.PK);
      expect(config.data).toEqual(sampleConfigData.data);
      expect(config.features).toEqual(sampleConfigData.features);
    });

    it('should use default values when some arguments are missing', () => {
      const config = new DynamoDBLtiToolConfigRecord(
        sampleConfigData.id,
        sampleConfigData.issuer,
        sampleConfigData.url
      );

      expect(config).toBeDefined();
      expect(config.PK).toBe(
        `TOOL#${sampleConfigData.id}#${sampleConfigData.issuer}`
      );
      expect(config.data).toEqual({});
      expect(config.features).toEqual([]);
    });
  });

  describe('new', () => {
    it('should create a new instance with default values', () => {
      const id = 'newId';
      const issuer = 'newIssuer';
      const url = 'https://new-url.com';

      const config = DynamoDBLtiToolConfigRecord.new(id, issuer, url);

      expect(config).toBeDefined();
      expect(config).toBeInstanceOf(DynamoDBLtiToolConfigRecord);
      expect(config.id).toBe(id);
      expect(config.issuer).toBe(issuer);
      expect(config.url).toBe(url);
      expect(config.PK).toBe(`TOOL#${id}#${issuer}`);
      expect(config.data).toEqual({});
      expect(config.features).toEqual([]);
    });

    it('should create a new instance with provided data', () => {
      const id = 'newId';
      const issuer = 'newIssuer';
      const url = 'https://new-url.com';
      const data = { someKey: 'someValue' };

      const config = DynamoDBLtiToolConfigRecord.new(id, issuer, url, data);

      expect(config).toBeDefined();
      expect(config).toBeInstanceOf(DynamoDBLtiToolConfigRecord);
      expect(config.id).toBe(id);
      expect(config.issuer).toBe(issuer);
      expect(config.url).toBe(url);
      expect(config.PK).toBe(`TOOL#${id}#${issuer}`);
      expect(config.data).toEqual(data);
      expect(config.features).toEqual([]);
    });
  });

  describe('assign', () => {
    it('should create an instance with values from an incoming object', () => {
      const incomingData = {
        id: 'incomingId',
        issuer: 'incomingIssuer',
        url: 'https://incoming-url.com',
        PK: 'incomingPK',
        data: {},
        features: [],
      };

      const config = DynamoDBLtiToolConfigRecord.assign(incomingData);

      expect(config).toBeDefined();
      expect(config).toBeInstanceOf(DynamoDBLtiToolConfigRecord);
      expect(config.id).toBe(incomingData.id);
      expect(config.issuer).toBe(incomingData.issuer);
      expect(config.url).toBe(incomingData.url);
      expect(config.PK).toBe(incomingData.PK);
      expect(config.data).toEqual(incomingData.data);
      expect(config.features).toEqual(incomingData.features);
    });
  });

  describe('authUrl', () => {
    it('should return the expected authentication URL', () => {
      const config = new DynamoDBLtiToolConfigRecord(
        sampleConfigData.id,
        sampleConfigData.issuer,
        sampleConfigData.url
      );

      const expectedAuthUrl = `${sampleConfigData.url}/authcode`;

      expect(config.authUrl()).toBe(expectedAuthUrl);
    });
  });

  describe('jwksUrl', () => {
    it('should return the expected JWKS URL', () => {
      const config = new DynamoDBLtiToolConfigRecord(
        sampleConfigData.id,
        sampleConfigData.issuer,
        sampleConfigData.url
      );

      const expectedJwksUrl = `${sampleConfigData.url}/jwks.json`;

      expect(config.jwksUrl()).toBe(expectedJwksUrl);
    });
  });

  describe('toolOIDCAuthorizeURL', () => {
    it('should return the OIDC authorize URL with default parameters', () => {
      const config = new DynamoDBLtiToolConfigRecord(
        sampleConfigData.id,
        sampleConfigData.issuer,
        sampleConfigData.url,
        sampleConfigData.PK,
        sampleConfigData.data
      );

      const expectedAuthorizeURL = `${sampleConfigData.data.OIDC.domain}oauth2/authorize?identity_provider=${sampleConfigData.data.OIDC.idpName}&redirect_uri=${sampleConfigData.url}&response_type=code&client_id=${sampleConfigData.data.OIDC.clientId}&scope=openid`;

      expect(config.toolOIDCAuthorizeURL()).toBe(expectedAuthorizeURL);
    });

    it('should return the OIDC authorize URL with custom state and nonce', () => {
      const config = new DynamoDBLtiToolConfigRecord(
        sampleConfigData.id,
        sampleConfigData.issuer,
        sampleConfigData.url,
        sampleConfigData.PK,
        sampleConfigData.data
      );

      const state = 'customState';
      const nonce = 'customNonce';

      const expectedAuthorizeURL = `${sampleConfigData.data.OIDC.domain}oauth2/authorize?identity_provider=${sampleConfigData.data.OIDC.idpName}&redirect_uri=${sampleConfigData.url}&response_type=code&client_id=${sampleConfigData.data.OIDC.clientId}&scope=openid&state=${state}&nonce=${nonce}`;

      expect(config.toolOIDCAuthorizeURL(state, undefined, nonce)).toBe(
        expectedAuthorizeURL
      );
    });

    it('should return the tool URL if OIDC configuration is missing', () => {
      const config = new DynamoDBLtiToolConfigRecord(
        sampleConfigData.id,
        sampleConfigData.issuer,
        sampleConfigData.url,
        sampleConfigData.PK,
        {} // Empty data to simulate missing OIDC configuration
      );

      const expectedToolURL = sampleConfigData.url;

      expect(config.toolOIDCAuthorizeURL()).toBe(expectedToolURL);
    });
  });

  describe('cmpAuthorizeURL', () => {
    it('should return the CMP authorize URL with default parameters', () => {
      const config = new DynamoDBLtiToolConfigRecord(
        sampleConfigData.id,
        sampleConfigData.issuer,
        sampleConfigData.url,
        sampleConfigData.PK,
        sampleConfigData.data,
        sampleConfigData.features
      );
      const expectedCMPAuthorizeURL = `${sampleConfigData.data.OIDC.domain}oauth2/authorize?identity_provider=${sampleConfigData.data.OIDC.idpName}&redirect_uri=${sampleCMPFeature.data.cmpDomain}&response_type=code&client_id=${sampleConfigData.data.OIDC.clientId}&scope=openid`;
      expect(config.cmpAuthorizeURL()).toBe(expectedCMPAuthorizeURL);
    });

    it('should return the CMP authorize URL with custom state and nonce', () => {
      const config = new DynamoDBLtiToolConfigRecord(
        sampleConfigData.id,
        sampleConfigData.issuer,
        sampleConfigData.url,
        sampleConfigData.PK,
        sampleConfigData.data,
        sampleConfigData.features
      );
      const state = 'customState';
      const nonce = 'customNonce';
      const expectedCMPAuthorizeURL = `${sampleConfigData.data.OIDC.domain}oauth2/authorize?identity_provider=${sampleConfigData.data.OIDC.idpName}&redirect_uri=${sampleCMPFeature.data.cmpDomain}&response_type=code&client_id=${sampleConfigData.data.OIDC.clientId}&scope=openid&state=${state}&nonce=${nonce}`;
      expect(config.cmpAuthorizeURL(state, nonce)).toBe(
        expectedCMPAuthorizeURL
      );
    });

    it('should throw error if CMP domain is missing', () => {
      const config = new DynamoDBLtiToolConfigRecord(
        sampleConfigData.id,
        sampleConfigData.issuer,
        sampleConfigData.url,
        sampleConfigData.PK,
        sampleConfigData.data,
        [
          {
            name: 'CMPDeepLinkingRedirect',
            enabled: true,
            data: {
              cmpResourceLinksAPI:
                'https://cmp.resource-links.com/api/client-id',
              oidc: {
                domain: 'https://oidc-provider.com/',
                idpName: 'sampleIdp',
                clientId: 'sampleClientId',
              },
            },
          },
        ]
      );
      expect(() => {
        config.cmpAuthorizeURL();
      }).toThrow('CMP Domain not found');
    });

    it('should throw error if CMP oidc is missing', () => {
      const config = new DynamoDBLtiToolConfigRecord(
        sampleConfigData.id,
        sampleConfigData.issuer,
        sampleConfigData.url,
        sampleConfigData.PK,
        sampleConfigData.data,
        [
          {
            name: 'CMPDeepLinkingRedirect',
            enabled: true,
            data: {
              cmpDomain: 'https://cmp.domain.com/',
              cmpResourceLinksAPI:
                'https://cmp.resource-links.com/api/client-id',
            },
          },
        ]
      );
      expect(() => {
        config.cmpAuthorizeURL();
      }).toThrow('CMP OIDC data not found on tool object');
    });
  });

  describe('cmpDomain and cmpResourceLinkAPIURL', () => {
    it('should return cmpDomain and cmpResourceLinkAPIURL', () => {
      const config = new DynamoDBLtiToolConfigRecord(
        sampleConfigData.id,
        sampleConfigData.issuer,
        sampleConfigData.url,
        sampleConfigData.PK,
        sampleConfigData.data,
        sampleConfigData.features
      );
      expect(config.cmpDomain()).toBe(sampleCMPFeature.data.cmpDomain);
      expect(config.cmpResourceLinkAPIURL()).toBe(
        sampleCMPFeature.data.cmpResourceLinksAPI
      );
    });
    it('should return undefined if no cmp feature data', () => {
      const config = new DynamoDBLtiToolConfigRecord(
        sampleConfigData.id,
        sampleConfigData.issuer,
        sampleConfigData.url,
        sampleConfigData.PK,
        sampleConfigData.data
      );
      expect(config.cmpDomain()).toBeUndefined();
      expect(config.cmpResourceLinkAPIURL()).toBeUndefined();
    });
  });

  describe('toolOIDCLogoutURL', () => {
    it('should return the OIDC logout URL with default parameters', () => {
      const config = new DynamoDBLtiToolConfigRecord(
        sampleConfigData.id,
        sampleConfigData.issuer,
        sampleConfigData.url,
        sampleConfigData.PK,
        sampleConfigData.data
      );

      const logoutRedirectURL = 'https://logout-redirect.com';
      const state = 'customState';

      const expectedLogoutURL = `${sampleConfigData.data.OIDC.domain}logout?client_id=${sampleConfigData.data.OIDC.clientId}&logout_uri=${logoutRedirectURL}&state=${state}`;

      expect(config.toolOIDCLogoutURL(logoutRedirectURL, state)).toBe(
        expectedLogoutURL
      );
    });

    it('should return the OIDC logout URL with custom state and no parameters', () => {
      const config = new DynamoDBLtiToolConfigRecord(
        sampleConfigData.id,
        sampleConfigData.issuer,
        sampleConfigData.url,
        sampleConfigData.PK,
        sampleConfigData.data
      );

      const logoutRedirectURL = 'https://logout-redirect.com';

      const expectedLogoutURL = `${sampleConfigData.data.OIDC.domain}logout?client_id=${sampleConfigData.data.OIDC.clientId}&logout_uri=${logoutRedirectURL}`;

      expect(config.toolOIDCLogoutURL(logoutRedirectURL)).toBe(
        expectedLogoutURL
      );
    });

    it('should throw an error if OIDC configuration is missing', () => {
      const config = new DynamoDBLtiToolConfigRecord(
        sampleConfigData.id,
        sampleConfigData.issuer,
        sampleConfigData.url,
        sampleConfigData.PK,
        {} // Empty data to simulate missing OIDC configuration
      );

      const logoutRedirectURL = 'https://logout-redirect.com';
      const state = 'customState';

      expect(() => {
        config.toolOIDCLogoutURL(logoutRedirectURL, state);
      }).toThrow('OIDC does not exist in tool config');
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true if the feature is enabled', () => {
      const config = new DynamoDBLtiToolConfigRecord(
        sampleConfigData.id,
        sampleConfigData.issuer,
        sampleConfigData.url,
        sampleConfigData.PK,
        sampleConfigData.data,
        sampleConfigData.features
      );

      const featureName = 'ForceLogout';

      expect(config.isFeatureEnabled(featureName)).toBe(true);
    });

    it('should return false if the feature is disabled', () => {
      const config = new DynamoDBLtiToolConfigRecord(
        sampleConfigData.id,
        sampleConfigData.issuer,
        sampleConfigData.url,
        sampleConfigData.PK,
        sampleConfigData.data,
        [{ name: 'ForceLogout', enabled: false }] as eLTIFeature[]
      );

      const featureName = 'ForceLogout';

      expect(config.isFeatureEnabled(featureName)).toBe(false);
    });
  });
});

describe('DynamoDBLtiToolConfig', () => {
  // Sample config data for testing
  const sampleConfigData = {
    id: 'sampleId',
    issuer: 'sampleIssuer',
    url: 'https://sample-url.com',
    PK: 'samplePK',
    data: {},
    features: [],
  };

  const getItemSpy = jest.spyOn(Aws.prototype, 'getItem');
  const putItemSpy = jest.spyOn(Aws.prototype, 'putItem');

  // Create an instance of DynamoDBLtiToolConfig with a mock table name
  const dynamoDBConfig = new DynamoDBLtiToolConfig('sampleTableName');

  beforeEach(() => {
    // Reset mock function calls before each test
    jest.clearAllMocks();
  });

  describe('load', () => {
    it('should load a LtiToolConfigRecord from DynamoDB', async () => {
      // Mock DynamoDB getItem to return sampleConfigData
      getItemSpy.mockResolvedValue(sampleConfigData);

      const id = 'sampleId';
      const issuer = 'sampleIssuer';

      const result = await dynamoDBConfig.load(id, issuer);

      expect(getItemSpy).toHaveBeenCalledWith({
        TableName: 'sampleTableName', // Ensure it uses the correct table name
        Key: { PK: { S: `TOOL#${id}#${issuer}` } },
      });

      expect(result).toEqual(sampleConfigData);
    });

    it('should throw an error if no LtiToolConfigRecord is found', async () => {
      // Mock DynamoDB getItem to return undefined
      getItemSpy.mockResolvedValue(undefined);

      const id = 'nonExistentId';
      const issuer = 'nonExistentIssuer';

      await expect(dynamoDBConfig.load(id, issuer)).rejects.toThrowError(
        `No LtiToolConfig record found for TOOL#${id}.`
      );
    });
  });

  describe('save', () => {
    it('should save a LtiToolConfigRecord to DynamoDB', async () => {
      // Mock DynamoDB putItem to succeed
      putItemSpy.mockResolvedValue({} as PutItemCommandOutput);

      const config = sampleConfigData;

      const result = await dynamoDBConfig.save(config);

      expect(putItemSpy).toHaveBeenCalledWith({
        TableName: 'sampleTableName', // Ensure it uses the correct table name
        Item: expect.any(Object), // Ensure it sends the expected item data
      });

      expect(result).toEqual(config);
    });

    it('should throw an error for an invalid config', async () => {
      // Mock DynamoDB putItem to succeed
      putItemSpy.mockResolvedValue({} as PutItemCommandOutput);

      const invalidConfig = {} as toolConfigRecord; // An invalid tool config we don't want to even save

      await expect(dynamoDBConfig.save(invalidConfig)).rejects.toThrowError(
        'InvalidParameterException'
      );
    });
  });
});
