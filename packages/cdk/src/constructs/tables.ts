import { Construct } from 'constructs';
import { AttributeType, BillingMode, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';

export class Tables extends Construct {
    readonly controlPlaneTable: Table;
    readonly dataPlaneTable: Table;


    constructor(scope: Construct, id: string) {
        super(scope, id);
        this.controlPlaneTable = new Table(this, 'controlPlaneTable', {
            partitionKey: { name: 'PK', type: AttributeType.STRING },
            billingMode: BillingMode.PAY_PER_REQUEST,
            timeToLiveAttribute: 'ttl',
            pointInTimeRecovery: true,
            encryption: TableEncryption.AWS_MANAGED,
            // The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
            // the new table, and it will remain in your account until manually deleted. By setting the policy to
            // DESTROY, cdk destroy will delete the table (even if it has data in it)
            removalPolicy: RemovalPolicy.RETAIN
        });

        this.dataPlaneTable = new Table(this, 'dataPlaneTable', {
            partitionKey: { name: 'PK', type: AttributeType.STRING },
            billingMode: BillingMode.PAY_PER_REQUEST,
            timeToLiveAttribute: 'ttl',
            pointInTimeRecovery: true,
            encryption: TableEncryption.AWS_MANAGED,
            // The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
            // the new table, and it will remain in your account until manually deleted. By setting the policy to
            // DESTROY, cdk destroy will delete the table (even if it has data in it)
            removalPolicy: RemovalPolicy.RETAIN
        });

        new CfnOutput(this, 'ELTIControlPlaneTable', {
            value: this.controlPlaneTable.tableName,
          });
        new CfnOutput(this, 'ELTIDataTable', {
            value: this.dataPlaneTable.tableName,
          });

    }

}