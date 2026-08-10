module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/libraries/nestjs-libraries/src/database/prisma/pipelines/**/*.spec.ts',
    '<rootDir>/libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.spec.ts',
    '<rootDir>/libraries/nestjs-libraries/src/integrations/social/file.provider.spec.ts',
    '<rootDir>/apps/orchestrator/src/workflows/pipeline-workflows/**/*.spec.ts',
    '<rootDir>/apps/frontend/src/components/pipelines/**/*.spec.ts',
  ],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.base.json',
        isolatedModules: true,
      },
    ],
  },
  moduleNameMapper: {
    '^@gitroom/nestjs-libraries/(.*)$':
      '<rootDir>/libraries/nestjs-libraries/src/$1',
    '^@gitroom/orchestrator/(.*)$': '<rootDir>/apps/orchestrator/src/$1',
    '^@gitroom/helpers/(.*)$': '<rootDir>/libraries/helpers/src/$1',
  },
};
