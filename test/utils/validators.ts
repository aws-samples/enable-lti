import { APIGatewayProxyResult, APIGatewayProxyEventHeaders } from 'aws-lambda';

export const isAPIGatewayProxyResult = (response: APIGatewayProxyResult) => {
  const { body, headers, statusCode } = response;

  if (!body || !headers || !statusCode) return false;
  if (typeof statusCode !== 'number') return false;
  if (typeof body !== 'string') return false;
  if (!isCorrectHeaders(headers as APIGatewayProxyEventHeaders)) return false;
  return true;
};

const isCorrectHeaders = (headers: APIGatewayProxyEventHeaders) => {
  if (headers['Content-Type'] !== 'application/json') return false;
  if (headers['Access-Control-Allow-Methods'] !== '*') return false;
  if (headers['Access-Control-Allow-Origin'] !== '*') return false;

  return true;
};

export const isRedirectResponse = (
  response: APIGatewayProxyResult,
  redirectDomainToCheck?: string
) => {
  const { statusCode, headers } = response;
  if (!headers || !statusCode || !headers.Location) return false;
  if (statusCode !== 302) return false;
  if (typeof headers.Location !== 'string') return false;
  if (redirectDomainToCheck) {
    if (headers.Location.search(redirectDomainToCheck) === -1) return false;
  }
  return true;
};

export const is500Response = (response: APIGatewayProxyResult) => {
  const { statusCode } = response;
  if (statusCode != 500) return false;
  return true;
};

export const is200Response = (response: APIGatewayProxyResult) => {
  const { statusCode } = response;
  if (statusCode != 200) return false;
  return true;
};

export const is401Response = (response: APIGatewayProxyResult) => {
  const { statusCode } = response;
  if (statusCode != 401) return false;
  return true;
};
