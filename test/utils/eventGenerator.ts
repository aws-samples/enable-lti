import { APIGatewayProxyEvent } from 'aws-lambda';
import {
  CLIENT_ID,
  DEPLOYMENT_ID,
  ISS,
  TOOL_DEEPLINK_URL1,
  TOOL_OIDC_DOMAIN,
} from './models';

const defaultIdentityObject = () => {
  return {
    apiKey: null,
    apiKeyId: null,
    clientCert: null,
    cognitoIdentityPoolId: null,
    accountId: null,
    cognitoIdentityId: null,
    caller: null,
    sourceIp: '52.94.133.128',
    principalOrgId: null,
    accessKey: null,
    cognitoAuthenticationType: null,
    cognitoAuthenticationProvider: null,
    userArn: null,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:106.0) Gecko/20100101 Firefox/106.0',
    user: null,
  };
};

const requestContext = (resourcePath: string) => {
  return {
    authorizer: undefined,
    resourceId: '123456',
    resourcePath,
    httpMethod: 'POST',
    path: `/prod${resourcePath}`,
    accountId: '123456789012',
    protocol: 'HTTP/1.1',
    stage: '',
    domainPrefix: '',
    requestTimeEpoch: 1669326491070,
    requestId: 'c983c03c-f60d-4687-b2b9-8dcba536e0bb',
    identity: defaultIdentityObject(),
    domainName: 'id.execute-api.us-east-1.amazonaws.com',
    apiId: '1234567890',
  };
};

export const loginRequestEvent = (): APIGatewayProxyEvent => {
  const request: APIGatewayProxyEvent = {
    resource: '/login',
    path: '/login',
    httpMethod: 'POST',
    headers: {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.5',
      'CloudFront-Forwarded-Proto': 'https',
      'CloudFront-Is-Desktop-Viewer': 'true',
      'CloudFront-Is-Mobile-Viewer': 'false',
      'CloudFront-Is-SmartTV-Viewer': 'false',
      'CloudFront-Is-Tablet-Viewer': 'false',
      'CloudFront-Viewer-ASN': '16509',
      'CloudFront-Viewer-Country': 'US',
      'content-type': 'application/x-www-form-urlencoded',
      Cookie: 'state=6f98895e-7b8c-4792-ac27-7a7afffabb0f',
      Host: 'id.execute-api.us-east-1.amazonaws.com',
      origin: `${ISS}`,
      Referer: `${ISS}/courses/816/modules/items/35859`,
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'cross-site',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:106.0) Gecko/20100101 Firefox/106.0',
      Via: '2.0 9546eb427ef2137803aed00cad4fc426.cloudfront.net (CloudFront)',
      'X-Amz-Cf-Id': 'aqNjlTR_jtL6cXy34-qyDGYiqzjgVhxLl-URHG_L1eE9lG54tSmkgQ==',
      'X-Amzn-Trace-Id': 'Root=1-637fe69b-787588ca46bf76a6789a025e',
      'X-Forwarded-For': '52.94.133.129, 15.158.50.52',
      'X-Forwarded-Port': '443',
      'X-Forwarded-Proto': 'https',
    },
    multiValueHeaders: {
      Accept: [
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      ],
      'Accept-Encoding': ['gzip, deflate, br'],
      'Accept-Language': ['en-US,en;q=0.5'],
      'CloudFront-Forwarded-Proto': ['https'],
      'CloudFront-Is-Desktop-Viewer': ['true'],
      'CloudFront-Is-Mobile-Viewer': ['false'],
      'CloudFront-Is-SmartTV-Viewer': ['false'],
      'CloudFront-Is-Tablet-Viewer': ['false'],
      'CloudFront-Viewer-ASN': ['16509'],
      'CloudFront-Viewer-Country': ['US'],
      'content-type': ['application/x-www-form-urlencoded'],
      Cookie: ['state=6f98895e-7b8c-4792-ac27-7a7afffabb0f'],
      Host: ['id.execute-api.us-east-1.amazonaws.com'],
      origin: [ISS],
      Referer: [`${ISS}/courses/816/modules/items/35859`],
      'sec-fetch-dest': ['document'],
      'sec-fetch-mode': ['navigate'],
      'sec-fetch-site': ['cross-site'],
      'sec-fetch-user': ['?1'],
      'upgrade-insecure-requests': ['1'],
      'User-Agent': [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:106.0) Gecko/20100101 Firefox/106.0',
      ],
      Via: ['2.0 9546eb427ef2137803aed00cad4fc426.cloudfront.net (CloudFront)'],
      'X-Amz-Cf-Id': [
        'aqNjlTR_jtL6cXy34-qyDGYiqzjgVhxLl-URHG_L1eE9lG54tSmkgQ==',
      ],
      'X-Amzn-Trace-Id': ['Root=1-637fe69b-787588ca46bf76a6789a025e'],
      'X-Forwarded-For': ['52.94.133.129, 15.158.50.52'],
      'X-Forwarded-Port': ['443'],
      'X-Forwarded-Proto': ['https'],
    },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: requestContext('/login'),
    body: `iss=${encodeURIComponent(
      ISS
    )}&login_hint=b0be1d1d0a2f64749cc50020c0493674dcf6b49c&client_id=${CLIENT_ID}&target_link_uri=${TOOL_DEEPLINK_URL1}&lti_message_hint=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ2ZXJpZmllciI6IjExYTkzNGQyMjUwZjk4ZGE5YTJmMGNjOWI1MDkzYmFhNTdmYmY2OWUyYTAwNGZjMDUzYjNhMTAxYWViMTQwYjVhYmE3MjkyNDExY2FmZDBhMDQzMDI3NGVhODEzODgyZmU2Njg2YzA3ZTI0N2EzMzBhMWRlMTAwMTVjYjhmMzgwIiwiY2FudmFzX2RvbWFpbiI6ImVkdWNhdGV0ZXN0Lmluc3RydWN0dXJlLmNvbSIsImNvbnRleHRfdHlwZSI6IkNvdXJzZSIsImNvbnRleHRfaWQiOjk2OTUwMDAwMDAwMDAwODE2LCJjYW52YXNfbG9jYWxlIjoiZW4iLCJleHAiOjE2NjkzMjY3ODl9.bXpmh4pkSC2aBNvfTPngQaSfbvP2ZmVFcWEL81wJ8yY&canvas_region=us-east-1&lti_storage_target=_parent`,
    isBase64Encoded: false,
  };
  return request;
};

