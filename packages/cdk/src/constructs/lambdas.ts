import { ArnFormat, Duration, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Architecture, AssetCode, LayerVersion, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import path from 'path';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Keys } from './keys';
import { Tables } from './tables';
import { NagSuppressions } from 'cdk-nag';

export interface LambdasConfig {
  tables: Tables;
  keys: Keys;
}

const LOG_LEVEL = 'debug';

const ltiNodejsFunction = (scope: Construct, id: string, props?: NodejsFunctionProps): NodejsFunction => {
  const role = new Role(scope, `${id}Role`, {
    assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
  });

  // create log retention role
  const logRetentionRole = new Role(scope, `${id}LogRetentionRole`, {
    assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
  });

  const nodejsFunction = new NodejsFunction(scope, id, {
    memorySize: 256,
    architecture: Architecture.ARM_64,
    timeout: Duration.seconds(30),
    runtime: Runtime.NODEJS_18_X,
    handler: 'handler',
    role: role,
    logRetentionRole: logRetentionRole,
    logRetention: RetentionDays.TEN_YEARS,
    tracing: Tracing.ACTIVE,
    ...props,
  });

  // Create the policy that adds the resource and role
  // tslint:disable-next-line
  const rolePolicy = new ManagedPolicy(scope, `${id}Policy`, {
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: [nodejsFunction.logGroup.logGroupArn],
      }),
    ],
    roles: [role],
  });

  // tslint:disable-next-line
  const logRetentionRolePolicy = new ManagedPolicy(scope, `${id}LogRetentionPolicy`, {
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:PutRetentionPolicy',
          'logs:DeleteRetentionPolicy',
        ],
        resources: [Stack.of(nodejsFunction).formatArn({
          service: 'logs',
          resource: 'log-group',
          arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          resourceName: '/aws/lambda/*',
        })],
      }),
    ],
    roles: [logRetentionRole],
  });
  nodejsFunction.node.addDependency(logRetentionRolePolicy);

  NagSuppressions.addResourceSuppressions(
    [role, logRetentionRole, rolePolicy, logRetentionRolePolicy],
    [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Suppress all AwsSolutions-IAM5 findings on ltiNodejsFunction role as required by log group.',
      },
    ],
    true
  );

  return nodejsFunction;
}


export class Lambdas extends Construct {
  readonly oidc: NodejsFunction;
  readonly launch: NodejsFunction;
  readonly platform: NodejsFunction;
  readonly jwks: NodejsFunction;
  readonly tool: NodejsFunction;
  readonly authorizerProxy: NodejsFunction;
  readonly tokenProxy: NodejsFunction;
  readonly scoreSubmission: NodejsFunction;
  readonly deepLinkingProxy: NodejsFunction;

