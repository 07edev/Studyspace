import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';

// `sid` is the refresh-token family; the guard checks it is still active so logout,
// suspension and password reset revoke live access tokens immediately.
export type AccessTokenPayload = { sub: string; typ: 'access'; sid: string };
export type ResetTokenPayload = { sub: string; typ: 'reset'; pwv: string };

const RESET_TTL_SECONDS = 600;

@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  sign(userId: string, sessionId: string) {
    const payload: AccessTokenPayload = { sub: userId, typ: 'access', sid: sessionId };
    return {
      accessToken: this.jwt.sign(payload),
      tokenType: 'Bearer' as const,
      expiresInSeconds: this.config.jwtAccessTtlSeconds,
    };
  }

  // Returns null for any invalid/expired/wrong-type token (caller maps to 401).
  verify(token: string): AccessTokenPayload | null {
    try {
      const p = this.jwt.verify<AccessTokenPayload>(token);
      return p.typ === 'access' && typeof p.sub === 'string' && typeof p.sid === 'string'
        ? p
        : null;
    } catch {
      return null;
    }
  }

  // Password-reset grant. `pwv` ties it to the current password hash, so it dies once used.
  signReset(userId: string, pwv: string) {
    const payload: ResetTokenPayload = { sub: userId, typ: 'reset', pwv };
    return {
      resetToken: this.jwt.sign(payload, { expiresIn: RESET_TTL_SECONDS }),
      expiresInSeconds: RESET_TTL_SECONDS,
    };
  }

  verifyReset(token: string): { payload?: ResetTokenPayload; expired: boolean } {
    try {
      const p = this.jwt.verify<ResetTokenPayload>(token);
      return p.typ === 'reset' ? { payload: p, expired: false } : { expired: false };
    } catch (error) {
      return { expired: (error as Error).name === 'TokenExpiredError' };
    }
  }
}
