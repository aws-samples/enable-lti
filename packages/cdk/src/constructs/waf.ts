import { Construct } from 'constructs';
import { CfnWebACL } from 'aws-cdk-lib/aws-wafv2';

export class WebAcl extends Construct {
  public readonly arn: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const rules = [
      {
        name: 'AWSManagedRulesCommonRuleSet',
        priority: 0,
        statement: {
          managedRuleGroupStatement: {
            name: 'AWSManagedRulesCommonRuleSet',
            vendorName: 'AWS',
            // Excluding generic SizeRestrictions for large id_token payloads
            // https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-list.html
            ruleActionOverrides: [
              {
                name: "SizeRestrictions_QUERYSTRING",
                actionToUse: {
                  allow: {}
                }
              },
              {
                name: "SizeRestrictions_Cookie_HEADER",
                actionToUse: {
                  allow: {}
                }
              },
              {
                name: "SizeRestrictions_URIPATH",
                actionToUse: {
                  allow: {}
                }
              },
              {
                name: "SizeRestrictions_BODY",
                actionToUse: {
                  allow: {}
                }
              },
            ]
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: 'ELTIAPIWebACL-CRS',
          sampledRequestsEnabled: true,
        },
        overrideAction: {
          none: {},
        },
      },
    ];

    const webAcl = new CfnWebACL(scope, `${id}Base`, {
      description: 'Basic protection for ELTI APIGW endpoints.',
      scope: 'REGIONAL',
      defaultAction: {
        allow: {},
      },
      rules,
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'ELTIAPIWebACL',
        sampledRequestsEnabled: true,
      },
    });
    this.arn = webAcl.attrArn;
  }
}
