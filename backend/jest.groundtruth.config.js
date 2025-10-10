module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/tests/**/*.groundtruth.test.ts'],
  // Don't use setupFilesAfterEnv for ground truth tests - we want to use the real database
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
  ],
  testTimeout: 30000, // 30 second timeout for ground truth tests
};
