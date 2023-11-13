import {
  GetPublicKeyCommand,
  KMSClient,
  SignCommand,
  VerifyCommand,
} from '@aws-sdk/client-kms';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import { marshall } from '@aws-sdk/util-dynamodb';
import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandInput,
  GetItemCommandOutput,
  PutItemCommand,
  PutItemCommandOutput,
  PutItemInput,
  ScanCommand,
  ScanCommandInput,
  ScanCommandOutput,
  UpdateItemCommand,
  UpdateItemCommandInput,
  UpdateItemCommandOutput,
} from '@aws-sdk/client-dynamodb';
import { Aws } from '@enable-lti/util';

const kmsMock = mockClient(KMSClient);
const ddbMock = mockClient(DynamoDBClient);

describe('AWS util', () => {
  const awsUtil = Aws.getInstance();

  describe('getPublicKeyPem', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return KeyId when successful', async () => {
      const mockedPublicKey = new Uint8Array(Buffer.from('FAKE_PUBLIC_KEY'));
      kmsMock.on(GetPublicKeyCommand).resolves({
        PublicKey: mockedPublicKey,
      });

      const result = await awsUtil.getPublicKeyPem('FAKE_KEY_ID');

      expect(kmsMock).toHaveReceivedCommandTimes(GetPublicKeyCommand, 1);
      expect(result).toEqual(getMockedPem(mockedPublicKey));
    });

    it('should throw error when failed', async () => {
      kmsMock.on(GetPublicKeyCommand).rejects(new Error('FAKE_ERROR'));

      await expect(awsUtil.getPublicKeyPem('FAKE_KEY_ID')).rejects.toThrow(
        'FAKE_ERROR'
      );
    });
  });

  describe('sign', () => {
    const mockedMessage = new Uint8Array(Buffer.from('FAKE_MESSAGE'));
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return signature when successful', async () => {
      const mockedSignature = new Uint8Array(Buffer.from('FAKE_SIGNATURE'));
      kmsMock.on(SignCommand).resolves({
        Signature: mockedSignature,
      });

      const result = await awsUtil.sign('FAKE_KEY_ID', mockedMessage);

      expect(kmsMock).toHaveReceivedCommandTimes(SignCommand, 1);
      expect(result).toEqual(mockedSignature);
    });

    it('should throw error when failed', async () => {
      kmsMock.on(SignCommand).rejects(new Error('FAKE_ERROR'));

      await expect(awsUtil.sign('FAKE_KEY_ID', mockedMessage)).rejects.toThrow(
        'FAKE_ERROR'
      );
    });
  });

  describe('verify', () => {
    const mockedMessage = new Uint8Array(Buffer.from('FAKE_MESSAGE'));
    const mockedSignature = new Uint8Array(Buffer.from('FAKE_SIGNATURE'));
    beforeEach(() => {
      jest.clearAllMocks();
      jest.resetAllMocks();
      kmsMock.reset();
    });

    it('should return true when signature is valid', async () => {
      kmsMock.on(VerifyCommand).resolves({
        SignatureValid: true,
      });

      const result = await awsUtil.verify(
        'FAKE_KEY_ID',
        mockedMessage,
        mockedSignature
      );

      expect(kmsMock).toHaveReceivedCommandTimes(VerifyCommand, 1);
      expect(result).toEqual(true);
    });

    it('should return false when signature is invalid', async () => {
      kmsMock.on(VerifyCommand).resolves({
        SignatureValid: false,
      });

      const result = await awsUtil.verify(
        'FAKE_KEY_ID',
        mockedMessage,
        mockedSignature
      );

      expect(kmsMock).toHaveReceivedCommandTimes(VerifyCommand, 1);
      expect(result).toEqual(false);
    });

    it('should throw error when failed', async () => {
      kmsMock.on(VerifyCommand).rejects(new Error('FAKE_ERROR'));

      await expect(
        awsUtil.verify('FAKE_KEY_ID', mockedMessage, mockedSignature)
      ).rejects.toThrow('FAKE_ERROR');
    });
  });

  describe('updateItem', () => {
    const mockedItem = {
      id: 'FAKE_ID',
      name: 'FAKE_NAME',
    };
    const mockedUpdateItemInput: UpdateItemCommandInput = {
      TableName: 'FAKE_TABLE_NAME',
      Key: marshall(mockedItem),
      UpdateExpression: 'SET name = :name',
      ExpressionAttributeValues: marshall({
        ':name': 'FAKE_NAME',
      }),
    };
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return item when successful', async () => {
      const mockedPutItemOutput: UpdateItemCommandOutput = {
        Attributes: marshall(mockedItem),
        $metadata: {
          httpStatusCode: 200,
          requestId: 'FAKE_REQUEST_ID',
        },
      };
      ddbMock.on(UpdateItemCommand).resolves(mockedPutItemOutput);

      const result = await awsUtil.updateItem(mockedUpdateItemInput);

      expect(ddbMock).toHaveReceivedCommandTimes(UpdateItemCommand, 1);
      expect(result).toEqual(mockedPutItemOutput);
    });

    it('should throw error when failed', async () => {
      ddbMock.on(UpdateItemCommand).rejects(new Error('FAKE_ERROR'));

      await expect(awsUtil.updateItem(mockedUpdateItemInput)).rejects.toThrow(
        'FAKE_ERROR'
      );
    });
  });

  describe('getItem', () => {
    const mockedItem = {
      id: 'FAKE_ID',
      name: 'FAKE_NAME',
    };
    const mockedGetItemInput: GetItemCommandInput = {
      TableName: 'FAKE_TABLE_NAME',
      Key: marshall(mockedItem),
    };
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return item when successful', async () => {
      const mockedGetItemOutput: GetItemCommandOutput = {
        Item: marshall(mockedItem),
        $metadata: {
          httpStatusCode: 200,
          requestId: 'FAKE_REQUEST_ID',
        },
      };
      ddbMock.on(GetItemCommand).resolves(mockedGetItemOutput);

      const result = await awsUtil.getItem(mockedGetItemInput);

      expect(ddbMock).toHaveReceivedCommandTimes(GetItemCommand, 1);
      expect(result).toEqual(mockedItem);
    });

    it('should throw error when failed', async () => {
      ddbMock.on(GetItemCommand).rejects(new Error('FAKE_ERROR'));

      await expect(awsUtil.getItem(mockedGetItemInput)).rejects.toThrow(
        'FAKE_ERROR'
      );
    });
  });

  describe('putItem', () => {
    const mockedItem = {
      id: 'FAKE_ID',
      name: 'FAKE_NAME',
    };
    const mockedPutItemInput: PutItemInput = {
      TableName: 'FAKE_TABLE_NAME',
      Item: marshall(mockedItem),
    };
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return item when successful', async () => {
      const mockedPutItemOutput: PutItemCommandOutput = {
        Attributes: {
          id: { S: 'FAKE_ID' },
          name: { S: 'FAKE_NAME' },
        },
        $metadata: {
          httpStatusCode: 200,
          requestId: 'FAKE_REQUEST_ID',
        },
      };
      ddbMock.on(PutItemCommand).resolves(mockedPutItemOutput);

      const result = await awsUtil.putItem(mockedPutItemInput);

      expect(ddbMock).toHaveReceivedCommandTimes(PutItemCommand, 1);
      expect(result).toEqual(mockedPutItemOutput);
    });
  });

  describe('scan', () => {
    const mockedItem = {
      id: 'FAKE_ID',
      name: 'FAKE_NAME',
    };
    const mockedScanInput: ScanCommandInput = {
      TableName: 'FAKE_TABLE_NAME',
    };
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return item when successful', async () => {
      const mockedScanOuput: ScanCommandOutput = {
        Items: [marshall(mockedItem)],
        $metadata: {
          httpStatusCode: 200,
          requestId: 'FAKE_REQUEST_ID',
        },
      };
      ddbMock.on(ScanCommand).resolves(mockedScanOuput);

      const result = await awsUtil.scan(mockedScanInput);

      expect(ddbMock).toHaveReceivedCommandTimes(ScanCommand, 1);
      expect(result).toEqual([mockedItem]);
    });

    it('should throw error when failed', async () => {
      ddbMock.on(ScanCommand).rejects(new Error('FAKE_ERROR'));

      await expect(awsUtil.scan(mockedScanInput)).rejects.toThrow('FAKE_ERROR');
    });
  });
});

function getMockedPem(publicKey: Uint8Array) {
  const pem = Buffer.from(publicKey).toString('base64');
  return `-----BEGIN PUBLIC KEY-----\n${pem}\n-----END PUBLIC KEY-----`;
}
