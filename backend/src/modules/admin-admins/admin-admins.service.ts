import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model } from 'mongoose';
import { ApiException } from '../../common/api-error';
import { AccountStatus, AdminStatus, Role } from '../../common/enums';
import type { IdentityContext } from '../../common/identity';
import { Mutex } from '../../common/utils/mutex';
import { normalizeEmail } from '../../common/utils/normalize';
import { pageParams, toPage, type PageQuery } from '../../common/utils/page';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../auth/mail.service';
import { SessionService } from '../auth/session.service';
import { AdminProfile } from '../identity/schemas/admin-profile.schema';
import { User } from '../identity/schemas/user.schema';
import type { AdminCreateDto, AdminPatchDto } from './dto/admin-admins.dto';
import { normalizePermissions } from './permissions';

type UserRow = User & { _id: unknown };
type ProfileRow = AdminProfile & { _id: unknown };

const notFound = () => new ApiException(404, 'NOT_FOUND', 'Không tìm thấy quản trị viên.');
const forbidden = (message: string) => new ApiException(403, 'FORBIDDEN', message);
const isDuplicate = (error: unknown) => (error as { code?: number }).code === 11000;

// API Admin. `id` is the user id: an admin is a user with role ADMIN/SUPER_ADMIN plus a profile
// that holds the status and permissions (the single source of truth for access).
function toAdminDto(user: UserRow, profile: ProfileRow) {
  return {
    id: String(user._id),
    email: user.emailNormalized,
    displayName: (user.profile?.displayName as string | undefined) ?? user.emailNormalized,
    role: user.role,
    status: profile.status,
    permissions: profile.permissions,
    createdAt: user.createdAt,
    updatedAt: profile.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}
export type AdminDto = ReturnType<typeof toAdminDto>;

@Injectable()
export class AdminAdminsService {
  private readonly logger = new Logger('AdminAdmins');
  // Every change to an existing admin runs one at a time. Each one first re-checks that the person
  // making it is still an active Super Admin, so two Super Admins cannot lock each other out
  // (or leave the system with none) by acting at the same moment.
  private readonly lock = new Mutex();

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(AdminProfile.name) private readonly admins: Model<AdminProfile>,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async list(query: PageQuery) {
    const { page, limit, skip } = pageParams(query);
    const [profiles, total] = await Promise.all([
      this.admins.find().sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      this.admins.countDocuments(),
    ]);
    const users = await this.users.find({ _id: { $in: profiles.map(p => p.userId) } }).lean();
    const byId = new Map(users.map(u => [String(u._id), u]));
    const items = profiles.flatMap(profile => {
      const user = byId.get(String(profile.userId));
      return user ? [toAdminDto(user, profile)] : [];
    });
    return toPage(items, total, page, limit);
  }

  private async load(id: string) {
    if (!isValidObjectId(id)) throw notFound();
    const [user, profile] = await Promise.all([
      this.users.findById(id).lean(),
      this.admins.findOne({ userId: id }).lean(),
    ]);
    if (!user || !profile) throw notFound();
    return { user, profile };
  }

  async get(id: string) {
    const { user, profile } = await this.load(id);
    return toAdminDto(user, profile);
  }

  private async assertActorStillSuperAdmin(actor: IdentityContext) {
    const [user, profile] = await Promise.all([
      this.users.findById(actor.userId).select('role').lean(),
      this.admins.findOne({ userId: actor.userId }).select('status').lean(),
    ]);
    if (user?.role !== Role.SUPER_ADMIN || profile?.status !== AdminStatus.ACTIVE) {
      throw forbidden('Bạn không còn quyền Super Admin.');
    }
  }

  async create(actor: IdentityContext, dto: AdminCreateDto, requestId: string) {
    const email = normalizeEmail(dto.email);
    const permissions = normalizePermissions(dto.permissions);
    const taken = () =>
      new ApiException(409, 'EMAIL_ALREADY_EXISTS', 'Email này đã được sử dụng.', [
        { field: 'email', rule: 'unique', message: 'Email này đã được sử dụng.' },
      ]);
    if (await this.users.exists({ emailNormalized: email })) throw taken();

    let user;
    try {
      // No password: the person sets the first one through "Quên mật khẩu", which proves they own
      // the mailbox. Nothing secret is ever sent in the invitation.
      user = await this.users.create({
        emailNormalized: email,
        role: Role.ADMIN,
        status: AccountStatus.ACTIVE,
        emailVerified: false,
        authProviders: [],
        profile: { displayName: dto.displayName },
      });
    } catch (error) {
      throw isDuplicate(error) ? taken() : error;
    }
    let profile;
    try {
      profile = await this.admins.create({ userId: user._id, status: AdminStatus.ACTIVE, permissions });
    } catch (error) {
      await this.users.deleteOne({ _id: user._id }); // do not leave a half-made admin behind
      throw error;
    }
    await this.audit.record({
      actorId: actor.userId,
      actorType: 'ADMIN',
      action: 'ADMIN_CREATED',
      resourceType: 'admin',
      resourceId: String(user._id),
      requestId,
      after: { email, role: Role.ADMIN, status: AdminStatus.ACTIVE, permissions },
    });

    let invitationSent = true;
    try {
      const inviter = await this.users.findById(actor.userId).select('profile').lean();
      await this.mail.sendAdminInvite(
        { email },
        (inviter?.profile?.displayName as string | undefined) ?? 'Super Admin',
        this.config.corsOrigins[0],
      );
    } catch (error) {
      // The account exists either way; tell the caller so it can ask the person to use
      // "Quên mật khẩu" themselves.
      invitationSent = false;
      this.logger.warn(`Admin invitation not delivered: ${(error as Error).message}`);
    }
    return { ...toAdminDto(user.toObject() as UserRow, profile.toObject() as ProfileRow), invitationSent };
  }

  /** PATCH: display name, status and/or permissions. */
  patch(actor: IdentityContext, id: string, dto: AdminPatchDto, requestId: string) {
    if (dto.displayName === undefined && dto.status === undefined && dto.permissions === undefined) {
      throw new ApiException(422, 'VALIDATION_ERROR', 'Cần ít nhất một thay đổi.');
    }
    return this.change(actor, id, dto, requestId, 'ADMIN_UPDATED');
  }

  /** PUT permissions: the list in the request replaces the stored one completely. */
  replacePermissions(actor: IdentityContext, id: string, dto: AdminPatchDto, requestId: string) {
    if (dto.permissions === undefined) {
      throw new ApiException(422, 'VALIDATION_ERROR', 'Dữ liệu chưa hợp lệ.', [
        { field: 'permissions', rule: 'required', message: 'Cần có danh sách quyền.' },
      ]);
    }
    return this.change(actor, id, { permissions: dto.permissions }, requestId, 'ADMIN_PERMISSIONS_REPLACED');
  }

  private change(actor: IdentityContext, id: string, dto: AdminPatchDto, requestId: string, action: string) {
    return this.lock.run(async () => {
      await this.assertActorStillSuperAdmin(actor);
      const { user, profile } = await this.load(id);
      const isSelf = String(user._id) === actor.userId;

      if (dto.status !== undefined) {
        if (isSelf) throw forbidden('Bạn không thể tự vô hiệu hóa tài khoản của mình.');
        if (dto.status === profile.status) {
          throw new ApiException(
            409,
            'INVALID_STATE_TRANSITION',
            profile.status === AdminStatus.ACTIVE
              ? 'Quản trị viên này đang hoạt động.'
              : 'Quản trị viên này đã bị vô hiệu hóa.',
          );
        }
      }
      const permissions = dto.permissions === undefined ? undefined : normalizePermissions(dto.permissions);
      if (permissions !== undefined && user.role === Role.SUPER_ADMIN) {
        throw forbidden('Super Admin luôn có toàn quyền; không cần phân quyền.');
      }

      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (dto.displayName !== undefined && dto.displayName !== user.profile?.displayName) {
        before.displayName = user.profile?.displayName;
        after.displayName = dto.displayName;
        await this.users.updateOne({ _id: user._id }, { $set: { 'profile.displayName': dto.displayName } });
      }
      const profileSet: Record<string, unknown> = {};
      if (dto.status !== undefined) {
        before.status = profile.status;
        after.status = dto.status;
        profileSet.status = dto.status;
      }
      if (permissions !== undefined) {
        before.permissions = profile.permissions;
        after.permissions = permissions;
        profileSet.permissions = permissions;
      }
      if (Object.keys(profileSet).length > 0) {
        await this.admins.updateOne({ userId: user._id }, { $set: profileSet });
      }
      if (dto.status === AdminStatus.DISABLED) {
        await this.sessions.revokeAllForUser(id);
      }
      if (Object.keys(after).length > 0) {
        await this.audit.record({
          actorId: actor.userId,
          actorType: 'ADMIN',
          action,
          resourceType: 'admin',
          resourceId: id,
          requestId,
          before,
          after,
        });
      }
      const fresh = await this.load(id);
      return toAdminDto(fresh.user, fresh.profile);
    });
  }

  /**
   * DELETE: takes admin rights away. The person's account stays (as a normal user) so anything
   * they own is not lost; their sessions end. Nobody can remove themselves, which also guarantees
   * the last Super Admin can never be removed: the one doing it is always another active one.
   */
  remove(actor: IdentityContext, id: string, requestId: string) {
    return this.lock.run(async () => {
      await this.assertActorStillSuperAdmin(actor);
      const { user, profile } = await this.load(id);
      if (String(user._id) === actor.userId) {
        throw forbidden('Bạn không thể gỡ quyền quản trị của chính mình.');
      }
      await this.users.updateOne({ _id: user._id }, { $set: { role: Role.USER } });
      await this.admins.deleteOne({ userId: user._id });
      await this.sessions.revokeAllForUser(id);
      await this.audit.record({
        actorId: actor.userId,
        actorType: 'ADMIN',
        action: 'ADMIN_REMOVED',
        resourceType: 'admin',
        resourceId: id,
        requestId,
        before: { role: user.role, status: profile.status, permissions: profile.permissions },
        after: { role: Role.USER },
      });
    });
  }
}
