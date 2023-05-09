import * as jose from 'jose';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import {
  CONFIG_ISSUE,
  INTERNAL_ERROR,
  Jwks,
  JWT_VALIDATION_FAILURE,
  LambdaInterface,
  LTIJwtPayload,
  LtiToolConfig,
  LtiToolConfigRecord,
  PlatformConfig,
  requestBearerClientCredential,
  REQUEST_ERROR,
  requiredValueFromRequest,
  SESSION_NOT_FOUND,
  LAUNCH_AUTH_FAILURE,
  State,
  StateRecord,
  valueFromRequest,
  requiredTruthyValueFromRequest,
  HandlerMethodDecorator,
} from './index';
import { Powertools } from './powertools';
import { MetricUnits } from '@aws-lambda-powertools/metrics';
import { PlatformConfigRecord } from './platformConfig';
import { errorResponse } from '@enable-lti/util';

const LOGIN_END_POINT = 'login';
const LAUNCH_END_POINT = 'launch';

export type LtiLoginOidcOptions = {
  powertools?: Powertools
};

export type LtiLoginOidcHandlerOptions = {
  platform: PlatformConfig;
  state: State;
};

export class LtiLoginOidc {
  private powertools: Powertools;

  /**
   * It initializes the LtiLoginOidc class with set of options (settings).
   * *
   * @param {LoginOidcHandlerOptions} options
   */
  public constructor(options?: LtiLoginOidcOptions) {
    this.setOptions(options);
  }

  /**
   * It configures the LtiLoginOidc instance settings that will affect the LtiLoginOidc's behaviour
   *
   * @private
   * @param {LtiLoginOidcOptions} options
   * @returns {LtiLoginOidc}
   */
  private setOptions(options?: LtiLoginOidcOptions): LtiLoginOidc {
    this.powertools = options?.powertools || Powertools.getInstance();
    return this;
  }

  public async login(options: LtiLoginOidcHandlerOptions, event: APIGatewayProxyEvent, context?: Context): Promise<APIGatewayProxyResult | undefined> {
    const powertools = this.powertools!;
    try {
      let platform: PlatformConfig = options.platform;
      let state: State = options.state;
      let clientId: string | undefined = undefined;
      let iss: string | undefined = undefined;
      let loginHint: string | undefined = undefined;
      let ltiDeploymentId: string | undefined = undefined;
      let ltiMessageHint: string | undefined = undefined;
      let platformConfig: PlatformConfigRecord | undefined = undefined;
      let stateRecord: StateRecord | undefined = undefined;
      try {
        clientId = requiredValueFromRequest(event, 'client_id');
        iss = requiredValueFromRequest(event, 'iss');
        loginHint = requiredValueFromRequest(event, 'login_hint');
        ltiDeploymentId = valueFromRequest(event, 'lti_deployment_id');
        ltiMessageHint = valueFromRequest(event, 'lti_message_hint');
      } catch (e) {
        return errorResponse(powertools!, e as Error, 400, REQUEST_ERROR);
      }
      powertools.metrics.addMetadata('client_id', clientId!);
      powertools.metrics.addMetadata('iss', iss!);
      powertools.metrics.addMetadata('lti_deployment_id', ltiDeploymentId!);
      try {
        platformConfig = await platform.load(
          clientId!,
          iss!,
          ltiDeploymentId
        );
      } catch (e) {
        return errorResponse(powertools, e as Error, 400, CONFIG_ISSUE);
      }
      try {
        stateRecord = await state.save(undefined);
      } catch (e) {
        return errorResponse(powertools, e as Error, 500, INTERNAL_ERROR);
      }
      const domain = event.requestContext.domainName;
      const path = event.requestContext.path.replace(
        LOGIN_END_POINT,
        LAUNCH_END_POINT
      );
      if (!domain || !path) {
        return errorResponse(
          powertools,
          new Error('domainName or path missing in event.requestContext'),
          500,
          INTERNAL_ERROR
        );
      }
      const queryParams: Record<string, any> = {
        /* eslint-disable */
        scope: 'openid',
        response_type: 'id_token',
        response_mode: 'form_post',
        prompt: 'none',
        client_id: clientId,
        redirect_uri: `https://${domain}${path}`,
        state: stateRecord.id,
        nonce: stateRecord.nonce,
        login_hint: loginHint,
        /* eslint-enable */
      };
      if (ltiMessageHint !== undefined) {
        /* eslint-disable-next-line camelcase */
        queryParams.lti_message_hint = ltiMessageHint;
      }
      const redirectUrl = new URL(platformConfig!.authTokenUrl);
      for (const key in queryParams) {
        redirectUrl.searchParams.append(key, queryParams[key]);
      }
      powertools.logger.info(redirectUrl.toString());
      powertools.metrics.addMetric('Success', MetricUnits.Count, 1);
      return {
        statusCode: 302,
        body: '',
        multiValueHeaders: {
          'Set-Cookie': [
            `state=${stateRecord.id}; SameSite=None; Secure; HttpOnly`,
          ],
        },
        headers: {
          Location: redirectUrl.toString(),
        },
      };
    } finally {
      powertools.metrics.publishStoredMetrics();
    }
  }

