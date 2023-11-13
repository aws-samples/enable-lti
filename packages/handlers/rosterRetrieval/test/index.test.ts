import 'aws-sdk-client-mock-jest';
import { rosterRetrievalRequestEvent } from '../../../../test/utils/eventGenerator';
import * as helpers from '../../../layers/util/src/helpers';
import * as rosterRetrievalUtil from '../../../layers/util/src/rosterRetrieval';
import { handler } from '../src/index';

import {
  DynamoDBJwks,
  DynamoDBPlatformConfig,
  PlatformConfigRecord,
} from '@enable-lti/util';

/* eslint-disable camelcase */
describe('rosterRetrievalLambdaTest', () => {
  const iss = 'iss';
  const client_id = 'cid';
  const deployment_id = 'did';
  const context_memberships_url = 'url';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Check for submit request call with expected params', async () => {
    const requestBody = {
      issuer: iss,
      client_id: client_id,
      deployment_id: deployment_id,
      context_memberships_url: context_memberships_url,
    };
    const event = rosterRetrievalRequestEvent(JSON.stringify(requestBody));
    const setParamsSpy = jest
      .spyOn(helpers, 'setParamsFromTokenOrRequestCombined')
      .mockResolvedValue();
    const platformConfigLookupSpy = jest
      .spyOn(DynamoDBPlatformConfig.prototype, 'load')
      .mockResolvedValue({
        iss: 'Dummy',
      } as PlatformConfigRecord);
    const submitRequestToLmsSpy = jest.spyOn(
      rosterRetrievalUtil,
      'submitRosterRequestToLms'
    );
    await handler(event);
    expect(setParamsSpy).toHaveBeenCalledTimes(1);
    expect(platformConfigLookupSpy).toHaveBeenCalledTimes(1);
    expect(submitRequestToLmsSpy).toHaveBeenCalledTimes(1);
  });
});
