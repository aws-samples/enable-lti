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
                name: 'SizeRestrictions_QUERYSTRING',
                actionToUse: {
                  allow: {},
                },
              },
              {
                name: 'SizeRestrictions_Cookie_HEADER',
                actionToUse: {
                  allow: {},
                },
              },
              {
                name: 'SizeRestrictions_URIPATH',
                actionToUse: {
                  allow: {},
                },
              },
              {
                name: 'SizeRestrictions_BODY',
                actionToUse: {
                  allow: {},
                },
              },
            ],
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
      // https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-ip-rep.html
      {
        name: 'AWSManagedRulesAmazonIpReputationList',
        priority: 1,
        statement: {
          managedRuleGroupStatement: {
            name: 'AWSManagedRulesAmazonIpReputationList',
            vendorName: 'AWS',
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: 'ELTIAPIWebACL-IPReputation',
          sampledRequestsEnabled: true,
        },
        overrideAction: {
          none: {},
        },
      },
      // https://docs.aws.amazon.com/waf/latest/APIReference/API_RateBasedStatement.html
      {
        priority: 2,
        name: 'RateLimitByPublicIP',
        statement: {
          rateBasedStatement: {
            aggregateKeyType: 'IP',
            limit: 100000, //in 5 minute time window
          },
        },
        action: {
          block: {
            customResponse: {
              customResponseBodyKey: 'denialOfService',
              responseCode: 429,
              responseHeaders: [
                { name: 'x-amzn-waf-action', value: 'denial-of-service' },
                {
                  name: 'x-amzn-errortype',
                  value: 'ServiceUnavailableException',
                },
                { name: 'Retry-After', value: '300' },
              ],
            },
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: 'ELTIAPIWebACL-RateLimitByPublicIP',
          sampledRequestsEnabled: false,
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
      customResponseBodies: {
        denialOfService: {
          content:
            '{"message": "[Service Unavailable] Please try again after some time."}',
          contentType: 'APPLICATION_JSON',
        },
      },
    });
    this.arn = webAcl.attrArn;
  }
}
