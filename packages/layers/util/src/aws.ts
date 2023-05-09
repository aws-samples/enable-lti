import {
  GetPublicKeyCommand,
  KMSClient,
  MessageType,
  SignCommand,
  SigningAlgorithmSpec,
  VerifyCommand,
} from '@aws-sdk/client-kms';
import { Sha256 } from '@aws-crypto/sha256-js';
import { SSMClient } from '@aws-sdk/client-ssm';
import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandInput,
  PutItemCommand,
  PutItemCommandOutput,
  PutItemInput,
  ScanCommand,
  ScanCommandInput,
  UpdateItemCommand,
  UpdateItemCommandInput,
  UpdateItemCommandOutput,
} from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

export class Aws {
  private static instance: Aws;
  private kmsClient: KMSClient;
  private ssmClient: SSMClient;
  private dynamoDBClient: DynamoDBClient;

  private constructor(configuration: object = {}) {
    this.kmsClient = new KMSClient(configuration);
    this.ssmClient = new SSMClient(configuration);
    this.dynamoDBClient = new DynamoDBClient(configuration);
  }

  static getInstance(): Aws {
    if (!this.instance) {
      this.instance = new this();
    }
    return this.instance;
  }

  async getPublicKeyPem(kmsKeyId: string): Promise<string | undefined> {
    try {
      const response = await this.kmsClient.send(
        new GetPublicKeyCommand({
          KeyId: kmsKeyId,
        })
      );
      const publicKeyBytes: Uint8Array = response.PublicKey!;
      const pem = Buffer.from(publicKeyBytes).toString('base64');
      return `-----BEGIN PUBLIC KEY-----\n${pem}\n-----END PUBLIC KEY-----`;
    } catch (e) {
      const error = e as Error;
      throw error;
    }
  }

  async sign(
    kmsKeyId: string,
    message: Uint8Array
  ): Promise<Uint8Array | undefined> {
    const hash = new Sha256();
    hash.update(message);
    const digestedMassage = await hash.digest();
    const response = await this.kmsClient.send(
      new SignCommand({
        KeyId: kmsKeyId,
        Message: digestedMassage,
        MessageType: MessageType.DIGEST,
        SigningAlgorithm: SigningAlgorithmSpec.RSASSA_PKCS1_V1_5_SHA_256,
      })
    );

    return response.Signature;
  }

  async verify(
    kmsKeyId: string,
    message: Uint8Array,
    signature: Uint8Array
  ): Promise<boolean> {
    const response = await this.kmsClient.send(
      new VerifyCommand({
        KeyId: kmsKeyId,
        Message: message,
        MessageType: MessageType.RAW,
        SigningAlgorithm: SigningAlgorithmSpec.RSASSA_PKCS1_V1_5_SHA_256,
        Signature: signature,
      })
    );
    return response.SignatureValid !== undefined
      ? response.SignatureValid
      : false;
  }

  async updateItem(
    input: UpdateItemCommandInput
  ): Promise<UpdateItemCommandOutput> {
    return await this.dynamoDBClient.send(new UpdateItemCommand(input));
  }

  async getItem(
    input: GetItemCommandInput
  ): Promise<Record<string, any> | undefined> {
    const response = await this.dynamoDBClient.send(new GetItemCommand(input));
    if (response.Item !== undefined) {
      return unmarshall(response.Item);
    } else {
      console.warn(`No item found for input ${JSON.stringify(input)}`);
      return undefined;
    }
  }

  async putItem(input: PutItemInput): Promise<PutItemCommandOutput> {
    return await this.dynamoDBClient.send(new PutItemCommand(input));
  }

  async scan(
    input: ScanCommandInput
  ): Promise<Record<string, any>[] | undefined> {
    const response = await this.dynamoDBClient.send(new ScanCommand(input));
    if (response.Items !== undefined && response.Items.length > 0) {
      return response.Items.map((item) => {
        return unmarshall(item);
      });
    } else {
      console.warn(`No items found for input ${JSON.stringify(input)}`);
      return undefined;
    }
  }
}
