import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiException } from '../../common/api-error';
import { AccountStatus, AdminStatus, Role } from '../../common/enums';
import type { IdentityContext } from '../../common/identity';
import { normalizeEmail, normalizePhone, sha256 } from '../../common/utils/normalize';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { AuditService } from '../audit/audit.service';
import { AccessTokenService } from '../identity/access-token.service';
import { AdminProfile } from '../identity/schemas/admin-profile.schema';
import { User, type UserDocument } from '../identity/schemas/user.schema';
import type {
  AccountDeleteRequest,
  AuthLogin,
  AuthRegister,
  ChangePassword,
  ContactChangeConfirm,
  ContactChangeRequest,
  GoogleLogin,
  ResetPassword,
} from './dto/auth.dto';
import { GoogleTokenVerifier } from './google-verifier';
import { MailService } from './mail.service';
import { OtpService } from './otp.service';
import { assertPasswordAcceptable, PasswordService } from './password.service';
import { SessionService, type Client } from './session.service';
import { toUserDto } from './user.mapper';

const EMAIL_VERIFY = 'EMAIL_VERIFY';
const PASSWORD_RESET = 'PASSWORD_RESET';
const CONTACT_CHANGE = 'CONTACT_CHANGE';
const PHONE_RE = /^\+?[1-9][0-9]{7,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REAUTH_WINDOW_MS = 10 * 60 * 1000;

const message = (text: string) => ({ message: text });
const isDuplicate = (e: unknown) => (e as { code?: number }).code === 11000;
const mask = (value: string) =>
  value.includes('@')
    ? value.replace(/^(.).*(@.*)$/, '$1***$2')
    : `${value.slice(0, 3)}***${value.slice(-2)}`;

export type SessionResult = {
  body: { user: ReturnType<typeof toUserDto>; tokens: Record<string, unknown> };
  // Present for every login; the controller puts it in the body (MOBILE) or a cookie (WEB).
  refreshToken: string;
  client: Client;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(AdminProfile.name) private readonly admins: Model<AdminProfile>,
    private readonly passwords: PasswordService,
    private readonly otp: OtpService,
    private readonly mail: MailService,
    private readonly sessions: SessionService,
    private readonly tokens: AccessTokenService,
    private readonly google: GoogleTokenVerifier,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // ---------- registration & email verification ----------

  async register(dto: AuthRegister) {
    const email = normalizeEmail(dto.email);
    const phone = dto.phone ? normalizePhone(dto.phone) : undefined;
    assertPasswordAcceptable(dto.password, dto.confirmPassword, {
      field: 'password',
      code: 'VALIDATION_ERROR',
    });
    const existing = await this.users.findOne({ emailNormalized: email });
    if (existing && existing.status !== AccountStatus.PENDING_VERIFICATION) {
      throw new ApiException(409, 'EMAIL_ALREADY_EXISTS', 'Email đã được sử dụng.', [
        { field: 'email', rule: 'unique', message: 'Email đã được sử dụng.' },
      ]);
    }
    if (phone) {
      const owner = await this.users.findOne({ phoneNormalized: phone });
      if (owner && String(owner._id) !== String(existing?._id)) {
        throw new ApiException(409, 'PHONE_ALREADY_EXISTS', 'Số điện thoại đã được sử dụng.', [
          { field: 'phone', rule: 'unique', message: 'Số điện thoại đã được sử dụng.' },
        ]);
      }
    }
    const passwordHash = await this.passwords.hash(dto.password);
    try {
      if (existing) {
        // An unverified signup can be retried (also stops someone squatting an email).
        existing.passwordHash = passwordHash;
        existing.phoneNormalized = phone;
        existing.profile = { ...existing.profile, displayName: dto.displayName.trim() };
        await existing.save();
      } else {
        await this.users.create({
          emailNormalized: email,
          phoneNormalized: phone,
          passwordHash,
          role: Role.USER,
          status: AccountStatus.PENDING_VERIFICATION,
          emailVerified: false,
          authProviders: ['PASSWORD'],
          profile: { displayName: dto.displayName.trim() },
        });
      }
    } catch (error) {
      if (isDuplicate(error)) {
        const field = JSON.stringify((error as { keyPattern?: unknown }).keyPattern ?? {});
        throw field.includes('phone')
          ? new ApiException(409, 'PHONE_ALREADY_EXISTS', 'Số điện thoại đã được sử dụng.')
          : new ApiException(409, 'EMAIL_ALREADY_EXISTS', 'Email đã được sử dụng.');
      }
      throw error;
    }
    const issued = await this.otp.issue({ purpose: EMAIL_VERIFY, emailNormalized: email });
    await this.mail.sendOtp({ email }, EMAIL_VERIFY, issued.code);
    return {
      email,
      status: AccountStatus.PENDING_VERIFICATION,
      otpExpiresAt: issued.expiresAt,
      resendAvailableAt: issued.resendAvailableAt,
    };
  }

  async verifyEmail(emailInput: string, code: string): Promise<SessionResult> {
    const email = normalizeEmail(emailInput);
    await this.otp.verify({ purpose: EMAIL_VERIFY, emailNormalized: email, code });
    const user = await this.users.findOneAndUpdate(
      { emailNormalized: email, status: AccountStatus.PENDING_VERIFICATION },
      { $set: { status: AccountStatus.ACTIVE, emailVerified: true, lastLoginAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!user) {
      throw new ApiException(422, 'OTP_INVALID', 'Mã xác minh không đúng.');
    }
    return this.startSession(user, 'MOBILE');
  }

  async resendVerification(emailInput: string) {
    const email = normalizeEmail(emailInput);
    const user = await this.users.findOne({ emailNormalized: email });
    // Same answer whether or not the account exists (no account enumeration).
    if (user?.status === AccountStatus.PENDING_VERIFICATION) {
      const issued = await this.otp.issue({ purpose: EMAIL_VERIFY, emailNormalized: email });
      await this.mail.sendOtp({ email }, EMAIL_VERIFY, issued.code);
    }
    return message('Nếu email hợp lệ, mã xác minh mới đã được gửi.');
  }

  // ---------- login / session ----------

  async login(dto: AuthLogin): Promise<SessionResult> {
    const email = normalizeEmail(dto.email);
    const user = await this.users.findOne({ emailNormalized: email }).select('+passwordHash');
    const passwordOk = await this.passwords.verify(dto.password, user?.passwordHash);
    if (!user || !passwordOk || user.deletedAt || user.status === AccountStatus.DELETED) {
      throw new ApiException(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
    }
    this.assertCanLogin(user);
    if (dto.client === 'WEB_ADMIN') {
      const profile =
        user.role === Role.USER ? null : await this.admins.findOne({ userId: user._id });
      if (!profile || profile.status !== AdminStatus.ACTIVE) {
        throw new ApiException(403, 'FORBIDDEN', 'Tài khoản không có quyền quản trị.');
      }
    }
    user.lastLoginAt = new Date();
    await user.save();
    return this.startSession(user, dto.client);
  }

  async loginWithGoogle(dto: GoogleLogin): Promise<SessionResult> {
    const profile = await this.google.verify(dto.idToken);
    if (!profile.emailVerified) {
      throw new ApiException(401, 'GOOGLE_TOKEN_INVALID', 'Email Google chưa được xác minh.');
    }
    const email = normalizeEmail(profile.email);
    let user = await this.users.findOne({ emailNormalized: email });
    if (user) {
      this.assertCanLogin(user, true);
      if (!user.authProviders.includes('GOOGLE')) {
        user.authProviders.push('GOOGLE');
      }
      // Google proved ownership of this email, so a pending signup is now verified.
      user.emailVerified = true;
      if (user.status === AccountStatus.PENDING_VERIFICATION) {
        user.status = AccountStatus.ACTIVE;
      }
      user.lastLoginAt = new Date();
      await user.save();
    } else {
      user = await this.users.create({
        emailNormalized: email,
        role: Role.USER,
        status: AccountStatus.ACTIVE,
        emailVerified: true,
        authProviders: ['GOOGLE'],
        profile: { displayName: (profile.name ?? email.split('@')[0]).slice(0, 100) },
        lastLoginAt: new Date(),
      });
    }
    return this.startSession(user, 'MOBILE');
  }

  private assertCanLogin(user: UserDocument, viaGoogle = false) {
    if (user.status === AccountStatus.SUSPENDED) {
      throw new ApiException(403, 'ACCOUNT_SUSPENDED', 'Tài khoản đang bị khóa.');
    }
    if (user.status === AccountStatus.PENDING_VERIFICATION && !viaGoogle) {
      throw new ApiException(403, 'EMAIL_NOT_VERIFIED', 'Email chưa được xác minh.');
    }
    if (user.status === AccountStatus.DELETED || user.deletedAt) {
      throw new ApiException(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
    }
  }

  private async startSession(user: UserDocument, client: Client): Promise<SessionResult> {
    const { refreshToken, familyId } = await this.sessions.start(String(user._id), client);
    return this.buildSession(user, familyId, refreshToken, client);
  }

  private buildSession(
    user: UserDocument,
    familyId: string,
    refreshToken: string,
    client: Client,
  ): SessionResult {
    const access = this.tokens.sign(String(user._id), familyId);
    return {
      body: {
        user: toUserDto(user),
        // The web admin keeps its refresh token in an HttpOnly cookie, never in JS-readable JSON.
        tokens: client === 'MOBILE' ? { ...access, refreshToken } : { ...access },
      },
      refreshToken,
      client,
    };
  }

  async refresh(refreshToken: string, client: Client) {
    const rotated = await this.sessions.rotate(refreshToken, client);
    const user = await this.users.findById(rotated.userId);
    if (!user || user.deletedAt) {
      await this.sessions.revokeFamily(rotated.familyId);
      throw new ApiException(401, 'TOKEN_INVALID', 'Phiên đăng nhập không hợp lệ.');
    }
    if (user.status === AccountStatus.SUSPENDED) {
      await this.sessions.revokeFamily(rotated.familyId);
      throw new ApiException(403, 'ACCOUNT_SUSPENDED', 'Tài khoản đang bị khóa.');
    }
    if (
      user.status !== AccountStatus.ACTIVE &&
      user.status !== AccountStatus.DELETION_REQUESTED
    ) {
      await this.sessions.revokeFamily(rotated.familyId);
      throw new ApiException(401, 'TOKEN_INVALID', 'Phiên đăng nhập không hợp lệ.');
    }
    const access = this.tokens.sign(rotated.userId, rotated.familyId);
    return {
      tokens: client === 'MOBILE' ? { ...access, refreshToken: rotated.refreshToken } : access,
      refreshToken: rotated.refreshToken,
    };
  }

  async logout(identity: IdentityContext) {
    if (identity.sessionId) {
      await this.sessions.revokeFamily(identity.sessionId);
    }
  }

  async me(identity: IdentityContext) {
    const user = await this.users.findById(identity.userId);
    if (!user) {
      throw new ApiException(401, 'UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ.');
    }
    return toUserDto(user);
  }

  // ---------- password ----------

  async forgotPassword(emailInput: string) {
    const email = normalizeEmail(emailInput);
    const user = await this.users.findOne({ emailNormalized: email });
    if (
      user &&
      (user.status === AccountStatus.ACTIVE || user.status === AccountStatus.DELETION_REQUESTED)
    ) {
      const issued = await this.otp.issue({
        purpose: PASSWORD_RESET,
        emailNormalized: email,
        userId: String(user._id),
      });
      await this.mail.sendOtp({ email }, PASSWORD_RESET, issued.code);
    }
    // Identical response for unknown emails.
    return message('Nếu email hợp lệ, mã đặt lại mật khẩu đã được gửi.');
  }

  async verifyResetOtp(emailInput: string, code: string) {
    const email = normalizeEmail(emailInput);
    await this.otp.verify({ purpose: PASSWORD_RESET, emailNormalized: email, code });
    const user = await this.users.findOne({ emailNormalized: email }).select('+passwordHash');
    if (!user) {
      throw new ApiException(422, 'OTP_INVALID', 'Mã xác minh không đúng.');
    }
    return this.tokens.signReset(String(user._id), sha256(user.passwordHash ?? '').slice(0, 16));
  }

  async resetPassword(dto: ResetPassword, requestId: string) {
    const { payload, expired } = this.tokens.verifyReset(dto.resetToken);
    if (!payload) {
      throw expired
        ? new ApiException(410, 'RESET_TOKEN_EXPIRED', 'Phiên đặt lại mật khẩu đã hết hạn.')
        : new ApiException(401, 'RESET_TOKEN_INVALID', 'Phiên đặt lại mật khẩu không hợp lệ.');
    }
    const user = await this.users.findById(payload.sub).select('+passwordHash');
    // pwv changes as soon as the password does, so a grant works exactly once.
    if (!user || sha256(user.passwordHash ?? '').slice(0, 16) !== payload.pwv) {
      throw new ApiException(401, 'RESET_TOKEN_INVALID', 'Phiên đặt lại mật khẩu không hợp lệ.');
    }
    assertPasswordAcceptable(dto.newPassword, dto.confirmPassword, {
      field: 'newPassword',
      code: 'WEAK_PASSWORD',
    });
    user.passwordHash = await this.passwords.hash(dto.newPassword);
    if (!user.authProviders.includes('PASSWORD')) {
      user.authProviders.push('PASSWORD');
    }
    await user.save();
    await this.sessions.revokeAllForUser(String(user._id));
    await this.audit.record({
      actorId: String(user._id),
      actorType: 'USER',
      action: 'PASSWORD_RESET',
      resourceType: 'user',
      resourceId: String(user._id),
      requestId,
    });
    return message('Đã đặt lại mật khẩu. Vui lòng đăng nhập lại.');
  }

  async changePassword(identity: IdentityContext, dto: ChangePassword, requestId: string) {
    const user = await this.users.findById(identity.userId).select('+passwordHash');
    if (!user) {
      throw new ApiException(401, 'UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ.');
    }
    if (!user.passwordHash) {
      throw new ApiException(
        409,
        'AUTH_PROVIDER_UNSUPPORTED',
        'Tài khoản đăng nhập bằng Google không có mật khẩu để đổi.',
      );
    }
    if (!(await this.passwords.verify(dto.currentPassword, user.passwordHash))) {
      throw new ApiException(401, 'INVALID_CREDENTIALS', 'Mật khẩu hiện tại không đúng.', [
        { field: 'currentPassword', rule: 'invalid', message: 'Mật khẩu hiện tại không đúng.' },
      ]);
    }
    assertPasswordAcceptable(dto.newPassword, dto.confirmPassword, {
      field: 'newPassword',
      code: 'WEAK_PASSWORD',
    });
    user.passwordHash = await this.passwords.hash(dto.newPassword);
    await user.save();
    // Other devices must log in again; this one stays signed in.
    await this.sessions.revokeAllForUser(String(user._id), identity.sessionId);
    await this.audit.record({
      actorId: String(user._id),
      actorType: 'USER',
      action: 'PASSWORD_CHANGED',
      resourceType: 'user',
      resourceId: String(user._id),
      requestId,
    });
    return message('Đã đổi mật khẩu.');
  }

  // ---------- contact change ----------

  async requestContactChange(identity: IdentityContext, dto: ContactChangeRequest) {
    const user = await this.users.findById(identity.userId);
    if (!user) {
      throw new ApiException(401, 'UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ.');
    }
    const email = dto.channel === 'EMAIL';
    if (!email && !this.mail.canSendSms()) {
      // Refuse before creating a challenge nobody can receive.
      throw new ApiException(
        503,
        'SMS_NOT_CONFIGURED',
        'Chưa hỗ trợ xác minh số điện thoại qua SMS. Vui lòng dùng email.',
      );
    }
    const value = email ? normalizeEmail(dto.newValue) : normalizePhone(dto.newValue);
    if (!(email ? EMAIL_RE : PHONE_RE).test(value)) {
      throw new ApiException(422, 'VALIDATION_ERROR', 'Dữ liệu chưa hợp lệ.', [
        {
          field: 'newValue',
          rule: email ? 'email' : 'phone',
          message: email ? 'Email không hợp lệ.' : 'Số điện thoại không hợp lệ.',
        },
      ]);
    }
    const taken = await this.users.exists({
      [email ? 'emailNormalized' : 'phoneNormalized']: value,
      _id: { $ne: user._id },
    });
    if (taken) {
      throw new ApiException(409, 'CONTACT_ALREADY_EXISTS', 'Thông tin liên hệ đã được sử dụng.', [
        { field: 'newValue', rule: 'unique', message: 'Thông tin liên hệ đã được sử dụng.' },
      ]);
    }
    const issued = await this.otp.issue({
      purpose: CONTACT_CHANGE,
      // The code is bound to the account's current email so one user cannot reuse another's.
      emailNormalized: email ? value : user.emailNormalized,
      userId: String(user._id),
      target: `${dto.channel}:${value}`,
    });
    await this.mail.sendOtp(email ? { email: value } : { phone: value }, CONTACT_CHANGE, issued.code);
    return {
      challengeId: issued.challengeId,
      deliveryChannel: dto.channel,
      maskedDestination: mask(value),
      expiresAt: issued.expiresAt,
      resendAvailableAt: issued.resendAvailableAt,
    };
  }

  async confirmContactChange(identity: IdentityContext, dto: ContactChangeConfirm) {
    const challenge = await this.otp.verifyById({
      challengeId: dto.challengeId,
      userId: identity.userId,
      purpose: CONTACT_CHANGE,
      code: dto.otp,
    });
    const [channel, value] = (challenge.target ?? '').split(/:(.+)/);
    try {
      const update =
        channel === 'EMAIL'
          ? { emailNormalized: value, emailVerified: true }
          : { phoneNormalized: value };
      const user = await this.users.findByIdAndUpdate(identity.userId, { $set: update }, { returnDocument: 'after' });
      if (!user) {
        throw new ApiException(401, 'UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ.');
      }
      return toUserDto(user);
    } catch (error) {
      if (isDuplicate(error)) {
        throw new ApiException(409, 'CONTACT_ALREADY_EXISTS', 'Thông tin liên hệ đã được sử dụng.');
      }
      throw error;
    }
  }

  // ---------- account deletion ----------

  async requestDeletion(identity: IdentityContext, dto: AccountDeleteRequest, requestId: string) {
    if (dto.confirm !== true) {
      throw new ApiException(422, 'VALIDATION_ERROR', 'Dữ liệu chưa hợp lệ.', [
        { field: 'confirm', rule: 'isTrue', message: 'Bạn cần xác nhận để xóa tài khoản.' },
      ]);
    }
    const user = await this.users.findById(identity.userId).select('+passwordHash');
    if (!user) {
      throw new ApiException(401, 'UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ.');
    }
    const reauth = () =>
      new ApiException(403, 'REAUTH_REQUIRED', 'Vui lòng xác thực lại để tiếp tục.');
    if (user.passwordHash) {
      if (!dto.password || !(await this.passwords.verify(dto.password, user.passwordHash))) {
        throw reauth();
      }
    } else if (!user.lastLoginAt || Date.now() - user.lastLoginAt.getTime() > REAUTH_WINDOW_MS) {
      // Google-only account: require a very recent sign-in instead of a password.
      throw reauth();
    }
    const before = { status: user.status };
    user.status = AccountStatus.DELETION_REQUESTED;
    await user.save();
    await this.audit.record({
      actorId: String(user._id),
      actorType: 'USER',
      action: 'ACCOUNT_DELETION_REQUESTED',
      resourceType: 'user',
      resourceId: String(user._id),
      requestId,
      before,
      after: { status: user.status, reason: dto.reason },
    });
    return message('Đã tiếp nhận yêu cầu xóa tài khoản.');
  }
}
