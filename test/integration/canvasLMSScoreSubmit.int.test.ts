import { handler as scoreSubmitHandler } from '@enable-lti/score-submission';
import { DynamoDBJwks, getSignedJWT } from '@enable-lti/util';
import axios from 'axios';
import { scoreSubmissionRequestEvent } from '../utils/eventGenerator';
import {
  CLIENT_ID,
  DEPLOYMENT_ID,
  ISS,
  LINE_ITEM_URL,
  jwtBodyForScoreSubmission,
} from '../utils/models';
jest.mock('axios');
/**
 * Specification for first 2 steps in this integ test is below:
 * https://www.imsglobal.org/spec/security/v1p0/#openid_connect_launch_flow
 *
 * Please note that this test is primarily for Canvas LMS platform
 * As we test for more LMS platforms, we will add similar e2e tests for each
 */

describe('CanvasLMS score submission flow', () => {
  const CONTROL_TABLE_NAME = process.env.CONTROL_PLANE_TABLE_NAME!;
  const JWK_URL = process.env.JWK_URL!;
  const KMS_KEY_ID = process.env.KMS_KEY_ID!;
  let KID: string | undefined;

  beforeAll(async () => {
    const jwks = new DynamoDBJwks(CONTROL_TABLE_NAME, KMS_KEY_ID);
    const kids = await jwks.all();
    KID = kids.keys[0].kid;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('user launched tool from CanvasLMS, OIDC launch flow', async () => {
    //Simulating CanvasLMS calling ELTI for 3rd party login launch flow
    const signedJWT = await getSignedJWT(jwtBodyForScoreSubmission(), {
      keyId: KMS_KEY_ID,
      kid: KID!,
    });

    (axios.post as jest.Mock).mockResolvedValue({
      status: 200,
      data: { access_token: 'ACCESS_TOKEN', score: 'SUCCESSFUL_SUBMISSION' },
    });
    const badObject = {
      id_token: signedJWT,
      score_given: 88,
      score_maximum: 100,
      activity_progress: 'Completed',
      grading_progress: 'HalfHalf',
      comment: 'Hello 456 Comment',
    };
    const badEvent = scoreSubmissionRequestEvent(JSON.stringify(badObject));
    const errorRes = await scoreSubmitHandler(badEvent);
    expect(errorRes).toBeDefined();
    expect(errorRes.statusCode).toEqual(400);
    const goodObject = {
      id_token: signedJWT,
      score_given: 88,
      score_maximum: 100,
      activity_progress: 'Completed',
      grading_progress: 'FullyGraded',
      comment: 'Hello 456 Comment',
    };
    const goodEvent = scoreSubmissionRequestEvent(JSON.stringify(goodObject));
    const successRes = await scoreSubmitHandler(goodEvent);
    expect(successRes).toBeDefined();
    expect(successRes.statusCode).toEqual(200);
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  test('user launched tool from CanvasLMS, without token, but inputs from request body', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      status: 200,
      data: { access_token: 'ACCESS_TOKEN', score: 'SUCCESSFUL_SUBMISSION' },
    });

    const goodObject = {
      id_token: undefined,
      score_given: 88,
      score_maximum: 100,
      activity_progress: 'Completed',
      grading_progress: 'FullyGraded',
      comment: 'Hello 456 Comment',
      issuer: ISS,
      client_id: CLIENT_ID,
      deployment_id: DEPLOYMENT_ID,
      lineitem: LINE_ITEM_URL,
      lms_student_id: '3898ba10-1eca-4558-a722-a3a48308a456',
    };
    const goodEvent = scoreSubmissionRequestEvent(JSON.stringify(goodObject));
    const successRes = await scoreSubmitHandler(goodEvent);
    expect(successRes).toBeDefined();
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(successRes.statusCode).toEqual(200);
  });

  test('user launched tool from CanvasLMS, without token and without required inputs in request body', async () => {
    // In the badObject these inputs are missing from request: client_id, deployment_id, lineitem
    const badObject = {
      id_token: undefined,
      score_given: 88,
      score_maximum: 100,
      activity_progress: 'Completed',
      grading_progress: 'FullyGraded',
      comment: 'Hello 456 Comment',
      issuer: ISS,
      lms_student_id: '3898ba10-1eca-4558-a722-a3a48308a456',
    };

    const badEvent = scoreSubmissionRequestEvent(JSON.stringify(badObject));
    const failureRes = await scoreSubmitHandler(badEvent);
    expect(failureRes).toBeDefined();
    expect(failureRes.statusCode).toEqual(400);
  });
});
