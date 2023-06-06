import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import * as data from '../../../../test/utils/data';
import { handler } from '../src/index';
import { Context } from 'aws-lambda';
import {
    DynamoDBClient,
    GetItemCommand,
    PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
    GetPublicKeyCommand,
    KMSClient
} from '@aws-sdk/client-kms';

const ddbMock = mockClient(DynamoDBClient);
const kmsMock = mockClient(KMSClient);

beforeEach(() => {
    ddbMock.reset();
    kmsMock.reset();
});

describe('jwks.json Tests', () => {
    it('Found JWK, TTL > 10 days', async () => {
        const entry = data.jwksValidEntry(30);

        ddbMock.on(GetItemCommand).resolves(entry);

        const response = await handler(data.jwksEventRequest, {} as Context, (error, result) => {/* do nothing */ });
        expect(ddbMock).toHaveReceivedCommandTimes(GetItemCommand, 1);
        expect(kmsMock).toHaveReceivedCommandTimes(PutItemCommand, 0);
        expect(kmsMock).toHaveReceivedCommandTimes(GetPublicKeyCommand, 0);
        expect(response?.statusCode).toBe(200);
        expect(JSON.parse(response?.body!).keys[0].kid).toBe(entry.Item!['kid']['S']);
    });

    it('Found JWK, TTL < 10 days', async () => {
        const entry = data.jwksValidEntry(9);
        const refreshEntry = data.jwksRefreshEntry(30);

        ddbMock
            .on(GetItemCommand).resolvesOnce(entry).resolves(refreshEntry)
            .on(PutItemCommand).resolves(data.jwksPutItem);
        kmsMock.on(GetPublicKeyCommand).resolves(data.jwksGetPublicKey);

        const response = await handler(data.jwksEventRequest, {} as Context, (error, result) => {/* do nothing */ });
        expect(ddbMock).toHaveReceivedCommandTimes(GetItemCommand, 2);
        expect(ddbMock).toHaveReceivedCommandTimes(PutItemCommand, 1);
        expect(kmsMock).toHaveReceivedCommandTimes(GetPublicKeyCommand, 1);
        expect(response?.statusCode).toBe(200);
        expect(JSON.parse(response?.body!).keys[0].kid).toBe(refreshEntry.Item!['kid']['S']);
    });

    it('Not found JWK', async () => {
        const refreshEntry = data.jwksRefreshEntry(30);

        ddbMock
            .on(GetItemCommand).resolvesOnce(data.jwksEmptyEntry).resolves(refreshEntry)
            .on(PutItemCommand).resolves(data.jwksPutItem);
        kmsMock.on(GetPublicKeyCommand).resolves(data.jwksGetPublicKey);

        const response = await handler(data.jwksEventRequest, {} as Context, (error, result) => {/* do nothing */ });
        expect(ddbMock).toHaveReceivedCommandTimes(GetItemCommand, 2);
        expect(ddbMock).toHaveReceivedCommandTimes(PutItemCommand, 1);
        expect(kmsMock).toHaveReceivedCommandTimes(GetPublicKeyCommand, 1);
        expect(response?.statusCode).toBe(200);
        expect(JSON.parse(response?.body!).keys[0].kid).toBe(refreshEntry.Item!['kid']['S']);
    });
});