export const launchProxyRequestEvent = (
  idToken: string,
  state: string
): APIGatewayProxyEvent => {
  const request: APIGatewayProxyEvent = {
    resource: '/launch',
    path: '/launch',
    httpMethod: 'POST',
    headers: {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.5',
      'CloudFront-Forwarded-Proto': 'https',
      'CloudFront-Is-Desktop-Viewer': 'true',
      'CloudFront-Is-Mobile-Viewer': 'false',
      'CloudFront-Is-SmartTV-Viewer': 'false',
      'CloudFront-Is-Tablet-Viewer': 'false',
      'CloudFront-Viewer-ASN': '16509',
      'CloudFront-Viewer-Country': 'US',
      'content-type': 'application/x-www-form-urlencoded',
      Cookie: `state=${state}`,
      Host: 'id.execute-api.us-east-1.amazonaws.com',
      origin: ISS,
      Referer: `${ISS}/api/lti/authorize?client_id=${CLIENT_ID}&login_hint=b0be1d1d0a2f64749cc50020c0493674dcf6b49c&lti_message_hint=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ2ZXJpZmllciI6IjExYTkzNGQyMjUwZjk4ZGE5YTJmMGNjOWI1MDkzYmFhNTdmYmY2OWUyYTAwNGZjMDUzYjNhMTAxYWViMTQwYjVhYmE3MjkyNDExY2FmZDBhMDQzMDI3NGVhODEzODgyZmU2Njg2YzA3ZTI0N2EzMzBhMWRlMTAwMTVjYjhmMzgwIiwiY2FudmFzX2RvbWFpbiI6ImVkdWNhdGV0ZXN0Lmluc3RydWN0dXJlLmNvbSIsImNvbnRleHRfdHlwZSI6IkNvdXJzZSIsImNvbnRleHRfaWQiOjk2OTUwMDAwMDAwMDAwODE2LCJjYW52YXNfbG9jYWxlIjoiZW4iLCJleHAiOjE2NjkzMjY3ODl9.bXpmh4pkSC2aBNvfTPngQaSfbvP2ZmVFcWEL81wJ8yY&nonce=78e7eaf5-cd1d-40ae-aa7e-0c44c5e5be2e&prompt=none&redirect_uri=https%3A%2F%2Fid.execute-api.us-east-1.amazonaws.com%2Fprod%2Flaunch&response_mode=form_post&response_type=id_token&scope=openid&state=${state}`,
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'cross-site',
      'upgrade-insecure-requests': '1',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:106.0) Gecko/20100101 Firefox/106.0',
      Via: '2.0 9546eb427ef2137803aed00cad4fc426.cloudfront.net (CloudFront)',
      'X-Amz-Cf-Id': '-IyrkFed9heG5AvMHBFV_HbB9a_UDnOLHl7Q_HvUpk2EPNDDB54ntw==',
      'X-Amzn-Trace-Id': 'Root=1-637fe69d-783bbc18643bf6eb77cdd374',
      'X-Forwarded-For': '52.94.133.129, 15.158.50.42',
      'X-Forwarded-Port': '443',
      'X-Forwarded-Proto': 'https',
    },
    multiValueHeaders: {
      Accept: [
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      ],
      'Accept-Encoding': ['gzip, deflate, br'],
      'Accept-Language': ['en-US,en;q=0.5'],
      'CloudFront-Forwarded-Proto': ['https'],
      'CloudFront-Is-Desktop-Viewer': ['true'],
      'CloudFront-Is-Mobile-Viewer': ['false'],
      'CloudFront-Is-SmartTV-Viewer': ['false'],
      'CloudFront-Is-Tablet-Viewer': ['false'],
      'CloudFront-Viewer-ASN': ['16509'],
      'CloudFront-Viewer-Country': ['US'],
      'content-type': ['application/x-www-form-urlencoded'],
      Cookie: [`state=${state}`],
      Host: ['id.execute-api.us-east-1.amazonaws.com'],
      origin: [ISS],
      Referer: [
        `${ISS}/api/lti/authorize?client_id=${CLIENT_ID}&login_hint=b0be1d1d0a2f64749cc50020c0493674dcf6b49c&lti_message_hint=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ2ZXJpZmllciI6IjExYTkzNGQyMjUwZjk4ZGE5YTJmMGNjOWI1MDkzYmFhNTdmYmY2OWUyYTAwNGZjMDUzYjNhMTAxYWViMTQwYjVhYmE3MjkyNDExY2FmZDBhMDQzMDI3NGVhODEzODgyZmU2Njg2YzA3ZTI0N2EzMzBhMWRlMTAwMTVjYjhmMzgwIiwiY2FudmFzX2RvbWFpbiI6ImVkdWNhdGV0ZXN0Lmluc3RydWN0dXJlLmNvbSIsImNvbnRleHRfdHlwZSI6IkNvdXJzZSIsImNvbnRleHRfaWQiOjk2OTUwMDAwMDAwMDAwODE2LCJjYW52YXNfbG9jYWxlIjoiZW4iLCJleHAiOjE2NjkzMjY3ODl9.bXpmh4pkSC2aBNvfTPngQaSfbvP2ZmVFcWEL81wJ8yY&nonce=78e7eaf5-cd1d-40ae-aa7e-0c44c5e5be2e&prompt=none&redirect_uri=https%3A%2F%2Fid.execute-api.us-east-1.amazonaws.com%2Fprod%2Flaunch&response_mode=form_post&response_type=id_token&scope=openid&state=${state}`,
      ],
      'sec-fetch-dest': ['document'],
      'sec-fetch-mode': ['navigate'],
      'sec-fetch-site': ['cross-site'],
      'upgrade-insecure-requests': ['1'],
      'User-Agent': [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:106.0) Gecko/20100101 Firefox/106.0',
      ],
      Via: ['2.0 9546eb427ef2137803aed00cad4fc426.cloudfront.net (CloudFront)'],
      'X-Amz-Cf-Id': [
        '-IyrkFed9heG5AvMHBFV_HbB9a_UDnOLHl7Q_HvUpk2EPNDDB54ntw==',
      ],
      'X-Amzn-Trace-Id': ['Root=1-637fe69d-783bbc18643bf6eb77cdd374'],
      'X-Forwarded-For': ['52.94.133.129, 15.158.50.42'],
      'X-Forwarded-Port': ['443'],
      'X-Forwarded-Proto': ['https'],
    },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: requestContext('/launch'),
    body: `utf8=%E2%9C%93&authenticity_token=QWcphzTL8cOxDyql5aaVRLTy8plYwKH4Q2Q5Cblab3YRUhuoQqiUlOs8c%2BKpwdkG%2BpeZzmDv1p5yHHx48Q8qNw%3D%3D&id_token=${idToken}&state=${state}`,
    isBase64Encoded: false,
  };
  return request;
};

