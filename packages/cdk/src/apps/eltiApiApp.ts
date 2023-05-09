#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ELTIApisStack } from '../stacks/eltiApisStack';
import { AwsSolutionsChecks } from 'cdk-nag';

const app = new cdk.App();
cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))
new ELTIApisStack(app, 'lti-tool')
app.synth();
