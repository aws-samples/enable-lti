import { Construct } from 'constructs';
import {
  AuthorizationType,
  LambdaIntegration,
  LambdaRestApi,
  MethodLoggingLevel,
  LogGroupLogDestination,
  AccessLogFormat,
  SecurityPolicy,
  EndpointType,
} from 'aws-cdk-lib/aws-apigateway';
import { CfnOutput } from 'aws-cdk-lib';
import { Lambdas } from './lambdas';
import { CfnWebACLAssociation } from 'aws-cdk-lib/aws-wafv2';
import {
  Effect,
  PolicyStatement,
  PolicyDocument,
  AccountRootPrincipal,
  AnyPrincipal,
  StarPrincipal,
} from 'aws-cdk-lib/aws-iam';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  HostedZone,
  RecordSet,
  RecordTarget,
  RecordType,
} from 'aws-cdk-lib/aws-route53';
import { ApiGateway } from 'aws-cdk-lib/aws-route53-targets';
import { NagSuppressions } from 'cdk-nag';

export interface CustomDomainConfig {
  subDomain: string;
  certificateArn: string;
  r53HostedZoneName: string;
  r53HostedZoneId: string;
}

export interface ApisConfig {
  lambdas: Lambdas;
  wafArn: string;
  customDomainConfig: CustomDomainConfig;
}
const STAGE_PROD = 'prod';