export const authProxyRequestEvent = (
  state: string,
  nonce: string
): APIGatewayProxyEvent => {
  const request: APIGatewayProxyEvent = {
    resource: '/authorizerProxy',
    path: '/authorizerProxy',
    httpMethod: 'GET',
    headers: {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.5',
      'CloudFront-Forwarded-Proto': 'https',
      'CloudFront-Is-Desktop-Viewer': 'true',
      'CloudFront-Is-Mobile-Viewer': 'false',
      'CloudFront-Is-SmartTV-Viewer': 'false',
      'CloudFront-Is-Tablet-Viewer': 'false',
      'CloudFront-Viewer-ASN': '16509',
      'CloudFront-Viewer-Country': 'US',
      Cookie: `state=${state};nonce=${nonce}`,
      Host: 'id.execute-api.us-east-1.amazonaws.com',
      Referer: `${ISS}/api/lti/authorize?client_id=${CLIENT_ID}&login_hint=b0be1d1d0a2f64749cc50020c0493674dcf6b49c&lti_message_hint=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ2ZXJpZmllciI6ImY4NGM2MDk0YzgwMGRiNDk0NjNiODI5YzIxMjZmNTQyZjZkZGFhMDM1MWQxOTI5NDhhOGVmYTg4NzgyZGE5M2FlZDUyZWZiNWE5YmFjMzMzYzBkNzU1M2YyNWFiZmZmODZlYzc2ZDhhZTU4MTBhMGY5NGQ2NjllZDc5OTZkM2U3IiwiY2FudmFzX2RvbWFpbiI6ImVkdWNhdGV0ZXN0Lmluc3RydWN0dXJlLmNvbSIsImNvbnRleHRfdHlwZSI6IkNvdXJzZSIsImNvbnRleHRfaWQiOjk2OTUwMDAwMDAwMDAwODE2LCJjYW52YXNfbG9jYWxlIjoiZW4iLCJleHAiOjE2NjkyNDU4NTB9.ayR3aXTtwIcred2z6nrf1V2o85COcEC523s49oZRjlU&nonce=${nonce}&prompt=none&redirect_uri=https%3A%2F%2Fid.execute-api.us-east-1.amazonaws.com%2Fprod%2Flaunch&response_mode=form_post&response_type=id_token&scope=openid&state=${state}`,
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'cross-site',
      'upgrade-insecure-requests': '1',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:106.0) Gecko/20100101 Firefox/106.0',
      Via: '2.0 d48a409d6a3222e2cc9a060d30206d3c.cloudfront.net (CloudFront)',
      'X-Amz-Cf-Id': '3BzuqKKruIHHaZXLIrZTadln6PX-SEpFiIQ06LPPkKROk3Le9ONN_A==',
      'X-Amzn-Trace-Id': 'Root=1-637eaa75-3e64c4443ffaeb5c642c7b87',
      'X-Forwarded-For': '52.94.133.128, 15.158.50.21',
      'X-Forwarded-Port': '443',
      'X-Forwarded-Proto': 'https',
    },
    multiValueHeaders: {
      Accept: [
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      ],
      'Accept-Encoding': ['gzip, deflate, br'],
      'Accept-Language': ['en-US,en;q=0.5'],
      'CloudFront-Forwarded-Proto': ['https'],
      'CloudFront-Is-Desktop-Viewer': ['true'],
      'CloudFront-Is-Mobile-Viewer': ['false'],
      'CloudFront-Is-SmartTV-Viewer': ['false'],
      'CloudFront-Is-Tablet-Viewer': ['false'],
      'CloudFront-Viewer-ASN': ['16509'],
      'CloudFront-Viewer-Country': ['US'],
      Cookie: [`state=${state}`, `nonce=${nonce}`],
      Host: ['id.execute-api.us-east-1.amazonaws.com'],
      Referer: [
        `${ISS}/api/lti/authorize?client_id=${CLIENT_ID}&login_hint=b0be1d1d0a2f64749cc50020c0493674dcf6b49c&lti_message_hint=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ2ZXJpZmllciI6ImY4NGM2MDk0YzgwMGRiNDk0NjNiODI5YzIxMjZmNTQyZjZkZGFhMDM1MWQxOTI5NDhhOGVmYTg4NzgyZGE5M2FlZDUyZWZiNWE5YmFjMzMzYzBkNzU1M2YyNWFiZmZmODZlYzc2ZDhhZTU4MTBhMGY5NGQ2NjllZDc5OTZkM2U3IiwiY2FudmFzX2RvbWFpbiI6ImVkdWNhdGV0ZXN0Lmluc3RydWN0dXJlLmNvbSIsImNvbnRleHRfdHlwZSI6IkNvdXJzZSIsImNvbnRleHRfaWQiOjk2OTUwMDAwMDAwMDAwODE2LCJjYW52YXNfbG9jYWxlIjoiZW4iLCJleHAiOjE2NjkyNDU4NTB9.ayR3aXTtwIcred2z6nrf1V2o85COcEC523s49oZRjlU&nonce=${nonce}&prompt=none&redirect_uri=https%3A%2F%2Fid.execute-api.us-east-1.amazonaws.com%2Fprod%2Flaunch&response_mode=form_post&response_type=id_token&scope=openid&state=${state}`,
      ],
      'sec-fetch-dest': ['document'],
      'sec-fetch-mode': ['navigate'],
      'sec-fetch-site': ['cross-site'],
      'upgrade-insecure-requests': ['1'],
      'User-Agent': [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:106.0) Gecko/20100101 Firefox/106.0',
      ],
      Via: ['2.0 d48a409d6a3222e2cc9a060d30206d3c.cloudfront.net (CloudFront)'],
      'X-Amz-Cf-Id': [
        '3BzuqKKruIHHaZXLIrZTadln6PX-SEpFiIQ06LPPkKROk3Le9ONN_A==',
      ],
      'X-Amzn-Trace-Id': ['Root=1-637eaa75-3e64c4443ffaeb5c642c7b87'],
      'X-Forwarded-For': ['52.94.133.128, 15.158.50.21'],
      'X-Forwarded-Port': ['443'],
      'X-Forwarded-Proto': ['https'],
    },
    queryStringParameters: {
      client_id: CLIENT_ID,
      redirect_uri: `${TOOL_OIDC_DOMAIN}/oauth2/idpresponse`,
      response_type: 'code',
      scope: 'openid',
      state:
        'H4sIAAAAAAAAAD1S23abMBD8Fz1bGEmwMn5LfGmc2I0vddKcnh4fIcTF5hYjY5yc_ns3cdoHscPM7jALvBNFhuTUUKMaS9nu2M4uYZ3eM9IjISqT6KSVNfPFBgmNRJ3FjatemcnhpOqDaoqcu9x3U9Qj1FNr62bY72tta1pX2rGmsY5pTWkbxx5VVmZl4qhz4yj-5uiq6OOgwUFdRQZhjPBxNh4hTMjwF6lqU2YR-d0jKSqUx1IA4zFoYMCxMsnBcF8IjyGWUnxhDf5VgwCPBAExGOkhi9drj_SxO_rsE8hFgl154QlXgJBCCI7VxRoIZL-cOWjpgy9ddA8-3CTgHcdcwcczsIt7gI4uaPTk_-bQ3VyPgE-eo-sAAPdAGTfBZDzyfV_g6gfctQ0O1Kz5ZflzksdxOtsWi_1p143pwhvEW9O-bOpNnMxvXJXHh_M933b1TbW6W-aUBbe7Sd2yzG43YxruzdNyo26P08X8Mj_cJTdlR0ejNnxrLpRupiulJpdd92xXozWPvj-fu-OjP227b-pp_5y9tmH-uE73q5pHy4cfy7DU4rjb287G69eBZg96PHvBxDkmTlQZYRiaqKJQjjrZ1Pn_ZzmqUG9VqaukzGz18eFxqCBDBhBwD9eWPVKTYazyxvTIEd0iie_KDyTFKqlndEAHRgENQEU6CIG7zCV__gIgpAl5wQIAAA.H4sIAAAAAAAAAGt_Ej_lh-o-R-HUfUHubI6T7PJZ35697Ch0ze5wu7G5Yi4A2iaGaSAAAAA.4',
    },
    multiValueQueryStringParameters: {
      client_id: [CLIENT_ID],
      redirect_uri: [`/oauth2/idpresponse`],
      response_type: ['code'],
      scope: ['openid'],
      state: [
        'H4sIAAAAAAAAAD1S23abMBD8Fz1bGEmwMn5LfGmc2I0vddKcnh4fIcTF5hYjY5yc_ns3cdoHscPM7jALvBNFhuTUUKMaS9nu2M4uYZ3eM9IjISqT6KSVNfPFBgmNRJ3FjatemcnhpOqDaoqcu9x3U9Qj1FNr62bY72tta1pX2rGmsY5pTWkbxx5VVmZl4qhz4yj-5uiq6OOgwUFdRQZhjPBxNh4hTMjwF6lqU2YR-d0jKSqUx1IA4zFoYMCxMsnBcF8IjyGWUnxhDf5VgwCPBAExGOkhi9drj_SxO_rsE8hFgl154QlXgJBCCI7VxRoIZL-cOWjpgy9ddA8-3CTgHcdcwcczsIt7gI4uaPTk_-bQ3VyPgE-eo-sAAPdAGTfBZDzyfV_g6gfctQ0O1Kz5ZflzksdxOtsWi_1p143pwhvEW9O-bOpNnMxvXJXHh_M933b1TbW6W-aUBbe7Sd2yzG43YxruzdNyo26P08X8Mj_cJTdlR0ejNnxrLpRupiulJpdd92xXozWPvj-fu-OjP227b-pp_5y9tmH-uE73q5pHy4cfy7DU4rjb287G69eBZg96PHvBxDkmTlQZYRiaqKJQjjrZ1Pn_ZzmqUG9VqaukzGz18eFxqCBDBhBwD9eWPVKTYazyxvTIEd0iie_KDyTFKqlndEAHRgENQEU6CIG7zCV__gIgpAl5wQIAAA.H4sIAAAAAAAAAGt_Ej_lh-o-R-HUfUHubI6T7PJZ35697Ch0ze5wu7G5Yi4A2iaGaSAAAAA.4',
      ],
    },
    pathParameters: null,
    stageVariables: null,
    requestContext: requestContext('/authorizerProxy'),
    body: null,
    isBase64Encoded: false,
  };
  return request;
};

