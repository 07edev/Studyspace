jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native-screens', () =>
  jest.requireActual('react-native-screens/mock'),
);
// Native secure storage does not exist under Jest; an in-memory stand-in keeps the same API.
jest.mock('react-native-keychain', () => {
  const store = new Map();
  return {
    ACCESSIBLE: {AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AccessibleAfterFirstUnlockThisDeviceOnly'},
    setGenericPassword: jest.fn(async (username, password, options = {}) => {
      store.set(options.service ?? 'default', {username, password});
      return {service: options.service, storage: 'mock'};
    }),
    getGenericPassword: jest.fn(async (options = {}) => {
      const found = store.get(options.service ?? 'default');
      return found ? {...found, service: options.service, storage: 'mock'} : false;
    }),
    resetGenericPassword: jest.fn(async (options = {}) => store.delete(options.service ?? 'default')),
  };
});
/* eslint-env jest */

