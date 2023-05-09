import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Lambdas } from '../constructs/lambdas';
import { Apis } from '../constructs/apis';
export declare class ELTIApisStack extends Stack {
    private _lambdas;
    private _apis;
    constructor(scope: Construct, id: string, props?: StackProps);
    get lambdas(): Lambdas;
    get apis(): Apis;
}
