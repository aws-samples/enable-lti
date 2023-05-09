import { Construct } from 'constructs';
import { Key, KeySpec, KeyUsage } from 'aws-cdk-lib/aws-kms';
import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';

export class Keys extends Construct {
    readonly asymmetricKey: Key;

    constructor(scope: Construct, id: string) {
        super(scope, id);
        //Key material to use for JWT Signing and Verification
        this.asymmetricKey = new Key(this, 'ltiAsymmetricKey', {
            keySpec: KeySpec.RSA_2048,         // Default to SYMMETRIC_DEFAULT
            keyUsage: KeyUsage.SIGN_VERIFY,    // and ENCRYPT_DECRYPT
            removalPolicy: RemovalPolicy.DESTROY,
            pendingWindow: Duration.days(7),
            alias: 'alias/ltiAsymmetricKey',
            description: 'KMS key for signing and verification of JSON Web Tokens (JWT)',
            enableKeyRotation: false,
        });

        new CfnOutput(this, 'ELTIKeyId', {
            value: this.asymmetricKey.keyId,
        });
    }

}