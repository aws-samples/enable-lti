import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { App, Aspects, Stack } from 'aws-cdk-lib';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { ELTIApisStack } from '../src/stacks/eltiApisStack';

describe('cdk-nag AwsSolutions Pack', () => {
  let stack: Stack;
  let app: App;
  // In this case we can use beforeAll() over beforeEach() since our tests 
  // do not modify the state of the application 
  beforeAll(async () => {
    // GIVEN
    app = new App();
    stack = new ELTIApisStack(app, 'test', {});

    // WHEN
    Aspects.of(stack).add(new AwsSolutionsChecks());
  });

  // THEN
  test('No unsuppressed Warnings', () => {
    const warnings = Annotations.fromStack(stack).findWarning(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*')
    );
    expect(warnings).toHaveLength(0);
  });

  test('No unsuppressed Errors', () => {
    const errors = Annotations.fromStack(stack).findError(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*')
    );
    expect(errors).toHaveLength(0);
  });
});