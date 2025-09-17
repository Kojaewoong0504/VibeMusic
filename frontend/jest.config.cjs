/**
 * Jest Configuration for VibeMusic Frontend
 *
 * TypeScript 및 React 컴포넌트 테스트를 위한 Jest 설정
 */

module.exports = {
  // 테스트 환경
  testEnvironment: 'jsdom',

  // 모듈 변환 설정
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        jsx: 'react-jsx'
      }
    }],
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }]
  },

  // 모듈 파일 확장자
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // 모듈 이름 매핑
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../shared/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': 'jest-transform-stub'
  },

  // 테스트 파일 패턴
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.(ts|tsx|js|jsx)',
    '<rootDir>/tests/unit/**/*.spec.(ts|tsx|js|jsx)',
    '<rootDir>/src/**/__tests__/**/*.(ts|tsx|js|jsx)',
    '<rootDir>/src/**/*.(test|spec).(ts|tsx|js|jsx)'
  ],

  // 테스트 무시 패턴
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/tests/e2e/',
    '<rootDir>/tests/visual/',
    '<rootDir>/dist/',
    '<rootDir>/build/'
  ],

  // 커버리지 설정
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/main.tsx',
    '!src/vite-env.d.ts'
  ],

  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // 설정 파일
  setupFilesAfterEnv: [
    '<rootDir>/tests/unit/setup.ts'
  ],

  // 모듈 디렉토리
  moduleDirectories: ['node_modules', '<rootDir>/src'],

  // ES 모듈 지원
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },

  // 변환 무시 패턴 (ES 모듈 라이브러리들을 변환하도록 설정)
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|@testing-library/.*|framer-motion|axios))'
  ],

  // 테스트 타임아웃
  testTimeout: 10000,

  // 자세한 출력
  verbose: true,

  // 캐시 디렉토리
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',

  // 에러 출력 제한
  errorOnDeprecated: true,

  // Watch 모드 설정
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/',
    '<rootDir>/coverage/'
  ]
};