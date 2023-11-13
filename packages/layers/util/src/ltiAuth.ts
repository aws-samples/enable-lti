import { errorResponse } from '@enable-lti/util';
import { MetricUnits } from '@aws-lambda-powertools/metrics';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import * as jose from 'jose';
import {
  HandlerMethodDecorator,
  Jwks,
  LTIJwtPayload,
  LambdaInterface,
  LtiToolConfig,
  LtiToolConfigRecord,
  PlatformConfig,
  State,
  StateRecord,
  requestBearerClientCredential,
  requiredTruthyValueFromRequest,
  requiredValueFromRequest,
  valueFromRequest,
} from './index';
import { PlatformConfigRecord } from './platformConfig';
import { Powertools } from './powertools';

const OIDC_LOGIN_FAILURE = 'OidcLoginFailure';
const LAUNCH_AUTH_FAILURE = 'LaunchAuthFailure';

const LOGIN_END_POINT = 'login';
const LAUNCH_END_POINT = 'launch';

export type LtiLoginOidcOptions = {
  powertools?: Powertools;
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

  public async login(
    options: LtiLoginOidcHandlerOptions,
    event: APIGatewayProxyEvent,
    context?: Context
  ): Promise<APIGatewayProxyResult | undefined> {
    const powertools = this.powertools;
    const platform: PlatformConfig = options.platform;
    const state: State = options.state;
    const clientId = requiredValueFromRequest(event, 'client_id');
    const iss = requiredValueFromRequest(event, 'iss');
    const loginHint = requiredValueFromRequest(event, 'login_hint');
    const ltiDeploymentId = valueFromRequest(event, 'lti_deployment_id');
    const ltiMessageHint = valueFromRequest(event, 'lti_message_hint');
    powertools.metrics.addMetadata('client_id', clientId);
    powertools.metrics.addMetadata('iss', iss);
    powertools.metrics.addMetadata('lti_deployment_id', ltiDeploymentId);
    const platformConfig = await platform.load(
      clientId,
      iss,
      ltiDeploymentId,
      400
    );
    const stateRecord = await state.save(undefined);
    const domain = event.requestContext.domainName;
    const path = event.requestContext.path.replace(
      LOGIN_END_POINT,
      LAUNCH_END_POINT
    );
    if (!domain || !path) {
      return errorResponse({
        pt: powertools,
        err: new Error('domainName or path missing in event.requestContext'),
        statusCode: 400,
        metricString: 'FailedToGetDomainOrPath',
        businessMetric: OIDC_LOGIN_FAILURE,
      });
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
    const redirectUrl = new URL(platformConfig.authTokenUrl);
    for (const key in queryParams) {
      redirectUrl.searchParams.append(key, queryParams[key]);
    }
    powertools.logger.info(redirectUrl.toString());
    powertools.metrics.addMetric(OIDC_LOGIN_FAILURE, MetricUnits.Count, 0);
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
  }

  /**
   * Method decorator
   * @see https://www.typescriptlang.org/docs/handbook/decorators.html#method-decorators
   * @returns {HandlerMethodDecorator}
   */
  public loginHandler(
    options: LtiLoginOidcHandlerOptions
  ): HandlerMethodDecorator {
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
      descriptor.value = async function (
        this: LambdaInterface,
        event,
        context,
        callback
      ) {
        const preResult = await LtiLoginOidc.loginHandlerRun(
          ltiLoginOidcRef,
          event,
          context,
          options
        );
        const result =
          preResult ||
          (await originalMethod.apply(this, [event, context, callback]));
        return result;
      };
    };
  }

  public static async loginHandlerRun(
    ltiLoginOidc: LtiLoginOidc,
    event: APIGatewayProxyEvent,
    context: Context,
    options: LtiLoginOidcHandlerOptions
  ): Promise<APIGatewayProxyResult | undefined> {
    return ltiLoginOidc.login(options, event, context);
  }
}

