import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import { DynamoDBState, DynamoDBStateRecord, makeStatePK } from '../src/state';
import { marshall } from '@aws-sdk/util-dynamodb';
import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';

const ddbMock = mockClient(DynamoDBClient);
const TEST_TABLE = 'test_table';
const TEST_STATE_ID = 'test_state_id';
const TEST_NONCE_ID = 'test_nonce_id';

export const sampleStateGetItem = (
  state: string,
  nonce: string,
  nonceCount: string
) => {
  return {
    Item: {
      PK: {
        S: `STATE#${state}`,
      },
      id: {
        S: state,
      },
      id_token: {
        S: 'id_token',
      },
      nonce: {
        S: nonce,
      },
      nonce_count: {
        N: nonceCount,
      },
      platform_lti_token: {
        S: 'ACCESS_TOKEN',
      },
      ttl: {
        N: '1692642318',
      },
    },
  };
};

beforeEach(() => {
  ddbMock.reset();
});

describe('state load', () => {
  it('loads successfully and verify nonce is updated', async () => {
    ddbMock
      .on(GetItemCommand)
      .resolves(sampleStateGetItem(TEST_STATE_ID, TEST_NONCE_ID, '0'));
    ddbMock.on(UpdateItemCommand).resolves({});
    const state = new DynamoDBState(TEST_TABLE);
    await state.load(TEST_STATE_ID, TEST_NONCE_ID);
    expect(ddbMock).toHaveReceivedCommandTimes(GetItemCommand, 1);
    expect(ddbMock).toHaveReceivedCommandWith(GetItemCommand, {
      TableName: TEST_TABLE,
      Key: { PK: { S: makeStatePK(TEST_STATE_ID) } },
      ConsistentRead: true,
    });
    expect(ddbMock).toHaveReceivedCommandTimes(UpdateItemCommand, 1);
    expect(ddbMock).toHaveReceivedCommandWith(UpdateItemCommand, {
      TableName: TEST_TABLE,
      Key: { PK: { S: makeStatePK(TEST_STATE_ID) } },
      UpdateExpression: 'ADD nonce_count :inc',
      ConditionExpression: 'nonce = :nonce AND nonce_count = :nonce_count',
      ExpressionAttributeValues: {
        ':inc': { N: '1' },
        ':nonce': { S: TEST_NONCE_ID },
        ':nonce_count': { N: '0' },
      },
    });
  });
  it('loads for state with single id', async () => {
    ddbMock
      .on(GetItemCommand)
      .resolves(sampleStateGetItem(TEST_STATE_ID, TEST_STATE_ID, '0'));
    ddbMock.on(UpdateItemCommand).resolves({});
    const state = new DynamoDBState(TEST_TABLE);
    await state.load(TEST_STATE_ID);
    expect(ddbMock).toHaveReceivedCommandTimes(GetItemCommand, 1);
    expect(ddbMock).toHaveReceivedCommandWith(GetItemCommand, {
      TableName: TEST_TABLE,
      Key: { PK: { S: makeStatePK(TEST_STATE_ID) } },
      ConsistentRead: true,
    });
    expect(ddbMock).toHaveReceivedCommandTimes(UpdateItemCommand, 1);
    expect(ddbMock).toHaveReceivedCommandWith(UpdateItemCommand, {
      TableName: TEST_TABLE,
      Key: { PK: { S: makeStatePK(TEST_STATE_ID) } },
      UpdateExpression: 'ADD nonce_count :inc',
      ConditionExpression: 'nonce = :nonce AND nonce_count = :nonce_count',
      ExpressionAttributeValues: {
        ':inc': { N: '1' },
        ':nonce': { S: TEST_STATE_ID },
        ':nonce_count': { N: '0' },
      },
    });
  });
  it('Reject load when state does not exist', async () => {
    ddbMock
      .on(GetItemCommand, {
        TableName: TEST_TABLE,
        Key: { PK: { S: makeStatePK(TEST_STATE_ID) } },
        ConsistentRead: true,
      })
      .resolves(sampleStateGetItem(TEST_STATE_ID, TEST_NONCE_ID, '0'));
    const state = new DynamoDBState(TEST_TABLE);
    await expect(state.load(TEST_STATE_ID)).rejects.toThrow();
    await expect(state.load('wrong_state_id', TEST_NONCE_ID)).rejects.toThrow();
  });
  it('Reject load if nonce does not match', async () => {
    ddbMock
      .on(GetItemCommand, {
        TableName: TEST_TABLE,
        Key: { PK: { S: makeStatePK(TEST_STATE_ID) } },
        ConsistentRead: true,
      })
      .resolves(sampleStateGetItem(TEST_STATE_ID, TEST_NONCE_ID, '0'));
    const state = new DynamoDBState(TEST_TABLE);
    await expect(state.load(TEST_STATE_ID, 'wrong_nonce_id')).rejects.toThrow();
  });
  it('Reject load if nonce_count is 1', async () => {
    ddbMock
      .on(GetItemCommand, {
        TableName: TEST_TABLE,
        Key: { PK: { S: makeStatePK(TEST_STATE_ID) } },
        ConsistentRead: true,
      })
      .resolves(sampleStateGetItem(TEST_STATE_ID, TEST_NONCE_ID, '1'));
    const state = new DynamoDBState(TEST_TABLE);
    await expect(state.load(TEST_STATE_ID, TEST_NONCE_ID)).rejects.toThrow();
  });
});
describe('state save', () => {
  it('create and save successfully', async () => {
    ddbMock.on(PutItemCommand).resolves({});
    const state = new DynamoDBState(TEST_TABLE);
    const record = await state.save();
    expect(ddbMock).toHaveReceivedCommandTimes(PutItemCommand, 1);
    expect(record).toHaveProperty('PK', makeStatePK(record.id));
    expect(record).toHaveProperty('nonce_count', 0);
    expect(record).toHaveProperty('nonce', expect.any(String));
    expect(record).toHaveProperty('id', expect.any(String));
    expect(ddbMock).toHaveReceivedCommandWith(PutItemCommand, {
      TableName: TEST_TABLE,
      Item: marshall(record, {
        convertClassInstanceToMap: true,
        removeUndefinedValues: true,
      }),
    });
  });
  it('save a record successfully', async () => {
    ddbMock.on(PutItemCommand).resolves({});
    const state = new DynamoDBState(TEST_TABLE);
    const record = DynamoDBStateRecord.new();
    const savedRecord = await state.save(record);
    expect(ddbMock).toHaveReceivedCommandTimes(PutItemCommand, 1);
    expect(ddbMock).toHaveReceivedCommandWith(PutItemCommand, {
      TableName: TEST_TABLE,
      Item: marshall(record, {
        convertClassInstanceToMap: true,
        removeUndefinedValues: true,
      }),
    });
    expect(savedRecord).toBe(record);
  });
});
