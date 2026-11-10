import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiException } from '../../common/api-error';
import { AccountStatus } from '../../common/enums';
import { sha256 } from '../../common/utils/normalize';
import { toUserDto } from '../auth/user.mapper';
import { UserDevice } from '../identity/schemas/user-device.schema';
import { User } from '../identity/schemas/user.schema';
import type {
  NotificationDevice,
  NotificationSettingsDto,
  PrivacySettingsDto,
  ProfilePatch,
} from './dto/users.dto';
import { FileReadyRef, TaxonomyRef } from './ports';
import { notificationsOf, privacyOf } from './settings';

const MAX_DEVICES_PER_USER = 10;
const OBJECT_ID = /^[a-fA-F0-9]{24}$/;
const notFound = () => new ApiException(404, 'NOT_FOUND', 'Không tìm thấy người dùng.');

const definedOnly = <T extends object>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(UserDevice.name) private readonly devices: Model<UserDevice>,
    private readonly taxonomy: TaxonomyRef,
    private readonly files: FileReadyRef,
  ) {}

  private async mustFind(userId: string) {
    const user = await this.users.findById(userId).lean();
    if (!user) {
      throw new ApiException(401, 'UNAUTHORIZED', 'Phiên đăng nhập không còn hợp lệ.');
    }
    return user;
  }

  async me(userId: string) {
    return toUserDto(await this.mustFind(userId));
  }

  async patchProfile(userId: string, dto: ProfilePatch) {
    const user = await this.mustFind(userId);
    const next: Record<string, unknown> = { ...user.profile };
    for (const [key, value] of Object.entries(dto)) {
      if (value === undefined) {
        continue;
      }
      if (value === null) {
        delete next[key];
      } else {
        next[key] = value;
      }
    }

    // A major only makes sense under a university.
    if (next.majorId && !next.universityId) {
      throw new ApiException(
        422,
        'UNIVERSITY_MAJOR_MISMATCH',
        'Vui lòng chọn trường trước khi chọn ngành.',
        [{ field: 'majorId', rule: 'universityMajor', message: 'Ngành phải thuộc một trường.' }],
      );
    }
    // Existence and "major belongs to university" are TV2's data; ask them.
    const touchesTaxonomy = ['universityId', 'majorId', 'subjectIds'].some(
      key => (dto as Record<string, unknown>)[key] != null,
    );
    if (touchesTaxonomy) {
      await this.taxonomy.assertValid({
        universityId: next.universityId as string | undefined,
        majorId: next.majorId as string | undefined,
        subjectIds: next.subjectIds as string[] | undefined,
      });
    }
    // The avatar must be an uploaded, READY file owned by this user (TV3's data).
    if (dto.avatarFileId) {
      await this.files.assertReady(dto.avatarFileId, userId);
    }

    const updated = await this.users
      .findByIdAndUpdate(userId, { $set: { profile: next } }, { returnDocument: 'after' })
      .lean();
    return toUserDto(updated as NonNullable<typeof updated>);
  }

  async getPrivacy(userId: string) {
    return privacyOf(await this.mustFind(userId));
  }

  async patchPrivacy(userId: string, dto: PrivacySettingsDto) {
    const current = privacyOf(await this.mustFind(userId));
    const next = { ...current, ...definedOnly(dto) };
    await this.users.updateOne({ _id: userId }, { $set: { privacy: next } });
    return next;
  }

  async getNotificationSettings(userId: string) {
    return notificationsOf(await this.mustFind(userId));
  }

  async patchNotificationSettings(userId: string, dto: NotificationSettingsDto) {
    const current = notificationsOf(await this.mustFind(userId));
    const next = { ...current, ...definedOnly(dto) };
    await this.users.updateOne({ _id: userId }, { $set: { notificationSettings: next } });
    return next;
  }

  // What other people may see (PublicAuthor). Only ACTIVE accounts exist publicly.
  async publicProfile(userId: string) {
    if (!OBJECT_ID.test(userId)) {
      throw notFound();
    }
    const user = await this.users.findById(userId).lean();
    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw notFound();
    }
    const profile = user.profile as Record<string, unknown>;
    const author = {
      id: String(user._id),
      displayName: (profile.displayName as string | undefined) ?? 'Người dùng StudySpace',
      avatarUrl: profile.avatarUrl as string | undefined,
    };
    const privacy = privacyOf(user);
    if (privacy.profileVisibility === 'PRIVATE') {
      return author;
    }
    return {
      ...author,
      bio: profile.bio as string | undefined,
      universityId: privacy.showUniversity ? (profile.universityId as string | undefined) : undefined,
      majorId: privacy.showMajor ? (profile.majorId as string | undefined) : undefined,
    };
  }

  // One row per (user, push token). A token belongs to the latest account that registered it,
  // so signing in as someone else on the same phone stops notifications to the previous user.
  async registerDevice(userId: string, dto: NotificationDevice) {
    const hash = sha256(dto.pushToken);
    const owner = new Types.ObjectId(userId);
    await this.devices.deleteMany({ pushTokenHash: hash, userId: { $ne: owner } });
    const device = await this.devices.findOneAndUpdate(
      { userId: owner, pushTokenHash: hash },
      { $set: { platform: dto.platform, lastSeenAt: new Date(), pushToken: dto.pushToken } },
      { upsert: true, returnDocument: 'after' },
    );
    const total = await this.devices.countDocuments({ userId: owner });
    if (total > MAX_DEVICES_PER_USER) {
      const oldest = await this.devices
        .find({ userId: owner, _id: { $ne: device._id } })
        .sort({ lastSeenAt: 1 })
        .limit(total - MAX_DEVICES_PER_USER)
        .select('_id')
        .lean();
      await this.devices.deleteMany({ _id: { $in: oldest.map(row => row._id) } });
    }
    return { message: 'Đã đăng ký thiết bị nhận thông báo.', deviceId: String(device._id) };
  }

  async removeDevice(userId: string, deviceId: string) {
    const removed =
      OBJECT_ID.test(deviceId) &&
      (await this.devices.deleteOne({ _id: deviceId, userId })).deletedCount === 1;
    if (!removed) {
      throw new ApiException(404, 'NOT_FOUND', 'Không tìm thấy thiết bị.');
    }
  }
}
