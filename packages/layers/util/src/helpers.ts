import { Sha256 } from '@aws-crypto/sha256-js';
import { MetricUnits } from '@aws-lambda-powertools/metrics';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyEventHeaders,
  APIGatewayProxyResult,
} from 'aws-lambda';
import axios, { AxiosError } from 'axios';
import * as jose from 'jose';
import * as forge from 'node-forge';
import * as nodeUtil from 'util';
import { v4 as uuidv4 } from 'uuid';
import { Aws } from './aws';
import { LtiCustomError } from './customErrors';
import { LTIJwtPayload } from './jwt';
import { LmsParams, ScoreSubmissionLmsParams } from './lmsParams';
import { DynamoDBPlatformConfig, PlatformConfigRecord } from './platformConfig';
import { Powertools } from './powertools';
const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN } =
  process.env;

/**
 * https://www.imsglobal.org/spec/security/v1p0/#using-json-web-tokens-with-oauth-2-0-client-credentials-grant
 * @param platform
 * @param kid
 * @param kmsKeyId
 * @param powertools
 * @returns access_token as string value
 */
export async function requestBearerClientCredential(
  platform: PlatformConfigRecord,
  kid: string,
  kmsKeyId: string
): Promise<string> {
  try {
    const jwt = new jose.SignJWT({})
      .setIssuedAt()
      .setExpirationTime('5m')
      .setJti(forge.util.bytesToHex(uuidv4()))
      .setIssuer(platform.clientId)
      .setAudience(platform.accessTokenUrl)
      .setSubject(platform.clientId)
      .setProtectedHeader({
        typ: 'JWT',
        alg: 'RS256',
        kid: kid,
      });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const payload = JSON.stringify(jwt._payload);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const header = JSON.stringify(jwt._protectedHeader);
    const headerJson = Buffer.from(header).toString('base64url');
    const payloadJson = Buffer.from(payload).toString('base64url');
    const clientAssertion = `${headerJson}.${payloadJson}`;
    const aws = Aws.getInstance();
    const encoded = new nodeUtil.TextEncoder().encode(clientAssertion);
    const signedClientAssertion = await aws.sign(kmsKeyId, encoded);
    const scopeParams = [
      'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/score',
    ];
    // const valid=await aws.verify(kmsKeyId,encoded,signedClientAssertion!)
    // assert(valid===true)
    const b64urlSignedClientAssertion = Buffer.from(
      signedClientAssertion!
    ).toString('base64url');
    const token = `${headerJson}.${payloadJson}.${b64urlSignedClientAssertion}`;
    const searchParams = new URLSearchParams();
    searchParams.append('grant_type', 'client_credentials');
    searchParams.append(
      'client_assertion_type',
      'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
    );
    searchParams.append('client_assertion', token);
    searchParams.append('scope', scopeParams.join(' '));
    const r = await axios.post(platform.accessTokenUrl, searchParams);
    if (r.status !== 200) {
      const msg = `Error retrieving access token from platform ${platform.accessTokenUrl}. ${r.status}: ${r.statusText}`;
      throw new LtiCustomError(msg, 'PlatformObjectRetrievalFailure', 400);
    }
    const accessToken = r.data.access_token;
    return accessToken;
  } catch (e) {
    const error = e as Error;
    Powertools.getInstance().logger.error(
      `Problem requesting bearer client credentials from ${platform.accessTokenUrl}: ${error.name} ${error.message}`
    );
    throw new LtiCustomError(
      error.message,
      'FailedToGetClientCredentials',
      500
    );
  }
}

export function abort(statusCode: number, msg: string): APIGatewayProxyResult {
  return {
    statusCode: statusCode,
    body: JSON.stringify(msg),
  } as APIGatewayProxyResult;
}

/**
 * Parses HTTP GET and POST data for the specified key
 * @param req APIGatewayProxyEvent
 * @param key string to search for
 * @returns string value, undefined if not found
 */
