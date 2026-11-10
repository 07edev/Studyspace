import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';

export type OtpDestination = { email?: string; phone?: string };

// Delivery abstraction. A real SMTP/SMS adapter replaces DevMailService in REL01.
export abstract class MailService {
  abstract sendOtp(to: OtpDestination, purpose: string, code: string): Promise<void>;
  /** Test/dev helper: last code sent to an address. Always undefined in production. */
  abstract peekOtp(address: string, purpose: string): string | undefined;
}

@Injectable()
export class DevMailService extends MailService {
  private readonly logger = new Logger('Mail');
  private readonly sent = new Map<string, string>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super();
  }

  async sendOtp(to: OtpDestination, purpose: string, code: string): Promise<void> {
    const address = to.email ?? to.phone ?? '';
    if (this.config.nodeEnv === 'production') {
      // Never log or keep OTPs in production.
      this.logger.warn(`No mail provider configured; OTP for ${purpose} was not delivered.`);
      return;
    }
    this.sent.set(`${address}|${purpose}`, code);
    if (this.config.nodeEnv !== 'test') {
      this.logger.log(`[DEV ONLY] OTP ${purpose} for ${address}: ${code}`);
    }
  }

  peekOtp(address: string, purpose: string): string | undefined {
    return this.config.nodeEnv === 'production'
      ? undefined
      : this.sent.get(`${address}|${purpose}`);
  }
}