  /**
   * Method decorator
   * @see https://www.typescriptlang.org/docs/handbook/decorators.html#method-decorators
   * @returns {HandlerMethodDecorator}
   */
  public loginHandler(options: LtiLoginOidcHandlerOptions): HandlerMethodDecorator {
    return (_target, _propertyKey, descriptor) => {
      /**
       * The descriptor.value is the method this decorator decorates, it cannot be undefined.
       */
      /* eslint-disable  @typescript-eslint/no-non-null-assertion */
      const originalMethod = descriptor.value!;

      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const ltiLoginOidcRef = this;
      // Use a function() {} instead of an () => {} arrow function so that we can
      // access `myClass` as `this` in a decorated `myClass.myMethod()`.
      descriptor.value = (async function (this: LambdaInterface, event, context, callback) {

        LtiLoginOidc.loginHandlerBefore(ltiLoginOidcRef, event, context, options);

        let preResult: APIGatewayProxyResult | undefined;
        let result: unknown;
        try {
          preResult = await LtiLoginOidc.loginHandlerRun(ltiLoginOidcRef, event, context, options);
          result = preResult || await originalMethod.apply(this, [event, context, callback]);
        } catch (error) {
          throw error;
        } finally {
          LtiLoginOidc.loginHandlerAfterOrOnError(ltiLoginOidcRef, options);
        }

        return result;
      });
    };
  }

  public static loginHandlerBefore(ltiLoginOidc: LtiLoginOidc, event: APIGatewayProxyEvent, context: Context, options: LtiLoginOidcHandlerOptions): void {
    // PLACEHOLDER: Before
  }

  public static async loginHandlerRun(ltiLoginOidc: LtiLoginOidc, event: APIGatewayProxyEvent, context: Context, options: LtiLoginOidcHandlerOptions): Promise<APIGatewayProxyResult | undefined> {
    return ltiLoginOidc.login(options, event, context);
  }

  public static loginHandlerAfterOrOnError(ltiLoginOidc: LtiLoginOidc, options: LtiLoginOidcHandlerOptions): void {
    // PLACEHOLDER: AfterOrOnError
  }
}

export type LtiLaunchAuthEvent = {
  platformRecord: PlatformConfigRecord;
  stateRecord: StateRecord;
  toolRecord: LtiToolConfigRecord;
  payload: LTIJwtPayload;
  kid: string;
}

export type APIGatewayProxyEventWithLtiLaunchAuth = APIGatewayProxyEvent & LtiLaunchAuthEvent;

function isLtiLaunchAuthEvent(value: APIGatewayProxyResult | LtiLaunchAuthEvent): value is LtiLaunchAuthEvent {
  return value.hasOwnProperty('platformRecord');
}

export type LtiLaunchAuthOptions = {
  powertools?: Powertools
};

export type LtiLaunchAuthHandlerOptions = {
  platform: PlatformConfig;
  state: State;
  tool: LtiToolConfig;
  jwks: Jwks;
  kmsKeyId: string;
};

export class LtiLaunchAuth {
  private powertools: Powertools;

  /**
   * It initializes the LtiLaunchAuth class with set of options (settings).
   * *
   * @param {LtiLaunchAuthOptions} options
   */
  public constructor(options?: LtiLaunchAuthOptions) {
    this.setOptions(options);
  }

  /**
   * It configures the LtiLaunchAuth instance settings that will affect the LtiLaunchAuth's behaviour
   *
   * @private
   * @param {LtiLaunchAuthOptions} options
   * @returns {LtiLaunchAuth}
   */
  private setOptions(options?: LtiLaunchAuthOptions): LtiLaunchAuth {
    this.powertools = options?.powertools || Powertools.getInstance();
    return this;
  }

