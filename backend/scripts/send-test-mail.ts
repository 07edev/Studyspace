// Usage: npm run mail:test -- you@example.com
// Sends one real OTP-style email with the SMTP settings from .env, so you can check the
// configuration without going through registration. The code in it is a dummy (000000).
import '../src/load-env';
import { loadConfig } from '../src/config/configuration';
import { SmtpMailService } from '../src/modules/auth/mail.service';

async function main() {
  const to = process.argv[2];
  if (!to || !to.includes('@')) {
    console.error('Usage: npm run mail:test -- you@example.com');
    process.exit(1);
  }
  const config = loadConfig();
  if (!config.smtp) {
    console.error('SMTP_HOST is not set in .env (see docs/EMAIL_SETUP.md).');
    process.exit(1);
  }
  await new SmtpMailService(config).sendOtp({ email: to }, 'EMAIL_VERIFY', '000000');
  console.log(`Sent a test email to ${to} via ${config.smtp.host}:${config.smtp.port}. Check the inbox (and spam).`);
}

main().catch(error => {
  console.error('Failed:', error?.code ?? '', error?.message ?? error);
  process.exit(1);
});