export const tokenProxyRequestEvent = (code: string): APIGatewayProxyEvent => {
  const request = {
    resource: '/tokenProxy',
    path: '/tokenProxy',
    httpMethod: 'POST',
    headers: {
      'Accept-Encoding': 'gzip,deflate',
      'CloudFront-Forwarded-Proto': 'https',
      'CloudFront-Is-Desktop-Viewer': 'true',
      'CloudFront-Is-Mobile-Viewer': 'false',
      'CloudFront-Is-SmartTV-Viewer': 'false',
      'CloudFront-Is-Tablet-Viewer': 'false',
      'CloudFront-Viewer-ASN': '14618',
      'CloudFront-Viewer-Country': 'US',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Host: 'id.execute-api.us-east-1.amazonaws.com',
      'User-Agent': 'Amazon/Cognito',
      Via: '1.1 14e4300e15854895259e6944bb121ec8.cloudfront.net (CloudFront)',
      'X-Amz-Cf-Id': 'OwKVkZVGYtSMszsBmP4etVm8vZmEmXi7Q49s5EjP1IRZHsaQZ4ccew==',
      'x-amz-cognito-request-id': 'd1d95b7c-eaa8-4232-a5d4-996b0908d510',
      'X-Amzn-Trace-Id': 'Root=1-637fe6a1-266120b455550e1e2c598c3f',
      'X-Forwarded-For': '50.17.71.13, 15.158.50.17',
      'X-Forwarded-Port': '443',
      'X-Forwarded-Proto': 'https',
    },
    multiValueHeaders: {
      'Accept-Encoding': ['gzip,deflate'],
      'CloudFront-Forwarded-Proto': ['https'],
      'CloudFront-Is-Desktop-Viewer': ['true'],
      'CloudFront-Is-Mobile-Viewer': ['false'],
      'CloudFront-Is-SmartTV-Viewer': ['false'],
      'CloudFront-Is-Tablet-Viewer': ['false'],
      'CloudFront-Viewer-ASN': ['14618'],
      'CloudFront-Viewer-Country': ['US'],
      'Content-Type': ['application/x-www-form-urlencoded; charset=UTF-8'],
      Host: ['id.execute-api.us-east-1.amazonaws.com'],
      'User-Agent': ['Amazon/Cognito'],
      Via: ['1.1 14e4300e15854895259e6944bb121ec8.cloudfront.net (CloudFront)'],
      'X-Amz-Cf-Id': [
        'OwKVkZVGYtSMszsBmP4etVm8vZmEmXi7Q49s5EjP1IRZHsaQZ4ccew==',
      ],
      'x-amz-cognito-request-id': ['d1d95b7c-eaa8-4232-a5d4-996b0908d510'],
      'X-Amzn-Trace-Id': ['Root=1-637fe6a1-266120b455550e1e2c598c3f'],
      'X-Forwarded-For': ['50.17.71.13, 15.158.50.17'],
      'X-Forwarded-Port': ['443'],
      'X-Forwarded-Proto': ['https'],
    },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: requestContext('/tokenProxy'),
    body: `grant_type=authorization_code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
      TOOL_OIDC_DOMAIN
    )}%2Foauth2%2Fidpresponse&client_secret=some_client_secret&code=${code}`,
    isBase64Encoded: false,
  };
  return request;
};

