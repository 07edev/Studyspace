import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fail, makeAdmin, mockApi, ok, renderApp, resetApi, tokens } from '../test/helpers';

beforeEach(resetApi);
afterEach(resetApi);

const signedInRoutes = (user = makeAdmin()) => ({
  'POST /auth/token/refresh': () => ok(tokens),
  'GET /auth/me': () => ok(user),
});

describe('session restore', () => {
  it('shows the login page when there is no valid session', async () => {
    mockApi({ 'POST /auth/token/refresh': () => fail(401, 'TOKEN_INVALID', 'Không hợp lệ') });
    renderApp('/users');
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
  });

  it('restores the session from the refresh cookie and opens the first page the admin may see', async () => {
    const api = mockApi(signedInRoutes());
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Người dùng' })).toBeInTheDocument();
    expect(screen.getByText('Ada Admin')).toBeInTheDocument();
    expect(api.count('POST /auth/token/refresh')).toBe(1);
  });

  it('refuses a restored account that is not an admin', async () => {
    mockApi(signedInRoutes(makeAdmin({ role: 'USER', admin: undefined })));
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
  });

  it('offers a retry when the server cannot be reached, instead of pretending to be signed out', async () => {
    let up = false;
    mockApi({
      'POST /auth/token/refresh': () => {
        if (!up) throw new TypeError('offline');
        return ok(tokens);
      },
      'GET /auth/me': () => ok(makeAdmin()),
    });
    renderApp('/');
    expect(await screen.findByText('Không kết nối được máy chủ')).toBeInTheDocument();
    up = true;
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('heading', { name: 'Người dùng' })).toBeInTheDocument();
  });
});

describe('menu and permissions', () => {
  it('shows only the menus the admin has permission for', async () => {
    mockApi(signedInRoutes());
    renderApp('/');
    const menu = await screen.findByRole('navigation', { name: 'Menu quản trị' });
    expect(within(menu).getByRole('link', { name: 'Người dùng' })).toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: 'Quản trị viên' })).not.toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: 'Địa điểm' })).not.toBeInTheDocument();
  });

  it('shows everything to a super admin', async () => {
    mockApi(signedInRoutes(makeAdmin({ role: 'SUPER_ADMIN', admin: { status: 'ACTIVE', permissions: [] } })));
    renderApp('/');
    const menu = await screen.findByRole('navigation', { name: 'Menu quản trị' });
    expect(within(menu).getByRole('link', { name: 'Quản trị viên' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Nhật ký quản trị' })).toBeInTheDocument();
  });

  it('blocks a page typed into the address bar when the permission is missing', async () => {
    mockApi(signedInRoutes());
    renderApp('/admins');
    expect(await screen.findByText('Bạn không có quyền truy cập trang này')).toBeInTheDocument();
  });

  it('says so when the admin has no permission at all', async () => {
    mockApi(signedInRoutes(makeAdmin({ admin: { status: 'ACTIVE', permissions: [] } })));
    renderApp('/');
    expect(await screen.findByText('Tài khoản chưa được cấp quyền nào')).toBeInTheDocument();
  });

  it('shows a not-found page for unknown paths', async () => {
    mockApi(signedInRoutes());
    renderApp('/does-not-exist');
    expect(await screen.findByText('Không tìm thấy trang')).toBeInTheDocument();
  });
});

describe('login (ADM-01)', () => {
  const loggedOut = { 'POST /auth/token/refresh': () => fail(401, 'TOKEN_INVALID', 'Không hợp lệ') };

  it('validates locally before calling the server', async () => {
    const api = mockApi(loggedOut);
    renderApp('/');
    await userEvent.type(await screen.findByLabelText('Email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(screen.getByText('Email không hợp lệ.')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập mật khẩu.')).toBeInTheDocument();
    expect(api.count('POST /auth/login')).toBe(0);
  });

  it('shows the server message for wrong credentials and keeps the form', async () => {
    mockApi({ ...loggedOut, 'POST /auth/login': () => fail(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.') });
    renderApp('/');
    await userEvent.type(await screen.findByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'whatever');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Email hoặc mật khẩu không đúng.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('a@b.co');
  });

  it('shows the wait time when rate limited', async () => {
    mockApi({ ...loggedOut, 'POST /auth/login': () => fail(429, 'RATE_LIMITED', 'Bạn thao tác quá nhanh.', { retryAfterSeconds: 42 }) });
    renderApp('/');
    await userEvent.type(await screen.findByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'whatever');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText(/Thử lại sau 42 giây/)).toBeInTheDocument();
  });

  it('signs in as WEB_ADMIN and returns to the page that was asked for', async () => {
    const api = mockApi({
      ...loggedOut,
      'POST /auth/login': (_url, init) => {
        expect(JSON.parse(String(init.body))).toEqual({ email: 'admin@example.test', password: 'Secret12345', client: 'WEB_ADMIN' });
        return ok({ user: makeAdmin(), tokens });
      },
    });
    renderApp('/users');
    await userEvent.type(await screen.findByLabelText('Email'), 'Admin@Example.test');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'Secret12345');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByRole('heading', { name: 'Người dùng' })).toBeInTheDocument();
    expect(api.count('POST /auth/login')).toBe(1);
  });

  it('logs out after confirmation and goes back to the login page', async () => {
    const api = mockApi({ ...signedInRoutes(), 'POST /auth/logout': () => ok(undefined, 204) });
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: /Đăng xuất/ }));
    const dialog = await screen.findByRole('alertdialog');
    expect(api.count('POST /auth/logout')).toBe(0); // nothing happens before the confirmation
    await userEvent.click(within(dialog).getByRole('button', { name: 'Đăng xuất' }));
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
    expect(api.count('POST /auth/logout')).toBe(1);
  });

  it('lets the admin stay when logout is cancelled', async () => {
    mockApi(signedInRoutes());
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: /Đăng xuất/ }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Hủy' }));
    expect(screen.getByRole('heading', { name: 'Người dùng' })).toBeInTheDocument();
  });
});

