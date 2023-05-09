import { handler as scoreSubmitHandler } from '@enable-lti/score-submission';
import axios from 'axios';
import {
  DynamoDBPlatformConfig,
  PlatformConfigRecord,
  getSignedJWT,
  DynamoDBJwks,
} from '@enable-lti/util';
//TODO: below utils can be utilized in unit tests as well so move them to util package
import { scoreSubmissionRequestEvent } from '../utils/eventGenerator';
import {
  platformConfig,
  CLIENT_ID,
  ISS,
  jwtBodyForScoreSubmission,
  LINE_ITEM_URL,
  ACCESS_TOKEN_URL,
} from '../utils/models';
jest.mock('axios');
/**
 * Specification for first 2 steps in this integ test is below:
 * https://www.imsglobal.org/spec/security/v1p0/#openid_connect_launch_flow
 *
 * Please note that this test is primarily for Canvas LMS platform
 * As we test for more LMS platforms, we will add similar e2e tests for each
 */

describe('CanvasLMS login launch flow works', () => {
  const CONTROL_TABLE_NAME = process.env.CONTROL_PLANE_TABLE_NAME!;
  const JWK_URL = process.env.JWK_URL!;
  const KMS_KEY_ID = process.env.KMS_KEY_ID!;
  let KID: string | undefined;

  beforeAll(async () => {
    const platform = new DynamoDBPlatformConfig(CONTROL_TABLE_NAME);
    const jwks = new DynamoDBJwks(CONTROL_TABLE_NAME, KMS_KEY_ID);
    const kids = await jwks.all();
    KID = kids.keys[0].kid;
    let platformConfigRecord: PlatformConfigRecord;
    try {
      platformConfigRecord = await platform.load(CLIENT_ID, ISS);
    } catch {
      platformConfigRecord = await platform.save(platformConfig(JWK_URL));
    }
    console.log(platformConfigRecord.accessTokenUrl);
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
  jest.resetAllMocks();
});