// BlackBoard request objects
export const bbLoginRequestEvent = (): APIGatewayProxyEvent => {
  const request: APIGatewayProxyEvent = {
    resource: '/login',
    path: '/login',
    httpMethod: 'GET',
    headers: {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.5',
      'CloudFront-Forwarded-Proto': 'https',
      'CloudFront-Is-Desktop-Viewer': 'true',
      'CloudFront-Is-Mobile-Viewer': 'false',
      'CloudFront-Is-SmartTV-Viewer': 'false',
      'CloudFront-Is-Tablet-Viewer': 'false',
      'CloudFront-Viewer-ASN': '16509',
      'CloudFront-Viewer-Country': 'US',
      Cookie: 'state=34af60b3-08d6-4167-86dd-83645624902d',
      Host: 'id.execute-api.us-east-1.amazonaws.com',
      Referer: 'https://learn170.anthology.workshops.aws.dev/',
      'sec-fetch-dest': 'iframe',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'cross-site',
      'upgrade-insecure-requests': '1',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:107.0) Gecko/20100101 Firefox/107.0',
      Via: '2.0 9d2dee9b44718f249b789987d2cbe62c.cloudfront.net (CloudFront)',
      'X-Amz-Cf-Id': 'QLqbQrz8ETNkITm8mTqIdTB9vkTcIIhSvrhGFHGUIFNP3gVnCVlx7g==',
      'X-Amzn-Trace-Id': 'Root=1-639cdbd1-0fc9f8db41a3d1240b721987',
      'X-Forwarded-For': '72.21.196.64, 15.158.50.177',
      'X-Forwarded-Port': '443',
      'X-Forwarded-Proto': 'https',
    },
    multiValueHeaders: {
      Accept: [
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      ],
      'Accept-Encoding': ['gzip, deflate, br'],
      'Accept-Language': ['en-US,en;q=0.5'],
      'CloudFront-Forwarded-Proto': ['https'],
      'CloudFront-Is-Desktop-Viewer': ['true'],
      'CloudFront-Is-Mobile-Viewer': ['false'],
      'CloudFront-Is-SmartTV-Viewer': ['false'],
      'CloudFront-Is-Tablet-Viewer': ['false'],
      'CloudFront-Viewer-ASN': ['16509'],
      'CloudFront-Viewer-Country': ['US'],
      Cookie: ['state=34af60b3-08d6-4167-86dd-83645624902d'],
      Host: ['id.execute-api.us-east-1.amazonaws.com'],
      Referer: ['https://learn170.anthology.workshops.aws.dev/'],
      'sec-fetch-dest': ['iframe'],
      'sec-fetch-mode': ['navigate'],
      'sec-fetch-site': ['cross-site'],
      'upgrade-insecure-requests': ['1'],
      'User-Agent': [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:107.0) Gecko/20100101 Firefox/107.0',
      ],
      Via: ['2.0 9d2dee9b44718f249b789987d2cbe62c.cloudfront.net (CloudFront)'],
      'X-Amz-Cf-Id': [
        'QLqbQrz8ETNkITm8mTqIdTB9vkTcIIhSvrhGFHGUIFNP3gVnCVlx7g==',
      ],
      'X-Amzn-Trace-Id': ['Root=1-639cdbd1-0fc9f8db41a3d1240b721987'],
      'X-Forwarded-For': ['72.21.196.64, 15.158.50.177'],
      'X-Forwarded-Port': ['443'],
      'X-Forwarded-Proto': ['https'],
    },
    queryStringParameters: {
      client_id: CLIENT_ID,
      iss: ISS,
      login_hint:
        'https%3A%2F%2Flearn170.anthology.workshops.aws.dev%2Fwebapps%2Fblackboard%2Fexecute%2Fblti%2FlaunchPlacement%3Fcmd%3Dauthenticate%26course_id%3D_3_1,41f9919667414595981acd8f89d20f4f,911a1c52c1754cdaa25caca142242bca',
      lti_deployment_id: DEPLOYMENT_ID,
      lti_message_hint:
        'eyJyZXNvdXJjZUxpbmtJZCI6Il8yOV8xIiwicGxhY2VtZW50SWQiOiJfOV8xIiwicG9zaXRpb24iOi0xLCJ0YXJnZXRMaW5rVXJsIjoiaHR0cHM6Ly9ha2F6YS50ZXN0LmV2ZW50cy50cmFpbmluZy5hd3MuYTJ6LmNvbS9zYS9sYWIvYXJuJTNBYXdzJTNBbGVhcm5pbmdjb250ZW50JTNBdXMtZWFzdC0xJTNBNDA2NzMyNjAzOTE0JTNBYmx1ZXByaW50dmVyc2lvbiUyRnNwbC04OC9lbi1VUyIsImlubGluZU1vZGUiOmZhbHNlLCJjb3Vyc2VJZCI6Il8zXzEiLCJjb250ZW50SWQiOiJfMjlfMSIsIm9wZW5JbkxpZ2h0Qm94IjpmYWxzZSwiZnJvbVVsdHJhIjpmYWxzZSwicGFyZW50Q29udGVudElkIjoiIiwiY3VzdG9tUGFyYW1zIjp7fSwidGFyZ2V0T3ZlcnJpZGUiOm51bGwsImZyb21HcmFkZUNlbnRlciI6ZmFsc2UsIm9wZW5OZXdXaW5kb3ciOmZhbHNlLCJkZWVwTGlua0xhdW5jaCI6ZmFsc2V9',
      lti_storage_target: 'lti_storage_frame',
      target_link_uri:
        'https://akaza.test.events.training.aws.a2z.com/sa/lab/arn%3Aaws%3Alearningcontent%3Aus-east-1%3A406732603914%3Ablueprintversion%2Fspl-88/en-US',
    },
    multiValueQueryStringParameters: {
      client_id: [CLIENT_ID],
      iss: [ISS],
      login_hint: [
        'https%3A%2F%2Flearn170.anthology.workshops.aws.dev%2Fwebapps%2Fblackboard%2Fexecute%2Fblti%2FlaunchPlacement%3Fcmd%3Dauthenticate%26course_id%3D_3_1,41f9919667414595981acd8f89d20f4f,911a1c52c1754cdaa25caca142242bca',
      ],
      lti_deployment_id: [DEPLOYMENT_ID],
      lti_message_hint: [
        'eyJyZXNvdXJjZUxpbmtJZCI6Il8yOV8xIiwicGxhY2VtZW50SWQiOiJfOV8xIiwicG9zaXRpb24iOi0xLCJ0YXJnZXRMaW5rVXJsIjoiaHR0cHM6Ly9ha2F6YS50ZXN0LmV2ZW50cy50cmFpbmluZy5hd3MuYTJ6LmNvbS9zYS9sYWIvYXJuJTNBYXdzJTNBbGVhcm5pbmdjb250ZW50JTNBdXMtZWFzdC0xJTNBNDA2NzMyNjAzOTE0JTNBYmx1ZXByaW50dmVyc2lvbiUyRnNwbC04OC9lbi1VUyIsImlubGluZU1vZGUiOmZhbHNlLCJjb3Vyc2VJZCI6Il8zXzEiLCJjb250ZW50SWQiOiJfMjlfMSIsIm9wZW5JbkxpZ2h0Qm94IjpmYWxzZSwiZnJvbVVsdHJhIjpmYWxzZSwicGFyZW50Q29udGVudElkIjoiIiwiY3VzdG9tUGFyYW1zIjp7fSwidGFyZ2V0T3ZlcnJpZGUiOm51bGwsImZyb21HcmFkZUNlbnRlciI6ZmFsc2UsIm9wZW5OZXdXaW5kb3ciOmZhbHNlLCJkZWVwTGlua0xhdW5jaCI6ZmFsc2V9',
      ],
      lti_storage_target: ['lti_storage_frame'],
      target_link_uri: [
        'https://akaza.test.events.training.aws.a2z.com/sa/lab/arn%3Aaws%3Alearningcontent%3Aus-east-1%3A406732603914%3Ablueprintversion%2Fspl-88/en-US',
      ],
    },
    pathParameters: null,
    stageVariables: null,
    requestContext: requestContext('/login'),
    body: null,
    isBase64Encoded: false,
  };
  return request;
};

