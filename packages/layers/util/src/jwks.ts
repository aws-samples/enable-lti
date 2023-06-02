
import { v4 as uuidv4 } from 'uuid';
import { marshall } from '@aws-sdk/util-dynamodb';
import { exportJWK, importSPKI, JSONWebKeySet, JWK } from 'jose';
import { Aws } from './aws';

export interface Jwks {
    load(kmsKeyId: string): Promise<JwkRecord>;

    all(): Promise<JSONWebKeySet>

    save(jwkRecord: JwkRecord): Promise<void>
}

export interface JwkRecord {
    kid: string
    kmsKeyId: string
    publicKeyPem: string
    ttl: number

    toJWK(): Promise<JWK>

}

export class DynamoDBJwkRecord implements JwkRecord {
    readonly PK: string;
    readonly kid: string;
    readonly kmsKeyId: string;
    readonly publicKeyPem: string;
    ttl: number;

    static assign(incoming: Record<string, any>): JwkRecord {
        return new DynamoDBJwkRecord(incoming.kmsKeyId, incoming.publicKeyPem, incoming.ttl, incoming.kid, incoming.PK);
    }

    static async new(kmsKeyId: string): Promise<JwkRecord> {

        const aws = Aws.getInstance();
        const publicKeyPem = await aws.getPublicKeyPem(kmsKeyId);
        if (publicKeyPem === undefined) {
            throw Error(`Could not find public key for KMS key id '${kmsKeyId}'`);
        } else {
            return new DynamoDBJwkRecord(kmsKeyId, publicKeyPem);
        }
    }

    // kid: string = uuidv4(), PK: string = `JWK#${kid}`, kmsKeyId: string, publicKeyPem: string, ttl: number = 0
    private constructor(kmsKeyId: string, publicKeyPem: string, ttl = 0, kid: string = uuidv4(), PK = `${kmsKeyId}`) {
        this.PK = PK;
        this.kid = kid;
        this.kmsKeyId = kmsKeyId;
        this.publicKeyPem = publicKeyPem;
        this.ttl = ttl;
    }

    async toJWK(): Promise<JWK> {

        // const jwk=pem2jwk(this.publicKeyPem)
        const keyLike = await importSPKI(this.publicKeyPem, 'RS256');
        const jwk = await exportJWK(keyLike);
        const re = /-----BEGIN PUBLIC KEY-----\r?\n?(.*)\r?\n?-----END PUBLIC KEY-----/;
        // @ts-ignore
        const x5c: string = this.publicKeyPem.match(re)[1];
        return {
            kid: this.kid,
            kty: 'RSA',
            use: 'sig',
            alg: 'RS256',
            n: jwk.n,
            e: jwk.e,
            x5c: [x5c]

        } as JWK;

    }

}

export class DynamoDBJwks implements Jwks {
    private readonly tableName: string;
    private readonly kmsKeyId: string;
    private readonly ttlSeconds: number;

    constructor(tableName: string, kmsKeyId: string, ttlSeconds = 2592000) {
        this.tableName = tableName;
        this.kmsKeyId = kmsKeyId;
        this.ttlSeconds = ttlSeconds;
    }

    async all(): Promise<JSONWebKeySet> {
        const aws = Aws.getInstance();
        const record: Record<string, any> | undefined = await aws.getItem({
            TableName: this.tableName,
            Key:{
                'PK': { S: `${this.kmsKeyId}`}
            },
        });
        const tenDaysFromNow = (new Date().getTime() / 1000) + 864000;
        if (record === undefined || record.ttl - tenDaysFromNow <= 864000) {
            const jwkRecord = await DynamoDBJwkRecord.new(this.kmsKeyId);
            await this.save(jwkRecord);
            return await this.all();

        } else {
            const keys: JWK[] = [];
            const jwk = await DynamoDBJwkRecord.assign(record).toJWK();
            keys.push(jwk);
            return {
                keys: keys
            } as JSONWebKeySet;
        }
    }

    async save(jwkRecord: JwkRecord): Promise<void> {
        const aws = Aws.getInstance();
        jwkRecord.ttl = (Math.floor(+new Date() / 1000) + +(this.ttlSeconds));
        const item = marshall(jwkRecord, {
            convertClassInstanceToMap: true
        });
        await aws.putItem({
            TableName: this.tableName,
            Item: item
        });
    }

    async load(kmsKeyId: string): Promise<JwkRecord> {
        const aws = Aws.getInstance();
        const record: Record<string, any> | undefined = await aws.getItem({
            TableName: this.tableName,
            Key: { 'PK': { 'S': `${kmsKeyId}` } }
        });
        if (record !== undefined) {
            return DynamoDBJwkRecord.assign(record);
        } else {
            throw Error(`No JwkRecord found for KMS Key ID ${kmsKeyId}`);
        }
    }

}



