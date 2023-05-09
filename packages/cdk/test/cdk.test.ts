import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ELTIApisStack } from '../src/stacks/eltiApisStack';



test('Snapshot', async () => {

    const app = new App();
    const stack = new ELTIApisStack(app, 'test');
    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();

});
