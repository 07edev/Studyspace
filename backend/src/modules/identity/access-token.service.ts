import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';

export type AccessTokenPayload = { sub: string; typ: 'access' };

@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  sign(userId: string) {
    const payload: AccessTokenPayload = { sub: userId, typ: 'access' };
    return {
      accessToken: this.jwt.sign(payload),
      tokenType: 'Bearer' as const,
      expiresInSeconds: this.config.jwtAccessTtlSeconds,
    };
  }

  // Returns null for any invalid/expired/wrong-type token (caller maps to 401).
  verify(token: string): AccessTokenPayload | null {
    try {
      const payload = this.jwt.verify<AccessTokenPayload>(token);
      return payload.typ === 'access' && typeof payload.sub === 'string'
        ? payload
        : null;
    } catch {
      return null;
    }
  }
}
