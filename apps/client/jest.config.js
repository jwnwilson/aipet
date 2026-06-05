/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/src/**/*.test.ts'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
    },
    moduleNameMapper: {
        '^@babylonjs/(.*)$': '<rootDir>/src/__mocks__/babylonjs.ts',
    },
};