export function valueFromRequest(
  req: APIGatewayProxyEvent,
  key: string
): any | undefined {
  if (req.queryStringParameters !== null && key in req.queryStringParameters!) {
    return req.queryStringParameters?.[key] ?? undefined;
  } else if (req?.body) {
    try {
      const body = JSON.parse(req.body);
      if (key in body) {
        return body?.[key] ?? undefined;
      }
    } catch (e) {
      const urlParams = new URLSearchParams(req.body);
      return urlParams.get(key) ?? undefined;
    }
  }
  return undefined;
}

/**
 * Parses HTTP GET and POST data for the specified key. Throws an error if the key is not found.
 * @param req APIGatewayProxyEvent
 * @param key string to search for
 * @returns string value, InvalidValueError if not found
 */
export function requiredValueFromRequest(
  req: APIGatewayProxyEvent,
  key: string
): any {
  const value = valueFromRequest(req, key);
  if (value !== undefined) {
    return value;
  } else {
    throw new LtiCustomError(
      `${key} not available in request`,
      'MissingKeyInRequest',
      400
    );
  }
}

/**
 * Parses HTTP GET and POST data for the specified key. Throws an error if the key is not found.
 * @param req APIGatewayProxyEvent
 * @param key string to search for
 * @returns string value, InvalidValueError if not found or is empty string
 */
export function requiredTruthyValueFromRequest(
  req: APIGatewayProxyEvent,
  key: string
): any {
  const value = valueFromRequest(req, key);
  if (value) {
    return value;
  } else {
    throw new LtiCustomError(
      `${key} not available in request`,
      'MissingKeyInRequest',
      400
    );
  }
}

export function requiredAllowedValueFromRequest(
  req: APIGatewayProxyEvent,
  key: string,
  allowedValues: string[]
): string {
  const value = valueFromRequest(req, key);
  if (value !== undefined && allowedValues.includes(value)) {
    return value;
  } else {
    throw new LtiCustomError(
      `${key} is invalid in request`,
      'InvalidKeyInRequest',
      400
    );
  }
}

/**
 * Parses HTTP Headers cookies for the specified key.
 * @param headers APIGatewayProxyEventHeaders
 * @param key string to search for
 * @returns string value, undefined if not found
 */
export function valueFromCookies(
  headers: APIGatewayProxyEventHeaders,
  key: string
): string | undefined {
  const rc = headers?.Cookie || headers?.cookie;
  if (rc === undefined) {
    Powertools.getInstance().logger.warn('No cookie found');
    return undefined;
  }

  for (const cookie of rc.split(';')) {
    const parts = cookie.split('=');
    const ckey = (parts as any)?.shift().trim();
    const value = decodeURI(parts.join('='));
    if (ckey === key) {
      return value;
    }
  }
  return undefined;
}

/**
 * Parses HTTP Headers cookies for the specified key. Throws an error if the key is not found.
 * @param headers APIGatewayProxyEventHeaders
 * @param key string to search for
 * @returns string value, InvalidValueError if not found
 */
export function requiredValueFromCookies(
  headers: APIGatewayProxyEventHeaders,
  key: string
): string {
  const value = valueFromCookies(headers, key);
  if (value !== undefined) {
    return value;
  } else {
    throw new LtiCustomError(
      `${key} not available in cookie`,
      'MissingKeyInCookie',
      400
    );
  }
}

/**
 * This method takes a JSON object and returns a signed a JWT message string
 *
 */
