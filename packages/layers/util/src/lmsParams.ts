import { APIGatewayProxyEvent } from 'aws-lambda';
import {
  LTIJwtPayload,
  requiredTruthyValueFromRequest,
  requiredValueFromRequest,
  requiredAllowedValueFromRequest,
  valueFromRequest,
  isIsoDateString,
  LtiCustomError,
} from '.';
import { decodeJwt } from 'jose';
import {
  ActivityProgress,
  GradingProgress,
} from './models/scoreSubmissionModels';

const IssuerKey = 'custom:LMS:Issuer';
const ClientIdKey = 'custom:LMS:ClientId';
const DeploymentIdKey = 'custom:LMS:DeploymentId';
const IssuerKeyInBody = 'issuer';
const ClientIdKeyInBody = 'client_id';
const DeploymentIdKeyInBody = 'deployment_id';
const NamesRoleServiceKey = 'custom:LMS:NamesRoleService';
const ContextMembershipsKey = 'context_memberships_url';
const LineItemKeyInBody = 'lineitem';
const LmsStudentIdKeyInBody = 'lms_student_id';
const ScoreGivenKeyInBody = 'score_given';
const ScoreMaximumKeyInBody = 'score_maximum';
const CommentKeyInBody = 'comment';
const AcitivityProgressKeyInBody = 'activity_progress';
const GradingProgressKeyInBody = 'grading_progress';
const TimestampKeyInBody = 'timestamp';
const EndpointKey = 'custom:LMS:Endpoint';

export interface LmsParams {
  lmsIssuer: string;
  lmsClientId: string;
  lmsDeploymentId: string;
  setLmsParamsFromJwt(jwt: LTIJwtPayload, idToken?: string): void;
  setLmsParamsFromRequestBody(event: APIGatewayProxyEvent): void;
}

export class RosterRetrievalLmsParams implements LmsParams {
  lmsIssuer: string;
  lmsClientId: string;
  lmsDeploymentId: string;
  contextMembershipsUrl: string;

  setLmsParamsFromJwt(jwt: LTIJwtPayload): void {
    setCommonLmsParamsFromToken(jwt, this);
    const lmsNamesRoleService = jwt.getTruthyClaim(NamesRoleServiceKey);
    this.contextMembershipsUrl = jwt.jsonParseClaim(
      lmsNamesRoleService,
      ContextMembershipsKey
    );
  }
  setLmsParamsFromRequestBody(event: APIGatewayProxyEvent): void {
    setCommonLmsParamsFromRequestBody(event, this);
    this.contextMembershipsUrl = requiredTruthyValueFromRequest(
      event,
      ContextMembershipsKey
    );
  }
}

export class ScoreSubmissionLmsParams implements LmsParams {
  lmsIssuer: string;
  lmsClientId: string;
  lmsDeploymentId: string;
  lmsStudentId: string;
  lineitem: string;
  scoreGiven: number;
  scoreMaximum: number;
  comment: string;
  activityProgress: string;
  gradingProgress: string;
  timestamp: string;

  setLmsParamsFromJwt(jwt: LTIJwtPayload, idToken?: string): void {
    setCommonLmsParamsFromToken(jwt, this);
    const endpoint = jwt!.getTruthyClaim(EndpointKey);
    this.lineitem = jwt.jsonParseClaim(endpoint, LineItemKeyInBody);
    if (idToken) {
      const decodedJwt: Record<string, any> = decodeJwt(idToken);
      this.lmsStudentId = decodedJwt.identities[0].userId;
    }
  }

  setLmsParamsFromRequestBody(event: APIGatewayProxyEvent): void {
    setCommonLmsParamsFromRequestBody(event, this);

    this.lineitem = requiredTruthyValueFromRequest(event, LineItemKeyInBody);
    this.lmsStudentId = requiredTruthyValueFromRequest(
      event,
      LmsStudentIdKeyInBody
    );

    this.setScoringParamsFromRequest(event);
  }

  setScoringParamsFromRequest(event: APIGatewayProxyEvent) {
    this.scoreGiven = requiredValueFromRequest(event, ScoreGivenKeyInBody);
    this.scoreMaximum = requiredValueFromRequest(event, ScoreMaximumKeyInBody);
    this.comment = requiredValueFromRequest(event, CommentKeyInBody);
    this.activityProgress = requiredAllowedValueFromRequest(
      event,
      AcitivityProgressKeyInBody,
      Object.keys(ActivityProgress)
    );
    this.gradingProgress = requiredAllowedValueFromRequest(
      event,
      GradingProgressKeyInBody,
      Object.keys(GradingProgress)
    );

    this.timestamp = valueFromRequest(event, TimestampKeyInBody);
    if (!this.timestamp || !isIsoDateString(this.timestamp)) {
      this.timestamp = new Date().toISOString();
    }

    if (this.scoreGiven < 0 || this.scoreGiven > 100 * this.scoreMaximum) {
      throw new LtiCustomError(
        'scoreGiven is not as expected',
        'UnexpectedScoreGiven',
        400
      );
    }
  }
}

export function setCommonLmsParamsFromToken(
  jwt: LTIJwtPayload,
  lmsParams: LmsParams
) {
  lmsParams.lmsIssuer = jwt.getTruthyClaim(IssuerKey);
  lmsParams.lmsClientId = jwt.getTruthyClaim(ClientIdKey);
  lmsParams.lmsClientId = lmsParams
    .lmsClientId!.replace('[', '')
    .replace(']', '');
  lmsParams.lmsDeploymentId = jwt.getTruthyClaim(DeploymentIdKey);
}

export function setCommonLmsParamsFromRequestBody(
  event: APIGatewayProxyEvent,
  lmsParams: LmsParams
) {
  lmsParams.lmsIssuer = requiredTruthyValueFromRequest(event, IssuerKeyInBody);
  lmsParams.lmsClientId = requiredTruthyValueFromRequest(
    event,
    ClientIdKeyInBody
  );
  lmsParams.lmsDeploymentId = requiredTruthyValueFromRequest(
    event,
    DeploymentIdKeyInBody
  );
}
