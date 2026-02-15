// @ts-check

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  setupFiles: ['./jest.setup.js'],
  testMatch: [
    '<rootDir>/tests/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/lib/**/*.js',
    'src/services/**/*.js',
    '!src/manifest.json',
    '!src/_locales/**',
    '!src/icons/**'
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80
    }
  },
  coverageDirectory: 'coverage',
  moduleFileExtensions: ['js', 'json']
};