  constructor(scope: Construct, id: string, config: LambdasConfig) {
    super(scope, id);

    const utilLayer = new LayerVersion(this, 'layerUtil', {
      code: AssetCode.fromAsset(path.join(__dirname, '../../../../dist/layers/util')),
      compatibleRuntimes: [Runtime.NODEJS_18_X],
      description: 'LTI utility functions',
    });

    this.oidc = ltiNodejsFunction(this, 'ltiOidc', {
      entry: path.join(
        __dirname,
        '../../../handlers/oidc/src/index.ts'.replace('/', path.sep)
      ),
      environment: {
        /* eslint-disable @typescript-eslint/naming-convention */
        CONTROL_PLANE_TABLE_NAME: config.tables.controlPlaneTable.tableName,
        DATA_PLANE_TABLE_NAME: config.tables.dataPlaneTable.tableName,
        STATE_TTL: Duration.hours(2).toSeconds().toString(), // Auto expire STATE records after two hours
        POWERTOOLS_SERVICE_NAME: 'oidc',
        POWERTOOLS_METRICS_NAMESPACE: 'lti',
        LOG_LEVEL,
        /* eslint-enable */
      },
      layers: [utilLayer],
    });
    config.tables.controlPlaneTable.grantReadData(this.oidc);
    config.tables.dataPlaneTable.grantReadWriteData(this.oidc);

    this.launch = ltiNodejsFunction(this, 'ltiLaunch', {
      entry: path.join(__dirname, '../../../handlers/launch/src/index.ts'),
      environment: {
        /* eslint-disable @typescript-eslint/naming-convention */
        CONTROL_PLANE_TABLE_NAME: config.tables.controlPlaneTable.tableName,
        DATA_PLANE_TABLE_NAME: config.tables.dataPlaneTable.tableName,

        KMS_KEY_ID: config.keys.asymmetricKey.keyId,
        POWERTOOLS_SERVICE_NAME: 'launch',
        POWERTOOLS_METRICS_NAMESPACE: 'lti',
        LOG_LEVEL,
        /* eslint-enable */
      },
      layers: [utilLayer],
    });
    config.tables.controlPlaneTable.grantReadWriteData(this.launch);
    config.tables.dataPlaneTable.grantReadWriteData(this.launch);

    this.authorizerProxy = ltiNodejsFunction(this, 'authorizerProxy', {
      entry: path.join(
        __dirname,
        '../../../handlers/authorizerProxy/src/index.ts'
      ),
      environment: {
        /* eslint-disable @typescript-eslint/naming-convention */
        DATA_PLANE_TABLE_NAME: config.tables.dataPlaneTable.tableName,
        KMS_KEY_ID: config.keys.asymmetricKey.keyId,
        POWERTOOLS_SERVICE_NAME: 'authorizerProxy',
        POWERTOOLS_METRICS_NAMESPACE: 'lti',
        LOG_LEVEL,
        /* eslint-enable */
      },
      layers: [utilLayer],
    });
    config.tables.dataPlaneTable.grantReadWriteData(this.authorizerProxy);

    this.tokenProxy = ltiNodejsFunction(this, 'tokenProxy', {
      entry: path.join(__dirname, '../../../handlers/tokenProxy/src/index.ts'),
      environment: {
        /* eslint-disable @typescript-eslint/naming-convention */
        DATA_PLANE_TABLE_NAME: config.tables.dataPlaneTable.tableName,
        KMS_KEY_ID: config.keys.asymmetricKey.keyId,
        POWERTOOLS_SERVICE_NAME: 'tokenProxy',
        POWERTOOLS_METRICS_NAMESPACE: 'lti',
        LOG_LEVEL,
        /* eslint-enable */
      },
      layers: [utilLayer],
    });
    config.tables.dataPlaneTable.grantReadWriteData(this.tokenProxy);

    this.scoreSubmission = ltiNodejsFunction(this, 'scoreSubmission', {
      entry: path.join(
        __dirname,
        '../../../handlers/scoreSubmission/src/index.ts'
      ),
      environment: {
        /* eslint-disable @typescript-eslint/naming-convention */
        DATA_PLANE_TABLE_NAME: config.tables.dataPlaneTable.tableName,
        CONTROL_PLANE_TABLE_NAME: config.tables.controlPlaneTable.tableName,
        KMS_KEY_ID: config.keys.asymmetricKey.keyId,
        POWERTOOLS_SERVICE_NAME: 'scoreSubmission',
        POWERTOOLS_METRICS_NAMESPACE: 'lti',
        LOG_LEVEL,
        /* eslint-enable */
      },
      layers: [utilLayer],
    });
    config.tables.controlPlaneTable.grantReadData(this.scoreSubmission);
    config.tables.dataPlaneTable.grantReadWriteData(this.scoreSubmission);

    this.deepLinkingProxy = ltiNodejsFunction(this, 'deepLinkingProxy', {
      entry: path.join(
        __dirname,
        '../../../handlers/deepLinkingProxy/src/index.ts'
      ),
      environment: {
        /* eslint-disable @typescript-eslint/naming-convention */
        DATA_PLANE_TABLE_NAME: config.tables.dataPlaneTable.tableName,
        CONTROL_PLANE_TABLE_NAME: config.tables.controlPlaneTable.tableName,
        KMS_KEY_ID: config.keys.asymmetricKey.keyId,
        POWERTOOLS_SERVICE_NAME: 'deepLinkingProxy',
        POWERTOOLS_METRICS_NAMESPACE: 'lti',
        LOG_LEVEL,
        /* eslint-enable */
      },
      layers: [utilLayer],
    });
    config.tables.controlPlaneTable.grantReadData(this.deepLinkingProxy);
    config.tables.dataPlaneTable.grantReadWriteData(this.deepLinkingProxy);

    this.platform = ltiNodejsFunction(this, 'ltiPlatformRegister', {
      entry: path.join(__dirname, '../../../handlers/platform/src/index.ts'),
      environment: {
        /* eslint-disable @typescript-eslint/naming-convention */
        CONTROL_PLANE_TABLE_NAME: config.tables.controlPlaneTable.tableName,
        POWERTOOLS_SERVICE_NAME: 'platformRegister',
        POWERTOOLS_METRICS_NAMESPACE: 'lti',
        LOG_LEVEL,
        /* eslint-enable */
      },
      layers: [utilLayer],
    });
    config.tables.controlPlaneTable.grantWriteData(this.platform);

    this.tool = ltiNodejsFunction(this, 'ltiToolConfig', {
      entry: path.join(__dirname, '../../../handlers/tool/src/index.ts'),
      environment: {
        /* eslint-disable @typescript-eslint/naming-convention */
        CONTROL_PLANE_TABLE_NAME: config.tables.controlPlaneTable.tableName,
        POWERTOOLS_SERVICE_NAME: 'toolConfig',
        POWERTOOLS_METRICS_NAMESPACE: 'lti',
        LOG_LEVEL,
        /* eslint-enable */
      },
      layers: [utilLayer],
    });
    config.tables.controlPlaneTable.grantWriteData(this.tool);

    this.jwks = ltiNodejsFunction(this, 'ltiJwks', {
      entry: path.join(__dirname, '../../../handlers/jwks/src/index.ts'),
      environment: {
        /* eslint-disable @typescript-eslint/naming-convention */
        CONTROL_PLANE_TABLE_NAME: config.tables.controlPlaneTable.tableName,
        KMS_KEY_ID: config.keys.asymmetricKey.keyId, // Auto expire STATE records after two hours
        POWERTOOLS_SERVICE_NAME: 'jwks',
        POWERTOOLS_METRICS_NAMESPACE: 'lti',
        LOG_LEVEL,
        /* eslint-enable */
      },
      layers: [utilLayer],
    });
    config.tables.controlPlaneTable.grantReadWriteData(this.jwks);

    const asymmetricKeyGrant = new PolicyStatement({
      actions: ['kms:Verify', 'kms:GetPublicKey', 'kms:Sign'],
      effect: Effect.ALLOW,
      resources: [config.keys.asymmetricKey.keyArn],
    });
    this.jwks.grantPrincipal.addToPrincipalPolicy(asymmetricKeyGrant);
    this.launch.grantPrincipal.addToPrincipalPolicy(asymmetricKeyGrant);
    this.deepLinkingProxy.grantPrincipal.addToPrincipalPolicy(asymmetricKeyGrant);
    this.scoreSubmission.grantPrincipal.addToPrincipalPolicy(asymmetricKeyGrant);
  }
}
