/**
 * @format
 */

import React from 'react';
import { Modal, Text, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import StudySpaceApp from '../src/app/StudySpaceApp';
import { features } from '../src/features/pending/features';
import { ModalCoordinator, useModal } from '../src/navigation/ModalCoordinator';
import { ModalHost } from '../src/navigation/ModalHost';
import { ApiError, createApiClient } from '../src/shared/api/client';
import { AuthGateProvider, useAuthGate, type GateRequest } from '../src/shared/auth/AuthGate';
import { AuthProvider } from '../src/shared/auth/AuthProvider';
import { SessionManager } from '../src/shared/auth/sessionManager';
import type { AuthSession } from '../src/shared/contracts/auth';
import { createMemoryTokenStorage } from '../src/shared/auth/tokenStorage';
import { Button } from '../src/shared/ui/Button';
import { ConfirmProvider, ToastProvider } from '../src/shared/ui';

const user = {
  id: 'u1',
  email: 'an@example.test',
  role: 'USER' as const,
  status: 'ACTIVE' as const,
  emailVerified: true,
  authProviders: ['PASSWORD'],
  profile: { displayName: 'An' },
  createdAt: '2026-01-01T00:00:00.000Z',
};
const authSession: AuthSession = {
  user,
  tokens: { accessToken: 'access-1', tokenType: 'Bearer', expiresInSeconds: 900, refreshToken: 'refresh-1' },
};
const ok = (data: unknown) =>
  ({ status: 200, ok: true, json: async () => ({ success: true, data, requestId: 'r' }), headers: { get: () => null } } as unknown as Response);

// A guest app (nothing stored) whose fake server answers by "METHOD /path".
function makeSession(storedToken: string | null = null) {
  const calls: string[] = [];
  const routes: Record<string, () => Response> = {
    'POST /auth/login': () => ok(authSession),
    'GET /auth/me': () => ok(user),
    'GET /users/me': () => ok(user),
    'POST /auth/token/refresh': () => ok(authSession.tokens),
    'POST /auth/logout': () => ({ status: 204, ok: true, headers: { get: () => null } } as unknown as Response),
  };
  const fetcher = jest.fn(async (url: string, init: RequestInit) => {
    const key = `${init.method ?? 'GET'} ${url.replace('https://api.test', '')}`;
    calls.push(key);
    const handler = routes[key];
    if (!handler) {
      throw new Error(`unexpected request ${key}`);
    }
    return handler();
  });
  const session = new SessionManager(
    createApiClient({ baseUrl: 'https://api.test', fetcher: fetcher as never }),
    createMemoryTokenStorage(storedToken),
  );
  return { session, calls };
}

let tree: ReactTestRenderer.ReactTestRenderer;
const act = ReactTestRenderer.act;
const textOf = (node: ReactTestRenderer.ReactTestInstance) =>
  node
    .findAllByType(Text)
    .map(t => [t.props.children].flat().join(''))
    .join(' ');
const everything = () => JSON.stringify(tree.toJSON());
const modalOpen = () => tree.root.findAllByType(Modal).length === 1;
const lastButton = (title: string) => {
  const matches = tree.root.findAllByType(Button).filter(b => b.props.title === title);
  return matches[matches.length - 1];
};
const press = async (title: string) => {
  const target = lastButton(title);
  if (!target) {
    throw new Error(`no button "${title}"`);
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
const closeModal = async () => {
  await act(async () => {
    tree.root.find(n => n.props.testID === 'modal-close').props.onPress();
  });
};
const pressRow = async (label: string) => {
  const rows = tree.root.findAll(
    n => typeof n.props.onPress === 'function' && n.props.accessibilityRole === 'button' && textOf(n).includes(label),
  );
  const target = rows[rows.length - 1];
  if (!target) {
    throw new Error(`no row "${label}"`);
  }
  await act(async () => {
    await target.props.onPress();
  });
};
const openProfileTab = async () => {
  const tab = tree.root.find(n => n.props.route?.name === 'Profile' && typeof n.props.onPress === 'function');
  await act(async () => {
    tab.props.onPress();
  });
};
const signInThroughForm = async () => {
  await press('Đăng nhập'); // U19 -> U03
  await type('Email', 'an@example.test');
  await type('Mật khẩu', 'Secret12345');
  await press('Đăng nhập'); // submit
};

afterEach(async () => {
  jest.restoreAllMocks();
  await act(async () => tree.unmount());
});

const mountApp = async (session: SessionManager) => {
  await act(async () => {
    tree = ReactTestRenderer.create(<StudySpaceApp session={session} />);
  });
};
// Guest who pressed "Bắt đầu khám phá" and is on the Cá nhân tab.
const guestOnProfile = async () => {
  const made = makeSession();
  await mountApp(made.session);
  await press('Bắt đầu khám phá');
  await openProfileTab();
  return made;
};

describe('U19 on real screens', () => {
  test('a guest tapping a Cá nhân link is asked to sign in, and lands on that same link afterwards', async () => {
    await guestOnProfile();
    await pressRow(features.favorites.title);
    expect(modalOpen()).toBe(true);
    expect(everything()).toContain('Bạn cần đăng nhập');
    expect(everything()).toContain('Đăng nhập để xem địa điểm yêu thích.');
    expect(lastButton('Tạo tài khoản')).toBeDefined();
    expect(lastButton('Để sau')).toBeDefined();

    await signInThroughForm();
    // No extra tap: the favourites screen the person wanted is open.
    expect(modalOpen()).toBe(true);
    expect(everything()).toContain(features.favorites.title);
    expect(everything()).not.toContain('Bạn cần đăng nhập');
  });

  test('the home bell does the same for notifications', async () => {
    const made = makeSession();
    await mountApp(made.session);
    await press('Bắt đầu khám phá');
    const bell = tree.root.find(n => n.props.accessibilityLabel === 'Thông báo' && typeof n.props.onPress === 'function');
    await act(async () => {
      bell.props.onPress();
    });
    expect(everything()).toContain('Đăng nhập để xem thông báo dành cho bạn.');
    await signInThroughForm();
    expect(everything()).toContain(features.notifications.title);
  });

  test('a signed-in person is never asked: the link opens straight away', async () => {
    const made = makeSession('refresh-1');
    await mountApp(made.session);
    await openProfileTab();
    await pressRow(features.favorites.title);
    expect(everything()).toContain(features.favorites.title);
    expect(everything()).not.toContain('Bạn cần đăng nhập');
  });

  test('"Để sau" forgets the request: signing in later does not open it', async () => {
    await guestOnProfile();
    await pressRow(features.favorites.title);
    await press('Để sau');
    expect(modalOpen()).toBe(false);
    await press('Đăng nhập / Đăng ký');
    await type('Email', 'an@example.test');
    await type('Mật khẩu', 'Secret12345');
    await press('Đăng nhập');
    expect(modalOpen()).toBe(false); // plain sign-in, nothing resumed
  });

  test('closing the sign-in form also forgets it', async () => {
    await guestOnProfile();
    await pressRow(features.favorites.title);
    await press('Đăng nhập');
    await closeModal();
    expect(modalOpen()).toBe(false);
    await press('Đăng nhập / Đăng ký');
    await type('Email', 'an@example.test');
    await type('Mật khẩu', 'Secret12345');
    await press('Đăng nhập');
    expect(modalOpen()).toBe(false);
  });

  test('creating an account instead of signing in is a valid way through U19', async () => {
    await guestOnProfile();
    await pressRow(features.favorites.title);
    await press('Tạo tài khoản');
    expect(everything()).toContain('Tạo tài khoản');
    expect(tree.root.findAllByType(TextInput).some(i => i.props.accessibilityLabel === 'Tên hiển thị')).toBe(true);
  });

  test('runs only once: signing out and in again does not reopen it', async () => {
    await guestOnProfile();
    await pressRow(features.favorites.title);
    await signInThroughForm();
    await closeModal(); // leaves the favourites screen
    expect(modalOpen()).toBe(false);
    await act(async () => {
      await (tree.root.findAllByType(AuthProvider)[0].props.manager as SessionManager).logout();
    });
    await act(async () => {});
    await press('Đăng nhập'); // back on the Welcome screen after signing out
    await type('Email', 'an@example.test');
    await type('Mật khẩu', 'Secret12345');
    await press('Đăng nhập');
    expect(modalOpen()).toBe(false);
  });

  test('too old a request is dropped silently', async () => {
    await guestOnProfile();
    const real = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(real);
    await pressRow(features.favorites.title);
    clock.mockReturnValue(real + 11 * 60_000); // the person took 11 minutes to sign in
    await signInThroughForm();
    expect(modalOpen()).toBe(false);
  });
});

// The rules of the gate itself, with requests the real screens do not make.
describe('useAuthGate', () => {
  let gate: ReturnType<typeof useAuthGate>;
  let modal: ReturnType<typeof useModal>;
  function Probe() {
    gate = useAuthGate();
    modal = useModal();
    return null;
  }
  const mountHarness = async (session: SessionManager) => {
    await act(async () => {
      tree = ReactTestRenderer.create(
        <SafeAreaProvider>
          <ToastProvider>
            <AuthProvider manager={session}>
              <ConfirmProvider>
                <ModalCoordinator>
                  <AuthGateProvider>
                    <Probe />
                    <ModalHost onWelcome={() => undefined} onContinue={() => undefined} />
                  </AuthGateProvider>
                </ModalCoordinator>
              </ConfirmProvider>
            </AuthProvider>
          </ToastProvider>
        </SafeAreaProvider>,
      );
    });
    await act(async () => {}); // session restore finishes
  };
  const request = (over: Partial<GateRequest> = {}): GateRequest => ({
    reason: 'Đăng nhập để bình luận.',
    action: jest.fn(),
    ...over,
  });
  const ask = async (req: GateRequest) => {
    let ran = false;
    await act(async () => {
      ran = gate.requireAuth(req);
    });
    return ran;
  };
  const signIn = async (session: SessionManager) => {
    await act(async () => {
      await session.startSession(authSession);
    });
    await closeModal();
  };

  test('runs the action at once when already signed in', async () => {
    const { session } = makeSession('refresh-1');
    await mountHarness(session);
    const req = request();
    expect(await ask(req)).toBe(true);
    expect(req.action).toHaveBeenCalledTimes(1);
    expect(modalOpen()).toBe(false);
  });

  test('keeps the action and what it captured (the draft) until sign-in, then runs it once', async () => {
    const { session } = makeSession();
    await mountHarness(session);
    const sent: string[] = [];
    const draft = 'Nội dung tôi đã gõ dở';
    expect(await ask(request({ action: () => { sent.push(draft); } }))).toBe(false);
    expect(sent).toEqual([]);
    expect(everything()).toContain('Đăng nhập để bình luận.');
    await signIn(session);
    expect(sent).toEqual([draft]);
    await act(async () => modal.open({ name: 'about' }));
    await closeModal();
    expect(sent).toEqual([draft]); // not again
  });

  test('a newer request replaces an older one', async () => {
    const { session } = makeSession();
    await mountHarness(session);
    const first = request();
    const second = request({ reason: 'Đăng nhập để lưu bài.' });
    await ask(first);
    await ask(second);
    expect(everything()).toContain('Đăng nhập để lưu bài.');
    await signIn(session);
    expect(first.action).not.toHaveBeenCalled();
    expect(second.action).toHaveBeenCalledTimes(1);
  });

  test('does not run when isStillValid says no, and tells the person', async () => {
    const { session } = makeSession();
    await mountHarness(session);
    const req = request({ isStillValid: () => false });
    await ask(req);
    await signIn(session);
    expect(req.action).not.toHaveBeenCalled();
    expect(everything()).toContain('Hành động trước đó không còn phù hợp');
  });

  test('shows the server message when the resumed action fails', async () => {
    const { session } = makeSession();
    await mountHarness(session);
    await ask(request({ action: async () => { throw new ApiError('FORBIDDEN', 'Bạn không có quyền làm việc này.', 403); } }));
    await signIn(session);
    expect(everything()).toContain('Bạn không có quyền làm việc này.');
    // An unexpected error gets a generic message instead of leaking details.
    await act(async () => modal.close());
    await act(async () => { await session.logout(); });
    await ask(request({ action: () => { throw new Error('boom: stack trace'); } }));
    await signIn(session);
    expect(everything()).toContain('Chưa thực hiện được. Vui lòng thử lại.');
    expect(everything()).not.toContain('boom');
  });

  test('waits for the steps after sign-up (complete your profile) before resuming', async () => {
    const { session } = makeSession();
    await mountHarness(session);
    const req = request();
    await ask(req);
    await act(async () => {
      await session.startSession(authSession);
    });
    await act(async () => modal.open({ name: 'profile-edit', mode: 'complete' }));
    expect(req.action).not.toHaveBeenCalled(); // the profile form is still open
    await closeModal();
    expect(req.action).toHaveBeenCalledTimes(1);
  });

  test('does nothing while the saved session is still being read', async () => {
    const { session } = makeSession('refresh-1');
    // Hold the restore: the refresh request never answers.
    const stuck = new Promise<Response>(() => undefined);
    const hanging = new SessionManager(
      createApiClient({ baseUrl: 'https://api.test', fetcher: (() => stuck) as never }),
      createMemoryTokenStorage('refresh-1'),
    );
    expect(session).toBeDefined();
    await act(async () => {
      tree = ReactTestRenderer.create(
        <SafeAreaProvider>
          <ToastProvider>
            <AuthProvider manager={hanging}>
              <ConfirmProvider>
                <ModalCoordinator>
                  <AuthGateProvider>
                    <Probe />
                  </AuthGateProvider>
                </ModalCoordinator>
              </ConfirmProvider>
            </AuthProvider>
          </ToastProvider>
        </SafeAreaProvider>,
      );
    });
    const req = request();
    expect(await ask(req)).toBe(false);
    expect(modal.state.active).toBeNull();
    expect(req.action).not.toHaveBeenCalled();
  });

  test('must be used inside the provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    function Bare() {
      useAuthGate();
      return null;
    }
    expect(() =>
      act(() => {
        ReactTestRenderer.create(<Bare />);
      }),
    ).toThrow('useAuthGate must be used inside AuthGateProvider');
    spy.mockRestore();
    tree = ReactTestRenderer.create(<></>);
  });
});