export const bbLaunchProxyRequestEvent = (
  idToken: string,
  state: string
): APIGatewayProxyEvent => {
  const request: APIGatewayProxyEvent = {
    resource: '/launch',
    path: '/launch',
    httpMethod: 'POST',
    headers: {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.5',
      'CloudFront-Forwarded-Proto': 'https',
      'CloudFront-Is-Desktop-Viewer': 'true',
      'CloudFront-Is-Mobile-Viewer': 'false',
      'CloudFront-Is-SmartTV-Viewer': 'false',
      'CloudFront-Is-Tablet-Viewer': 'false',
      'CloudFront-Viewer-ASN': '16509',
      'CloudFront-Viewer-Country': 'US',
      'content-type': 'application/x-www-form-urlencoded',
      Cookie: `state=${state}`,
      Host: 'id.execute-api.us-east-1.amazonaws.com',
      origin: ISS,
      Referer: ISS,
      'sec-fetch-dest': 'iframe',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'cross-site',
      'upgrade-insecure-requests': '1',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:107.0) Gecko/20100101 Firefox/107.0',
      Via: '2.0 06c1d28e93bdae8f6401a12c10b2f570.cloudfront.net (CloudFront)',
      'X-Amz-Cf-Id': 'ZsCCZ2XSqp0wnMou-D7Go7RuaLXz0mttkL1RkYvvwM0bIwXRV0OSdQ==',
      'X-Amzn-Trace-Id': 'Root=1-639e1b0b-676afd32224c5b0c27b37532',
      'X-Forwarded-For': '72.21.196.65, 15.158.50.180',
      'X-Forwarded-Port': '443',
      'X-Forwarded-Proto': 'https',
    },
    multiValueHeaders: {
      Accept: [
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      ],
      'Accept-Encoding': ['gzip, deflate, br'],
      'Accept-Language': ['en-US,en;q=0.5'],
      'CloudFront-Forwarded-Proto': ['https'],
      'CloudFront-Is-Desktop-Viewer': ['true'],
      'CloudFront-Is-Mobile-Viewer': ['false'],
      'CloudFront-Is-SmartTV-Viewer': ['false'],
      'CloudFront-Is-Tablet-Viewer': ['false'],
      'CloudFront-Viewer-ASN': ['16509'],
      'CloudFront-Viewer-Country': ['US'],
      'content-type': ['application/x-www-form-urlencoded'],
      Cookie: [`state=${state}`],
      Host: ['id.execute-api.us-east-1.amazonaws.com'],
      origin: [ISS],
      Referer: [ISS],
      'sec-fetch-dest': ['iframe'],
      'sec-fetch-mode': ['navigate'],
      'sec-fetch-site': ['cross-site'],
      'upgrade-insecure-requests': ['1'],
      'User-Agent': [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:107.0) Gecko/20100101 Firefox/107.0',
      ],
      Via: ['2.0 06c1d28e93bdae8f6401a12c10b2f570.cloudfront.net (CloudFront)'],
      'X-Amz-Cf-Id': [
        'ZsCCZ2XSqp0wnMou-D7Go7RuaLXz0mttkL1RkYvvwM0bIwXRV0OSdQ==',
      ],
      'X-Amzn-Trace-Id': ['Root=1-639e1b0b-676afd32224c5b0c27b37532'],
      'X-Forwarded-For': ['72.21.196.65, 15.158.50.180'],
      'X-Forwarded-Port': ['443'],
      'X-Forwarded-Proto': ['https'],
    },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: requestContext('/launch'),
    body: `id_token=${idToken}&state=${state}`,
    isBase64Encoded: false,
  };
  return request;
};

