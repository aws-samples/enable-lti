import { Logger } from '@aws-lambda-powertools/logger';
import { LogLevel } from '@aws-lambda-powertools/logger/lib/types';
import { Metrics } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
  Callback,
  Context,
} from 'aws-lambda';
import { LambdaInterface } from './index';

export interface PowertoolsConfig {
  namespace: string;
  serviceName: string;
  logLevel: LogLevel;
}

export class Powertools {
  static readonly DEFAULT_CONFIG = {
    logLevel: (process.env.LOG_LEVEL as LogLevel) ?? 'INFO',
    serviceName: process.env.POWERTOOLS_SERVICE_NAME ?? 'service',
    namespace: process.env.POWERTOOLS_METRICS_NAMESPACE ?? 'default',
  };

  static getInstance(
    config: PowertoolsConfig = Powertools.DEFAULT_CONFIG
  ): Powertools {
    if (!this.instance) {
      this.instance = new this(config);
    }
    return this.instance;
  }

  private static instance: Powertools;
  readonly metrics: Metrics;
  readonly logger: Logger;
  readonly tracer: Tracer;

  private constructor(config: PowertoolsConfig = Powertools.DEFAULT_CONFIG) {
    this.metrics = new Metrics({
      namespace: config.namespace,
      serviceName: config.serviceName,
    });
    this.logger = new Logger({
      logLevel: config.logLevel,
      serviceName: config.serviceName,
    });
    this.tracer = new Tracer({ serviceName: config.serviceName });
  }
}

export const handlerWithPowertools = (
  handler: APIGatewayProxyHandler | LambdaInterface,
  powertools: Powertools = Powertools.getInstance()
): APIGatewayProxyHandler => {
  return (
    event: APIGatewayProxyEvent,
    context: Context,
    callback: Callback<APIGatewayProxyResult>
  ): void | Promise<APIGatewayProxyResult> => {
    const tracer = powertools.tracer;
    const logger = powertools.logger;
    const metrics = powertools.metrics;
    const segment = tracer.getSegment();
    if (segment === undefined) {
      throw Error('Undefined segment');
    }
    const handlerSegment = segment.addNewSubsegment(
      `## ${process.env._HANDLER}`
    );
    tracer.setSegment(handlerSegment);
    tracer.annotateColdStart();
    tracer.addServiceNameAnnotation();
    metrics.captureColdStartMetric();
    try {
      if ('handler' in handler) {
        return handler.handler(event, context, callback);
      } else {
        return handler(event, context, callback);
      }
    } catch (e) {
      const error = e as Error;
      logger.error(`${error.name} - ${error.message}`);
      throw e;
    } finally {
      handlerSegment.close();
      tracer.setSegment(segment);
    }
  };
};

export function injectPowertools(
  powertools: Powertools = Powertools.getInstance()
) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const originalMethod = descriptor.value!;
    descriptor.value = function (
      this: LambdaInterface,
      event: APIGatewayProxyEvent,
      context: Context,
      callback: Callback<APIGatewayProxyResult>
    ): void | Promise<APIGatewayProxyResult> {
      return handlerWithPowertools(originalMethod.bind(this), powertools)(
        event,
        context,
        callback
      );
    };
  };
}
