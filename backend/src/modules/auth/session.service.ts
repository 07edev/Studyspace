import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';
import { ApiException } from '../../common/api-error';
import { randomToken, sha256 } from '../../common/utils/normalize';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { Session } from '../identity/schemas/session.schema';

export type Client = 'WEB_ADMIN' | 'MOBILE';

// Refresh tokens: opaque, stored only as sha256, rotated on every use, one family per login.
@Injectable()
export class SessionService {
  constructor(
    @InjectModel(Session.name) private readonly sessions: Model<Session>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private expiry() {
    return new Date(Date.now() + this.config.refreshTtlDays * 24 * 60 * 60 * 1000);
  }

  async start(userId: string, client: Client) {
    return this.create(userId, client, randomUUID());
  }

  private async create(userId: string, client: Client, familyId: string) {
    const refreshToken = randomToken();
    await this.sessions.create({
      userId: new Types.ObjectId(userId),
      refreshTokenHash: sha256(refreshToken),
      familyId,
      client,
      expiresAt: this.expiry(),
    });
    return { refreshToken, familyId };
  }

  /**
   * Rotates a refresh token. Presenting an already-used token means it was stolen or replayed:
   * the whole family is revoked so neither party keeps access.
   */
  async rotate(refreshToken: string, client: Client) {
    const session = await this.sessions.findOne({ refreshTokenHash: sha256(refreshToken) });
    if (!session || session.client !== client) {
      throw new ApiException(401, 'TOKEN_INVALID', 'Phiên đăng nhập không hợp lệ.');
    }
    if (session.revokedAt) {
      await this.revokeFamily(session.familyId);
      throw new ApiException(401, 'TOKEN_REUSED', 'Phiên đăng nhập không còn hiệu lực.');
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new ApiException(401, 'TOKEN_EXPIRED', 'Phiên đăng nhập đã hết hạn.');
    }
    // Atomic: of two parallel refreshes with the same token only one wins.
    const claimed = await this.sessions.findOneAndUpdate(
      { _id: session._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    if (!claimed) {
      await this.revokeFamily(session.familyId);
      throw new ApiException(401, 'TOKEN_REUSED', 'Phiên đăng nhập không còn hiệu lực.');
    }
    const next = await this.create(String(session.userId), client, session.familyId);
    return { userId: String(session.userId), ...next };
  }

  revokeFamily(familyId: string) {
    return this.sessions.updateMany(
      { familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  /** Revokes every session of a user, optionally keeping the current login. */
  revokeAllForUser(userId: string, exceptFamilyId?: string) {
    return this.sessions.updateMany(
      {
        userId: new Types.ObjectId(userId),
        revokedAt: null,
        ...(exceptFamilyId ? { familyId: { $ne: exceptFamilyId } } : {}),
      },
      { $set: { revokedAt: new Date() } },
    );
  }
}
