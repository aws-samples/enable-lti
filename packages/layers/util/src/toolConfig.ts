import { LtiCustomError } from '@enable-lti/util';
import { marshall } from '@aws-sdk/util-dynamodb';
import { Aws } from './aws';

export type titleURLs = {
  title: string;
  url: string;
  lineItem?: {
    scoreMaximum: number;
    label?: string;
    resourceId?: string;
    tag?: string;
  };
};

export type toolOIDCConfig = {
  clientId: string;
  domain: string;
  idpName: string;
};

export type toolConfigData = {
  OIDC?: toolOIDCConfig;
  LTIResourceLinks?: titleURLs[];
};

export type featureName = 'ForceLogout' | 'CMPDeepLinkingRedirect';
export type featureData = {
  cmpDomain?: string;
  cmpResourceLinksAPI?: string;
  oidc?: toolOIDCConfig;
};

export type eLTIFeature = {
  name: featureName;
  enabled: boolean;
  data?: featureData;
};

export type toolConfigRecord = {
  id: string;
  issuer: string;
  url: string;
  data: toolConfigData;
  features: eLTIFeature[];
  clientUuId?: string;
};

export interface LtiToolConfigRecord {
  id: string;
  issuer: string;
  url: string;
  data: toolConfigData;
  features: eLTIFeature[];
  clientUuId?: string;
  toolOIDCAuthorizeURL(
    state?: string,
    launchUrl?: string,
    nonce?: string
  ): string;
  toolOIDCLogoutURL(logoutRedirectURL: string, state: string): string;
  cmpAuthorizeURL(state?: string, nonce?: string): string;
  cmpDomainFlow(): boolean;
  isFeatureEnabled(feature: featureName): boolean;
  cmpResourceLinkAPIURL(): string | undefined;
  authUrl(): string;
  jwksUrl(): string;
}

export interface LtiToolConfig {
  load(id: string, issuer: string): Promise<LtiToolConfigRecord>;
  save(config: toolConfigRecord): Promise<LtiToolConfigRecord>;
}

export class DynamoDBLtiToolConfigRecord implements LtiToolConfigRecord {
  readonly PK: string;
  readonly id: string;
  readonly issuer: string;
  readonly url: string;
  readonly data: toolConfigData;
  readonly features: eLTIFeature[];
  readonly clientUuId?: string;

  static assign(incoming: Record<string, any>): DynamoDBLtiToolConfigRecord {
    return new DynamoDBLtiToolConfigRecord(
      incoming.id,
      incoming.issuer,
      incoming.url,
      incoming.PK,
      incoming.data,
      incoming.features,
      incoming.clientUuId
    );
  }

  constructor(
    id: string,
    issuer: string,
    url: string,
    PK?: string,
    data: toolConfigData = {},
    features?: eLTIFeature[],
    clientUuId?: string
  ) {
    this.id = id;
    this.issuer = issuer;
    this.url = url;
    this.PK = PK === undefined ? `TOOL#${id}#${issuer}` : PK!;
    this.data = data;
    this.features = features === undefined ? [] : features;
    this.clientUuId = clientUuId;
  }

  static new(
    id: string,
    issuer: string,
    url: string,
    data: Record<string, any> = {}
  ): DynamoDBLtiToolConfigRecord {
    return new DynamoDBLtiToolConfigRecord(id, issuer, url, undefined, data);
  }

  authUrl(): string {
    return `${this.url}/authcode`;
  }

  jwksUrl(): string {
    return `${this.url}/jwks.json`;
  }

  /**
   * This function will construct the oath2/authorize url with response_type=code and scope=openId
   * https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html
   *
   * @param optional state
   * @param launchUrl an optional launch url to launch if there is no OIDC configuration
   * @param optional nonce
   *
   * @returns the oauth2/authorize endpoint of tool's OIDC provider with toolURL as redirect_uri
   * Please note that this will return the toolURL back if there is no OIDC configured
   */
  toolOIDCAuthorizeURL(
    state?: string,
    launchUrl?: string,
    nonce?: string
  ): string {
    if (!this.data.OIDC) {
      return launchUrl ?? this.url;
    }
    let toolOIDCURL = `${this.data.OIDC.domain}oauth2/authorize?identity_provider=${this.data.OIDC.idpName}&redirect_uri=${this.url}&response_type=code&client_id=${this.data.OIDC.clientId}&scope=openid`;
    if (state) {
      toolOIDCURL = `${toolOIDCURL}&state=${state}`;
    }
    if (nonce) {
      toolOIDCURL = `${toolOIDCURL}&nonce=${nonce}`;
    }
    return toolOIDCURL;
  }

