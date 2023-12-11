import {
  DynamoDBJwks,
  PlatformConfigRecord,
  getKidFromJwk,
  requestBearerClientCredential,
  submitGetRequestToLms,
} from './index';

export async function submitRosterRequestToLms(
  platformConfigRecord: PlatformConfigRecord,
  contextMembershipsUrl: string,
  kmsKeyId: string,
  jwks: DynamoDBJwks
) {
  const kid = await getKidFromJwk(jwks);

  const accessToken = await requestBearerClientCredential(
    platformConfigRecord,
    kid!,
    kmsKeyId
  );

  const response = await submitGetRequestToLms(
    contextMembershipsUrl,
    accessToken
  );

  return response;
}
