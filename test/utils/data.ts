import { APIGatewayProxyEvent } from 'aws-lambda';
import { ScanCommandOutput, PutItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { GetPublicKeyCommandOutput } from "@aws-sdk/client-kms";

export const jwksEventRequest: APIGatewayProxyEvent = {
    'resource': '/jwks.json',
    'path': '/jwks.json',
    'httpMethod': 'GET',
    'headers': {},
    'multiValueHeaders': {},
    'queryStringParameters': null,
    'multiValueQueryStringParameters': null,
    'pathParameters': null,
    'stageVariables': null,
    'requestContext': {
        'authorizer': null,
        'resourceId': '123456',
        'resourcePath': '/jwks.json',
        'httpMethod': 'GET',
        'extendedRequestId': '',
        'requestTime': '',
        'path': '/jwks.json',
        'accountId': '123456789012',
        'protocol': 'HTTP/1.1',
        'stage': '',
        'domainPrefix': '',
        'requestTimeEpoch': 1660615799135,
        'requestId': 'c983c03c-f60d-4687-b2b9-8dcba536e0bb',
        'identity': {
            'clientCert': null,
            'cognitoIdentityPoolId': null,
            'cognitoIdentityId': null,
            'apiKey': '',
            'principalOrgId': null,
            'cognitoAuthenticationType': null,
            'userArn': '',
            'apiKeyId': '',
            'userAgent': 'Custom User Agent String',
            'accountId': '',
            'caller': '',
            'sourceIp': '127.0.0.1',
            'accessKey': '',
            'cognitoAuthenticationProvider': null,
            'user': ''
        },
        'apiId': '1234567890'
    },
    'body': null,
    'isBase64Encoded': false
}

export const jwksValidEntry = (days: number = 30): Partial<ScanCommandOutput> => {
    return {
        Items: [{
            "PK": {
                "S": "JWK#f2cafabe-8d1b-423c-9082-53201c279a0a"
            },
            "kid": {
                "S": "f2cafabe-8d1b-423c-9082-53201c279a0a"
            },
            "kmsKeyId": {
                "S": "4c2ff352-324d-4277-916f-b29e51a3707b"
            },
            "publicKeyPem": {
                "S": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoCt72xh8oNFxteJb92MS5fmAm9Fn2AJmV6F2Oh1R6zBVyIM8BFVLqT7Y1b3nnelmC7sEFnq+gcLQsusfVlyza5TfnKRNAxhC4LtAZixsr6+cWihBtBywNZ7TlS9WtOxMoxRk1uoSdKUGW9/TzlS1CSipUmG4dskBdU7tfQndnXLx0ZzUuv9NEZOJdbhvl6VugrNjC1kF91u2d24dgSgfWssZBMKw6kS0BpU3o13M55bSBah5u/BzZrk+tEylZ5fwShwXi7ohvSJIlX0sYbqC/n9F1ghgKkadnR8ueEZDkvIyDlA8N3NW9Cx2SkhvOZeQAsBPK7WNzyoaMeJdg2hRgQIDAQAB\n-----END PUBLIC KEY-----"
            },
            "ttl": {
                "N": `${(new Date().getTime() / 1000) + 86400 * days}`
            }
        }]
    };
}

export const jwksGetPublicKey: Partial<GetPublicKeyCommandOutput> = {
    $metadata: {
        httpStatusCode: 200,
        requestId: "91f2b1aa-b769-4e53-8ac2-772a11591167",
        extendedRequestId: undefined,
        cfId: undefined,
        attempts: 2,
        totalRetryDelay: 33,
    },
    CustomerMasterKeySpec: "RSA_2048",
    EncryptionAlgorithms: undefined,
    KeyId: "arn:aws:kms:us-east-2:123456789012:key/4c2ff352-324d-4277-916f-b29e51a3707b",
    KeySpec: "RSA_2048",
    KeyUsage: "SIGN_VERIFY",
    PublicKey: new Uint8Array([48, 130, 1, 34, 48, 13, 6, 9, 42, 134, 72, 134, 247, 13, 1, 1, 1, 5, 0, 3, 130, 1, 15, 0, 48, 130, 1, 10, 2, 130, 1, 1, 0, 160, 43, 123, 219, 24, 124, 160, 209, 113, 181, 226, 91, 247, 99, 18, 229, 249, 128, 155, 209, 103, 216, 2, 102, 87, 161, 118, 58, 29, 81, 235, 48, 85, 200, 131, 60, 4, 85, 75, 169, 62, 216, 213, 189, 231, 157, 233, 102, 11, 187, 4, 22, 122, 190, 129, 194, 208, 178, 235, 31, 86, 92, 179, 107, 148, 223, 156, 164, 77, 3, 24, 66, 224, 187, 64, 102, 44, 108, 175, 175, 156, 90, 40, 65, 180, 28, 176, 53, 158, 211, 149, 47, 86, 180, 236, 76, 163, 20, 100, 214, 234, 18, 116, 165, 6, 91, 223, 211, 206, 84, 181, 9, 40, 169, 82, 97, 184, 118, 201, 1, 117, 78, 237, 125, 9, 221, 157, 114, 241, 209, 156, 212, 186, 255, 77, 17, 147, 137, 117, 184, 111, 151, 165, 110, 130, 179, 99, 11, 89, 5, 247, 91, 182, 119, 110, 29, 129, 40, 31, 90, 203, 25, 4, 194, 176, 234, 68, 180, 6, 149, 55, 163, 93, 204, 231, 150, 210, 5, 168, 121, 187, 240, 115, 102, 185, 62, 180, 76, 165, 103, 151, 240, 74, 28, 23, 139, 186, 33, 189, 34, 72, 149, 125, 44, 97, 186, 130, 254, 127, 69, 214, 8, 96, 42, 70, 157, 157, 31, 46, 120, 70, 67, 146, 242, 50, 14, 80, 60, 55, 115, 86, 244, 44, 118, 74, 72, 111, 57, 151, 144, 2, 192, 79, 43, 181, 141, 207, 42, 26, 49, 226, 93, 131, 104, 81, 129, 2, 3, 1, 0, 1]),
    SigningAlgorithms: [
        "RSASSA_PKCS1_V1_5_SHA_256",
        "RSASSA_PKCS1_V1_5_SHA_384",
        "RSASSA_PKCS1_V1_5_SHA_512",
        "RSASSA_PSS_SHA_256",
        "RSASSA_PSS_SHA_384",
        "RSASSA_PSS_SHA_512",
    ],
}

export const jwksRefreshEntry = (days: number = 30): Partial<ScanCommandOutput> => {
    return {
        Items: [{
            "PK": {
                "S": "JWK#a4c976d4-d70e-4e56-9ad3-2b69bde0e907",
            },
            "kid": {
                "S": "a4c976d4-d70e-4e56-9ad3-2b69bde0e907",
            },
            "kmsKeyId": {
                "S": "4c2ff352-324d-4277-916f-b29e51a3707b",
            },
            "publicKeyPem": {
                "S": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoCt72xh8oNFxteJb92MS5fmAm9Fn2AJmV6F2Oh1R6zBVyIM8BFVLqT7Y1b3nnelmC7sEFnq+gcLQsusfVlyza5TfnKRNAxhC4LtAZixsr6+cWihBtBywNZ7TlS9WtOxMoxRk1uoSdKUGW9/TzlS1CSipUmG4dskBdU7tfQndnXLx0ZzUuv9NEZOJdbhvl6VugrNjC1kF91u2d24dgSgfWssZBMKw6kS0BpU3o13M55bSBah5u/BzZrk+tEylZ5fwShwXi7ohvSJIlX0sYbqC/n9F1ghgKkadnR8ueEZDkvIyDlA8N3NW9Cx2SkhvOZeQAsBPK7WNzyoaMeJdg2hRgQIDAQAB\n-----END PUBLIC KEY-----",
            },
            "ttl": {
                "N": `${(new Date().getTime() / 1000) + 86400 * days}`,
            },
        }]
    };
}

export const jwksPutItem: Partial<PutItemCommandOutput> = {
}

export const jwksEmptyEntry: Partial<ScanCommandOutput> = {
    Items: []
}