export class Apis extends Construct {
  constructor(scope: Construct, id: string, config: ApisConfig) {
    super(scope, id);
    const accessLogs = new LogGroup(this, 'AccessLogs', {
      removalPolicy: RemovalPolicy.RETAIN,
      retention: RetentionDays.TEN_YEARS,
    });

    /**
     * Data Plane API
     */
    const setCustomDomain = this.node.tryGetContext('deploy-custom-domain');
    const apiLTI = new LambdaRestApi(this, 'ELTIApi', {
      handler: config.lambdas.launch,
      proxy: false,
      disableExecuteApiEndpoint: setCustomDomain,
      deployOptions: {
        accessLogDestination: new LogGroupLogDestination(accessLogs),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
        loggingLevel: MethodLoggingLevel.INFO,
        metricsEnabled: true,
        stageName: STAGE_PROD,
        tracingEnabled: true,
        dataTraceEnabled: false,
      },
      cloudWatchRole: true,
      policy: new PolicyDocument({
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['execute-api:Invoke'],
            principals: [
              new AccountRootPrincipal(), // Allow calls from same a/c. ELTI is being deployed along with EHSW.
            ],
            resources: [
              'execute-api:/*/POST/scoreSubmission',
              'execute-api:/*/POST/rosterRetrieval',
            ],
          }),
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['execute-api:Invoke'],
            principals: [new StarPrincipal()],
            resources: ['execute-api:/*/POST/deepLinkingProxy'],
          }),
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['execute-api:Invoke'],
            principals: [new StarPrincipal()],
            resources: [
              'execute-api:/*/*/login',
              'execute-api:/*/*/launch',
              'execute-api:/*/*/jwks.json',
            ],
          }),
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['execute-api:Invoke'],
            principals: [new AnyPrincipal()],
            resources: [
              'execute-api:/*/GET/authorizerProxy',
              'execute-api:/*/POST/tokenProxy',
            ],
          }),
        ],
      }),
    });

    let endpointValue = apiLTI.url;
    if (setCustomDomain) {
      const fullDomain = `${config.customDomainConfig.subDomain}.${config.customDomainConfig.r53HostedZoneName}`;
      apiLTI.addDomainName('CustomDomain', {
        domainName: fullDomain,
        securityPolicy: SecurityPolicy.TLS_1_2,
        certificate: Certificate.fromCertificateArn(
          this,
          'acmCertificate',
          config.customDomainConfig.certificateArn
        ),
        endpointType: EndpointType.EDGE,
      });
      new RecordSet(this, 'RecordSet', {
        recordName: config.customDomainConfig.subDomain,
        recordType: RecordType.A,
        zone: HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
          hostedZoneId: config.customDomainConfig.r53HostedZoneId,
          zoneName: config.customDomainConfig.r53HostedZoneName,
        }),
        target: RecordTarget.fromAlias(new ApiGateway(apiLTI)),
      });
      endpointValue = `https://${fullDomain}/`;
    }

    apiLTI.root.addCorsPreflight({
      allowOrigins: ['*'],
      allowMethods: ['GET', 'PUT'],
    });

    const loginResource = apiLTI.root.addResource('login');
    const loginLambdaIntegration = new LambdaIntegration(config.lambdas.oidc);
    loginResource.addMethod('POST', loginLambdaIntegration);
    loginResource.addMethod('GET', loginLambdaIntegration);

    const launchResource = apiLTI.root.addResource('launch');
    const launchIntegration = new LambdaIntegration(config.lambdas.launch);
    launchResource.addMethod('POST', launchIntegration);
    launchResource.addMethod('GET', launchIntegration);

    const authProxyResource = apiLTI.root.addResource('authorizerProxy');
    const authProxyIntegration = new LambdaIntegration(
      config.lambdas.authorizerProxy
    );
    authProxyResource.addMethod('GET', authProxyIntegration);

    const tokenProxyResource = apiLTI.root.addResource('tokenProxy');
    const tokenProxyIntegration = new LambdaIntegration(
      config.lambdas.tokenProxy
    );
    tokenProxyResource.addMethod('POST', tokenProxyIntegration);

    const deepLinkingProxyResource =
      apiLTI.root.addResource('deepLinkingProxy');
    const deepLinkingProxyIntegration = new LambdaIntegration(
      config.lambdas.deepLinkingProxy
    );
    deepLinkingProxyResource.addMethod('POST', deepLinkingProxyIntegration);

    const scoreSubmissionResource = apiLTI.root.addResource('scoreSubmission', {
      defaultMethodOptions: {
        authorizationType: AuthorizationType.IAM,
      },
    });
    const scoreSubmissionIntegration = new LambdaIntegration(
      config.lambdas.scoreSubmission
    );
    scoreSubmissionResource.addMethod('POST', scoreSubmissionIntegration);

    const rosterRetrievalResource = apiLTI.root.addResource('rosterRetrieval', {
      defaultMethodOptions: {
        authorizationType: AuthorizationType.IAM,
      },
    });
    const rosterRetrievalIntegration = new LambdaIntegration(
      config.lambdas.rosterRetrieval
    );
    rosterRetrievalResource.addMethod('POST', rosterRetrievalIntegration);

    const jwksResource = apiLTI.root.addResource('jwks.json');
    const jwksIntegration = new LambdaIntegration(config.lambdas.jwks);
    jwksResource.addMethod('GET', jwksIntegration);

    NagSuppressions.addResourceSuppressions(
      apiLTI,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason:
            'Suppress all AwsSolutions-IAM4 findings on apiLTI for AmazonAPIGatewayPushToCloudWatchLogs.',
        },
        {
          id: 'AwsSolutions-APIG2',
          reason:
            'Suppress all AwsSolutions-APIG2 findings on apiLTI validation.',
        },
        {
          id: 'AwsSolutions-COG4',
          reason:
            'Suppress all AwsSolutions-APIG2 findings on apiLTI resources as it enforces auth inside lambdas.',
        },
      ],
      true
    );
    NagSuppressions.addResourceSuppressions(
      [
        apiLTI,
        loginResource,
        launchResource,
        scoreSubmissionResource,
        jwksResource,
        deepLinkingProxyResource,
        authProxyResource,
        tokenProxyResource,
      ],
      [
        {
          id: 'AwsSolutions-APIG4',
          reason:
            'Suppress all AwsSolutions-APIG2 findings on apiLTI resources as it enforces auth inside lambdas.',
        },
      ],
      true
    );

    new CfnOutput(this, 'ELTI URI', {
      value: endpointValue,
    });

    new CfnWebACLAssociation(scope, 'EltiWebACLAssociation', {
      resourceArn: apiLTI.deploymentStage.stageArn,
      webAclArn: config.wafArn,
    });

    /**
     * Control Plane API
     */
    const apiLTIControlPlane = new LambdaRestApi(this, 'ELTIConfigApi', {
      handler: config.lambdas.launch,
      proxy: false,
      deployOptions: {
        accessLogDestination: new LogGroupLogDestination(accessLogs),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
        loggingLevel: MethodLoggingLevel.INFO,
        metricsEnabled: true,
        stageName: STAGE_PROD,
        tracingEnabled: true,
        dataTraceEnabled: false,
      },
      cloudWatchRole: true,
      policy: new PolicyDocument({
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['execute-api:Invoke'],
            principals: [new AccountRootPrincipal()],
            resources: ['execute-api:/*/*/platform', 'execute-api:/*/*/tool'],
          }),
        ],
      }),
    });

    apiLTIControlPlane.root.addCorsPreflight({
      allowOrigins: ['*'],
      allowMethods: ['GET', 'PUT'],
    });

    const platformResource = apiLTIControlPlane.root.addResource('platform', {
      defaultMethodOptions: {
        authorizationType: AuthorizationType.IAM,
      },
    });
    const platformIntegration = new LambdaIntegration(config.lambdas.platform);
    platformResource.addMethod('POST', platformIntegration);

    const toolResource = apiLTIControlPlane.root.addResource('tool', {
      defaultMethodOptions: {
        authorizationType: AuthorizationType.IAM,
      },
    });
    const toolIntegration = new LambdaIntegration(config.lambdas.tool);
    toolResource.addMethod('POST', toolIntegration);

    NagSuppressions.addResourceSuppressions(
      apiLTIControlPlane,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason:
            'Suppress all AwsSolutions-IAM4 findings on apiLTI for AmazonAPIGatewayPushToCloudWatchLogs.',
        },
        {
          id: 'AwsSolutions-APIG2',
          reason:
            'Suppress all AwsSolutions-APIG2 findings on apiLTIControlPlane validation.',
        },
        {
          id: 'AwsSolutions-APIG4',
          reason:
            'Suppress all AwsSolutions-APIG2 findings on apiLTIControlPlane resource.',
        },
        {
          id: 'AwsSolutions-COG4',
          reason:
            'Suppress all AwsSolutions-APIG2 findings on apiLTIControlPlane resource does not use cognito authorizer.',
        },
      ],
      true
    );

    new CfnOutput(this, 'ELTI Control Plane URI', {
      value: apiLTIControlPlane.url,
    });

    new CfnWebACLAssociation(scope, 'EltiConfigWebACLAssociation', {
      resourceArn: apiLTIControlPlane.deploymentStage.stageArn,
      webAclArn: config.wafArn,
    });
  }
}
