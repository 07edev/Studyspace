import { Inject, Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { ApiException } from '../../common/api-error';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';

export type GoogleProfile = {
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
};

// Abstract so tests can stub it. The real one verifies signature, iss, aud and exp via Google.
export abstract class GoogleTokenVerifier {
  abstract verify(idToken: string): Promise<GoogleProfile>;
}

@Injectable()
export class GoogleLibVerifier extends GoogleTokenVerifier {
  private readonly client = new OAuth2Client();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super();
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    if (this.config.googleClientIds.length === 0) {
      throw new ApiException(503, 'GOOGLE_NOT_CONFIGURED', 'Đăng nhập Google chưa được cấu hình.');
    }
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.config.googleClientIds,
      });
      const payload = ticket.getPayload();
      if (!payload?.email) {
        throw new Error('no email');
      }
      return {
        email: payload.email,
        emailVerified: payload.email_verified === true,
        name: payload.name,
        picture: payload.picture,
      };
    } catch {
      throw new ApiException(401, 'GOOGLE_TOKEN_INVALID', 'Mã đăng nhập Google không hợp lệ.');
    }
  }
}
