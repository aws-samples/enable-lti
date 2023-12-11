import { MetricUnits } from '@aws-lambda-powertools/metrics';
import { getErrorResponseTemplate } from './errorResponseTemplate';
import { defaultHeaders } from './httpHeaders';
import { v4 as uuidv4 } from 'uuid';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Powertools } from './powertools';

export type CustomErrorMetric =
  | 'ToolURLNotDefined'
  | 'UnknownLTIMessageType'
  | 'LaunchFailedToSaveState'
  | 'FailedToGetDomainOrPath'
  | 'IssueWithTargetLinkUrl'
  | 'StoreAccessError'
  | 'InvalidValueError'
  | 'RecordNotFoundError'
  | 'OIDCDoesNotExist'
  | 'StateLoadError'
  | 'SessionNotFound'
  | 'UnsuccessfulPostAxiosScores'
  | 'FailedToPostAxiosScores'
  | 'JwksIssue'
  | 'FailedToGetDomainOrPath'
  | 'FailedRequestToAxios'
  | 'JwtValidationFailure'
  | 'FailedToGetClientCredentials'
  | 'PlatformObjectRetrievalFailure'
  | 'UnexpectedScoreGiven'
  | 'SendMessageError'
  | 'FailedToSendRequestToSqs'
  | 'RequiredClaimsMissingInToken'
  | 'TokenMissingNonce'
  | 'TokenAzpInvalid'
  | 'TokenMissingAzp'
  | 'TokenVerificationFailed'
  | 'TokenMissingAud'
  | 'InvalidToken'
  | 'DataAccessError'
  | 'MissingKeyInRequest'
  | 'MissingKeyInCookie'
  | 'InvalidKeyInRequest'
  | 'ScoreSubmissionFailure'
  | 'ScoreSubmissionAsyncFailure'
  | 'RosterRetrievalAsyncFailure'
  | 'RosterRetrievalFailure'
  | 'TokenProxyFailure'
  | 'FailedSaveToolConfig'
  | 'RosterRetrievalSQSFailure'
  | 'ScoreSubmissionSQSFailure'
  | 'InternalError'
  | 'OidcFailure'
  | 'LogoutRedirectHandlererror'
  | 'LaunchFailure'
  | 'JwksFailure'
  | 'DeepLinkProxyFailure'
  | 'ResourceLinksTampered'
  | 'FailedToGetJWKS'
  | 'JWTValidationFailure'
  | 'InvalidResourceLinks'
  | 'AuthorizerProxyFailure'
  | 'ConfigurationIssue'
  | 'testMetric';

export type ErrorResponseArgs = {
  pt: Powertools;
  err: Error;
  statusCode: number;
  metricString: CustomErrorMetric;
  businessMetric?: string;
  throwError?: boolean;
};

export class LtiCustomError extends Error {
  customMetric: CustomErrorMetric;
  statusCode: number;
  constructor(
    errorMessage: string,
    customMetric: CustomErrorMetric,
    statusCode: number
  ) {
    super(errorMessage);
    this.name = 'LtiCustomError';
    this.customMetric = customMetric;
    this.statusCode = statusCode;
  }
}

export const errorResponse = (
  args: ErrorResponseArgs
): APIGatewayProxyResult => {
  args.pt.logger.error('Error:', args.err);
  args.pt.metrics.addMetric(args.metricString, MetricUnits.Count, 1);
  if (args.businessMetric) {
    args.pt.metrics.addMetric(args.businessMetric, MetricUnits.Count, 1);
  }

  if (args.throwError) {
    throw args.err;
  }

  // Nonce is required for 'style-src' to prevent using 'unsafe-inline'
  const nonce = uuidv4();

  return {
    statusCode: args.statusCode,
    headers: {
      ...defaultHeaders,
      'Content-Type': 'text/html',
      'Content-Security-Policy': `default-src 'self'; img-src data:; style-src 'nonce-${nonce}'`,
    },
    body: getErrorResponseTemplate(args.err.message, nonce),
  };
};
