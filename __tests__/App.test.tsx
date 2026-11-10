/**
 * @format
 */

import React from 'react';
import { Modal, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import StudySpaceApp from '../src/app/StudySpaceApp';
import { HomeScreen } from '../src/features/home/HomeScreen';
import { WelcomeScreen } from '../src/features/welcome/WelcomeScreen';
import { createApiClient } from '../src/shared/api/client';
import { SessionManager } from '../src/shared/auth/sessionManager';
import { createMemoryTokenStorage } from '../src/shared/auth/tokenStorage';
import { Button } from '../src/shared/ui/Button';

const user = {
  id: 'u1',
  email: 'an@example.test',
  role: 'USER',
  status: 'ACTIVE',
  emailVerified: true,
  authProviders: ['PASSWORD'],
  profile: { displayName: 'An' },
  createdAt: '2026-01-01T00:00:00.000Z',
};
const tokens = (n: number) => ({
  accessToken: `access-${n}`,
  tokenType: 'Bearer',
  expiresInSeconds: 900,
  refreshToken: `refresh-${n}`,
});
const ok = (data: unknown) =>
  ({
    status: 200,
    ok: true,
    json: async () => ({ success: true, data, requestId: 'r' }),
    headers: { get: () => null },
  } as unknown as Response);
const failure = (status: number, code: string, message: string, details: unknown[] = []) =>
  ({
    status,
    ok: false,
    json: async () => ({ success: false, error: { code, message, details }, requestId: 'r' }),
    headers: { get: () => null },
  } as unknown as Response);

type Handler = (body: any) => Response | Promise<Response>;
function makeApp(routes: Record<string, Handler>, storedToken: string | null = null) {
  const calls: { path: string; body: any }[] = [];
  const fetcher = jest.fn(async (url: string, init: RequestInit) => {
    const path = url.replace('https://api.test', '');
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ path, body });
    const handler = routes[path];
    if (!handler) {
      throw new Error(`unexpected request ${path}`);
    }
    return handler(body);
  });
  const storage = createMemoryTokenStorage(storedToken);
  const session = new SessionManager(
    createApiClient({ baseUrl: 'https://api.test', fetcher: fetcher as never }),
    storage,
  );
  return { session, storage, calls, fetcher };
}

let tree: ReactTestRenderer.ReactTestRenderer;
const mount = async (session: SessionManager) => {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<StudySpaceApp session={session} />);
  });
};
const button = (title: string) =>
  tree.root.findAllByType(Button).find(b => b.props.title === title);
const press = async (title: string) => {
  const target = button(title);
  if (!target) {
    throw new Error(`no button "${title}"`);
  }
  await ReactTestRenderer.act(async () => {
    await target.props.onPress();
  });
};
// The Welcome screen behind the modal also has a "Đăng nhập" button; the form's is the last one.
const pressLast = async (title: string) => {
  const matches = tree.root.findAllByType(Button).filter(b => b.props.title === title);
  const target = matches[matches.length - 1];
  if (!target) {
    throw new Error(`no button "${title}"`);
  }
  await ReactTestRenderer.act(async () => {
    await target.props.onPress();
  });
};
const type = async (label: string, value: string) => {
  const input = tree.root
    .findAllByType(TextInput)
    .find(i => i.props.accessibilityLabel === label);
  if (!input) {
    throw new Error(`no field "${label}"`);
  }
  await ReactTestRenderer.act(async () => {
    input.props.onChangeText(value);
  });
};
const texts = () =>
  JSON.stringify(tree.toJSON());
const modalOpen = () => tree.root.findAllByType(Modal).length === 1;

afterEach(async () => {
  await ReactTestRenderer.act(async () => tree.unmount());
});

describe('guest', () => {
  test('can browse, open sign in and switch to sign up inside one modal', async () => {
    const { session, calls } = makeApp({});
    await mount(session);
    expect(tree.root.findAllByType(WelcomeScreen)).toHaveLength(1);
    await press('Đăng nhập');
    expect(modalOpen()).toBe(true);
    await press('Chưa có tài khoản? Đăng ký');
    expect(tree.root.findAllByType(Modal)).toHaveLength(1);
    expect(texts()).toContain('Tạo tài khoản');
    expect(calls).toHaveLength(0);
  });

  test('"Bắt đầu khám phá" enters the app without any session or request', async () => {
    const { session, calls } = makeApp({});
    await mount(session);
    await press('Bắt đầu khám phá');
    expect(tree.root.findAllByType(HomeScreen)).toHaveLength(1);
    expect(session.getState().status).toBe('guest');
    expect(calls).toHaveLength(0);
  });
});

