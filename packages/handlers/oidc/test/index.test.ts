import { handler } from '../src/index';
import { Context } from 'aws-lambda';

import { mockLoginRequest } from './payloads/learn';

describe('oidc',()=>{
    jest.setTimeout(30000);
    test('Can login', async () => {

        const value = await handler(mockLoginRequest as any, {} as Context, (error, result) => {/* do nothing */
        });
    });

});
