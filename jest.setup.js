jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native-screens', () =>
  jest.requireActual('react-native-screens/mock'),
);
/* eslint-env jest */

