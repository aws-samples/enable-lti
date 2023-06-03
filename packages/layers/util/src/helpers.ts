import {
  APIGatewayProxyEvent,
  APIGatewayProxyEventHeaders,
  APIGatewayProxyResult,
} from 'aws-lambda';
import { InvalidValueError } from './customErrors';
import { PlatformConfigRecord } from './platformConfig';
import * as jose from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { Aws } from './aws';
import * as axios from 'axios';
import * as nodeUtil from 'util';
import * as forge from 'node-forge';
import { Powertools } from './powertools';

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
  kmsKeyId: string,
  powertools: Powertools
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

    // @ts-ignore
    const payload = JSON.stringify(jwt._payload);
    // @ts-ignore
    const header = JSON.stringify(jwt._protectedHeader);
    const headerJson = Buffer.from(header).toString('base64url');
    const payloadJson = Buffer.from(payload).toString('base64url');
    const clientAssertion = `${headerJson}.${payloadJson}`;
    powertools.logger.debug(`clientAssertion: ${clientAssertion}`);
    const aws = Aws.getInstance();
    const encoded = new nodeUtil.TextEncoder().encode(clientAssertion);
    const signedClientAssertion = await aws.sign(kmsKeyId, encoded);
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
    searchParams.append(
      'scope',
      [
        'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
        'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
        'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
        'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
        'https://purl.imsglobal.org/spec/lti-ags/scope/score'
      ].join(' ')
    );
    const httpClient = axios.default;
    powertools.logger.debug(`POST: ${platform.accessTokenUrl}?${searchParams}`);
    const r = await httpClient.post(platform.accessTokenUrl, searchParams);
    if (r.status !== 200 && r.status !== 201) {
      const msg = `Error retrieving access token from platform ${platform.accessTokenUrl}. ${r.status}: ${r.statusText}`;
      throw Error(msg);
    }
    const accessToken = r.data.access_token;
    return accessToken;
  } catch (e) {
    const error = e as Error;
    Powertools.getInstance().logger.error(
      `Problem requesting bearer client credentials from ${platform.accessTokenUrl}: ${error.name} ${error.message}`
    );
    throw error;
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
  let value = undefined;
  if (req.queryStringParameters !== null && key in req.queryStringParameters!) {
    value = req.queryStringParameters?.[key] ?? undefined;
    if (value  !== undefined) return value;
  }
  if (req?.body) {
    try {
      const body = JSON.parse(req.body);
      if (key in body) {
        value = body?.[key] ?? undefined;
        if (value  !== undefined) return value;
      }
    } catch (e) {
      const urlParams = new URLSearchParams(req.body);
      value = urlParams.get(key) ?? undefined;
      if (value  !== undefined) return value;
    }
  }

  if (req?.headers?.Cookie) {
    value = valueFromCookies(req.headers, key)
     if (value  !== undefined) return value;
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
    throw new InvalidValueError(`${key} not available in request`);
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
    throw new InvalidValueError(`${key} not available or is empty`);
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
    throw new InvalidValueError(
      `${key} not available or is sending unexpected value`
    );
  }
}

/**
 * Parses HTTP Header and returns a list of cookies
 * @param headers APIGatewayProxyEventHeaders
 * @returns list of cookies found
 */
export function cookiesFromHeaders(
  headers: APIGatewayProxyEventHeaders
): Record<string, string> | undefined {
  if (headers?.Cookie === undefined) {
    return undefined;
  }
  const list = {},
    rc = headers.Cookie;

  rc &&
    rc.split(';').forEach(function (cookie) {
      const parts = cookie.split('=');
      const key = (parts as any)?.shift().trim();
      const value = decodeURI(parts.join('='));
      if (key !== '') {
        (list as any)[key] = value;
      }
    });
  return list;
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
  if (headers?.Cookie === undefined) {
    Powertools.getInstance().logger.warn('No cookie found');
    return undefined;
  }
  const rc = headers.Cookie;
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
    throw new InvalidValueError(`${key} not available in cookie`);
  }
}

/**
 * This method takes a JSON object and returns a signed a JWT message string
 *
 */
export const getSignedJWT = async (
  jwtBody: {},
  keyDetails: { keyId: string; kid: string }
): Promise<string> => {
  try {
    const headers = {
      alg: 'RS256',
      typ: 'JWT',
      kid: keyDetails.kid,
    };

    const headerJson = Buffer.from(JSON.stringify(headers)).toString(
      'base64url'
    );
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
  } catch (e) {
    throw e;
  }
};

/**
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
