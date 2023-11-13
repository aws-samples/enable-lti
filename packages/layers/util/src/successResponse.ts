import { APIGatewayProxyResult } from 'aws-lambda';

import { defaultHeaders } from './httpHeaders';

export const successResponse = (
  response: APIGatewayProxyResult
): APIGatewayProxyResult => {
  return {
    ...response,
    headers: {
      ...defaultHeaders,
      ...response.headers,
    },
  };
};