describe('login (U03)', () => {
  test('validates locally before calling the server', async () => {
    const { session, calls } = makeApp({});
    await mount(session);
    await press('Đăng nhập');
    await type('Email', 'not-an-email');
    await pressLast('Đăng nhập');
    expect(texts()).toContain('Email không hợp lệ.');
    expect(texts()).toContain('Vui lòng nhập mật khẩu.');
    expect(calls).toHaveLength(0);
  });

  test('success stores the session, closes the modal and opens the app', async () => {
    const { session, storage, calls } = makeApp({
      '/auth/login': () => ok({ user, tokens: tokens(1) }),
    });
    await mount(session);
    await press('Đăng nhập');
    await type('Email', ' an@example.test ');
    await type('Mật khẩu', 'Str0ngPassw0rd');
    await pressLast('Đăng nhập');
    expect(calls[0]).toEqual({
      path: '/auth/login',
      body: { email: 'an@example.test', password: 'Str0ngPassw0rd', client: 'MOBILE' },
    });
    expect(session.getState()).toMatchObject({ status: 'authenticated', user });
    expect(storage.peek()).toBe('refresh-1');
    expect(modalOpen()).toBe(false);
    expect(tree.root.findAllByType(HomeScreen)).toHaveLength(1);
  });

  test('shows the server message and keeps the modal open on wrong credentials', async () => {
    const { session, storage } = makeApp({
      '/auth/login': () => failure(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.'),
    });
    await mount(session);
    await press('Đăng nhập');
    await type('Email', 'an@example.test');
    await type('Mật khẩu', 'Wr0ngPasswordHere');
    await pressLast('Đăng nhập');
    expect(texts()).toContain('Email hoặc mật khẩu không đúng.');
    expect(modalOpen()).toBe(true);
    expect(session.getState().status).toBe('guest');
    expect(storage.peek()).toBeNull();
  });

  test('puts server field errors next to the right input', async () => {
    const { session } = makeApp({
      '/auth/login': () =>
        failure(422, 'VALIDATION_ERROR', 'Dữ liệu chưa hợp lệ.', [
          { field: 'email', rule: 'isEmail', message: 'Email không hợp lệ.' },
        ]),
    });
    await mount(session);
    await press('Đăng nhập');
    await type('Email', 'an@example.test');
    await type('Mật khẩu', 'x');
    await pressLast('Đăng nhập');
    const emailInput = tree.root
      .findAllByType(TextInput)
      .find(i => i.props.accessibilityLabel === 'Email');
    expect(emailInput?.props.style).toBeTruthy();
    expect(texts()).toContain('Email không hợp lệ.');
  });

  test('ignores a second tap while the first request is still running', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const { session, fetcher } = makeApp({
      '/auth/login': async () => {
        await gate;
        return ok({ user, tokens: tokens(1) });
      },
    });
    await mount(session);
    await press('Đăng nhập');
    await type('Email', 'an@example.test');
    await type('Mật khẩu', 'Str0ngPassw0rd');
    const submit = tree.root.findAllByType(Button).filter(b => b.props.title === 'Đăng nhập').pop()!;
    await ReactTestRenderer.act(async () => {
      submit.props.onPress();
      submit.props.onPress();
      release();
    });
    expect(fetcher.mock.calls.filter(c => String(c[0]).endsWith('/auth/login'))).toHaveLength(1);
  });

  test('offers email verification when the account is not verified yet', async () => {
    const { session } = makeApp({
      '/auth/login': () => failure(403, 'EMAIL_NOT_VERIFIED', 'Email chưa được xác minh.'),
    });
    await mount(session);
    await press('Đăng nhập');
    await type('Email', 'an@example.test');
    await type('Mật khẩu', 'Str0ngPassw0rd');
    await pressLast('Đăng nhập');
    expect(button('Xác minh email')).toBeTruthy();
    await press('Xác minh email');
    expect(texts()).toContain('an@example.test');
    expect(tree.root.findAllByType(Modal)).toHaveLength(1);
  });
});

