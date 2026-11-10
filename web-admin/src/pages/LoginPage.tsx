import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card, Spinner, TextField, useSubmit } from '../ui';
import { ForgotPasswordFlow } from './ForgotPasswordFlow';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ADM-01 - Dang nhap
export function LoginPage() {
  const { state, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [local, setLocal] = useState<Record<string, string>>({});
  const [forgot, setForgot] = useState(false);
  const submit = useSubmit();

  if (state.status === 'loading') {
    return (
      <div className="center-screen">
        <Spinner label="Đang kiểm tra phiên đăng nhập…" />
      </div>
    );
  }
  if (state.status === 'signedIn') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!EMAIL_RE.test(email.trim())) errors.email = 'Email không hợp lệ.';
    if (!password) errors.password = 'Vui lòng nhập mật khẩu.';
    setLocal(errors);
    if (Object.keys(errors).length > 0) return;
    await submit.run(() => login(email.trim().toLowerCase(), password));
  };

  const limited = submit.error?.code === 'RATE_LIMITED';
  return (
    <div className="center-screen">
      <Card className="auth-card">
        <div className="brand">
          <span className="brand-mark" aria-hidden>S</span>
          <span>StudySpace Admin</span>
        </div>
        <div>
          <h1>Đăng nhập</h1>
          <p className="muted">Dành cho quản trị viên.</p>
        </div>
        {state.status === 'signedOut' && state.notice && (
          <div className="form-error" role="status">{state.notice}</div>
        )}
        <form className="form" onSubmit={onSubmit} noValidate>
          <TextField
            label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)}
            autoComplete="username" maxLength={254} autoFocus
            error={local.email ?? submit.fields.email}
          />
          <TextField
            label="Mật khẩu" type="password" value={password} onChange={e => setPassword(e.target.value)}
            autoComplete="current-password" maxLength={72}
            error={local.password ?? submit.fields.password}
          />
          {submit.message && (
            <div className="form-error" role="alert">
              {submit.message}
              {limited && submit.error?.retryAfterSeconds ? ` Thử lại sau ${submit.error.retryAfterSeconds} giây.` : ''}
            </div>
          )}
          <Button type="submit" block loading={submit.pending}>Đăng nhập</Button>
        </form>
        <Button variant="ghost" onClick={() => setForgot(true)}>Quên mật khẩu?</Button>
      </Card>
      {forgot && <ForgotPasswordFlow initialEmail={email} onClose={() => setForgot(false)} />}
    </div>
  );
}