export type LtiLaunchAuthEvent = {
  platformRecord: PlatformConfigRecord;
  stateRecord: StateRecord;
  toolRecord: LtiToolConfigRecord;
  payload: LTIJwtPayload;
  kid: string;
};

export type APIGatewayProxyEventWithLtiLaunchAuth = APIGatewayProxyEvent &
  LtiLaunchAuthEvent;

function isLtiLaunchAuthEvent(
  value: APIGatewayProxyResult | LtiLaunchAuthEvent
): value is LtiLaunchAuthEvent {
  return Object.prototype.hasOwnProperty.call(value, 'platformRecord');
}

export type LtiLaunchAuthOptions = {
  powertools?: Powertools;
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

  public async launchAuth(
    options: LtiLaunchAuthHandlerOptions,
    event: APIGatewayProxyEvent,
    context?: Context
  ): Promise<APIGatewayProxyResult | LtiLaunchAuthEvent> {
    const powertools = this.powertools;
    const platform: PlatformConfig = options.platform;
    const state: State = options.state;
    const tool = options.tool;
    const jwks = options.jwks;
    const kmsKeyId = options.kmsKeyId;
    const requestPostState: string = requiredValueFromRequest(event, 'state');
    const idToken: string = requiredTruthyValueFromRequest(event, 'id_token');
    let kids: jose.JSONWebKeySet | undefined = undefined;
    let kid: string | undefined = undefined;
    const ltiJwtPayload: LTIJwtPayload = await LTIJwtPayload.load(
      idToken,
      platform
    );
    const stateRecord: StateRecord = await state.load(
      requestPostState,
      ltiJwtPayload.nonce!
    );
    stateRecord!.id_token = idToken;
    const platformConfigRecord = ltiJwtPayload.platformConfigRecord;
    const toolConfig = await tool.load(
      platformConfigRecord.clientId,
      platformConfigRecord.iss
    );
    kids = await jwks.all();
    kid = kids.keys[0].kid;
    let accessToken: string | undefined = undefined;
    try {
      accessToken = requiredValueFromRequest(event, 'authenticity_token');
    } catch (error) {
      //For some non-canvas LMS platforms we have to make another call to get the access token
      accessToken = await requestBearerClientCredential(
        platformConfigRecord,
        kid!,
        kmsKeyId!
      );
    }
    stateRecord!.platform_lti_token = accessToken;
    await state.save(stateRecord);
    powertools.metrics.addMetric(LAUNCH_AUTH_FAILURE, MetricUnits.Count, 0);
    return {
      platformRecord: platformConfigRecord,
      stateRecord: stateRecord!,
      toolRecord: toolConfig,
      payload: ltiJwtPayload,
      kid: kid!,
    };
  }

  /**
   * Method decorator
   * @see https://www.typescriptlang.org/docs/handbook/decorators.html#method-decorators
   * @returns {HandlerMethodDecorator}
   */
  public launchAuthHandler(
    options: LtiLaunchAuthHandlerOptions
  ): HandlerMethodDecorator {
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
      descriptor.value = async function (
        this: LambdaInterface,
        event,
        context,
        callback
      ) {
        const preResult = await LtiLaunchAuth.launchAuthHandlerRun(
          ltiLaunchAuthRef,
          event,
          context,
          options
        );
        const result = isLtiLaunchAuthEvent(preResult)
          ? await originalMethod.apply(this, [
              { ...event, ...preResult },
              context,
              callback,
            ])
          : preResult;
        return result;
      };
    };
  }

  public static async launchAuthHandlerRun(
    ltiLaunchAuth: LtiLaunchAuth,
    event: APIGatewayProxyEvent,
    context: Context,
    options: LtiLaunchAuthHandlerOptions
  ): Promise<APIGatewayProxyResult | LtiLaunchAuthEvent> {
    return ltiLaunchAuth.launchAuth(options, event, context);
  }
}
