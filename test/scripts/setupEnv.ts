const fs = require('fs');
const outputPath = '../packages/cdk/output.json';
export const envFile = './env.local.ts';

if (!fs.existsSync(outputPath)) {
    console.log('File "packages/cdk/output.json" is not there to generate the env.local');
    process.exit();
}

fs.readFile(outputPath, function (err: any, data: string) {
    if (err) {
        return console.error(err);
    }

    const outputs = JSON.parse(data);
    const ltiTool = outputs["lti-tool"];

    const findValueByKeyPrefix = (obj: { [key: string]: string }, prefix: string) => {
        const findKey = Object.keys(obj).find(key => {
            return key.startsWith(prefix);
        });
        return obj[findKey!];
    };

    const initializeEnvFile = () => {
        fs.writeFileSync(envFile, '// These will be the values in AWS infrastructure you are testing against\r\n');
    }

    const writeEnvFileVariables = (key: string, prefix: string, suffix?: string) => {
        fs.appendFileSync(envFile, `process.env.${key} = '${findValueByKeyPrefix(ltiTool, prefix)}${suffix || ''}';\r\n`);
    }

    initializeEnvFile();
    writeEnvFileVariables("CONTROL_PLANE_TABLE_NAME", "tablesELTIControlPlaneTable");
    writeEnvFileVariables("DATA_PLANE_TABLE_NAME", "tablesELTIDataTable");
    writeEnvFileVariables("KMS_KEY_ID", "keysELTIKeyId");
    writeEnvFileVariables("JWK_URL", "apiELTIURI", "jwks.json");
});
