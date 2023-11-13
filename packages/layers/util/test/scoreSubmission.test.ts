import 'aws-sdk-client-mock-jest';
import axios from 'axios';
import * as jose from 'jose';
import { DynamoDBJwks } from '../src';
import * as helpers from '../src/helpers';
import { PlatformConfigRecord } from '../src/platformConfig';
import * as scoreSubmissionHelpers from '../src/scoreSubmission';

jest.mock('axios');
const fakeDate = new Date(2020, 3, 1);
const joseDecodeJwt = jest.fn();
jest.mock('jose', () => ({
  decodeJwt: (jwt: any) => joseDecodeJwt(jwt),
}));

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(fakeDate);
  jest.spyOn(process.stdout, 'write').mockImplementation(function () {
    return true;
  });
});

describe('GetKidFromJwk', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    //    const kid = kids.keys[0].kid;
  });

  it('Should return scoring data as expected', async () => {
    jest
      .spyOn(DynamoDBJwks.prototype, 'all')
      .mockImplementation(async function () {
        return {
          keys: [
            {
              kid: 'keyId',
            },
          ],
        } as jose.JSONWebKeySet;
      });

    expect(
      scoreSubmissionHelpers.getKidFromJwk(
        new DynamoDBJwks('Table', 'kmsId', 900)
      )
    ).resolves.toEqual('keyId');
  });

  it('Should throw error for faulty data', async () => {
    jest
      .spyOn(DynamoDBJwks.prototype, 'all')
      .mockImplementation(async function () {
        throw new Error('DummyError');
      });

    expect(
      scoreSubmissionHelpers.getKidFromJwk(
        new DynamoDBJwks('Table', 'kmsId', 900)
      )
    ).rejects.toThrow('DummyError');
  });
});

describe('SubmitScoreToLms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Successful score submission', async () => {
    jest.spyOn(helpers, 'requiredValueFromRequest');
    jest
      .spyOn(DynamoDBJwks.prototype, 'all')
      .mockImplementation(async function () {
        return {
          keys: [
            {
              kid: 'keyId',
            },
          ],
        } as jose.JSONWebKeySet;
      });

    jest
      .spyOn(helpers, 'requestBearerClientCredential')
      .mockImplementation(async function () {
        return 'DummyToken';
      });

    (axios.post as jest.Mock).mockResolvedValueOnce({
      status: 200,
      data: { access_token: 'ACCESS_TOKEN' },
    });

    const spyOnPost = jest.spyOn(axios, 'post');

    const response = await scoreSubmissionHelpers.submitScoreToLms(
      undefined as unknown as PlatformConfigRecord,
      'lineItem',
      'studentId',
      88,
      100,
      'Comment Dummy',
      fakeDate.toISOString(),
      'Completed',
      'FullyGraded',
      new DynamoDBJwks('Table', 'kmsId', 900),
      'kmsKid'
    );

    expect(response.status).toEqual(200);
    expect(spyOnPost).toHaveBeenCalledTimes(1);
    expect(spyOnPost).toHaveBeenCalledWith(
      'lineItem/scores',
      {
        activityProgress: 'Completed',
        comment: 'Comment Dummy',
        gradingProgress: 'FullyGraded',
        scoreGiven: 88,
        scoreMaximum: 100,
        timestamp: fakeDate.toISOString(),
        userId: 'studentId',
      },
      {
        headers: {
          Authorization: 'Bearer DummyToken',
          'Content-Type': 'application/vnd.ims.lis.v1.score+json',
        },
      }
    );
  });

  it('UnSuccessful score submission - post call gave status code 500', async () => {
    jest.spyOn(helpers, 'requiredValueFromRequest');

    jest
      .spyOn(DynamoDBJwks.prototype, 'all')
      .mockImplementation(async function () {
        return {
          keys: [
            {
              kid: 'keyId',
            },
          ],
        } as jose.JSONWebKeySet;
      });

    jest
      .spyOn(helpers, 'requestBearerClientCredential')
      .mockImplementation(async function () {
        return 'DummyToken';
      });

    (axios.post as jest.Mock).mockResolvedValueOnce({
      status: 500,
    });

    jest.spyOn(axios, 'post');

    await expect(
      scoreSubmissionHelpers.submitScoreToLms(
        undefined as unknown as PlatformConfigRecord,
        'lineItem',
        'studentId',
        88,
        100,
        'Comment Dummy',
        fakeDate.toISOString(),
        'Completed',
        'FullyGraded',
        new DynamoDBJwks('Table', 'kmsId', 900),
        'kmsKid'
      )
    ).rejects.toThrow(
      'Unsuccessful score submission POST call. Error: {"status":500}'
    );
  });
});