  public async launchAuth(options: LtiLaunchAuthHandlerOptions, event: APIGatewayProxyEvent, context?: Context): Promise<APIGatewayProxyResult | LtiLaunchAuthEvent> {
    const powertools = this.powertools!;
    const platform: PlatformConfig = options.platform;
    const state: State = options.state;
    const tool = options.tool;
    const jwks = options.jwks;
    const kmsKeyId = options.kmsKeyId;
    try {
      let requestPostState: string | undefined = undefined;
      let idToken: string | undefined = undefined;
      let ltiJwtPayload: LTIJwtPayload | undefined = undefined;
      let stateRecord: StateRecord | undefined = undefined;
      let toolConfig: LtiToolConfigRecord | undefined = undefined;
      let kids: jose.JSONWebKeySet | undefined = undefined;
      let kid: string | undefined = undefined;
      try {
        requestPostState = requiredValueFromRequest(event, 'state');
        idToken = requiredTruthyValueFromRequest(event, 'id_token');
      } catch (e) {
        return errorResponse(
          powertools,
          e as Error,
          400,
          REQUEST_ERROR,
          LAUNCH_AUTH_FAILURE
        );
      }
      try {
        ltiJwtPayload = await LTIJwtPayload.load(idToken!, platform);
      } catch (e) {
        return errorResponse(
          powertools,
          e as Error,
          401,
          JWT_VALIDATION_FAILURE,
          LAUNCH_AUTH_FAILURE
        );
      }
      try {
        stateRecord = await state.load(
          requestPostState!,
          ltiJwtPayload.nonce
        );
      } catch (e) {
        return errorResponse(
          powertools,
          e as Error,
          401,
          SESSION_NOT_FOUND,
          LAUNCH_AUTH_FAILURE
        );
      }
      /* eslint-disable-next-line camelcase */
      stateRecord!.id_token = idToken;
      const platformConfigRecord = ltiJwtPayload.platformConfigRecord;
      try {
        toolConfig = await tool.load(
          platformConfigRecord.clientId,
          platformConfigRecord.iss
        );
      } catch (e) {
        return errorResponse(powertools, e as Error, 500, CONFIG_ISSUE);
      }
      //TODO: must change how we store and retrieve keys
      try {
        kids = await jwks.all();
        kid = kids.keys[0].kid;
      } catch (e) {
        return errorResponse(powertools, e as Error, 500, INTERNAL_ERROR);
      }
      let accessToken: string | undefined = undefined;
      try {
        accessToken = requiredValueFromRequest(event, 'authenticity_token');
      } catch (error) {
        //For blackboard LMS we have to make another call to get the access token
        //down the road we should check issuer url and use switch cases
        try {
          accessToken = await requestBearerClientCredential(
            platformConfigRecord,
            kid!,
            kmsKeyId!,
            powertools
          );
        } catch (e) {
          return errorResponse(
            powertools,
            e as Error,
            500,
            INTERNAL_ERROR,
            LAUNCH_AUTH_FAILURE
          );
        }
      }
      // eslint-disable-next-line camelcase
      stateRecord!.platform_lti_token = accessToken;
      await state.save(stateRecord);
      return {
        platformRecord: platformConfigRecord,
        stateRecord: stateRecord!,
        toolRecord: toolConfig,
        payload: ltiJwtPayload,
        kid: kid!,
      };
    } finally {
      powertools.metrics.publishStoredMetrics();
    }
  }

  /**
   * Method decorator
   * @see https://www.typescriptlang.org/docs/handbook/decorators.html#method-decorators
   * @returns {HandlerMethodDecorator}
   */
  public launchAuthHandler(options: LtiLaunchAuthHandlerOptions): HandlerMethodDecorator {
    return (_target, _propertyKey, descriptor) => {
      /**
       * The descriptor.value is the method this decorator decorates, it cannot be undefined.
       */
      /* eslint-disable  @typescript-eslint/no-non-null-assertion */
      const originalMethod = descriptor.value!;

      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const ltiLaunchAuthRef = this;
      // Use a function() {} instead of an () => {} arrow function so that we can
      // access `myClass` as `this` in a decorated `myClass.myMethod()`.
      descriptor.value = (async function (this: LambdaInterface, event, context, callback) {

        LtiLaunchAuth.launchAuthHandlerBefore(ltiLaunchAuthRef, event, context, options);

        let preResult: APIGatewayProxyResult | LtiLaunchAuthEvent;
        let result: unknown;
        try {
          preResult = await LtiLaunchAuth.launchAuthHandlerRun(ltiLaunchAuthRef, event, context, options);
          result = isLtiLaunchAuthEvent(preResult) ? await originalMethod.apply(this, [{ ...event, ...preResult }, context, callback]) : preResult;
        } catch (error) {
          throw error;
        } finally {
          LtiLaunchAuth.launchAuthHandlerAfterOrOnError(ltiLaunchAuthRef, options);
        }

        return result;
      });
    };
  }

  public static launchAuthHandlerBefore(ltiLaunchAuth: LtiLaunchAuth, event: APIGatewayProxyEvent, context: Context, options: LtiLaunchAuthHandlerOptions): void {
    // PLACEHOLDER: Before
  }

  public static async launchAuthHandlerRun(ltiLaunchAuth: LtiLaunchAuth, event: APIGatewayProxyEvent, context: Context, options: LtiLaunchAuthHandlerOptions): Promise<APIGatewayProxyResult | LtiLaunchAuthEvent> {
    return ltiLaunchAuth.launchAuth(options, event, context);
  }

  public static launchAuthHandlerAfterOrOnError(ltiLaunchAuth: LtiLaunchAuth, options: LtiLaunchAuthHandlerOptions): void {
    // PLACEHOLDER: AfterOrOnError
  }
}
