import { MetricUnits } from '@aws-lambda-powertools/metrics';
import {
  LtiCustomError,
  errorResponse,
  CustomErrorMetric,
} from './customErrors';
import { Powertools } from './powertools';
import { successResponse } from './successResponse';

export type TryCatchWrapperConfig = {
  defaultErrorMetric: CustomErrorMetric;
  powertools: Powertools;
  throwErrorResponse?: boolean;
};

export function tryCatchWrapper(config: TryCatchWrapperConfig) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        const response = await originalMethod.apply(this, args);
        if (response) {
          return successResponse(response);
        }
        return response;
      } catch (error) {
        if (error instanceof LtiCustomError) {
          return errorResponse({
            pt: config.powertools,
            err: error as Error,
            statusCode: error.statusCode,
            metricString: config.defaultErrorMetric,
            businessMetric: error.customMetric,
            throwError: config.throwErrorResponse,
          });
        } else {
          return errorResponse({
            pt: config.powertools,
            err: error as Error,
            statusCode: 500,
            metricString: config.defaultErrorMetric,
            throwError: config.throwErrorResponse,
          });
        }
      } finally {
        config.powertools.metrics.addMetric(
          config.defaultErrorMetric,
          MetricUnits.Count,
          0
        );
        config.powertools.metrics.publishStoredMetrics();
      }
    };

    return descriptor;
  };
}
