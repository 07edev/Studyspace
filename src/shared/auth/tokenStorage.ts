import * as Keychain from 'react-native-keychain';

// Only the refresh token is ever persisted. It lives in the Android Keystore / iOS Keychain,
// never in AsyncStorage. The access token stays in memory.
export type TokenStorage = {
  get(): Promise<string | null>;
  set(refreshToken: string): Promise<void>;
  clear(): Promise<void>;
};

const SERVICE = 'studyspace.refresh-token';

export const keychainTokenStorage: TokenStorage = {
  async get() {
    try {
      const found = await Keychain.getGenericPassword({ service: SERVICE });
      return found ? found.password : null;
    } catch {
      return null;
    }
  },
  async set(refreshToken) {
    await Keychain.setGenericPassword('refresh', refreshToken, {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  },
  async clear() {
    try {
      await Keychain.resetGenericPassword({ service: SERVICE });
    } catch {
      /* nothing stored */
    }
  },
};

export function createMemoryTokenStorage(initial: string | null = null) {
  let value = initial;
  const storage: TokenStorage & { peek: () => string | null } = {
    get: async () => value,
    set: async token => {
      value = token;
    },
    clear: async () => {
      value = null;
    },
    peek: () => value,
  };
  return storage;
}
