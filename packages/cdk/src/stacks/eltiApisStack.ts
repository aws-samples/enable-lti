import { Stack, StackProps, CfnParameter } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Lambdas } from '../constructs/lambdas';
import { Apis, ApisConfig } from '../constructs/apis';
import { Keys } from '../constructs/keys';
import { Tables } from '../constructs/tables';
import { WebAcl } from '../constructs/waf';

export class ELTIApisStack extends Stack {
  private _lambdas: Lambdas;
  private _apis: Apis;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const keys = new Keys(this, 'keys');
    const tables = new Tables(this, 'tables');
    const subDomainName = new CfnParameter(this, 'subDomainName', {
      type: 'String',
      default: '',
      description: 'Custom sub-domain name for ELTI APIGW',
    });
    const certificateArn = new CfnParameter(this, 'certificateArn', {
      type: 'String',
      default: '',
      description: 'ACM Certificate Arn',
    });
    const r53HostedZoneName = new CfnParameter(this, 'r53HostedZoneName', {
      type: 'String',
      default: '',
      description: 'Route53 hosted zone name',
    });
    const r53HostedZoneId = new CfnParameter(this, 'r53HostedZoneId', {
      type: 'String',
      default: '',
      description: 'Route53 hosted zone id',
    });
    this._lambdas = new Lambdas(this, 'lambdas', {
      tables: tables,
      keys: keys,
    });
    const webAcl = new WebAcl(this, 'eltiWaf');
    const apiConfig: ApisConfig = {
      lambdas: this._lambdas,
      wafArn: webAcl.arn,
      customDomainConfig: {
        subDomain: subDomainName.valueAsString,
        certificateArn: certificateArn.valueAsString,
        r53HostedZoneId: r53HostedZoneId.valueAsString,
        r53HostedZoneName: r53HostedZoneName.valueAsString,
      },
    };
    this._apis = new Apis(this, 'api', apiConfig);
  }

  public get lambdas(): Lambdas {
    return this._lambdas;
  }

  public get apis(): Apis {
    return this._apis;
  }
}
