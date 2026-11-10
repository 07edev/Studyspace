import React from 'react';
import type { ModalRoute } from '../../navigation/types';
import { ForgotPasswordFlow } from './ForgotPasswordFlow';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { VerifyEmailForm } from './VerifyEmailForm';

type AuthRoute = Extract<ModalRoute, { name: 'auth' }>;

export const authTitles: Record<AuthRoute['mode'], string> = {
  login: 'Đăng nhập',
  register: 'Tạo tài khoản',
  verify: 'Xác minh email',
  forgot: 'Quên mật khẩu',
};

// One full-screen modal that moves between U01-U04 without stacking modals.
export function AuthModal({
  route,
  onAuthenticated,
}: {
  route: AuthRoute;
  onAuthenticated: () => void;
}) {
  switch (route.mode) {
    case 'login':
      return <LoginForm onAuthenticated={onAuthenticated} />;
    case 'register':
      return <RegisterForm onAuthenticated={onAuthenticated} />;
    case 'verify':
      return (
        <VerifyEmailForm
          email={route.email ?? ''}
          resendIn={route.resendIn}
          onAuthenticated={onAuthenticated}
        />
      );
    case 'forgot':
      return <ForgotPasswordFlow />;
  }
}
