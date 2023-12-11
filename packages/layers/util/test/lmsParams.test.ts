import 'aws-sdk-client-mock-jest';
import { LTIJwtPayload } from '../src/jwt';
import {
  RosterRetrievalLmsParams,
  ScoreSubmissionLmsParams,
} from '../src/lmsParams';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { scoreSubmissionRequestEvent } from '../../../../test/utils/eventGenerator';
import * as helpers from '../src/helpers';

const IssuerKey = 'custom:LMS:Issuer';
const ClientIdKey = 'custom:LMS:ClientId';
const DeploymentIdKey = 'custom:LMS:DeploymentId';
const NamesRoleServiceKey = 'custom:LMS:NamesRoleService';
const EndpointKey = 'custom:LMS:Endpoint';
const fakeDate = new Date(2020, 3, 1);

describe('LmsParams classes test suite', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('getting value from token', async () => {
    const rosterLmsParams = new RosterRetrievalLmsParams();
    const fakeLTIJwtPayload = {
      getTruthyClaim(key: string): string {
        return key;
      },

      jsonParseClaim(jsonString: string, key: string) {
        return jsonString;
      },
    };

    rosterLmsParams.setLmsParamsFromJwt(fakeLTIJwtPayload as LTIJwtPayload);

    expect(rosterLmsParams.lmsClientId).toEqual(ClientIdKey);
    expect(rosterLmsParams.lmsDeploymentId).toEqual(DeploymentIdKey);
    expect(rosterLmsParams.lmsIssuer).toEqual(IssuerKey);
    expect(rosterLmsParams.contextMembershipsUrl).toEqual(NamesRoleServiceKey);
  });

  it('getting value from requestBody', async () => {
    const rosterLmsParams = new RosterRetrievalLmsParams();
    const goodObject = {
      issuer: 'a',
      client_id: 'b',
      deployment_id: 'c',
      context_memberships_url: 'd',
    };
    const event = {
      body: JSON.stringify(goodObject),
      queryStringParameters: null,
    } as APIGatewayProxyEvent;
    rosterLmsParams.setLmsParamsFromRequestBody(event);

    expect(rosterLmsParams.lmsClientId).toEqual('b');
    expect(rosterLmsParams.lmsDeploymentId).toEqual('c');
    expect(rosterLmsParams.lmsIssuer).toEqual('a');
    expect(rosterLmsParams.contextMembershipsUrl).toEqual('d');
  });
});

describe('Score submission LmsParams classes test suite', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('getting value from token', async () => {
    const scoreSubParams = new ScoreSubmissionLmsParams();
    const fakeLTIJwtPayload = {
      getTruthyClaim(key: string): string {
        return key;
      },

      jsonParseClaim(jsonString: string, key: string) {
        return jsonString;
      },
    };

    scoreSubParams.setLmsParamsFromJwt(fakeLTIJwtPayload as LTIJwtPayload);

    expect(scoreSubParams.lmsClientId).toEqual(ClientIdKey);
    expect(scoreSubParams.lmsDeploymentId).toEqual(DeploymentIdKey);
    expect(scoreSubParams.lmsIssuer).toEqual(IssuerKey);
    expect(scoreSubParams.lineitem).toEqual(EndpointKey);
  });

  it('getting value from requestBody', async () => {
    const scoreSubParams = new ScoreSubmissionLmsParams();
    const goodObject = {
      issuer: 'a',
      client_id: 'b',
      deployment_id: 'c',
      lineitem: 'd',
      lms_student_id: 'e',
      score_given: 80,
      score_maximum: 100,
      activity_progress: 'Completed',
      grading_progress: 'FullyGraded',
      comment: 'Hello 456 Comment',
    };
    const event = {
      body: JSON.stringify(goodObject),
      queryStringParameters: null,
    } as APIGatewayProxyEvent;
    scoreSubParams.setLmsParamsFromRequestBody(event);

    expect(scoreSubParams.lmsClientId).toEqual('b');
    expect(scoreSubParams.lmsDeploymentId).toEqual('c');
    expect(scoreSubParams.lmsIssuer).toEqual('a');
    expect(scoreSubParams.lineitem).toEqual('d');
    expect(scoreSubParams.lmsStudentId).toEqual('e');
  });
});

describe('GetScoringParamsFromRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(fakeDate);
  });

  it('Should return scoring data as expected', async () => {
    const scoreSubParams = new ScoreSubmissionLmsParams();
    const requestBodyContainingValidRequiredInputs = {
      score_given: 88,
      score_maximum: 100,
      activity_progress: 'Completed',
      grading_progress: 'FullyGraded',
      comment: 'Hello 456 Comment',
    };

    const requiredValueFromRequestSpy = jest.spyOn(
      helpers,
      'requiredValueFromRequest'
    );

    const goodEvent = scoreSubmissionRequestEvent(
      JSON.stringify(requestBodyContainingValidRequiredInputs)
    );

    scoreSubParams.setScoringParamsFromRequest(goodEvent);
    expect(scoreSubParams.timestamp).toEqual(fakeDate.toISOString());
    expect(scoreSubParams.scoreGiven).toEqual(
      requestBodyContainingValidRequiredInputs.score_given
    );
    expect(scoreSubParams.scoreMaximum).toEqual(
      requestBodyContainingValidRequiredInputs.score_maximum
    );
    expect(scoreSubParams.comment).toEqual(
      requestBodyContainingValidRequiredInputs.comment
    );
    expect(scoreSubParams.gradingProgress).toEqual(
      requestBodyContainingValidRequiredInputs.grading_progress
    );
    expect(scoreSubParams.activityProgress).toEqual(
      requestBodyContainingValidRequiredInputs.activity_progress
    );
    expect(requiredValueFromRequestSpy).toHaveBeenCalledTimes(3);
  });

  it('Should throw exception if grading process data is invalid', async () => {
    const scoreSubParams = new ScoreSubmissionLmsParams();
    const requestBodyContainingValidRequiredInputs = {
      score_given: 88,
      score_maximum: 100,
      activity_progress: 'Completed',
      grading_progress: 'Dummy',
      comment: 'Hello 456 Comment',
    };

    const requiredValueFromRequestSpy = jest.spyOn(
      helpers,
      'requiredValueFromRequest'
    );

    const badEvent = scoreSubmissionRequestEvent(
      JSON.stringify(requestBodyContainingValidRequiredInputs)
    );
    expect(() => {
      scoreSubParams.setScoringParamsFromRequest(badEvent);
    }).toThrow('grading_progress is invalid in request');

    expect(requiredValueFromRequestSpy).toHaveBeenCalledTimes(3);
  });

  it('Should throw exception if activity_progress data is invalid', async () => {
    const scoreSubParams = new ScoreSubmissionLmsParams();
    const requestBodyContainingValidRequiredInputs = {
      score_given: 88,
      score_maximum: 100,
      activity_progress: 'Dummy',
      grading_progress: 'FullyGraded',
      comment: 'Hello 456 Comment',
    };

    const requiredValueFromRequestSpy = jest.spyOn(
      helpers,
      'requiredValueFromRequest'
    );

    const badEvent = scoreSubmissionRequestEvent(
      JSON.stringify(requestBodyContainingValidRequiredInputs)
    );
    expect(() => {
      scoreSubParams.setScoringParamsFromRequest(badEvent);
    }).toThrow('activity_progress is invalid in request');

    expect(requiredValueFromRequestSpy).toHaveBeenCalledTimes(3);
  });
});
