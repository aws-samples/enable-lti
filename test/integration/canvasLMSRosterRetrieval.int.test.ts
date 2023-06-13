import { handler as rosterRetrievalHandler } from '@enable-lti/roster-retrieval';
import axios from 'axios';
import {
  DynamoDBPlatformConfig,
  PlatformConfigRecord,
  getSignedJWT,
  DynamoDBJwks,
} from '@enable-lti/util';
//TODO: below utils can be utilized in unit tests as well so move them to util package
import { rosterRetrievalRequestEvent } from '../utils/eventGenerator';
import {
  platformConfig,
  CLIENT_ID,
  ISS,
  DEPLOYMENT_ID,
  jwtBodyForRosterRetrieval,
  PLATFORM_NAMES_AND_ROLE_URL,
} from '../utils/models';
jest.mock('axios');
/**
 * Specification for first 2 steps in this integ test is below:
 * https://www.imsglobal.org/spec/security/v1p0/#openid_connect_launch_flow
 *
 * Please note that this test is primarily for Canvas LMS platform
 * As we test for more LMS platforms, we will add similar e2e tests for each
 */

// Example from https://canvas.instructure.com/doc/api/names_and_role.html#NamesAndRoleMemberships
const MOCK_NRPS_RESPONSE = {
  "id": "https://example.instructure.com/api/lti/courses/1/names_and_roles?tlid=f91ca4d8-fa84-4a9b-b08e-47d5527416b0",
  "context":
  {
      "id": "4dde05e8ca1973bcca9bffc13e1548820eee93a3",
      "label": "CS-101",
      "title": "Computer Science 101"
  },
  "members":
  [
      {
          "status": "Active",
          "name": "Sienna Howell",
          "picture": "https://example.instructure.com/images/messages/avatar-50.png",
          "given_name": "Sienna",
          "family_name": "Howell",
          "email": "showell@school.edu",
          "lis_person_sourcedid": "1238.8763.00",
          "user_id": "535fa085f22b4655f48cd5a36a9215f64c062838",
          "roles":
          [
              "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor",
              "http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper"
          ],
          "message":
          [
              {
                  "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiResourceLinkRequest",
                  "locale": "en",
                  "https://www.instructure.com/canvas_user_id": 1,
                  "https://www.instructure.com/canvas_user_login_id": "showell@school.edu",
                  "https://purl.imsglobal.org/spec/lti/claim/custom":
                  {
                      "message_locale": "en",
                      "person_address_timezone": "America/Denver"
                  }
              }
          ]
      },
      {
          "status": "Active",
          "name": "Terrence Walls",
          "picture": "https://example.instructure.com/images/messages/avatar-51.png",
          "given_name": "Terrence",
          "family_name": "Walls",
          "email": "twalls@school.edu",
          "lis_person_sourcedid": "5790.3390.11",
          "user_id": "86157096483e6b3a50bfedc6bac902c0b20a824f",
          "roles":
          [
              "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"
          ],
          "message":
          [
              {
                  "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiResourceLinkRequest",
                  "locale": "de",
                  "https://www.instructure.com/canvas_user_id": 2,
                  "https://www.instructure.com/canvas_user_login_id": "twalls@school.edu",
                  "https://purl.imsglobal.org/spec/lti/claim/custom":
                  {
                      "message_locale": "en",
                      "person_address_timezone": "Europe/Berlin"
                  }
              }
          ]
      }
  ]
}

describe('CanvasLMS names and role provisioning services flow works', () => {
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
      platformConfigRecord = await platform.load(CLIENT_ID, ISS, DEPLOYMENT_ID);
    } catch {
      platformConfigRecord = await platform.save(platformConfig(JWK_URL, DEPLOYMENT_ID));
    }
  });

  test('user launched tool from CanvasLMS, OIDC launch flow', async () => {
    //Simulating CanvasLMS calling ELTI for 3rd party login launch flow
    const signedJWT = await getSignedJWT(jwtBodyForRosterRetrieval(), {
      keyId: KMS_KEY_ID,
      kid: KID!,
    });
    (axios.post as jest.Mock).mockResolvedValue({
      status: 200,
      data: { access_token: 'ACCESS_TOKEN'}
    });
    (axios.get as jest.Mock).mockResolvedValue({
      status: 200,
      data: MOCK_NRPS_RESPONSE,
    });
    const requestBody = {
      id_token: signedJWT,
      issuer: ISS,
      client_id: CLIENT_ID,
      deployment_id: DEPLOYMENT_ID,
      context_memberships_url: PLATFORM_NAMES_AND_ROLE_URL,
    };
    const retrievalEvent = rosterRetrievalRequestEvent(signedJWT, JSON.stringify(requestBody));
    const successRes = await rosterRetrievalHandler(retrievalEvent);
    expect(successRes).toBeDefined();
    expect(successRes.statusCode).toEqual(200);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
  jest.resetAllMocks();
});