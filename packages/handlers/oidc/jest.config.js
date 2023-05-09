"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = {
    verbose: true,
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    testMatch: ['**/*.test.ts'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest'
    },
    setupFiles: ['<rootDir>/test/env.js']
};
exports.default = config;
//# sourceMappingURL=jest.config.js.map