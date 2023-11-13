import {
  DynamoDBPlatformConfigRecord,
  PlatformConfigRecord,
  toolConfigData,
  toolConfigRecord,
  toolOIDCConfig,
} from '@enable-lti/util';

export const CLIENT_ID = 'integ-test-client-id';
export const CLIENT_ID_WITH_FORCE_LOGOUT = 'integ-test-client-id-force-logout';
export const ISS = 'https://lms-integ-test.com';
export const DEPLOYMENT_ID = 'integ-deployment-id';
export const ACCESS_TOKEN_URL =
  'https://lms-integ-test.com/api/lti/access-token';
export const AUTH_TOKEN_URL =
  'https://lms-integ-test.com/api/lti/authorize_redirect';
export const COURSE_ID = '85';
export const AUTH_LOGIN_URL = 'https://lms-integ-test.com/api/lti/authorize';
export const TOOL_OIDC_DOMAIN = 'https://integ-tool-oidc.domain.com';
export const USER_EMAIL = 'integ@tester.com';
export const TOOL_OIDC_CLIENT_ID = 'integ_oidc_client_id';
export const IDP_NAME = 'IntegIDPName';
export const TOOL_BASE_URL = 'https://integ-tool.test.com';
export const TOOL_DEEPLINK_URL1 = `${TOOL_BASE_URL}/sa/lab/123`;
export const TOOL_DEEPLINK_URL2 = `${TOOL_BASE_URL}/sa/lab/456`;
export const LINE_ITEM_URL = `${ISS}/api/lti/courses/820/line_items/116`;
export const NAMES_AND_ROLES_URL = `${ISS}/api/lti/courses/820/names_and_roles`;

export const platformConfig = (
  keySetUrl: string,
  clientId = CLIENT_ID,
  ltiDeploymentId?: string
): PlatformConfigRecord => {
  return new DynamoDBPlatformConfigRecord(
    clientId,
    ISS,
    AUTH_LOGIN_URL,
    AUTH_TOKEN_URL,
    ACCESS_TOKEN_URL,
    keySetUrl,
    ltiDeploymentId
  );
};

export const integToolConfig = (id: string): toolConfigRecord => {
  return {
    id,
    issuer: ISS,
    url: TOOL_BASE_URL,
    data: {
      OIDC: {
        clientId: TOOL_OIDC_CLIENT_ID,
        domain: TOOL_OIDC_DOMAIN,
        idpName: IDP_NAME,
      } as toolOIDCConfig,
      LTIResourceLinks: [
        {
          title: 'Integration deep link test 123',
          url: TOOL_DEEPLINK_URL1,
        },
        {
          title: 'Integration deep link test 456',
          url: TOOL_DEEPLINK_URL2,
        },
      ],
    } as toolConfigData,
    features: [],
  };
};

export const integToolConfigWithForceLogoutFeature = (
  id: string
): toolConfigRecord => {
  const toolConfig = integToolConfig(id);
  toolConfig.features = [{ name: 'ForceLogout', enabled: true }];
  return toolConfig;
};

