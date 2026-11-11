import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type QueryFilter, type Model } from 'mongoose';
import { ApiException } from '../../common/api-error';
import { AccountStatus, Role } from '../../common/enums';
import type { IdentityContext } from '../../common/identity';
import { escapeRegex, pageParams, toPage, type PageQuery } from '../../common/utils/page';
import { AuditLog } from '../audit/audit-log.schema';
import { toAuditEventDto } from '../audit/audit.mapper';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';
import { User } from '../identity/schemas/user.schema';
import { OutboxService } from '../outbox/outbox.service';
import { toAdminUserView } from './admin-users.mapper';
import type { AdminUserListQuery, AdminUserStatusDto } from './dto/admin-users.dto';
import { CONTENT_KINDS, contentNotConnected, UserContentRef, type ContentKind } from './ports';

// Audit actions that make up a user's "violations / handling history" (A07). TV3 adds the actions
// it writes for reports that end in a decision about a user.
export const USER_MODERATION_ACTIONS = ['USER_SUSPENDED', 'USER_UNSUSPENDED'];

const notFound = () => new ApiException(404, 'NOT_FOUND', 'Không tìm thấy người dùng.');
const forbidden = (message: string) => new ApiException(403, 'FORBIDDEN', message);

// Suspension only applies to accounts that can currently sign in or are waiting to verify.
const SUSPENDABLE = [AccountStatus.ACTIVE, AccountStatus.PENDING_VERIFICATION];

const SORTS = {
  createdAt: { createdAt: 1 },
  '-createdAt': { createdAt: -1 },
  lastLoginAt: { lastLoginAt: 1 },
  '-lastLoginAt': { lastLoginAt: -1 },
} as const;

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(AuditLog.name) private readonly logs: Model<AuditLog>,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly content: UserContentRef,
  ) {}

  async list(query: AdminUserListQuery) {
    const { page, limit, skip } = pageParams(query);
    const filter: QueryFilter<User> = {};
    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;
    const from = query.createdFrom ? new Date(query.createdFrom) : undefined;
    const to = query.createdTo ? new Date(query.createdTo) : undefined;
    if (from && to && from > to) {
      throw new ApiException(422, 'QUERY_INVALID', 'Khoảng ngày không hợp lệ.', [
        { field: 'createdFrom', rule: 'range', message: 'Ngày bắt đầu phải trước ngày kết thúc.' },
      ]);
    }
    if (from || to) {
      filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    }
    if (query.q) {
      const text = new RegExp(escapeRegex(query.q), 'i');
      filter.$or = [
        { emailNormalized: text },
        { 'profile.displayName': text },
        ...(isValidObjectId(query.q) ? [{ _id: query.q }] : []),
      ];
    }
    // _id as the last key keeps the order stable between pages when other keys tie.
    const sort = { ...SORTS[query.sort ?? '-createdAt'], _id: -1 } as Record<string, 1 | -1>;
    const [items, total] = await Promise.all([
      this.users.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      this.users.countDocuments(filter),
    ]);
    return toPage(items.map(toAdminUserView), total, page, limit);
  }

  private async mustFind(id: string) {
    if (!isValidObjectId(id)) throw notFound();
    const user = await this.users.findById(id).lean();
    if (!user) throw notFound();
    return user;
  }

  async detail(id: string) {
    const user = await this.mustFind(id);
    const counts = await Promise.all(CONTENT_KINDS.map(kind => this.content.count(kind, id)));
    const [postCount, documentCount, reviewCount, suggestionCount] = counts;
    const history = await this.logs
      .find({ resourceType: 'user', resourceId: id, action: { $in: USER_MODERATION_ACTIONS } })
      .sort({ createdAt: -1 })
      .limit(20);
    return {
      user: toAdminUserView(user),
      // A count is left out while the team that owns that data is not connected yet.
      ...(postCount !== undefined ? { postCount } : {}),
      ...(documentCount !== undefined ? { documentCount } : {}),
      ...(reviewCount !== undefined ? { reviewCount } : {}),
      ...(suggestionCount !== undefined ? { suggestionCount } : {}),
      moderationHistory: history.map(toAuditEventDto),
    };
  }

  async changeStatus(actor: IdentityContext, id: string, dto: AdminUserStatusDto, requestId: string) {
    const target = await this.mustFind(id);
    if (String(target._id) === actor.userId) {
      throw forbidden('Bạn không thể thay đổi trạng thái tài khoản của chính mình.');
    }
    if (target.role === Role.SUPER_ADMIN) {
      throw forbidden('Không thể khóa tài khoản Super Admin.');
    }
    if (target.role === Role.ADMIN && actor.role !== Role.SUPER_ADMIN) {
      throw forbidden('Chỉ Super Admin mới có thể khóa hoặc mở khóa tài khoản quản trị.');
    }

    const suspend = dto.action === 'SUSPEND';
    const nextStatus = suspend
      ? AccountStatus.SUSPENDED
      : target.emailVerified
        ? AccountStatus.ACTIVE
        : AccountStatus.PENDING_VERIFICATION;
    // The status is part of the filter, so of two admins acting at once only one succeeds.
    const updated = await this.users.findOneAndUpdate(
      {
        _id: id,
        status: suspend ? { $in: SUSPENDABLE } : AccountStatus.SUSPENDED,
      },
      { $set: { status: nextStatus } },
      { returnDocument: 'after' },
    );
    if (!updated) {
      throw new ApiException(
        409,
        'INVALID_STATE_TRANSITION',
        suspend
          ? 'Chỉ có thể khóa tài khoản đang hoạt động hoặc đang chờ xác minh.'
          : 'Tài khoản này hiện không bị khóa.',
      );
    }
    if (suspend) {
      await this.sessions.revokeAllForUser(id);
    }
    await this.audit.record({
      actorId: actor.userId,
      actorType: 'ADMIN',
      action: suspend ? 'USER_SUSPENDED' : 'USER_UNSUSPENDED',
      resourceType: 'user',
      resourceId: id,
      requestId,
      before: { status: target.status },
      after: { status: nextStatus, reason: dto.reason },
    });
    // TV3's notification subscriber tells the user. The reason stays in the audit log only.
    await this.outbox.enqueue({
      eventType: 'USER_STATUS_CHANGED',
      aggregateType: 'user',
      aggregateId: id,
      payload: { action: dto.action },
    });
    return toAdminUserView(updated);
  }

  /** Actions the user performed (A07, "activity"). */
  async activity(id: string, query: PageQuery) {
    await this.mustFind(id);
    return this.auditPage({ actorId: id }, query);
  }

  /** Moderation decisions about the user (A07 / ADM-04, "violations"). */
  async violations(id: string, query: PageQuery) {
    await this.mustFind(id);
    return this.auditPage(
      { resourceType: 'user', resourceId: id, action: { $in: USER_MODERATION_ACTIONS } },
      query,
    );
  }

  private async auditPage(filter: QueryFilter<AuditLog>, query: PageQuery) {
    const { page, limit, skip } = pageParams(query);
    const [items, total] = await Promise.all([
      this.logs.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
      this.logs.countDocuments(filter),
    ]);
    return toPage(items.map(toAuditEventDto), total, page, limit);
  }

  /** Posts / documents / reviews / suggestions of a user, from the team that owns them. */
  async contentOf(kind: ContentKind, id: string, query: PageQuery) {
    await this.mustFind(id);
    const { page, limit } = pageParams(query);
    const result = await this.content.list(kind, id, { page, limit });
    if (!result) {
      throw contentNotConnected();
    }
    return result;
  }
}
