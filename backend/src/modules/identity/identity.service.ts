import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { ApiException } from '../../common/api-error';
import { AccountStatus, AdminStatus, Role } from '../../common/enums';
import type { IdentityContext } from '../../common/identity';
import { AdminProfile } from './schemas/admin-profile.schema';
import { Session } from './schemas/session.schema';
import { User } from './schemas/user.schema';

@Injectable()
export class IdentityService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(AdminProfile.name) private readonly admins: Model<AdminProfile>,
    @InjectModel(Session.name) private readonly sessions: Model<Session>,
  ) {}

  /**
   * Loads identity from the database on every request, so suspending a user or
   * changing/disabling admin permissions takes effect immediately for live tokens.
   */
  async load(userId: string, sessionId?: string): Promise<IdentityContext> {
    if (!isValidObjectId(userId)) {
      throw new ApiException(401, 'UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ.');
    }
    const user = await this.users.findById(userId).lean();
    if (!user || user.deletedAt) {
      throw new ApiException(401, 'UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ.');
    }
    if (user.status === AccountStatus.SUSPENDED) {
      throw new ApiException(403, 'ACCOUNT_SUSPENDED', 'Tài khoản đang bị khóa.');
    }
    if (
      user.status !== AccountStatus.ACTIVE &&
      user.status !== AccountStatus.DELETION_REQUESTED
    ) {
      throw new ApiException(401, 'UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ.');
    }
    if (sessionId) {
      // Logged-out / revoked / expired sessions must stop working even with a live JWT.
      const active = await this.sessions.exists({
        familyId: sessionId,
        userId: user._id,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      });
      if (!active) {
        throw new ApiException(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn.');
      }
    }
    let permissions: IdentityContext['permissions'] = [];
    if (user.role !== Role.USER) {
      const profile = await this.admins.findOne({ userId: user._id }).lean();
      // A disabled/missing admin profile means no admin access, even with a valid token.
      if (!profile || profile.status !== AdminStatus.ACTIVE) {
        throw new ApiException(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.');
      }
      permissions = profile.permissions;
    }
    return {
      userId: String(user._id),
      role: user.role,
      status: user.status,
      permissions,
      sessionId,
    };
  }
}
