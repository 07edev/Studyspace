import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleLibVerifier, GoogleTokenVerifier } from './google-verifier';
import { DevMailService, MailService } from './mail.service';
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
    { provide: MailService, useClass: DevMailService },
    { provide: GoogleTokenVerifier, useClass: GoogleLibVerifier },
  ],
  exports: [SessionService, PasswordService, MailService, OtpService],
})
export class AuthModule {}