describe('google sign-in (U03)', () => {
  const signIn = GoogleSignin.signIn as unknown as jest.Mock;
  beforeEach(() => signIn.mockReset());

  test('sends the Google idToken to the backend and opens the app', async () => {
    signIn.mockResolvedValue({ type: 'success', data: { idToken: 'g'.repeat(40) } });
    const { session, storage, calls } = makeApp({
      '/auth/google': () => ok({ user, tokens: tokens(7) }),
    });
    await mount(session);
    await press('Đăng nhập');
    await press('Tiếp tục với Google');
    expect(calls).toEqual([
      { path: '/auth/google', body: { idToken: 'g'.repeat(40), client: 'MOBILE' } },
    ]);
    expect(session.getState()).toMatchObject({ status: 'authenticated', user });
    expect(storage.peek()).toBe('refresh-7');
    expect(modalOpen()).toBe(false);
    expect(tree.root.findAllByType(HomeScreen)).toHaveLength(1);
  });

  test('closing the Google account picker changes nothing and shows no error', async () => {
    signIn.mockResolvedValue({ type: 'cancelled', data: null });
    const { session, calls } = makeApp({});
    await mount(session);
    await press('Đăng nhập');
    await press('Tiếp tục với Google');
    expect(calls).toHaveLength(0);
    expect(session.getState().status).toBe('guest');
    expect(modalOpen()).toBe(true);
    expect(texts()).not.toContain('Không đăng nhập được');
  });

  test('shows the server message when the account is suspended', async () => {
    signIn.mockResolvedValue({ type: 'success', data: { idToken: 'g'.repeat(40) } });
    const { session } = makeApp({
      '/auth/google': () =>
        failure(403, 'ACCOUNT_SUSPENDED', 'Tài khoản của bạn đang bị khóa.'),
    });
    await mount(session);
    await press('Đăng nhập');
    await press('Tiếp tục với Google');
    expect(texts()).toContain('Tài khoản của bạn đang bị khóa.');
    expect(session.getState().status).toBe('guest');
    expect(modalOpen()).toBe(true);
  });

  test('explains a Google failure in Vietnamese without calling the backend', async () => {
    signIn.mockRejectedValue(Object.assign(new Error('10'), { code: '10' }));
    const { session, calls } = makeApp({});
    await mount(session);
    await press('Đăng nhập');
    await press('Tiếp tục với Google');
    expect(calls).toHaveLength(0);
    expect(texts()).toContain('Không đăng nhập được bằng Google');
  });

  test('is also offered on the sign-up form', async () => {
    const { session } = makeApp({});
    await mount(session);
    await press('Đăng nhập');
    await press('Chưa có tài khoản? Đăng ký');
    expect(texts()).toContain('Tạo tài khoản');
    expect(button('Tiếp tục với Google')).toBeDefined();
  });
});

describe('register + verify (U01, U02)', () => {
  test('blocks weak or mismatched passwords locally', async () => {
    const { session, calls } = makeApp({});
    await mount(session);
    await press('Đăng nhập');
    await press('Chưa có tài khoản? Đăng ký');
    await type('Tên hiển thị', 'An');
    await type('Email', 'an@example.test');
    await type('Mật khẩu', 'weak');
    await type('Nhập lại mật khẩu', 'other');
    await press('Tạo tài khoản');
    expect(texts()).toContain('Tối thiểu 10 ký tự, gồm chữ hoa, chữ thường và chữ số.');
    expect(texts()).toContain('Mật khẩu xác nhận không khớp.');
    expect(calls).toHaveLength(0);
  });

  test('register -> OTP -> signed in', async () => {
    const { session, calls, storage } = makeApp({
      '/auth/register': () =>
        ok({ email: 'an@example.test', status: 'PENDING_VERIFICATION', otpExpiresAt: 'x' }),
      '/auth/email/verify': () => ok({ user, tokens: tokens(1) }),
    });
    await mount(session);
    await press('Đăng nhập');
    await press('Chưa có tài khoản? Đăng ký');
    await type('Tên hiển thị', ' An ');
    await type('Email', 'an@example.test');
    await type('Mật khẩu', 'Str0ngPassw0rd');
    await type('Nhập lại mật khẩu', 'Str0ngPassw0rd');
    await press('Tạo tài khoản');
    expect(calls[0].body).toMatchObject({ displayName: 'An', email: 'an@example.test' });
    expect(calls[0].body.phone).toBeUndefined();
    expect(texts()).toContain('Mã xác minh');

    await type('Mã xác minh', '12ab34');
    await press('Xác minh');
    expect(calls).toHaveLength(1); // 6 digits required, nothing sent yet
    await type('Mã xác minh', '123456');
    await press('Xác minh');
    expect(calls[1]).toEqual({ path: '/auth/email/verify', body: { email: 'an@example.test', otp: '123456' } });
    expect(session.getState().status).toBe('authenticated');
    expect(storage.peek()).toBe('refresh-1');
    expect(modalOpen()).toBe(false);
  });

  test('wrong code keeps the user on the OTP step with the message beside the field', async () => {
    const { session } = makeApp({
      '/auth/register': () => ok({ email: 'an@example.test', status: 'PENDING_VERIFICATION', otpExpiresAt: 'x' }),
      '/auth/email/verify': () =>
        failure(422, 'OTP_INVALID', 'Mã xác minh không đúng.', [
          { field: 'otp', rule: 'invalid', message: 'Mã xác minh không đúng.' },
        ]),
    });
    await mount(session);
    await press('Đăng nhập');
    await press('Chưa có tài khoản? Đăng ký');
    await type('Tên hiển thị', 'An');
    await type('Email', 'an@example.test');
    await type('Mật khẩu', 'Str0ngPassw0rd');
    await type('Nhập lại mật khẩu', 'Str0ngPassw0rd');
    await press('Tạo tài khoản');
    await type('Mã xác minh', '000000');
    await press('Xác minh');
    expect(texts()).toContain('Mã xác minh không đúng.');
    expect(session.getState().status).toBe('guest');
  });
});

