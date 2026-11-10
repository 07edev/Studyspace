import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleLibVerifier, GoogleTokenVerifier } from './google-verifier';
import { DevMailService, MailService, SmtpMailService } from './mail.service';
import { OtpService } from './otp.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    OtpService,
    SessionService,
    {
      provide: MailService,
      inject: [APP_CONFIG],
      // Real SMTP whenever it is configured (mandatory in production); log-only dev mail otherwise.
      useFactory: (config: AppConfig) =>
        config.smtp ? new SmtpMailService(config) : new DevMailService(config),
    },
    { provide: GoogleTokenVerifier, useClass: GoogleLibVerifier },
  ],
  exports: [SessionService, PasswordService, MailService, OtpService],
})
export class AuthModule {}
