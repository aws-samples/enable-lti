import { LtiCustomError } from '@enable-lti/util';
import { marshall } from '@aws-sdk/util-dynamodb';
import { Aws } from './aws';

export interface PlatformConfigRecord {
  authTokenUrl: string;
  authLoginUrl: string;
  accessTokenUrl: string;
  clientId: string;
  ltiDeploymentId: string | undefined;
  iss: string;
  keySetUrl: string;
}

export class DynamoDBPlatformConfigRecord implements PlatformConfigRecord {
  readonly PK: string;
  readonly authLoginUrl: string;
  readonly authTokenUrl: string;
  readonly accessTokenUrl: string;
  readonly clientId: string;
  readonly iss: string;
  readonly keySetUrl: string;
  readonly ltiDeploymentId: string | undefined;

  static assign(incoming: Record<string, any>): DynamoDBPlatformConfigRecord {
    return new DynamoDBPlatformConfigRecord(
      incoming.clientId || '',
      incoming.iss || '',
      incoming.authLoginUrl || '',
      incoming.authTokenUrl || '',
      incoming.accessTokenUrl || '',
      incoming.keySetUrl || '',
      incoming.ltiDeploymentId || undefined,
      incoming.PK || undefined
    );
  }

  constructor(
    clientId: string,
    iss: string,
    authLoginUrl: string,
    authTokenUrl: string,
    accessTokenUrl: string,
    keySetUrl: string,
    ltiDeploymentId?: string,
    PK = `PLATFORM#${clientId}#${iss}#${ltiDeploymentId ?? ''}`
  ) {
    this.PK = PK;
    this.authLoginUrl = authLoginUrl;
    this.authTokenUrl = authTokenUrl;
    this.accessTokenUrl = accessTokenUrl;
    this.clientId = clientId;
    this.iss = iss;
    this.keySetUrl = keySetUrl;
    this.ltiDeploymentId = ltiDeploymentId;
  }
}

export interface PlatformConfig {
  /**
   * Represents the PlatformConfig record for the given client_id, iss, and lti_deployment_id.
   * @param client_id The Tool’s Client ID for this issuer.
   * @param iss The issuer identifier identifying the learning platform.
   * @param lti_deployment_id The specific deployment identifier.
   */
  load(
    client_id: string,
    iss: string,
    lti_deployment_id?: string,
    errorStatusCode?: number
  ): Promise<PlatformConfigRecord>;

  /**
   * @param config The PlatformConfigRecord to save.
   */
  save(config: PlatformConfigRecord): Promise<PlatformConfigRecord>;
}

export class DynamoDBPlatformConfig implements PlatformConfig {
  private readonly tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * @param clientId The Tool’s Client ID for this issuer.
   * @param iss The issuer identifier identifying the learning platform.
   * @param ltiDeploymentId The specific deployment identifier.
   * Because canvasLMS does not send deployment id with login call but sends it for launch flow, we need to retry platformConfig.load without deployment id on failure
   */
  async load(
    clientId: string,
    iss: string,
    ltiDeploymentId?: string,
    errorStatusCode = 500
  ): Promise<PlatformConfigRecord> {
    const aws = Aws.getInstance();
    try {
      let item = await aws.getItem({
        TableName: this.tableName,
        Key: {
          PK: {
            S: `PLATFORM#${clientId}#${iss}#${ltiDeploymentId}`,
          },
        },
      });
      if (item) {
        return DynamoDBPlatformConfigRecord.assign(item);
      }
      item = await aws.getItem({
        TableName: this.tableName,
        Key: {
          PK: {
            S: `PLATFORM#${clientId}#${iss}#`,
          },
        },
      });
      if (item) {
        return DynamoDBPlatformConfigRecord.assign(item);
      }
    } catch (e) {
      const error = e as Error;
      throw new LtiCustomError(
        `PlatformConfig data retrieval error. ${error.name} - ${error.message}`,
        'DataAccessError',
        500
      );
    }
    throw new LtiCustomError(
      `PlatformConfig could not be found for clientId:${clientId}, issuer:${iss}, deploymentId:${ltiDeploymentId}.`,
      'RecordNotFoundError',
      errorStatusCode
    );
  }

  /**
   * Persist the instance to storage.
   */
  async save(record: PlatformConfigRecord): Promise<PlatformConfigRecord> {
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
        `Error persisting PlatformConfig. ${error.name} - ${error.message}`,
        'StoreAccessError',
        500
      );
    }
  }
}
