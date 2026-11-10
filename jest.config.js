module.exports = {
  preset: '@react-native/jest-preset',
  transform: {
    '^.+\\.(m?js|ts|tsx)$': 'babel-jest',
  },
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/backend/', '<rootDir>/web-admin/'],
  modulePathIgnorePatterns: ['<rootDir>/backend/', '<rootDir>/web-admin/'],
  setupFilesAfterEnv: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-safe-area-context|react-native-screens|react-native-svg|lucide-react-native)/)',
  ],
};
