import { Platform } from 'react-native';

// Development: the Android emulator reaches the host machine at 10.0.2.2 (plain HTTP is
// allowed in debug builds only). Release builds MUST point at the HTTPS production API;
// set it here (or inject it at build time) before publishing.
const DEV_API =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api/v1'
    : 'http://localhost:3000/api/v1';
const PROD_API = 'https://api.studyspace.example/api/v1';

export const API_BASE_URL = __DEV__ ? DEV_API : PROD_API;

// Google OAuth *Web* client id (public, not a secret). The backend lists the same id in
// GOOGLE_CLIENT_IDS. See docs/GOOGLE_SIGNIN_SETUP.md.
export const GOOGLE_WEB_CLIENT_ID =
  '596700134846-9jtprv8pko2jp4geps79qgdk2tb26rdi.apps.googleusercontent.com';
