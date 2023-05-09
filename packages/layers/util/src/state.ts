import { v4 as uuidv4 } from 'uuid';
import { Aws } from './aws';
import { marshall } from '@aws-sdk/util-dynamodb';
import { Powertools } from './powertools';
import { StoreAccessError, SessionNotFound } from '@enable-lti/util';

export interface StateRecord {
  /* eslint-disable */
  id: string;
  PK: string;
  nonce: string;
  nonce_count: number;
  ttl: number;
  platform_lti_token: string | undefined;
  id_token: string | undefined;
  learn_rest_token: string | undefined;
  /* eslint-enable */
}

export interface State {
  load(id: string, nonce: string | undefined): Promise<StateRecord | undefined>;
  save(record: StateRecord | undefined): Promise<StateRecord>;
}

class DynamoDBStateRecord implements StateRecord {
  /* eslint-disable */
  readonly PK: string;
  readonly id: string;
  readonly nonce: string;
  readonly nonce_count: number;
  ttl: number;
  id_token: string | undefined;
  platform_lti_token: string | undefined;
  learn_rest_token: string | undefined;
  /* eslint-enable */
  static assign(incoming: Record<string, any>): DynamoDBStateRecord {
    return new DynamoDBStateRecord(
      incoming.id,
      incoming.PK,
      incoming.nonce,
      incoming.nonce_count,
      incoming.ttl,
      incoming.id_token,
      incoming.platform_lti_token,
      incoming.learn_rest_token
    );
  }

  private constructor(
    id: string = uuidv4(),
    PK = `STATE#${id}`,
    nonce: string = uuidv4(),
    nonceCount = 0,
    ttl = 0,
    idToken?: string,
    platformLtiToken?: string,
    learnRestToken?: string
  ) {
    /* eslint-disable */
    this.id = id;
    this.PK = PK;
    this.nonce = nonce;
    this.nonce_count = nonceCount;
    this.ttl = ttl;
    this.id_token = idToken;
    this.platform_lti_token = platformLtiToken;
    this.learn_rest_token = learnRestToken;
    /* eslint-enable */
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
      `STATE#${id}`,
      sourceStateRecord.nonce,
      sourceStateRecord.nonce_count,
      sourceStateRecord.ttl,
      sourceStateRecord.id_token,
      sourceStateRecord.platform_lti_token,
      sourceStateRecord.learn_rest_token
    );
  }
}
1;
export class DynamoDBState implements State {
  private readonly tableName: string;
  private readonly ttlSeconds: number;

  constructor(tableName: string, ttlSeconds = 7200) {
    this.tableName = tableName;
    this.ttlSeconds = ttlSeconds;
  }

  /**
   * Hydrates the instance from state provided and validates that it has the same nonce, and the nonce has only been used once *Trust On First Use (TOFU)*.
   * @param id state value from the authentication request
   * @param nonce nonce value from the id_token
   * @returns boolean value indicating if the state has been validated.
   */
  async load(id: String, nonce: string | undefined): Promise<StateRecord> {
    const aws = Aws.getInstance();
    try {
      const item = await aws.getItem({
        TableName: this.tableName,
        Key: { PK: { S: `STATE#${id}` } },
      });
      if (item !== undefined) {
        const stateRecord = DynamoDBStateRecord.assign(item);
        if (nonce !== undefined) {
          if (stateRecord.nonce !== nonce && stateRecord.nonce_count !== 0) {
            console.error('Invalid state');
            throw Error('Invalid state');
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
        }
        return stateRecord;
      } else {
        throw new SessionNotFound(`No State record found for STATE${id}.`);
      }
    } catch (e) {
      const error = e as Error;
      throw new StoreAccessError(
        `Error retrieving State for STATE#${id}. ${error.name} - ${error.message}`
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
      throw new StoreAccessError(
        `Error persisting State. ${error.name} - ${error.message}`
      );
    }
  }
}