// Score submission request object from LXP
export const scoreSubmissionRequestEvent = (
  reqJSON: string
): APIGatewayProxyEvent => {
  const request: APIGatewayProxyEvent = {
    resource: '/scoreSubmission',
    path: '/scoreSubmission',
    httpMethod: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.5',
      'CloudFront-Forwarded-Proto': 'https',
      'CloudFront-Is-Desktop-Viewer': 'true',
      'CloudFront-Is-Mobile-Viewer': 'false',
      'CloudFront-Is-SmartTV-Viewer': 'false',
      'CloudFront-Is-Tablet-Viewer': 'false',
      'CloudFront-Viewer-ASN': '16509',
      'CloudFront-Viewer-Country': 'US',
      'content-type': 'application/json;charset=utf-8',
      Host: 'id.execute-api.us-east-1.amazonaws.com',
      origin: 'https://akaza.test.events.training.aws.a2z.com',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'cross-site',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:108.0) Gecko/20100101 Firefox/108.0',
      Via: '2.0 68a3b1d5c75429221abc685a453afb60.cloudfront.net (CloudFront)',
      'X-Amz-Cf-Id': 'FIQ8LBpy_3djv-Pyvu-PviOAQeC1D0FGinbwws8KheKMtmi8OYVqLw==',
      'X-Amzn-Trace-Id': 'Root=1-63d816c7-544adfae4a0fa3482d39c4f8',
      'X-Forwarded-For': '52.94.133.136, 15.158.50.140',
      'X-Forwarded-Port': '443',
      'X-Forwarded-Proto': 'https',
    },
    multiValueHeaders: {
      Accept: ['application/json, text/plain, */*'],
      'Accept-Encoding': ['gzip, deflate, br'],
      'Accept-Language': ['en-US,en;q=0.5'],
      'CloudFront-Forwarded-Proto': ['https'],
      'CloudFront-Is-Desktop-Viewer': ['true'],
      'CloudFront-Is-Mobile-Viewer': ['false'],
      'CloudFront-Is-SmartTV-Viewer': ['false'],
      'CloudFront-Is-Tablet-Viewer': ['false'],
      'CloudFront-Viewer-ASN': ['16509'],
      'CloudFront-Viewer-Country': ['US'],
      'content-type': ['application/json;charset=utf-8'],
      Host: ['id.execute-api.us-east-1.amazonaws.com'],
      origin: ['https://akaza.test.events.training.aws.a2z.com'],
      'sec-fetch-dest': ['empty'],
      'sec-fetch-mode': ['cors'],
      'sec-fetch-site': ['cross-site'],
      'User-Agent': [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:108.0) Gecko/20100101 Firefox/108.0',
      ],
      Via: ['2.0 68a3b1d5c75429221abc685a453afb60.cloudfront.net (CloudFront)'],
      'X-Amz-Cf-Id': [
        'FIQ8LBpy_3djv-Pyvu-PviOAQeC1D0FGinbwws8KheKMtmi8OYVqLw==',
      ],
      'X-Amzn-Trace-Id': ['Root=1-63d816c7-544adfae4a0fa3482d39c4f8'],
      'X-Forwarded-For': ['52.94.133.136, 15.158.50.140'],
      'X-Forwarded-Port': ['443'],
      'X-Forwarded-Proto': ['https'],
    },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: requestContext('/scoreSubmission'),
    body: reqJSON,
    isBase64Encoded: false,
  };
  return request;
};

