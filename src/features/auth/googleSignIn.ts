import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { ApiError } from '../../shared/api/client';
import { GOOGLE_WEB_CLIENT_ID } from '../../shared/config';

let configured = false;
const ensureConfigured = () => {
  if (!configured) {
    // The backend checks the idToken against this Web client id (its `audience`).
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    configured = true;
  }
};

const fail = (code: string, message: string) => new ApiError(code, message);

/**
 * Opens the Google account picker and returns the idToken to send to POST /auth/google.
 * Returns `null` when the user simply closed the picker (nothing to report).
 */
export async function requestGoogleIdToken(): Promise<string | null> {
  ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Forget the previous Google account so the picker always lets the user choose.
    await GoogleSignin.signOut().catch(() => undefined);
    const result = await GoogleSignin.signIn();
    if (result.type !== 'success') {
      return null;
    }
    if (!result.data.idToken) {
      throw fail('GOOGLE_NO_TOKEN', 'Google không trả về thông tin đăng nhập. Vui lòng thử lại.');
    }
    return result.data.idToken;
  } catch (caught) {
    if (caught instanceof ApiError) {
      throw caught;
    }
    const code = (caught as { code?: string })?.code;
    if (code === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }
    if (code === statusCodes.IN_PROGRESS) {
      return null;
    }
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw fail(
        'GOOGLE_PLAY_SERVICES',
        'Thiết bị chưa có Google Play Services nên không thể đăng nhập bằng Google.',
      );
    }
    throw fail('GOOGLE_SIGNIN_FAILED', 'Không đăng nhập được bằng Google. Vui lòng thử lại.');
  }
}