export const getSignedJWT = async (
  jwtBody: object,
  keyDetails: { keyId: string; kid: string }
): Promise<string> => {
  const headers = {
    alg: 'RS256',
    typ: 'JWT',
    kid: keyDetails.kid,
  };

  const headerJson = Buffer.from(JSON.stringify(headers)).toString('base64url');
  const payloadJson = Buffer.from(JSON.stringify(jwtBody)).toString(
    'base64url'
  );
  const clientAssertion = `${headerJson}.${payloadJson}`;
  const aws = Aws.getInstance();
  const encoded = new nodeUtil.TextEncoder().encode(clientAssertion);
  const signedClientAssertion = await aws.sign(keyDetails.keyId, encoded);
  const b64urlSignedClientAssertion = Buffer.from(
    signedClientAssertion!
  ).toString('base64url');
  const token = `${headerJson}.${payloadJson}.${b64urlSignedClientAssertion}`;
  return token;
};

/**
 *
 * This is how aws amplify library encodes the state param,
 * https://github.com/aws-amplify/amplify-js/blob/main/packages/core/src/Util/StringUtils.ts#L1-L11
 * https://github.com/aws-amplify/amplify-js/blob/e1b0b5be3e8ccb3c76e8e2e2f43f910d40d73254/packages/auth/src/OAuth/OAuth.ts#L79
 *
 * @param str the string that needs to be encoded to send as state for tools which use aws amplify library to authenticate and use custom state to get deep link paths
 * @returns an encoded string prefixed with '-' because AWS Amplify needs that
 */
export const awsAmplifyUrlSafeEncode = (str: string): string => {
  return `-${str
    .split('')
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')}`;
};

export const isIsoDateString = (inStr: string) => {
  if (!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(inStr)) return false;
  const d = new Date(inStr);
  return d instanceof Date && d.toISOString() === inStr;
};

export async function setParamsFromTokenOrRequestCombined(
  event: APIGatewayProxyEvent,
  platform: DynamoDBPlatformConfig,
  powertools: Powertools,
  lmsParams: LmsParams,
  metricPrefix: string
) {
  let idToken: string | undefined = undefined;

  try {
    idToken = requiredTruthyValueFromRequest(event, 'id_token');
  } catch (e) {
    powertools.logger.info(
      "The request does not contain an 'id_token' parameter"
    );
  }

  if (idToken) {
    let jwt;
    try {
      jwt = await LTIJwtPayload.load(idToken, platform);
    } catch (e) {
      throw new LtiCustomError(
        (e as Error).message,
        'JwtValidationFailure',
        401
      );
    }

    lmsParams.setLmsParamsFromJwt(jwt, idToken);

    if (lmsParams instanceof ScoreSubmissionLmsParams) {
      lmsParams.setScoringParamsFromRequest(event);
    }

    powertools.metrics.addMetric(
      `${metricPrefix}WithParameter`,
      MetricUnits.Count,
      1
    );
  } else {
    lmsParams.setLmsParamsFromRequestBody(event);

    powertools.metrics.addMetric(
      `${metricPrefix}WithParameter`,
      MetricUnits.Count,
      1
    );
  }
}

export async function submitGetRequestToLms(url: string, accessToken: string) {
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response;
  } catch (e) {
    throw new LtiCustomError(
      (e as Error).message,
      'FailedRequestToAxios',
      (e as AxiosError) && (e as AxiosError).response
        ? (e as AxiosError).response!.status
        : 500
    );
  }
}

export const sendSignedGetRequest = async (requestURL: string) => {
  const apiUrl = new URL(requestURL);
  const sigv4 = new SignatureV4({
    service: 'execute-api',
    region: 'us-east-1',
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID!,
      secretAccessKey: AWS_SECRET_ACCESS_KEY!,
      sessionToken: AWS_SESSION_TOKEN,
    },
    sha256: Sha256,
  });
  const signed = await sigv4.sign({
    method: 'GET',
    hostname: apiUrl.host,
    path: apiUrl.pathname,
    protocol: apiUrl.protocol,
    headers: {
      'Content-Type': 'application/json',
      host: apiUrl.hostname,
    },
  });
  try {
    return await axios({
      ...signed,
      url: requestURL,
    });
  } catch (e) {
    throw new Error(`Failed to send signed get request : ${requestURL}`);
  }
};
