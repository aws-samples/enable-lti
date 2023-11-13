export const simpleLaunchProxyRequestEvent = () => {
  const request: object = {
    resource: '/launch',
    path: '/launch',
    httpMethod: 'POST',
    queryStringParameters: {
      state: 'test_state',
    },
    body: `utf8=%E2%9C%93&authenticity_token=test_auth_token&id_token=test_id_token&state='test_state'`,
  };
  return request;
};