describe('forgot password (A01-A03)', () => {
  const loggedOut = { 'POST /auth/token/refresh': () => fail(401, 'TOKEN_INVALID', 'Không hợp lệ') };
  const openFlow = async () => {
    renderApp('/');
    await userEvent.type(await screen.findByLabelText('Email'), 'admin@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'Quên mật khẩu?' }));
    return screen.findByRole('dialog', { name: 'Quên mật khẩu' });
  };

  it('goes through email, code and new password, then asks to sign in', async () => {
    const bodies: Record<string, unknown> = {};
    mockApi({
      ...loggedOut,
      'POST /auth/password/forgot': (_u, init) => {
        bodies.forgot = JSON.parse(String(init.body));
        return ok({ message: 'ok' }, 202);
      },
      'POST /auth/password/verify-otp': (_u, init) => {
        bodies.verify = JSON.parse(String(init.body));
        return ok({ resetToken: 'r'.repeat(40), expiresInSeconds: 600 });
      },
      'POST /auth/password/reset': (_u, init) => {
        bodies.reset = JSON.parse(String(init.body));
        return ok({ message: 'done' });
      },
    });
    const a01 = await openFlow();
    expect(within(a01).getByLabelText('Email')).toHaveValue('admin@example.test'); // carried over from login
    await userEvent.click(within(a01).getByRole('button', { name: 'Gửi mã' }));

    const a02 = await screen.findByRole('dialog', { name: 'Xác minh mã' });
    await userEvent.type(within(a02).getByLabelText('Mã xác minh'), '123456');
    await userEvent.click(within(a02).getByRole('button', { name: 'Xác nhận' }));

    const a03 = await screen.findByRole('dialog', { name: 'Đặt lại mật khẩu' });
    await userEvent.type(within(a03).getByLabelText('Mật khẩu mới'), 'NewPassword123');
    await userEvent.type(within(a03).getByLabelText('Nhập lại mật khẩu'), 'NewPassword123');
    await userEvent.click(within(a03).getByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect(await screen.findByText(/Đã đặt lại mật khẩu/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies.forgot).toEqual({ email: 'admin@example.test' });
    expect(bodies.verify).toEqual({ email: 'admin@example.test', otp: '123456' });
    expect(bodies.reset).toEqual({ resetToken: 'r'.repeat(40), newPassword: 'NewPassword123', confirmPassword: 'NewPassword123' });
  });

  it('rejects a bad email and a short code without calling the server', async () => {
    const api = mockApi(loggedOut);
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Quên mật khẩu?' }));
    const a01 = await screen.findByRole('dialog', { name: 'Quên mật khẩu' });
    await userEvent.type(within(a01).getByLabelText('Email'), 'nope');
    await userEvent.click(within(a01).getByRole('button', { name: 'Gửi mã' }));
    expect(within(a01).getByText('Email không hợp lệ.')).toBeInTheDocument();
    expect(api.count('POST /auth/password/forgot')).toBe(0);
  });

  it('shows a wrong code next to the code field and stays on the step', async () => {
    mockApi({
      ...loggedOut,
      'POST /auth/password/forgot': () => ok({ message: 'ok' }, 202),
      'POST /auth/password/verify-otp': () => fail(422, 'OTP_INVALID', 'Mã xác minh không đúng.'),
    });
    const a01 = await openFlow();
    await userEvent.click(within(a01).getByRole('button', { name: 'Gửi mã' }));
    const a02 = await screen.findByRole('dialog', { name: 'Xác minh mã' });
    await userEvent.type(within(a02).getByLabelText('Mã xác minh'), '000000');
    await userEvent.click(within(a02).getByRole('button', { name: 'Xác nhận' }));
    expect(await within(a02).findByText('Mã xác minh không đúng.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Xác minh mã' })).toBeInTheDocument();
  });

  it('only allows resending the code after the cooldown', async () => {
    mockApi({ ...loggedOut, 'POST /auth/password/forgot': () => ok({ message: 'ok' }, 202) });
    const a01 = await openFlow();
    await userEvent.click(within(a01).getByRole('button', { name: 'Gửi mã' }));
    const a02 = await screen.findByRole('dialog', { name: 'Xác minh mã' });
    expect(within(a02).getByRole('button', { name: /Gửi lại mã \(\d+s\)/ })).toBeDisabled();
  });

  it('sends the person back to A01 when the reset link has expired', async () => {
    mockApi({
      ...loggedOut,
      'POST /auth/password/forgot': () => ok({ message: 'ok' }, 202),
      'POST /auth/password/verify-otp': () => ok({ resetToken: 'r'.repeat(40), expiresInSeconds: 600 }),
      'POST /auth/password/reset': () => fail(410, 'RESET_TOKEN_EXPIRED', 'Hết hạn'),
    });
    const a01 = await openFlow();
    await userEvent.click(within(a01).getByRole('button', { name: 'Gửi mã' }));
    const a02 = await screen.findByRole('dialog', { name: 'Xác minh mã' });
    await userEvent.type(within(a02).getByLabelText('Mã xác minh'), '123456');
    await userEvent.click(within(a02).getByRole('button', { name: 'Xác nhận' }));
    const a03 = await screen.findByRole('dialog', { name: 'Đặt lại mật khẩu' });
    await userEvent.type(within(a03).getByLabelText('Mật khẩu mới'), 'NewPassword123');
    await userEvent.type(within(a03).getByLabelText('Nhập lại mật khẩu'), 'NewPassword123');
    await userEvent.click(within(a03).getByRole('button', { name: 'Đặt lại mật khẩu' }));
    expect(await screen.findByRole('dialog', { name: 'Quên mật khẩu' })).toBeInTheDocument();
    expect(screen.getByText(/đã hết hạn/)).toBeInTheDocument();
  });

  it('checks that the two new passwords match before calling the server', async () => {
    const api = mockApi({
      ...loggedOut,
      'POST /auth/password/forgot': () => ok({ message: 'ok' }, 202),
      'POST /auth/password/verify-otp': () => ok({ resetToken: 'r'.repeat(40), expiresInSeconds: 600 }),
    });
    const a01 = await openFlow();
    await userEvent.click(within(a01).getByRole('button', { name: 'Gửi mã' }));
    const a02 = await screen.findByRole('dialog', { name: 'Xác minh mã' });
    await userEvent.type(within(a02).getByLabelText('Mã xác minh'), '123456');
    await userEvent.click(within(a02).getByRole('button', { name: 'Xác nhận' }));
    const a03 = await screen.findByRole('dialog', { name: 'Đặt lại mật khẩu' });
    await userEvent.type(within(a03).getByLabelText('Mật khẩu mới'), 'NewPassword123');
    await userEvent.type(within(a03).getByLabelText('Nhập lại mật khẩu'), 'Different123');
    await userEvent.click(within(a03).getByRole('button', { name: 'Đặt lại mật khẩu' }));
    expect(within(a03).getByText('Mật khẩu nhập lại chưa khớp.')).toBeInTheDocument();
    expect(api.count('POST /auth/password/reset')).toBe(0);
  });
});
