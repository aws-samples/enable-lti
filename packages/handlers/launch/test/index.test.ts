import { handler } from '../src/index';
import { Context } from 'aws-lambda';
import { mockLaunchRequest } from './payloads/learn';

describe('launch', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.resetModules(); // Most important - it clears the cache
        process.env = { ...OLD_ENV }; // Make a copy
    });

    afterAll(() => {
        process.env = OLD_ENV; // Restore old environment
    });

    test('Can launch', async () => {
        // Set the variables
        process.env.CONTROL_PLANE_TABLE_NAME = '';
        process.env.DATA_PLANE_TABLE_NAME = '';
        process.env.CONTROL_PLANE_TABLE_NAME = '';
        process.env.CONTROL_PLANE_TABLE_NAME = '';
        process.env.KMS_KEY_ID = 'test-key';

        await handler(mockLaunchRequest as any, {} as Context, (error, result) => {/* do nothing */});
    });
});