export const jwtBodyForDeepLinking = (nonce: string) => {
  return {
    'https://purl.imsglobal.org/spec/lti/claim/message_type':
      'LtiDeepLinkingRequest',
    'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
    'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings': {
      deep_link_return_url:
        'https://educatetest.instructure.com/courses/813/deep_linking_response',
      accept_types: ['ltiResourceLink'],
      accept_presentation_document_targets: ['iframe', 'window'],
      accept_media_types: 'application/vnd.ims.lti.v1.ltilink',
      auto_create: false,
      accept_multiple: true,
      validation_context: null,
      errors: {
        errors: {},
      },
    },
    aud: CLIENT_ID,
    azp: CLIENT_ID,
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id': DEPLOYMENT_ID,
    exp: Date.now() + 60 * 60 * 1000,
    iat: Date.now(),
    iss: ISS,
    nonce,
    sub: '4ddb60e2-a5c4-40c3-8378-0adb666928f1',
    'https://purl.imsglobal.org/spec/lti/claim/target_link_uri': TOOL_BASE_URL,
    'https://purl.imsglobal.org/spec/lti/claim/context': {
      id: '250b95bbd8d7910f8129cc827865c54d9fb95250',
      label: 'EH',
      title: 'EH Deeplink ELTI Library',
      type: ['http://purl.imsglobal.org/vocab/lis/v2/course#CourseOffering'],
      validation_context: null,
      errors: {
        errors: {},
      },
    },
    'https://purl.imsglobal.org/spec/lti/claim/tool_platform': {
      guid: 'AOpOS8uH12pBdXrXcJ23u92lCuMtNwhdpsaAHBeB:canvas-lms',
      name: 'AWS Educate',
      version: 'cloud',
      product_family_code: 'canvas',
      validation_context: null,
      errors: {
        errors: {},
      },
    },
    'https://purl.imsglobal.org/spec/lti/claim/launch_presentation': {
      document_target: 'iframe',
      return_url:
        'https://educatetest.instructure.com/courses/813/external_content/success/external_tool_dialog',
      locale: 'en',
      validation_context: null,
      errors: {
        errors: {},
      },
      height: 400,
      width: 800,
    },
    locale: 'en',
    'https://purl.imsglobal.org/spec/lti/claim/roles': [
      'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator',
      'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Instructor',
      'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
      'http://purl.imsglobal.org/vocab/lis/v2/system/person#User',
    ],
    'https://purl.imsglobal.org/spec/lti/claim/custom': {},
    'https://purl.imsglobal.org/spec/lti/claim/lti11_legacy_user_id':
      'b0be1d1d0a2f64749cc50020c0493674dcf6b49c',
    'https://purl.imsglobal.org/spec/lti/claim/lti1p1': {
      user_id: 'b0be1d1d0a2f64749cc50020c0493674dcf6b49c',
      validation_context: null,
      errors: {
        errors: {},
      },
    },
    errors: {
      errors: {},
    },
    email: USER_EMAIL,
    name: USER_EMAIL,
    given_name: USER_EMAIL,
    family_name: '',
    'https://purl.imsglobal.org/spec/lti/claim/lis': {
      person_sourcedid: null,
      course_offering_sourcedid: null,
      validation_context: null,
      errors: {
        errors: {},
      },
    },
    'https://www.instructure.com/placement': 'link_selection',
  };
};

export const jwtBodyForLaunch = (nonce: string, clientId = CLIENT_ID) => {
  return {
    'https://purl.imsglobal.org/spec/lti/claim/message_type':
      'LtiResourceLinkRequest',
    'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
    'https://purl.imsglobal.org/spec/lti/claim/resource_link': {
      id: '55da1204-03ee-46d5-8076-8ae74b5b1292',
      description: null,
      title: 'Amazon ElastiCache with Windows Server',
      validation_context: null,
      errors: {
        errors: {},
      },
    },
    aud: clientId,
    azp: clientId,
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id': DEPLOYMENT_ID,
    exp: Date.now() + 60 * 60 * 1000,
    iat: Date.now(),
    iss: ISS,
    nonce,
    sub: '4ddb60e2-a5c4-40c3-8378-0adb666928f1',
    'https://purl.imsglobal.org/spec/lti/claim/target_link_uri':
      TOOL_DEEPLINK_URL1,
    'https://purl.imsglobal.org/spec/lti/claim/context': {
      id: '67a335ea4a30e0a7afcf2a10041d185445cdb130',
      label: 'EH',
      title: 'EH ELTI Demo',
      type: ['http://purl.imsglobal.org/vocab/lis/v2/course#CourseOffering'],
      validation_context: null,
      errors: {
        errors: {},
      },
    },
    'https://purl.imsglobal.org/spec/lti/claim/tool_platform': {
      guid: 'AOpOS8uH12pBdXrXcJ23u92lCuMtNwhdpsaAHBeB:canvas-lms',
      name: 'AWS Educate',
      version: 'cloud',
      product_family_code: 'canvas',
      validation_context: null,
      errors: {
        errors: {},
      },
    },
    'https://purl.imsglobal.org/spec/lti/claim/launch_presentation': {
      document_target: 'iframe',
      return_url: 'https://educatetest.instructure.com/courses/816/modules',
      locale: 'en',
      validation_context: null,
      errors: {
        errors: {},
      },
    },
    locale: 'en',
    'https://purl.imsglobal.org/spec/lti/claim/roles': [
      'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator',
      'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Instructor',
      'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
      'http://purl.imsglobal.org/vocab/lis/v2/system/person#User',
    ],
    'https://purl.imsglobal.org/spec/lti/claim/custom': {},
    'https://purl.imsglobal.org/spec/lti/claim/lti11_legacy_user_id':
      'b0be1d1d0a2f64749cc50020c0493674dcf6b49c',
    'https://purl.imsglobal.org/spec/lti/claim/lti1p1': {
      user_id: 'b0be1d1d0a2f64749cc50020c0493674dcf6b49c',
      validation_context: null,
      errors: {
        errors: {},
      },
    },
    errors: {
      errors: {},
    },
    picture: '',
    email: USER_EMAIL,
    name: USER_EMAIL,
    given_name: USER_EMAIL,
    family_name: '',
    'https://purl.imsglobal.org/spec/lti/claim/lis': {
      person_sourcedid: null,
      course_offering_sourcedid: null,
      validation_context: null,
      errors: {
        errors: {},
      },
    },
    'https://www.instructure.com/placement': null,
  };
};

