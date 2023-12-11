import { LtiCustomError } from '@enable-lti/util';
import { marshall } from '@aws-sdk/util-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { Aws } from './aws';
import { Powertools } from './powertools';

export interface StateRecord {
  id: string;
  PK: string;
  nonce: string;
  nonce_count: number;
  ttl: number;
  platform_lti_token: string | undefined;
  id_token: string | undefined;
  learn_rest_token?: string | undefined;
  tool_url?: string;
}

export interface State {
  load(id: string, nonce: string): Promise<StateRecord>;
  save(record: StateRecord | undefined): Promise<StateRecord>;
}

export const makeStatePK = (stateId: string): string => {
  return `STATE#${stateId}`;
};

export class DynamoDBStateRecord implements StateRecord {
  readonly PK: string;
  readonly id: string;
  readonly nonce: string;
  readonly nonce_count: number;
  ttl: number;
  id_token: string | undefined;
  platform_lti_token: string | undefined;
  learn_rest_token: string | undefined;
  tool_url?: string;
  static assign(incoming: Record<string, any>): DynamoDBStateRecord {
    return new DynamoDBStateRecord(
      incoming.id,
      incoming.PK,
      incoming.nonce,
      incoming.nonce_count,
      incoming.ttl,
      incoming.id_token,
      incoming.platform_lti_token,
      incoming.learn_rest_token,
      incoming.tool_url
    );
  }

  private constructor(
    id: string = uuidv4(),
    PK = makeStatePK(id),
    nonce: string = uuidv4(),
    nonceCount = 0,
    ttl = 0,
    idToken?: string,
    platformLtiToken?: string,
    learnRestToken?: string,
    toolURL?: string
  ) {
    this.id = id;
    this.PK = PK;
    this.nonce = nonce;
    this.nonce_count = nonceCount;
    this.ttl = ttl;
    this.id_token = idToken;
    this.platform_lti_token = platformLtiToken;
    this.learn_rest_token = learnRestToken;
    this.tool_url = toolURL;
  }

  static new(): DynamoDBStateRecord {
    return new DynamoDBStateRecord();
  }

  static cloneWithNewId(
    sourceStateRecord: StateRecord,
    id: string
  ): DynamoDBStateRecord {
    return new DynamoDBStateRecord(
      id,
      makeStatePK(id),
      id,
      0,
      sourceStateRecord.ttl,
      sourceStateRecord.id_token,
      sourceStateRecord.platform_lti_token,
      sourceStateRecord.learn_rest_token
    );
  }
}

export class DynamoDBState implements State {
  private readonly tableName: string;
  private readonly ttlSeconds: number;

  constructor(tableName: string, ttlSeconds = 7200) {
    this.tableName = tableName;
    if (typeof ttlSeconds !== 'number') {
      this.ttlSeconds = 7200;
    } else {
      this.ttlSeconds = ttlSeconds;
    }
  }

  /**
   * Hydrates the instance from state provided and validates that it has the same nonce, and the nonce has only been used once *Trust On First Use (TOFU)*.
   * @param id state value from the authentication request
   * @param nonce nonce value from the id_token, if it is not provided then id is re-used for nonce
   * @returns boolean value indicating if the state has been validated.
   */
  async load(id: string, nonce?: string): Promise<StateRecord> {
    try {
      const aws = Aws.getInstance();
      const item = await aws.getItem({
        TableName: this.tableName,
        Key: { PK: { S: makeStatePK(id) } },
        ConsistentRead: true,
      });
      if (!item) {
        throw new LtiCustomError(
          `No State record found for ${makeStatePK(id)}.`,
          'SessionNotFound',
          401
        );
      } else {
        // In one case, we are using the state record and mechanism to limit to single use for single id, below condition is to accommodate for that case
        if (!nonce) {
          nonce = id;
        }
        const stateRecord = DynamoDBStateRecord.assign(item);
        if (stateRecord.nonce !== nonce || stateRecord.nonce_count !== 0) {
          throw new LtiCustomError('Invalid nonce', 'SessionNotFound', 401);
        } else {
          await aws.updateItem({
            TableName: this.tableName,
            Key: { PK: { S: stateRecord.PK } },
            UpdateExpression: 'ADD nonce_count :inc',
            ConditionExpression:
              'nonce = :nonce AND nonce_count = :nonce_count',
            ExpressionAttributeValues: {
              ':inc': { N: '1' },
              ':nonce': { S: stateRecord.nonce },
              ':nonce_count': { N: '0' },
            },
          });
        }
        return stateRecord;
      }
    } catch (e) {
      const error = e as Error;
      if (error instanceof LtiCustomError) {
        throw error;
      }
      throw new LtiCustomError(
        `Error retrieving State for ${makeStatePK(id)}. ${error.name} - ${
          error.message
        }`,
        'StateLoadError',
        500
      );
    }
  }

  /**
   * Persist the instance to storage. Will set the TTL.
   * @returns LTIState instance
   */
  async save(
    record: StateRecord | undefined = undefined
  ): Promise<StateRecord> {
    if (record === undefined) {
      record = DynamoDBStateRecord.new();
    }

    record.ttl = Math.floor(+new Date() / 1000) + +this.ttlSeconds; //this will auto expire the state in DDB
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
      const logger = Powertools.getInstance().logger;
      logger.error(
        `Error persisting State record for ${JSON.stringify(record)}. ${
          error.name
        } - ${error.message}`
      );
      throw new LtiCustomError(
        `Error persisting State. ${error.name} - ${error.message}`,
        'StoreAccessError',
        500
      );
    }
  }
}
