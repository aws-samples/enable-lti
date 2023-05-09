import type { Config } from 'jest';

const config: Config = {
    verbose: true,
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    testMatch: ['**/*.test.ts'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest'
    },
    setupFiles: ['<rootDir>/test/env.js']
};

export default config;