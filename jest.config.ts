import type { Config } from 'jest';

export default async (): Promise<Config> => {
  return {
    verbose: true,
    testEnvironment: 'node',
    testMatch: ['**/*.test.ts'],
    transform: {
      '^.+\\.tsx?$': 'ts-jest',
    },
    testTimeout: 15000,
    coverageReporters: ['json', 'lcov', 'text', 'clover', 'cobertura'],
  };
};
