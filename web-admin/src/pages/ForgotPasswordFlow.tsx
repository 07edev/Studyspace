import { useEffect, useState } from 'react';
import type { ResetGrant, StatusMessage } from '@contracts/auth';
import { api } from '../lib/api';
import { Button, Modal, TextField, useSubmit, useToast } from '../ui';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 60;

type Step = { name: 'A01' } | { name: 'A02'; email: string } | { name: 'A03'; resetToken: string };

// A01 -> A02 -> A03. Three small modals that share one flow; closing any of them ends the flow.
export function ForgotPasswordFlow({ initialEmail, onClose }: { initialEmail: string; onClose: () => void }) {
  const [step, setStep] = useState<Step>({ name: 'A01' });
  const [notice, setNotice] = useState<string>();
  if (step.name === 'A01') {
    return (
      <EmailStep
        initialEmail={initialEmail}
        notice={notice}
        onClose={onClose}
        onSent={email => {
          setNotice(undefined);
          setStep({ name: 'A02', email });
        }}
      />
    );
  }
  if (step.name === 'A02') {
    return (
      <OtpStep
        email={step.email}
        onClose={onClose}
        onVerified={resetToken => setStep({ name: 'A03', resetToken })}
      />
    );
  }
  return (
    <NewPasswordStep
      resetToken={step.resetToken}
      onClose={onClose}
      onExpired={() => {
        setNotice('Yêu cầu đặt lại mật khẩu đã hết hạn. Vui lòng nhận mã mới.');
        setStep({ name: 'A01' });
      }}
    />
  );
}

// A01 - Quen mat khau
function EmailStep({
  initialEmail, notice, onClose, onSent,
}: { initialEmail: string; notice?: string; onClose: () => void; onSent: (email: string) => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [local, setLocal] = useState<string>();
  const submit = useSubmit();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setLocal('Email không hợp lệ.');
      return;
    }
    setLocal(undefined);
    const sent = await submit.run(() =>
      api.request<StatusMessage>('/auth/password/forgot', { method: 'POST', body: { email: value }, authenticated: false }),
    );
    if (sent) onSent(value);
  };

  return (
    <Modal title="Quên mật khẩu" size="C" onClose={onClose} dirty={email.trim() !== initialEmail.trim()}>
      <form className="form" onSubmit={onSubmit} noValidate>
        {notice && <div className="form-error" role="alert">{notice}</div>}
        <p className="muted">Nhập email của tài khoản. Chúng tôi sẽ gửi mã xác minh 6 số.</p>
        <TextField
          label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)}
          autoComplete="email" error={local ?? submit.fields.email} maxLength={254}
        />
        {submit.message && <div className="form-error" role="alert">{submit.message}</div>}
        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button type="submit" loading={submit.pending}>Gửi mã</Button>
        </div>
      </form>
    </Modal>
  );
}

// A02 - Xac minh ma
function OtpStep({
  email, onClose, onVerified,
}: { email: string; onClose: () => void; onVerified: (resetToken: string) => void }) {
  const toast = useToast();
  const [otp, setOtp] = useState('');
  const [local, setLocal] = useState<string>();
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const submit = useSubmit();
  const resend = useSubmit();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setLocal('Mã gồm 6 chữ số.');
      return;
    }
    setLocal(undefined);
    const grant = await submit.run(() =>
      api.request<ResetGrant>('/auth/password/verify-otp', { method: 'POST', body: { email, otp }, authenticated: false }),
    );
    if (grant) onVerified(grant.resetToken);
  };

  const onResend = async () => {
    // The reset flow resends through "forgot": the verification-email resend endpoint would do
    // nothing for an already active account.
    const sent = await resend.run(() =>
      api.request<StatusMessage>('/auth/password/forgot', { method: 'POST', body: { email }, authenticated: false }),
    );
    if (sent) {
      setCooldown(RESEND_SECONDS);
      toast('Đã gửi lại mã.');
    } else if (resend.error?.retryAfterSeconds) {
      setCooldown(resend.error.retryAfterSeconds);
    }
  };

  return (
    <Modal title="Xác minh mã" size="C" onClose={onClose} dirty={otp !== ''}>
      <form className="form" onSubmit={onSubmit} noValidate>
        <p className="muted">Nhập mã 6 số đã gửi tới {email}. Mã có hiệu lực trong 5 phút.</p>
        <TextField
          label="Mã xác minh" value={otp} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
          onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
          error={local ?? submit.fields.otp ?? (submit.error && !Object.keys(submit.fields).length ? submit.error.message : undefined)}
        />
        {resend.message && <div className="form-error" role="alert">{resend.message}</div>}
        <div className="modal-actions">
          <Button variant="ghost" onClick={onResend} disabled={cooldown > 0} loading={resend.pending}>
            {cooldown > 0 ? `Gửi lại mã (${cooldown}s)` : 'Gửi lại mã'}
          </Button>
          <Button type="submit" loading={submit.pending}>Xác nhận</Button>
        </div>
      </form>
    </Modal>
  );
}

// A03 - Dat lai mat khau
function NewPasswordStep({
  resetToken, onClose, onExpired,
}: { resetToken: string; onClose: () => void; onExpired: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [local, setLocal] = useState<Record<string, string>>({});
  const submit = useSubmit();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!password) errors.newPassword = 'Vui lòng nhập mật khẩu mới.';
    if (confirm !== password) errors.confirmPassword = 'Mật khẩu nhập lại chưa khớp.';
    setLocal(errors);
    if (Object.keys(errors).length > 0) return;
    const done = await submit.run(() =>
      api.request<StatusMessage>('/auth/password/reset', {
        method: 'POST', authenticated: false,
        body: { resetToken, newPassword: password, confirmPassword: confirm },
      }),
    );
    if (done) {
      toast('Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.');
      onClose();
    }
  };

  // An expired or used reset link sends the person back to A01 for a fresh code.
  const expired = submit.error?.code === 'RESET_TOKEN_EXPIRED' || submit.error?.code === 'RESET_TOKEN_INVALID';
  useEffect(() => {
    if (expired) onExpired();
  }, [expired, onExpired]);

  return (
    <Modal title="Đặt lại mật khẩu" size="C" onClose={onClose} dirty={password !== '' || confirm !== ''}>
      <form className="form" onSubmit={onSubmit} noValidate>
        <TextField
          label="Mật khẩu mới" type="password" value={password} onChange={e => setPassword(e.target.value)}
          autoComplete="new-password" maxLength={72}
          hint="10–72 ký tự, gồm chữ hoa, chữ thường và chữ số."
          error={local.newPassword ?? submit.fields.newPassword}
        />
        <TextField
          label="Nhập lại mật khẩu" type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
          autoComplete="new-password" maxLength={72}
          error={local.confirmPassword ?? submit.fields.confirmPassword}
        />
        {submit.message && !expired && <div className="form-error" role="alert">{submit.message}</div>}
        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button type="submit" loading={submit.pending}>Đặt lại mật khẩu</Button>
        </div>
      </form>
    </Modal>
  );
}
