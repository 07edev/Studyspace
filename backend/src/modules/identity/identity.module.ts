import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { AccessTokenService } from './access-token.service';
import { IdentityService } from './identity.service';
import {
  AdminProfile,
  AdminProfileSchema,
} from './schemas/admin-profile.schema';
import {
  OtpChallenge,
  OtpChallengeSchema,
} from './schemas/otp-challenge.schema';
import { Session, SessionSchema } from './schemas/session.schema';
import { UserDevice, UserDeviceSchema } from './schemas/user-device.schema';
import { User, UserSchema } from './schemas/user.schema';

// Global so TV2/TV3 modules can inject IdentityService/AccessTokenService and models.
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AdminProfile.name, schema: AdminProfileSchema },
      { name: Session.name, schema: SessionSchema },
      { name: OtpChallenge.name, schema: OtpChallengeSchema },
      { name: UserDevice.name, schema: UserDeviceSchema },
    ]),
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.jwtAccessSecret,
        signOptions: { expiresIn: config.jwtAccessTtlSeconds },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  providers: [AccessTokenService, IdentityService],
  exports: [AccessTokenService, IdentityService, MongooseModule],
})
export class IdentityModule {}