describe('forgot password (U04)', () => {
  test('email -> code -> new password -> back to sign in', async () => {
    const { session, calls } = makeApp({
      '/auth/password/forgot': () => ok({ message: 'ok' }),
      '/auth/password/verify-otp': () => ok({ resetToken: 'r'.repeat(40), expiresInSeconds: 600 }),
      '/auth/password/reset': () => ok({ message: 'ok' }),
    });
    await mount(session);
    await press('Đăng nhập');
    await press('Quên mật khẩu?');
    await type('Email', 'an@example.test');
    await press('Gửi mã');
    await type('Mã xác minh', '123456');
    await press('Xác minh');
    await type('Mật khẩu mới', 'An0therStrongPass');
    await type('Nhập lại mật khẩu mới', 'An0therStrongPass');
    await press('Đặt lại mật khẩu');
    expect(calls.map(c => c.path)).toEqual([
      '/auth/password/forgot',
      '/auth/password/verify-otp',
      '/auth/password/reset',
    ]);
    expect(calls[2].body).toEqual({
      resetToken: 'r'.repeat(40),
      newPassword: 'An0therStrongPass',
      confirmPassword: 'An0therStrongPass',
    });
    // Back on the sign in form, not signed in.
    expect(button('Quên mật khẩu?')).toBeTruthy();
    expect(session.getState().status).toBe('guest');
  });
});

describe('session lifecycle', () => {
  test('a stored session reopens straight into the app (no Welcome screen)', async () => {
    const { session, calls } = makeApp(
      {
        '/auth/token/refresh': () => ok(tokens(2)),
        '/auth/me': () => ok(user),
      },
      'refresh-1',
    );
    await mount(session);
    expect(tree.root.findAllByType(WelcomeScreen)).toHaveLength(0);
    expect(tree.root.findAllByType(HomeScreen)).toHaveLength(1);
    expect(calls[0].body).toEqual({ refreshToken: 'refresh-1', client: 'MOBILE' });
  });

  test('an expired stored session starts as a guest and explains why', async () => {
    const { session, storage } = makeApp(
      { '/auth/token/refresh': () => failure(401, 'TOKEN_EXPIRED', 'Phiên đăng nhập đã hết hạn.') },
      'old-token',
    );
    await mount(session);
    expect(texts()).toContain('Phiên đăng nhập đã hết hạn');
    expect(button('Đăng nhập lại')).toBeTruthy();
    expect(storage.peek()).toBeNull();
  });

  test('a suspended account is told so and gets no sign-in shortcut', async () => {
    const { session } = makeApp({ '/auth/me': () => failure(403, 'ACCOUNT_SUSPENDED', 'Tài khoản đang bị khóa.') });
    await mount(session);
    await ReactTestRenderer.act(async () => {
      await session.startSession({ user: user as never, tokens: tokens(1) as never });
    });
    await ReactTestRenderer.act(async () => {
      await session.request('/auth/me').catch(() => undefined);
    });
    expect(texts()).toContain('Tài khoản đang bị khóa');
    expect(button('Đăng nhập lại')).toBeUndefined();
  });

  test('signing out returns to Welcome and clears the stored token', async () => {
    const { session, storage } = makeApp({
      '/auth/login': () => ok({ user, tokens: tokens(1) }),
      '/auth/logout': () => ({ status: 204, ok: true, headers: { get: () => null } } as unknown as Response),
    });
    await mount(session);
    await press('Đăng nhập');
    await type('Email', 'an@example.test');
    await type('Mật khẩu', 'Str0ngPassw0rd');
    await pressLast('Đăng nhập');
    expect(storage.peek()).toBe('refresh-1');
    await ReactTestRenderer.act(async () => {
      await session.logout();
    });
    expect(storage.peek()).toBeNull();
    expect(session.getState().status).toBe('guest');
    expect(tree.root.findAllByType(WelcomeScreen)).toHaveLength(1);
  });
});
