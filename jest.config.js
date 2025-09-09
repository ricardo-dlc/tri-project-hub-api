module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  testTimeout: 10000, // 10 second timeout per test
  maxWorkers: '50%', // Limit CPU usage
  forceExit: true, // Force exit after tests complete
  detectOpenHandles: true // Help identify hanging handles
};
