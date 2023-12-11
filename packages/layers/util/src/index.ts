import { Handler } from 'aws-lambda';

export * from './aws';
export * from './customErrors';
export * from './helpers';
export * from './jwks';
export * from './jwt';
export * from './lmsParams';
export * from './ltiAuth';
export * from './ltiDeepLinking';
export * from './ltiMessage';
export * from './models/scoreSubmissionModels';
export * from './platformConfig';
export * from './powertools';
export * from './rosterRetrieval';
export * from './scoreSubmission';
export * from './state';
export * from './successResponse';
export * from './toolConfig';
export * from './tryCatchWrapper';

export type SyncHandler<T extends Handler> = (
  event: Parameters<T>[0],
  context: Parameters<T>[1],
  callback: Parameters<T>[2]
) => void;

export type AsyncHandler<T extends Handler> = (
  event: Parameters<T>[0],
  context: Parameters<T>[1]
) => Promise<NonNullable<Parameters<Parameters<T>[2]>[1]>>;

export interface LambdaInterface {
  handler: SyncHandler<Handler> | AsyncHandler<Handler>;
}

export type HandlerMethodDecorator = (
  target: LambdaInterface,
  propertyKey: string | symbol,
  descriptor:
    | TypedPropertyDescriptor<SyncHandler<Handler>>
    | TypedPropertyDescriptor<AsyncHandler<Handler>>
) => void;
