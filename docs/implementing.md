# Implementing

## Getting Started

??? info "System Requirements"

    The following tools need to be installed prior to building and deploying:

    * Node.js 18 - [How to install Node.js](https://nodejs.dev/en/learn/how-to-install-nodejs/){:target="blank"}
    * AWS CDK v2 - [Install the AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_install){:target="_blank"}

!!! note "Note"

    The commands shown are run from the root directory of the project unless specified otherwise.


The following commands install project dependencies and build eLTI.
``` bash
echo "# Install dependencies"
npm install
echo "# Build project"
npm run build
```

The following commands deploy and test eLTI in an integration environment.

!!! note "Note"

    The CDK deploy `outputs.json` is used during the `test:setup` command to setup the configurations and table entries in an integration environment.
    After setup the integration tests can be run continuously.

!!! info "Info"

    For [cdk bootstrap](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html), each environment (account/region combination) to which you deploy must be bootstrapped separately.

``` bash
echo "# One-time: CDK bootstrap"
npm run cdk bootstrap
echo "# CDK deploy"
npm run cdk -- -- deploy --outputs-file output.json
echo "# One-time: Setup integration test configs and table entries"
npm run test:setup
echo "# Run integration tests"
npm run test:integration
```

## Cleaning up resources

To cleanup the resources created by this project delete the stack that CDK deployed.

!!! danger "Warning"

    Do not run the following command unless intending to delete the created resources.

``` bash
npm run cdk destroy
```