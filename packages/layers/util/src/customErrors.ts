import { Powertools } from './powertools';
import { MetricUnits } from '@aws-lambda-powertools/metrics';

export class InvalidValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidValueError';
  }
}

export class RecordNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecordNotFoundError';
  }
}

export class StoreAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreAccessError';
  }
}

export class SessionNotFound extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionNotFound';
  }
}

export const errorResponse = (
  pt: Powertools,
  err: Error,
  statusCode: 500 | 400 | 401,
  metricString: string,
  businessMetric?: string
) => {
  pt.logger.error('Error:', err);
  pt.metrics.addMetric(metricString, MetricUnits.Count, 1);
  if (businessMetric) {
    pt.metrics.addMetric(businessMetric, MetricUnits.Count, 1);
  }
  return {
    statusCode,
    body: JSON.stringify({
      error: err.message,
    }),
  };
};
