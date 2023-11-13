import {
  DynamoDBJwks,
  LtiCustomError,
  requestBearerClientCredential,
  PlatformConfigRecord,
  Powertools,
} from './index';
import axios from 'axios';

export async function getKidFromJwk(jwks: DynamoDBJwks) {
  try {
    const kids = await jwks.all();
    const kid = kids.keys[0].kid;
    return kid;
  } catch (e) {
    throw new LtiCustomError((e as Error).message, 'JwksIssue', 500);
  }
}

export async function postRequestToLms(
  lineitem: string,
  LMSStudentId: string,
  scoreGiven: number,
  scoreMaximum: number,
  comment: string,
  timestamp: string,
  activityProgress: string,
  gradingProgress: string,
  accessToken: string
) {
  try {
    const response = await axios.post(
      `${lineitem}/scores`,
      {
        userId: LMSStudentId,
        scoreGiven,
        scoreMaximum,
        comment,
        timestamp,
        activityProgress,
        gradingProgress,
      },
      {
        headers: {
          'Content-Type': 'application/vnd.ims.lis.v1.score+json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return response;
  } catch (e) {
    throw new LtiCustomError(
      (e as Error).message,
      'FailedToPostAxiosScores',
      500
    );
  }
}

export async function submitScoreToLms(
  platformConfigRecord: PlatformConfigRecord,
  lineitem: string,
  lmsStudentId: string,
  scoreGiven: number,
  scoreMaximum: number,
  comment: string,
  timestamp: string,
  activityProgress: string,
  gradingProgress: string,
  jwks: DynamoDBJwks,
  kmsKeyId: string
) {
  const kid = await getKidFromJwk(jwks);

  const accessToken = await requestBearerClientCredential(
    platformConfigRecord,
    kid!,
    kmsKeyId
  );

  const response = await postRequestToLms(
    lineitem,
    lmsStudentId,
    scoreGiven,
    scoreMaximum,
    comment,
    timestamp,
    activityProgress,
    gradingProgress,
    accessToken
  );

  Powertools.getInstance().logger.info(
    'Response from LMS scoring endpoint',
    response.data
  );

  if (response.status !== 200) {
    throw new LtiCustomError(
      `Unsuccessful score submission POST call. Error: ${JSON.stringify(
        response
      )}`,
      'UnsuccessfulPostAxiosScores',
      response.status
    );
  }

  return response;
}
