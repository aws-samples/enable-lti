import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import * as data from '../../../../test/utils/data';
import { handler } from '../src/index';
import { Context } from 'aws-lambda';
import {
    DynamoDBClient,
    ScanCommand,
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

        ddbMock.on(ScanCommand).resolves(entry);

        const response = await handler(data.jwksEventRequest, {} as Context, (error, result) => {/* do nothing */ });
        expect(ddbMock).toHaveReceivedCommandTimes(ScanCommand, 1);
        expect(kmsMock).toHaveReceivedCommandTimes(PutItemCommand, 0);
        expect(kmsMock).toHaveReceivedCommandTimes(GetPublicKeyCommand, 0);
        expect(response?.statusCode).toBe(200);
        expect(JSON.parse(response?.body!).keys[0].kid).toBe(entry.Items![0]['kid']['S']);
    });

    it('Found JWK, TTL < 10 days', async () => {
        const entry = data.jwksValidEntry(9);
        const refreshEntry = data.jwksRefreshEntry(30);

        ddbMock
            .on(ScanCommand).resolvesOnce(entry).resolves(refreshEntry)
            .on(PutItemCommand).resolves(data.jwksPutItem);
        kmsMock.on(GetPublicKeyCommand).resolves(data.jwksGetPublicKey);

        const response = await handler(data.jwksEventRequest, {} as Context, (error, result) => {/* do nothing */ });
        expect(ddbMock).toHaveReceivedCommandTimes(ScanCommand, 2);
        expect(ddbMock).toHaveReceivedCommandTimes(PutItemCommand, 1);
        expect(kmsMock).toHaveReceivedCommandTimes(GetPublicKeyCommand, 1);
        expect(response?.statusCode).toBe(200);
        expect(JSON.parse(response?.body!).keys[0].kid).toBe(refreshEntry.Items![0]['kid']['S']);
    });

    it('Not found JWK', async () => {
        const refreshEntry = data.jwksRefreshEntry(30);

        ddbMock
            .on(ScanCommand).resolvesOnce(data.jwksEmptyEntry).resolves(refreshEntry)
            .on(PutItemCommand).resolves(data.jwksPutItem);
        kmsMock.on(GetPublicKeyCommand).resolves(data.jwksGetPublicKey);

        const response = await handler(data.jwksEventRequest, {} as Context, (error, result) => {/* do nothing */ });
        expect(ddbMock).toHaveReceivedCommandTimes(ScanCommand, 2);
        expect(ddbMock).toHaveReceivedCommandTimes(PutItemCommand, 1);
        expect(kmsMock).toHaveReceivedCommandTimes(GetPublicKeyCommand, 1);
        expect(response?.statusCode).toBe(200);
        expect(JSON.parse(response?.body!).keys[0].kid).toBe(refreshEntry.Items![0]['kid']['S']);
    });
});
