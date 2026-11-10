import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { ApiException } from '../../common/api-error';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';

export type OtpDestination = { email?: string; phone?: string };

// Delivery abstraction used by auth. Email goes out through SMTP when configured; there is
// no SMS provider yet (see canSendSms), so phone-based codes are refused instead of faked.
export abstract class MailService {
  abstract sendOtp(to: OtpDestination, purpose: string, code: string): Promise<void>;
  /** False when no SMS gateway exists: callers must refuse phone flows up front. */
  abstract canSendSms(): boolean;
  /** Test/dev helper: last code sent to an address. Always undefined for real deliveries. */
  abstract peekOtp(address: string, purpose: string): string | undefined;
}

const SUBJECTS: Record<string, string> = {
  EMAIL_VERIFY: 'Mã xác minh email StudySpace',
  PASSWORD_RESET: 'Mã đặt lại mật khẩu StudySpace',
  CONTACT_CHANGE: 'Mã xác nhận thay đổi thông tin liên hệ StudySpace',
};
const INTRO: Record<string, string> = {
  EMAIL_VERIFY: 'Dùng mã dưới đây để xác minh email của bạn',
  PASSWORD_RESET: 'Dùng mã dưới đây để đặt lại mật khẩu',
  CONTACT_CHANGE: 'Dùng mã dưới đây để xác nhận thay đổi thông tin liên hệ',
};

@Injectable()
export class DevMailService extends MailService {
  private readonly logger = new Logger('Mail');
  private readonly sent = new Map<string, string>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super();
  }

  async sendOtp(to: OtpDestination, purpose: string, code: string): Promise<void> {
    const address = to.email ?? to.phone ?? '';
    this.sent.set(`${address}|${purpose}`, code);
    if (this.config.nodeEnv !== 'test') {
      this.logger.log(`[DEV ONLY] OTP ${purpose} for ${address}: ${code}`);
    }
  }

  canSendSms() {
    return true; // dev: the code is just logged
  }

  peekOtp(address: string, purpose: string): string | undefined {
    return this.sent.get(`${address}|${purpose}`);
  }
}

@Injectable()
export class SmtpMailService extends MailService {
  private readonly logger = new Logger('Mail');
  private readonly transport: Transporter;

  // `transport` is injectable so tests can capture messages without a network.
  constructor(
    private readonly config: AppConfig,
    transport?: Transporter,
  ) {
    super();
    const smtp = config.smtp;
    if (!smtp && !transport) {
      throw new Error('SMTP is not configured');
    }
    this.transport =
      transport ??
      createTransport({
        host: smtp!.host,
        port: smtp!.port,
        secure: smtp!.secure,
        requireTLS: !smtp!.secure,
        auth: smtp!.user ? { user: smtp!.user, pass: smtp!.pass } : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });
  }

  async sendOtp(to: OtpDestination, purpose: string, code: string): Promise<void> {
    if (!to.email) {
      throw new ApiException(
        503,
        'SMS_NOT_CONFIGURED',
        'Chưa hỗ trợ gửi mã qua tin nhắn SMS. Vui lòng dùng email.',
      );
    }
    const minutes = Math.round(this.config.otpTtlSeconds / 60);
    const intro = INTRO[purpose] ?? 'Mã xác minh của bạn';
    try {
      await this.transport.sendMail({
        from: this.config.smtp?.from,
        to: to.email,
        subject: SUBJECTS[purpose] ?? 'Mã xác minh StudySpace',
        text:
          `${intro}:\n\n${code}\n\n` +
          `Mã có hiệu lực trong ${minutes} phút. Không chia sẻ mã này với bất kỳ ai, ` +
          `kể cả nhân viên StudySpace. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
        html:
          `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#182E28">` +
          `<h2 style="color:#285C49">StudySpace</h2><p>${intro}:</p>` +
          `<p style="font-size:32px;letter-spacing:8px;font-weight:bold;margin:16px 0">${code}</p>` +
          `<p>Mã có hiệu lực trong ${minutes} phút. Không chia sẻ mã này với bất kỳ ai.</p>` +
          `<p style="color:#66766E;font-size:13px">Nếu bạn không yêu cầu, hãy bỏ qua email này.</p></div>`,
      });
    } catch (error) {
      // Log the failure but never the code.
      this.logger.error(`Failed to send ${purpose} email: ${(error as Error).message}`);
      throw new ApiException(
        503,
        'MAIL_DELIVERY_FAILED',
        'Không thể gửi email lúc này. Vui lòng thử lại sau.',
      );
    }
  }

  canSendSms() {
    return false;
  }

  peekOtp(): string | undefined {
    return undefined; // real deliveries are never readable back
  }
}