  /**
   * This function will construct the logout url with client_id, logout_uri, and state as params
   * https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html
   *
   * @param logoutRedirectURL the url user must be redirected to after logou
   * @param state an optional state parameter to be added
   * @returns the logout endpoint of tool's OIDC provider with eLTI redirect handler endpoint as logout_url
   */
  toolOIDCLogoutURL(logoutRedirectURL: string, state?: string): string {
    if (!this.data.OIDC) {
      throw new LtiCustomError(
        'OIDC does not exist in tool config',
        'OIDCDoesNotExist',
        500
      );
    }
    let toolOIDCLogoutURL = `${this.data.OIDC!.domain}logout?client_id=${
      this.data.OIDC!.clientId
    }&logout_uri=${logoutRedirectURL}`;
    if (state) {
      toolOIDCLogoutURL = `${toolOIDCLogoutURL}&state=${state}`;
    }
    return toolOIDCLogoutURL;
  }

  cmpAuthorizeURL(state?: string, nonce?: string): string {
    const cmpOidc = this.cmpOidc();
    if (!cmpOidc) {
      throw new Error('CMP OIDC data not found on tool object');
    }
    const cmpDomain = this.cmpDomain();
    if (!cmpDomain) {
      throw new Error('CMP Domain not found');
    }
    let cmpAuthorizeURL = `${cmpOidc.domain}oauth2/authorize?identity_provider=${cmpOidc.idpName}&redirect_uri=${cmpDomain}&response_type=code&client_id=${cmpOidc.clientId}&scope=openid`;
    if (state) {
      cmpAuthorizeURL = `${cmpAuthorizeURL}&state=${state}`;
    }
    if (nonce) {
      cmpAuthorizeURL = `${cmpAuthorizeURL}&nonce=${nonce}`;
    }
    return cmpAuthorizeURL;
  }
  cmpDomainFlow(): boolean {
    return (
      this.isFeatureEnabled('CMPDeepLinkingRedirect') &&
      this.cmpDomain() !== undefined &&
      this.cmpResourceLinkAPIURL() !== undefined
    );
  }
  cmpDomain(): string | undefined {
    return this.features.find((f) => f.name === 'CMPDeepLinkingRedirect')?.data
      ?.cmpDomain;
  }
  cmpResourceLinkAPIURL(): string | undefined {
    return this.features.find((f) => f.name === 'CMPDeepLinkingRedirect')?.data
      ?.cmpResourceLinksAPI;
  }
  cmpOidc(): toolOIDCConfig | undefined {
    return this.features.find((f) => f.name === 'CMPDeepLinkingRedirect')?.data
      ?.oidc;
  }
  /**
   * As we are expanding our features, we will provide the ability to enable or disable features using tool config object
   * @param featureName
   * @returns
   */
  isFeatureEnabled(featureName: featureName): boolean {
    return (
      this.features &&
      this.features.length > 0 &&
      this.features.some((f) => f.name === featureName && f.enabled)
    );
  }
}

export class DynamoDBLtiToolConfig implements LtiToolConfig {
  private readonly tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }
  async load(id: string, issuer: string): Promise<LtiToolConfigRecord> {
    const aws = Aws.getInstance();
    try {
      const item = await aws.getItem({
        TableName: this.tableName,
        Key: { PK: { S: `TOOL#${id}#${issuer}` } },
      });
      if (item !== undefined) {
        return DynamoDBLtiToolConfigRecord.assign(item);
      } else {
        throw Error(`No LtiToolConfig record found for TOOL#${id}.`);
      }
    } catch (e) {
      const error = e as Error;
      throw new LtiCustomError(
        `Error retrieving LtiToolConfig for TOOL#${id}. ${error.name} - ${error.message}`,
        'RecordNotFoundError',
        500
      );
    }
  }

  async save(config: toolConfigRecord): Promise<LtiToolConfigRecord> {
    if (!config.url || !config.id || !config.issuer) {
      throw new LtiCustomError(
        'InvalidParameterException',
        'InvalidValueError',
        500
      );
    }
    const record = DynamoDBLtiToolConfigRecord.assign(config);
    const aws = Aws.getInstance();
    const item = marshall(record, {
      convertClassInstanceToMap: true,
      removeUndefinedValues: true,
    });
    try {
      await aws.putItem({
        TableName: this.tableName,
        Item: item,
      });
      return record;
    } catch (e) {
      const error = e as Error;
      throw new LtiCustomError(
        `Error persisting LtiToolConfig. ${error.name} - ${error.message}`,
        'StoreAccessError',
        500
      );
    }
  }
}
