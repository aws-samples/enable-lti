require('../env.local.ts');
import { BatchWriteItemCommand, BatchWriteItemInput, DynamoDBClient } from "@aws-sdk/client-dynamodb";
const client = new DynamoDBClient({});

console.log("Seeding integration entries into DynamoDB. Please wait...");
const params: BatchWriteItemInput = {
  RequestItems: {
    [process.env.CONTROL_PLANE_TABLE_NAME!]: [
      {
        PutRequest: {
          Item: {
            "PK": {
              "S": "TOOL#integ-test-client-id#https://lms-integ-test.com"
            },
            "data": {
              "M": {
                "LTIResourceLinks": {
                  "L": [
                    {
                      "M": {
                        "title": {
                          "S": "Integration deep link test 123"
                        },
                        "url": {
                          "S": "https://integ-tool.test.com/sa/lab/123"
                        }
                      }
                    },
                    {
                      "M": {
                        "title": {
                          "S": "Integration deep link test 456"
                        },
                        "url": {
                          "S": "https://integ-tool.test.com/sa/lab/456"
                        }
                      }
                    }
                  ]
                },
                "OIDC": {
                  "M": {
                    "clientId": {
                      "S": "integ_oidc_client_id"
                    },
                    "domain": {
                      "S": "https://integ-tool-oidc.domain.com"
                    },
                    "idpName": {
                      "S": "IntegIDPName"
                    }
                  }
                }
              }
            },
            "id": {
              "S": "integ-test-client-id"
            },
            "issuer": {
              "S": "https://lms-integ-test.com"
            },
            "url": {
              "S": "https://integ-tool.test.com"
            }
          }
        },
      },
      {
        PutRequest: {
          Item: {
            "PK": {
              "S": "PLATFORM#integ-test-client-id#https://lms-integ-test.com#"
            },
            "accessTokenUrl": {
              "S": "https://lms-integ-test.com/api/lti/access-token"
            },
            "authLoginUrl": {
              "S": "https://lms-integ-test.com/api/lti/authorize"
            },
            "authTokenUrl": {
              "S": "https://lms-integ-test.com/api/lti/authorize_redirect"
            },
            "clientId": {
              "S": "integ-test-client-id"
            },
            "iss": {
              "S": "https://lms-integ-test.com"
            },
            "keySetUrl": {
              "S": process.env.JWK_URL!
            }
          },
        },
      },
      {
        PutRequest: {
          Item: {
            "PK": {
              "S": "PLATFORM#integ-test-client-id#https://lms-integ-test.com#integ-deployment-id"
            },
            "accessTokenUrl": {
              "S": "https://lms-integ-test.com/api/lti/access-token"
            },
            "authLoginUrl": {
              "S": "https://lms-integ-test.com/api/lti/authorize"
            },
            "authTokenUrl": {
              "S": "https://lms-integ-test.com/api/lti/authorize_redirect"
            },
            "clientId": {
              "S": "integ-test-client-id"
            },
            "iss": {
              "S": "https://lms-integ-test.com"
            },
            "keySetUrl": {
              "S": process.env.JWK_URL!
            }
          }
        },
      },
    ],
  }
};

const run = async function () {
  try {
    const results = await client.send(new BatchWriteItemCommand(params));
    console.log('Successfully seeded integration entries.');
  } catch (err) {
    console.log('Failed seeding integration entries.');
    console.error(err);
  }
};

run();