// Roster retrieval request object from LXP
export const rosterRetrievalRequestEvent = (
  idToken: string,
  reqJSON: string
): APIGatewayProxyEvent => {
  const request: APIGatewayProxyEvent = {
    resource: '/rosterRetrieval',
    path: '/rosterRetrieval',
    httpMethod: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.5',
      'CloudFront-Forwarded-Proto': 'https',
      'CloudFront-Is-Desktop-Viewer': 'true',
      'CloudFront-Is-Mobile-Viewer': 'false',
      'CloudFront-Is-SmartTV-Viewer': 'false',
      'CloudFront-Is-Tablet-Viewer': 'false',
      'CloudFront-Viewer-ASN': '16509',
      'CloudFront-Viewer-Country': 'US',
      'content-type': 'application/json;charset=utf-8',
      Host: 'cofwx6v92e.execute-api.us-east-1.amazonaws.com',
      origin: 'https://akaza.test.events.training.aws.a2z.com',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'cross-site',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:108.0) Gecko/20100101 Firefox/108.0',
      Via: '2.0 68a3b1d5c75429221abc685a453afb60.cloudfront.net (CloudFront)',
      'X-Amz-Cf-Id': 'FIQ8LBpy_3djv-Pyvu-PviOAQeC1D0FGinbwws8KheKMtmi8OYVqLw==',
      'X-Amzn-Trace-Id': 'Root=1-63d816c7-544adfae4a0fa3482d39c4f8',
      'X-Forwarded-For': '52.94.133.136, 15.158.50.140',
      'X-Forwarded-Port': '443',
      'X-Forwarded-Proto': 'https',
      Authorization: `Bearer ${idToken}`,
    },
    multiValueHeaders: {
      Accept: ['application/json, text/plain, */*'],
      'Accept-Encoding': ['gzip, deflate, br'],
      'Accept-Language': ['en-US,en;q=0.5'],
      'CloudFront-Forwarded-Proto': ['https'],
      'CloudFront-Is-Desktop-Viewer': ['true'],
      'CloudFront-Is-Mobile-Viewer': ['false'],
      'CloudFront-Is-SmartTV-Viewer': ['false'],
      'CloudFront-Is-Tablet-Viewer': ['false'],
      'CloudFront-Viewer-ASN': ['16509'],
      'CloudFront-Viewer-Country': ['US'],
      'content-type': ['application/json;charset=utf-8'],
      Host: ['cofwx6v92e.execute-api.us-east-1.amazonaws.com'],
      origin: ['https://akaza.test.events.training.aws.a2z.com'],
      'sec-fetch-dest': ['empty'],
      'sec-fetch-mode': ['cors'],
      'sec-fetch-site': ['cross-site'],
      'User-Agent': [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:108.0) Gecko/20100101 Firefox/108.0',
      ],
      Via: ['2.0 68a3b1d5c75429221abc685a453afb60.cloudfront.net (CloudFront)'],
      'X-Amz-Cf-Id': [
        'FIQ8LBpy_3djv-Pyvu-PviOAQeC1D0FGinbwws8KheKMtmi8OYVqLw==',
      ],
      'X-Amzn-Trace-Id': ['Root=1-63d816c7-544adfae4a0fa3482d39c4f8'],
      'X-Forwarded-For': ['52.94.133.136, 15.158.50.140'],
      'X-Forwarded-Port': ['443'],
      'X-Forwarded-Proto': ['https'],
    },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: reqJSON,
    pathParameters: null,
    stageVariables: null,
    requestContext: requestContext('/rosterRetrieval'),
    isBase64Encoded: false,
  };
  return request;
};