export const jwtBodyForScoreSubmission = () => {
  return {
    at_hash: 'e6tEIp2YmAD10v4d7q3sXg',
    sub: '0a59538d-c06b-4869-8385-e78ede51aa47',
    'custom:LMS:ClientId': CLIENT_ID,
    'custom:LMS:DeploymentId': DEPLOYMENT_ID,
    iss: ISS,
    acl_email_allowed: 'true',
    vibe_user_id: 'a9a7f65a-e872-40b6-9e77-ea39043d4148',
    'custom:LMS:Issuer': ISS,
    identities: [
      {
        userId: '3898ba10-1eca-4558-a722-a3a48308a456',
        providerName: 'CCTPLMS',
        providerType: 'OIDC',
        issuer: null,
        primary: 'true',
        dateCreated: '1673283674394',
      },
    ],
    'custom:LMS:Endpoint': `{"errors":{"errors":{}},"lineitem":"${LINE_ITEM_URL}","lineitems":"https://educatetest.instructure.com/api/lti/courses/820/line_items","scope":["https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly","https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly","https://purl.imsglobal.org/spec/lti-ags/scope/lineitem","https://purl.imsglobal.org/spec/lti-ags/scope/score","https://canvas.instructure.com/lti-ags/progress/scope/show"],"validation_context":null}`,
    auth_time: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    jti: 'b69b663f-f219-4b32-85b7-284f664c7b7e',
    email: 'test@amazon.com',
    email_verified: false,
    'cognito:username': 'Something',
    public_provider_name: 'CCTPLMS',
    given_name: 'Given',
    nonce:
      'd-1nIhkTjQiPdZMZLoaKdK5Qz-V6AZ1-Lv7wEi1Pcl-DOa2A398rz8VYKDdatX0u267ovubl-FVvDRjZV_pjkVBsIoWM41MOhvVCoZLSQC9D16RKTO91EIFh_dN58FHxejfBP1WS-hT07kLV-Ed4PmmNRKRr9NLYr_-ZGAN9XSE',
    origin_jti: '93997ddb-165c-4042-be91-9832b51e8ca4',
    aud: CLIENT_ID,
    token_use: 'id',
    name: 'Some Name',
    hat_id: 'f57223eb-18d4-4219-b5fd-f6bee804fdc1',
    family_name: 'Student',
  };
};

export const jwtBodyForRosterRetrieval = () => {
  return {
    at_hash: 'e6tEIp2YmAD10v4d7q3sXg',
    sub: '0a59538d-c06b-4869-8385-e78ede51aa47',
    'custom:LMS:ClientId': CLIENT_ID,
    'custom:LMS:DeploymentId': DEPLOYMENT_ID,
    iss: ISS,
    acl_email_allowed: 'true',
    vibe_user_id: 'a9a7f65a-e872-40b6-9e77-ea39043d4148',
    'custom:LMS:Issuer': ISS,
    identities: [
      {
        userId: '3898ba10-1eca-4558-a722-a3a48308a456',
        providerName: 'CCTPLMS',
        providerType: 'OIDC',
        issuer: null,
        primary: 'true',
        dateCreated: '1673283674394',
      },
    ],
    'custom:LMS:CustomClaims': `{"course_id": "${COURSE_ID}"}`,
    'custom:LMS:NamesRoleService': `{"context_memberships_url": "${NAMES_AND_ROLES_URL}", "service_versions": ["2.0"]}`,
    auth_time: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    jti: 'b69b663f-f219-4b32-85b7-284f664c7b7e',
    email: 'test@amazon.com',
    email_verified: false,
    'cognito:username': 'Something',
    public_provider_name: 'CCTPLMS',
    given_name: 'Given',
    nonce:
      'd-1nIhkTjQiPdZMZLoaKdK5Qz-V6AZ1-Lv7wEi1Pcl-DOa2A398rz8VYKDdatX0u267ovubl-FVvDRjZV_pjkVBsIoWM41MOhvVCoZLSQC9D16RKTO91EIFh_dN58FHxejfBP1WS-hT07kLV-Ed4PmmNRKRr9NLYr_-ZGAN9XSE',
    origin_jti: '93997ddb-165c-4042-be91-9832b51e8ca4',
    aud: CLIENT_ID,
    token_use: 'id',
    name: 'Some Name',
    hat_id: 'f57223eb-18d4-4219-b5fd-f6bee804fdc1',
    family_name: 'Student',
  };
};
