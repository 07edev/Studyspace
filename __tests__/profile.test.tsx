/**
 * @format
 */

import React from 'react';
import { Modal, Switch, Text, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import StudySpaceApp from '../src/app/StudySpaceApp';
import { WelcomeScreen } from '../src/features/welcome/WelcomeScreen';
import { createApiClient } from '../src/shared/api/client';
import { SessionManager } from '../src/shared/auth/sessionManager';
import { createMemoryTokenStorage } from '../src/shared/auth/tokenStorage';
import { Button } from '../src/shared/ui/Button';

const baseUser = {
  id: 'u1',
  email: 'an@example.test',
  role: 'USER',
  status: 'ACTIVE',
  emailVerified: true,
  authProviders: ['PASSWORD'],
  profile: { displayName: 'An', bio: 'Xin chào', hometown: 'Huế' },
  createdAt: '2026-01-01T00:00:00.000Z',
};
const fresh = (n: number) => ({
  accessToken: `access-${n}`,
  tokenType: 'Bearer',
  expiresInSeconds: 900,
  refreshToken: `refresh-${n}`,
});
const ok = (data: unknown, status = 200) =>
  ({
    status,
    ok: true,
    json: async () => ({ success: true, data, requestId: 'r' }),
    headers: { get: () => null },
  } as unknown as Response);
const noContent = () => ({ status: 204, ok: true, headers: { get: () => null } } as unknown as Response);
const failure = (status: number, code: string, message: string, details: unknown[] = []) =>
  ({
    status,
    ok: false,
    json: async () => ({ success: false, error: { code, message, details }, requestId: 'r' }),
    headers: { get: () => null },
  } as unknown as Response);

type Call = { method: string; path: string; body: any };
type Handler = (call: Call) => Response | Promise<Response>;

// A signed-in app (stored refresh token) whose fake server answers by "METHOD /path".
function makeApp(routes: Record<string, Handler>, user: object = baseUser) {
  const calls: Call[] = [];
  const all: Record<string, Handler> = {
    'POST /auth/token/refresh': () => ok(fresh(2)),
    'GET /auth/me': () => ok(user),
    'GET /users/me': () => ok(user),
    ...routes,
  };
  const fetcher = jest.fn(async (url: string, init: RequestInit) => {
    const call: Call = {
      method: init.method ?? 'GET',
      path: url.replace('https://api.test', ''),
      body: init.body ? JSON.parse(init.body as string) : undefined,
    };
    calls.push(call);
    const handler = all[`${call.method} ${call.path}`];
    if (!handler) {
      throw new Error(`unexpected request ${call.method} ${call.path}`);
    }
    return handler(call);
  });
  const storage = createMemoryTokenStorage('refresh-1');
  const session = new SessionManager(
    createApiClient({ baseUrl: 'https://api.test', fetcher: fetcher as never }),
    storage,
  );
  return { session, storage, calls };
}

let tree: ReactTestRenderer.ReactTestRenderer;
const act = ReactTestRenderer.act;
const mount = async (session: SessionManager) => {
  await act(async () => {
    tree = ReactTestRenderer.create(<StudySpaceApp session={session} />);
  });
};
const textOf = (node: ReactTestRenderer.ReactTestInstance) =>
  node
    .findAllByType(Text)
    .map(t => [t.props.children].flat().join(''))
    .join(' ');
const everything = () => JSON.stringify(tree.toJSON());
const modalOpen = () => tree.root.findAllByType(Modal).length === 1;
const button = (title: string) => {
  const matches = tree.root.findAllByType(Button).filter(b => b.props.title === title);
  return matches[matches.length - 1];
};
const press = async (title: string) => {
  const target = button(title);
  if (!target) {
    throw new Error(`no button "${title}"`);
  }
  await act(async () => {
    await target.props.onPress();
  });
};
const pressRow = async (label: string) => {
  const rows = tree.root.findAll(
    n =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityRole === 'button' &&
      textOf(n).includes(label),
  );
  const target = rows[rows.length - 1];
  if (!target) {
    throw new Error(`no row "${label}"`);
  }
  await act(async () => {
    await target.props.onPress();
  });
};
const type = async (label: string, value: string) => {
  const input = tree.root.findAllByType(TextInput).find(i => i.props.accessibilityLabel === label);
  if (!input) {
    throw new Error(`no field "${label}"`);
  }
  await act(async () => {
    input.props.onChangeText(value);
  });
};
const toggle = async (label: string, value: boolean) => {
  const sw = tree.root.findAllByType(Switch).find(s => s.props.accessibilityLabel === label);
  if (!sw) {
    throw new Error(`no switch "${label}"`);
  }
  await act(async () => {
    await sw.props.onValueChange(value);
  });
};
const switchValue = (label: string) =>
  tree.root.findAllByType(Switch).find(s => s.props.accessibilityLabel === label)?.props.value;
const openProfileTab = async () => {
  const tab = tree.root.find(
    n => n.props.route?.name === 'Profile' && typeof n.props.onPress === 'function',
  );
  await act(async () => {
    tab.props.onPress();
  });
};
const openSettings = async () => {
  await openProfileTab();
  await pressRow('Cài đặt');
};

afterEach(async () => {
  await act(async () => tree.unmount());
});

describe('Cá nhân tab (USR-35)', () => {
  test('shows the account and refreshes it from the server', async () => {
    const { session, calls } = makeApp({
      'GET /users/me': () => ok({ ...baseUser, profile: { displayName: 'An Nguyễn', bio: 'Mới cập nhật' } }),
    });
    await mount(session);
    await openProfileTab();
    expect(calls.some(c => c.method === 'GET' && c.path === '/users/me')).toBe(true);
    expect(everything()).toContain('An Nguyễn');
    expect(everything()).toContain('Mới cập nhật');
    expect(button('Chỉnh sửa hồ sơ')).toBeDefined();
  });

  test('a failed refresh keeps the cached profile on screen', async () => {
    const { session } = makeApp({ 'GET /users/me': () => failure(500, 'INTERNAL_ERROR', 'Lỗi hệ thống.') });
    await mount(session);
    await openProfileTab();
    expect(everything()).toContain('An');
    expect(session.getState().status).toBe('authenticated');
  });
});

describe('edit profile (U46)', () => {
  const openEdit = async () => {
    await openProfileTab();
    await press('Chỉnh sửa hồ sơ');
  };

  test('sends only the changed fields and updates the cached user', async () => {
    const { session, calls } = makeApp({
      'PATCH /users/me/profile': ({ body }) =>
        ok({ ...baseUser, profile: { ...baseUser.profile, ...body } }),
    });
    await mount(session);
    await openEdit();
    await type('Tên hiển thị', '  An Nguyễn ');
    await type('Quê quán', 'Đà Nẵng');
    await press('Lưu hồ sơ');
    const patch = calls.find(c => c.method === 'PATCH');
    expect(patch?.path).toBe('/users/me/profile');
    expect(patch?.body).toEqual({ displayName: 'An Nguyễn', hometown: 'Đà Nẵng' });
    expect(session.getState().user?.profile.displayName).toBe('An Nguyễn');
    expect(modalOpen()).toBe(false);
  });

  test('an emptied optional field is cleared with null', async () => {
    const { session, calls } = makeApp({
      'PATCH /users/me/profile': ({ body }) => ok({ ...baseUser, profile: { displayName: 'An', ...body } }),
    });
    await mount(session);
    await openEdit();
    await type('Giới thiệu bản thân', '   ');
    await press('Lưu hồ sơ');
    expect(calls.find(c => c.method === 'PATCH')?.body).toEqual({ bio: null });
  });

  test('nothing is sent when nothing changed', async () => {
    const { session, calls } = makeApp({});
    await mount(session);
    await openEdit();
    await press('Lưu hồ sơ');
    expect(calls.some(c => c.method === 'PATCH')).toBe(false);
    expect(modalOpen()).toBe(false);
  });

  test('validates locally before calling the server', async () => {
    const { session, calls } = makeApp({});
    await mount(session);
    await openEdit();
    await type('Tên hiển thị', 'A');
    await type('Ngày sinh', '2999-01-01');
    await press('Lưu hồ sơ');
    expect(everything()).toContain('Tên hiển thị cần tối thiểu 2 ký tự.');
    expect(everything()).toContain('Ngày sinh không được lớn hơn hôm nay.');
    await type('Ngày sinh', '17/05/2003');
    await press('Lưu hồ sơ');
    expect(everything()).toContain('Nhập ngày sinh theo định dạng YYYY-MM-DD');
    expect(calls.some(c => c.method === 'PATCH')).toBe(false);
    expect(modalOpen()).toBe(true);
  });

  test('shows the server message beside the field and keeps the form open', async () => {
    const { session } = makeApp({
      'PATCH /users/me/profile': () =>
        failure(422, 'VALIDATION_ERROR', 'Dữ liệu chưa hợp lệ.', [
          { field: 'bio', rule: 'maxLength', message: 'Tối đa 500 ký tự.' },
        ]),
    });
    await mount(session);
    await openEdit();
    await type('Giới thiệu bản thân', 'Học thật vui');
    await press('Lưu hồ sơ');
    expect(everything()).toContain('Tối đa 500 ký tự.');
    expect(modalOpen()).toBe(true);
    expect(session.getState().user?.profile.bio).toBe('Xin chào');
  });

  test('asks before discarding unsaved changes', async () => {
    const { session } = makeApp({});
    await mount(session);
    await openEdit();
    await type('Quê quán', 'Hà Nội');
    await act(async () => {
      tree.root.findByProps({ testID: 'modal-close' }).props.onPress();
    });
    expect(everything()).toContain('Rời khỏi form?');
  });
});

describe('change email (U46 → U47)', () => {
  const challenge = {
    challengeId: 'c'.repeat(24),
    deliveryChannel: 'EMAIL',
    maskedDestination: 'm***@example.test',
    expiresAt: '2026-11-10T10:05:00.000Z',
  };
  const startChange = async () => {
    await openProfileTab();
    await press('Chỉnh sửa hồ sơ');
    await type('Email mới', 'moi@example.test');
    await press('Gửi mã xác minh');
  };

  test('request → code → the new email replaces the old one', async () => {
    const { session, calls } = makeApp({
      'POST /auth/contact/change-request': () => ok(challenge, 202),
      'POST /auth/contact/change-confirm': () => ok({ ...baseUser, email: 'moi@example.test' }),
    });
    await mount(session);
    await startChange();
    expect(calls.find(c => c.path === '/auth/contact/change-request')?.body).toEqual({
      channel: 'EMAIL',
      newValue: 'moi@example.test',
    });
    expect(everything()).toContain('m***@example.test');
    await type('Mã xác minh', '12ab');
    await press('Xác nhận');
    expect(calls.some(c => c.path === '/auth/contact/change-confirm')).toBe(false); // 6 digits needed
    await type('Mã xác minh', '123456');
    await press('Xác nhận');
    expect(calls.find(c => c.path === '/auth/contact/change-confirm')?.body).toEqual({
      challengeId: challenge.challengeId,
      otp: '123456',
    });
    expect(session.getState().user?.email).toBe('moi@example.test');
    expect(modalOpen()).toBe(false);
  });

  test('a wrong code keeps the dialog open with the server message', async () => {
    const { session } = makeApp({
      'POST /auth/contact/change-request': () => ok(challenge, 202),
      'POST /auth/contact/change-confirm': () => failure(422, 'OTP_INVALID', 'Mã xác minh không đúng.'),
    });
    await mount(session);
    await startChange();
    await type('Mã xác minh', '000000');
    await press('Xác nhận');
    expect(everything()).toContain('Mã xác minh không đúng.');
    expect(session.getState().user?.email).toBe('an@example.test');
  });

  test('rejects an invalid or unchanged email without calling the server', async () => {
    const { session, calls } = makeApp({});
    await mount(session);
    await openProfileTab();
    await press('Chỉnh sửa hồ sơ');
    await type('Email mới', 'khong-hop-le');
    await press('Gửi mã xác minh');
    expect(everything()).toContain('Email không hợp lệ.');
    await type('Email mới', 'AN@example.test');
    await press('Gửi mã xác minh');
    expect(everything()).toContain('Đây đang là email của bạn.');
    expect(calls.some(c => c.path === '/auth/contact/change-request')).toBe(false);
  });
});

describe('settings (U48)', () => {
  test('lists the account actions; opening the sheet signs nobody out', async () => {
    const { session, calls } = makeApp({});
    await mount(session);
    await openSettings();
    expect(everything()).toContain('Quyền riêng tư');
    expect(everything()).toContain('Cài đặt thông báo');
    expect(everything()).toContain('Đổi mật khẩu');
    expect(calls.some(c => c.path === '/auth/logout')).toBe(false);
    expect(session.getState().status).toBe('authenticated');
  });

  test('hides "Đổi mật khẩu" for accounts without a password', async () => {
    const { session } = makeApp({}, { ...baseUser, authProviders: ['GOOGLE'] });
    await mount(session);
    await openSettings();
    expect(everything()).not.toContain('Đổi mật khẩu');
  });
});

describe('privacy (U50)', () => {
  const stored = { profileVisibility: 'PUBLIC', showUniversity: true, showMajor: true };

  test('loads the saved values and saves each toggle at once', async () => {
    const { session, calls } = makeApp({
      'GET /users/me/privacy': () => ok(stored),
      'PATCH /users/me/privacy': ({ body }) => ok({ ...stored, ...body }),
    });
    await mount(session);
    await openSettings();
    await pressRow('Quyền riêng tư');
    expect(switchValue('Hồ sơ công khai')).toBe(true);
    await toggle('Hồ sơ công khai', false);
    expect(calls.find(c => c.method === 'PATCH')?.body).toEqual({ profileVisibility: 'PRIVATE' });
    expect(switchValue('Hồ sơ công khai')).toBe(false);
    await toggle('Hiển thị ngành', false);
    expect(calls.filter(c => c.method === 'PATCH')[1].body).toEqual({ showMajor: false });
    expect(switchValue('Hiển thị ngành')).toBe(false);
  });

  test('puts the toggle back and explains when saving fails', async () => {
    const { session } = makeApp({
      'GET /users/me/privacy': () => ok(stored),
      'PATCH /users/me/privacy': () => failure(500, 'INTERNAL_ERROR', 'Lỗi hệ thống.'),
    });
    await mount(session);
    await openSettings();
    await pressRow('Quyền riêng tư');
    await toggle('Hiển thị trường', false);
    expect(switchValue('Hiển thị trường')).toBe(true);
    expect(everything()).toContain('Lỗi hệ thống.');
  });

  test('offers a retry when the settings cannot be loaded', async () => {
    let attempts = 0;
    const { session } = makeApp({
      'GET /users/me/privacy': () => (++attempts === 1 ? failure(500, 'INTERNAL_ERROR', 'Lỗi hệ thống.') : ok(stored)),
    });
    await mount(session);
    await openSettings();
    await pressRow('Quyền riêng tư');
    expect(everything()).toContain('Lỗi hệ thống.');
    await press('Thử lại');
    expect(switchValue('Hồ sơ công khai')).toBe(true);
  });
});

describe('notification settings (U51)', () => {
  test('saves a toggle with the exact field name', async () => {
    const stored = { postInteraction: true, moderation: true, adminMessage: true, system: true, pushEnabled: false };
    const { session, calls } = makeApp({
      'GET /users/me/notification-settings': () => ok(stored),
      'PATCH /users/me/notification-settings': ({ body }) => ok({ ...stored, ...body }),
    });
    await mount(session);
    await openSettings();
    await pressRow('Cài đặt thông báo');
    expect(switchValue('Thông báo đẩy')).toBe(false);
    await toggle('Thông báo đẩy', true);
    expect(calls.find(c => c.method === 'PATCH')?.body).toEqual({ pushEnabled: true });
    expect(switchValue('Thông báo đẩy')).toBe(true);
  });
});

describe('change password (U49)', () => {
  const fill = async (current: string, next: string, confirm: string) => {
    await type('Mật khẩu hiện tại', current);
    await type('Mật khẩu mới', next);
    await type('Nhập lại mật khẩu mới', confirm);
  };

  test('validates locally, then sends the three fields', async () => {
    const { session, calls } = makeApp({
      'POST /auth/password/change': () => ok({ message: 'Đã đổi mật khẩu.' }),
    });
    await mount(session);
    await openSettings();
    await pressRow('Đổi mật khẩu');
    await fill('Str0ngPassw0rd', 'yeu', 'khac');
    await press('Đổi mật khẩu');
    expect(everything()).toContain('Tối thiểu 10 ký tự');
    expect(everything()).toContain('Mật khẩu xác nhận không khớp.');
    await fill('Str0ngPassw0rd', 'Str0ngPassw0rd', 'Str0ngPassw0rd');
    await press('Đổi mật khẩu');
    expect(everything()).toContain('Mật khẩu mới cần khác mật khẩu hiện tại.');
    expect(calls.some(c => c.path === '/auth/password/change')).toBe(false);
    await fill('Str0ngPassw0rd', 'An0therStrongPass', 'An0therStrongPass');
    await press('Đổi mật khẩu');
    expect(calls.find(c => c.path === '/auth/password/change')?.body).toEqual({
      currentPassword: 'Str0ngPassw0rd',
      newPassword: 'An0therStrongPass',
      confirmPassword: 'An0therStrongPass',
    });
    expect(modalOpen()).toBe(false);
    expect(session.getState().status).toBe('authenticated');
  });

  test('a wrong current password is shown beside that field', async () => {
    const { session } = makeApp({
      'POST /auth/password/change': () =>
        failure(401, 'INVALID_CREDENTIALS', 'Mật khẩu hiện tại không đúng.', [
          { field: 'currentPassword', rule: 'invalid', message: 'Mật khẩu hiện tại không đúng.' },
        ]),
    });
    await mount(session);
    await openSettings();
    await pressRow('Đổi mật khẩu');
    await fill('SaiMatKhau123', 'An0therStrongPass', 'An0therStrongPass');
    await press('Đổi mật khẩu');
    expect(everything()).toContain('Mật khẩu hiện tại không đúng.');
    expect(modalOpen()).toBe(true);
    // A 401 that is not an expired session must not sign the user out.
    expect(session.getState().status).toBe('authenticated');
  });
});

describe('sign out (U52)', () => {
  test('asks first, then signs out and returns to Welcome', async () => {
    const { session, storage, calls } = makeApp({ 'POST /auth/logout': () => noContent() });
    await mount(session);
    await openSettings();
    await press('Đăng xuất');
    expect(calls.some(c => c.path === '/auth/logout')).toBe(false);
    await press('Ở lại');
    expect(session.getState().status).toBe('authenticated');
    await openSettings();
    await press('Đăng xuất');
    await press('Đăng xuất');
    expect(calls.some(c => c.path === '/auth/logout')).toBe(true);
    expect(storage.peek()).toBeNull();
    expect(session.getState().status).toBe('guest');
    expect(tree.root.findAllByType(WelcomeScreen)).toHaveLength(1);
  });
});

describe('delete account (U53)', () => {
  const open = async () => {
    await openSettings();
    await press('Xóa tài khoản');
  };

  test('needs confirmation and the password before anything is sent', async () => {
    const { session, calls } = makeApp({});
    await mount(session);
    await open();
    await press('Gửi yêu cầu xóa tài khoản');
    expect(everything()).toContain('Bạn cần xác nhận để tiếp tục.');
    expect(everything()).toContain('Vui lòng nhập mật khẩu để xác thực.');
    expect(calls.some(c => c.path === '/auth/account/deletion-requests')).toBe(false);
  });

  test('success is acknowledged and the session ends', async () => {
    const { session, storage, calls } = makeApp({
      'POST /auth/account/deletion-requests': () => ok({ message: 'Đã tiếp nhận yêu cầu xóa tài khoản.' }, 202),
      'POST /auth/logout': () => noContent(),
    });
    await mount(session);
    await open();
    await toggle('Tôi hiểu và muốn xóa tài khoản', true);
    await type('Mật khẩu', 'Str0ngPassw0rd');
    await type('Lý do (không bắt buộc)', ' Không dùng nữa ');
    await press('Gửi yêu cầu xóa tài khoản');
    expect(calls.find(c => c.path === '/auth/account/deletion-requests')?.body).toEqual({
      confirm: true,
      password: 'Str0ngPassw0rd',
      reason: 'Không dùng nữa',
    });
    expect(everything()).toContain('Đã tiếp nhận yêu cầu');
    expect(storage.peek()).toBeNull();
    expect(session.getState().status).toBe('guest');
  });

  test('a wrong password keeps the account signed in', async () => {
    const { session } = makeApp({
      'POST /auth/account/deletion-requests': () =>
        failure(403, 'REAUTH_REQUIRED', 'Vui lòng xác thực lại để tiếp tục.'),
    });
    await mount(session);
    await open();
    await toggle('Tôi hiểu và muốn xóa tài khoản', true);
    await type('Mật khẩu', 'SaiMatKhau123');
    await press('Gửi yêu cầu xóa tài khoản');
    expect(everything()).toContain('Vui lòng xác thực lại để tiếp tục.');
    expect(session.getState().status).toBe('authenticated');
  });

  test('a Google-only account is told to sign in again, and sees no password field', async () => {
    const { session } = makeApp(
      {
        'POST /auth/account/deletion-requests': () =>
          failure(403, 'REAUTH_REQUIRED', 'Vui lòng xác thực lại để tiếp tục.'),
      },
      { ...baseUser, authProviders: ['GOOGLE'] },
    );
    await mount(session);
    await open();
    expect(tree.root.findAllByType(TextInput).some(i => i.props.accessibilityLabel === 'Mật khẩu')).toBe(false);
    await toggle('Tôi hiểu và muốn xóa tài khoản', true);
    await press('Gửi yêu cầu xóa tài khoản');
    expect(everything()).toContain('đăng nhập lại bằng Google');
  });
});
