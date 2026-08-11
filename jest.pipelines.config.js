module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/libraries/nestjs-libraries/src/database/prisma/pipelines/**/*.spec.ts',
    '<rootDir>/libraries/nestjs-libraries/src/database/prisma/context-documents/**/*.spec.ts',
    '<rootDir>/libraries/nestjs-libraries/src/chat/tools/pipeline.context-document.tools.spec.ts',
    '<rootDir>/libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.spec.ts',
    '<rootDir>/libraries/nestjs-libraries/src/integrations/social/file.provider.spec.ts',
    '<rootDir>/libraries/nestjs-libraries/src/imgflip/**/*.spec.ts',
    '<rootDir>/apps/orchestrator/src/workflows/pipeline-workflows/**/*.spec.ts',
    '<rootDir>/apps/frontend/src/components/pipelines/**/*.spec.ts',
    '<rootDir>/apps/frontend/src/components/new-launch/open-graph/**/*.spec.ts',
    '<rootDir>/apps/frontend/src/components/media/**/*.spec.tsx',
  ],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          jsx: 'react-jsx',
          esModuleInterop: true,
          isolatedModules: true,
          target: 'es2019',
          lib: ['es2020', 'dom'],
        },
      },
    ],
  },
  moduleNameMapper: {
    '^canvas$': '<rootDir>/jest.canvas.mock.js',
    '^@gitroom/nestjs-libraries/(.*)$':
      '<rootDir>/libraries/nestjs-libraries/src/$1',
    '^@gitroom/orchestrator/(.*)$': '<rootDir>/apps/orchestrator/src/$1',
    '^@gitroom/helpers/(.*)$': '<rootDir>/libraries/helpers/src/$1',
    '^@gitroom/react/(.*)$': '<rootDir>/libraries/react-shared-libraries/src/$1',
    '^@gitroom/frontend/(.*)$': '<rootDir>/apps/frontend/src/$1',
  },
};
