import { Aws } from './aws';
import { marshall } from '@aws-sdk/util-dynamodb';
import {
  InvalidValueError,
  RecordNotFoundError,
  StoreAccessError,
} from '@enable-lti/util';

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

export type toolConfigRecord = {
  id: string;
  issuer: string;
  url: string;
  data: toolConfigData;
};

export interface LtiToolConfigRecord {
  id: string;
  issuer: string;
  url: string;
  data: toolConfigData;
  toolOIDCAuthorizeURL(
    toolURL: string,
    state?: string,
    launchUrl?: string,
    nonce?: string
  ): string;
  authUrl(): string;
  jwksUrl(): string;
}

export interface LtiToolConfig {
  load(id: string, issuer: string): Promise<LtiToolConfigRecord>;
  save(config: toolConfigRecord): Promise<LtiToolConfigRecord>;
}

class DynamoDBLtiToolConfigRecord implements LtiToolConfigRecord {
  readonly PK: string;
  readonly id: string;
  readonly issuer: string;
  readonly url: string;
  readonly data: toolConfigData;

  static assign(incoming: Record<string, any>): DynamoDBLtiToolConfigRecord {
    return new DynamoDBLtiToolConfigRecord(
      incoming.id,
      incoming.issuer,
      incoming.url,
      incoming.PK,
      incoming.data
    );
  }

  private constructor(
    id: string,
    issuer: string,
    url: string,
    PK?: string,
    data: toolConfigData = {}
  ) {
    this.id = id;
    this.issuer = issuer;
    this.url = url;
    this.PK = PK === undefined ? `TOOL#${id}#${issuer}` : PK!;
    this.data = data;
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
   * @param toolURL the url user must be redirected to after Authentication
   * @param state an optional state parameter to be added
   * @param launchUrl an optional launch url to launch if there is no OIDC configuration
   * @param nonce an optional nonce to be added for tool oidc flow
   *
   * @returns the oauth2/authorize endpoint of tool's OIDC provider with toolURL as redirect_uri
   * Please note that this will return the toolURL back if there is no OIDC configured
   */
  toolOIDCAuthorizeURL(
    toolURL: string,
    state?: string,
    launchUrl?: string,
    nonce?: string
  ): string {
    if (!this.data.OIDC) {
      return launchUrl ?? toolURL;
    }
    let toolOIDCURL = `${this.data.OIDC.domain}oauth2/authorize?identity_provider=${this.data.OIDC.idpName}&redirect_uri=${toolURL}&response_type=code&client_id=${this.data.OIDC.clientId}&scope=openid`;
    if (state) {
      toolOIDCURL = `${toolOIDCURL}&state=${state}`;
    }
    if (nonce) {
      toolOIDCURL = `${toolOIDCURL}&nonce=${nonce}`;
    }
    return toolOIDCURL;
  }
}

export class DynamoDBLtiToolConfig implements LtiToolConfig {
  private readonly tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }
  async load(id: String, issuer: String): Promise<LtiToolConfigRecord> {
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
      throw new RecordNotFoundError(
        `Error retrieving LtiToolConfig for TOOL#${id}. ${error.name} - ${error.message}`
      );
    }
  }

  async save(config: toolConfigRecord): Promise<LtiToolConfigRecord> {
    if (!config.url) {
      throw new InvalidValueError('InvalidParameterException');
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
      throw new StoreAccessError(
        `Error persisting LtiToolConfig. ${error.name} - ${error.message}`
      );
    }
  }
}
