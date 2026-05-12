/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
    testPathIgnorePatterns: ['/node_modules/', '/src/__tests__/integration/'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
    },
};
