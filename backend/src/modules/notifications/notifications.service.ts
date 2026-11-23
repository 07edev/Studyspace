import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { ApiException } from '../../common/api-error';
import { AccountStatus } from '../../common/enums';
import { pageParams, toPage } from '../../common/utils/page';
import { User } from '../identity/schemas/user.schema';
import { OutboxService, type OutboxHandler } from '../outbox/outbox.service';
import { notificationsOf } from '../users/settings';
import {
  Notification,
  NotificationTargetType,
  NotificationType,
} from './notification.schema';
import { NotificationsQuery } from './dto/notifications.dto';

const notFound = () => new ApiException(404, 'NOT_FOUND', 'Không tìm thấy thông báo.');

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    @InjectModel(Notification.name) private readonly notifications: Model<Notification>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly outbox: OutboxService,
  ) {}

  onModuleInit() {
    const handler: OutboxHandler = event => this.handleOutboxEvent(event);
    for (const eventType of [
      'USER_STATUS_CHANGED',
      'DOCUMENT_MODERATION_RESULT',
      'REPORT_DECISION',
      'POST_INTERACTION',
      'POST_MODERATION_RESULT',
    ]) {
      this.outbox.subscribe(eventType, handler);
    }
  }

  async list(userId: string, query: NotificationsQuery) {
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = { recipientId: new Types.ObjectId(userId) };
    if (query.unreadOnly) filter.readAt = null;
    const [items, total] = await Promise.all([
      this.notifications.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      this.notifications.countDocuments(filter),
    ]);
    return toPage(items.map(item => this.present(item)), total, page, limit);
  }

  async unreadCount(userId: string) {
    const count = await this.notifications.countDocuments({
      recipientId: new Types.ObjectId(userId),
      readAt: null,
    });
    return { unreadCount: count };
  }

  async readAll(userId: string) {
    const result = await this.notifications.updateMany(
      { recipientId: new Types.ObjectId(userId), readAt: null },
      { $set: { readAt: new Date() } },
    );
    return { updatedCount: result.modifiedCount };
  }

  async mark(userId: string, notificationId: string, read: boolean) {
    if (!isValidObjectId(notificationId)) throw notFound();
    const notification = await this.notifications.findOneAndUpdate(
      { _id: notificationId, recipientId: new Types.ObjectId(userId) },
      { $set: { readAt: read ? new Date() : null } },
      { returnDocument: 'after' },
    ).lean();
    if (!notification) throw notFound();
    return this.present(notification);
  }

  private async handleOutboxEvent(event: Parameters<OutboxHandler>[0]) {
    const payload = event.payload;
    if (event.eventType === 'USER_STATUS_CHANGED') {
      if (payload.action !== 'SUSPEND' && payload.action !== 'UNSUSPEND') {
        throw new Error('Invalid USER_STATUS_CHANGED action');
      }
      const suspended = payload.action === 'SUSPEND';
      return this.createFromEvent(event, {
        recipientId: event.aggregateId,
        type: NotificationType.ADMIN_MESSAGE,
        title: suspended ? 'Tài khoản tạm khóa' : 'Tài khoản đã được mở',
        body: suspended
          ? 'Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ bộ phận hỗ trợ nếu cần thêm thông tin.'
          : 'Tài khoản của bạn đã được mở lại.',
      });
    }
    if (event.eventType === 'DOCUMENT_MODERATION_RESULT') {
      const action = payload.action;
      const body = action === 'APPROVE'
        ? 'Tài liệu của bạn đã được duyệt.'
        : action === 'REJECT'
          ? 'Tài liệu của bạn chưa được duyệt.'
          : 'Tài liệu của bạn đã bị ẩn.';
      const reason = typeof payload.reason === 'string' ? payload.reason.trim().slice(0, 700) : '';
      return this.createFromEvent(event, {
        recipientId: payload.recipientId,
        type: NotificationType.DOCUMENT_RESULT,
        title: 'Cập nhật kiểm duyệt tài liệu',
        body: reason && action !== 'APPROVE' ? `${body} Lý do: ${reason}` : body,
        targetType: NotificationTargetType.DOCUMENT,
        targetId: payload.documentId,
      });
    }
    if (event.eventType === 'REPORT_DECISION') {
      return this.createFromEvent(event, {
        recipientId: payload.reporterId,
        type: NotificationType.REPORT_RESULT,
        title: 'Cập nhật báo cáo',
        body: 'Báo cáo của bạn đã được xem xét.',
        targetType: NotificationTargetType.REPORT,
        targetId: payload.reportId,
      });
    }
    if (event.eventType === 'POST_INTERACTION') {
      return this.createFromEvent(event, {
        recipientId: payload.recipientId,
        type: NotificationType.POST_INTERACTION,
        title: typeof payload.title === 'string' ? payload.title : 'Tương tác mới',
        body: typeof payload.body === 'string' ? payload.body : 'Bài viết của bạn vừa có tương tác mới.',
        targetType: payload.targetType,
        targetId: payload.targetId,
      });
    }
    if (event.eventType === 'POST_MODERATION_RESULT') {
      if (payload.action !== 'HIDE' && payload.action !== 'RESTORE') {
        throw new Error('Invalid POST_MODERATION_RESULT action');
      }
      const hidden = payload.action === 'HIDE';
      const reason = typeof payload.reason === 'string' ? payload.reason.trim().slice(0, 700) : '';
      return this.createFromEvent(event, {
        recipientId: payload.recipientId,
        type: NotificationType.POST_RESULT,
        title: 'Cập nhật kiểm duyệt nội dung',
        body: `${hidden ? 'Nội dung của bạn đã bị ẩn.' : 'Nội dung của bạn đã được khôi phục.'}${reason ? ` Lý do: ${reason}` : ''}`,
        targetType: payload.targetType,
        targetId: payload.targetId,
      });
    }
  }

  private async createFromEvent(
    event: Parameters<OutboxHandler>[0],
    input: {
      recipientId: unknown;
      type: NotificationType;
      title: string;
      body: string;
      targetType?: unknown;
      targetId?: unknown;
    },
  ) {
    const recipientIdValue = typeof input.recipientId === 'string' && isValidObjectId(input.recipientId)
      ? input.recipientId
      : undefined;
    if (!recipientIdValue) {
      throw new Error(`Invalid notification recipient for ${event.eventType}`);
    }
    const recipientId = new Types.ObjectId(recipientIdValue);
    const user = await this.users.findById(recipientId).select('status notificationSettings').lean();
    if (!user || user.status === AccountStatus.DELETED) return;

    const settings = notificationsOf(user);
    const enabled = input.type === NotificationType.POST_INTERACTION
      ? settings.postInteraction
      : input.type === NotificationType.DOCUMENT_RESULT ||
          input.type === NotificationType.REPORT_RESULT ||
          input.type === NotificationType.POST_RESULT
        ? settings.moderation
        : input.type === NotificationType.ADMIN_MESSAGE
          ? settings.adminMessage
          : settings.system;
    if (!enabled) return;

    const targetType = Object.values(NotificationTargetType).includes(input.targetType as NotificationTargetType)
      ? input.targetType as NotificationTargetType
      : undefined;
    const targetIdValue = typeof input.targetId === 'string' && isValidObjectId(input.targetId)
      ? input.targetId
      : undefined;
    const targetId = targetIdValue ? new Types.ObjectId(targetIdValue) : undefined;
    await this.notifications.updateOne(
      { sourceEventId: new Types.ObjectId(event.eventId) },
      {
        $setOnInsert: {
          recipientId,
          type: input.type,
          title: input.title.slice(0, 120),
          body: input.body.slice(0, 1000),
          targetType,
          targetId,
          sourceEventId: new Types.ObjectId(event.eventId),
          readAt: null,
        },
      },
      { upsert: true },
    );
  }

  private present(notification: {
    _id: Types.ObjectId;
    type: NotificationType;
    title: string;
    body: string;
    targetType?: NotificationTargetType;
    targetId?: Types.ObjectId;
    readAt?: Date | null;
    createdAt: Date;
  }) {
    return {
      id: String(notification._id),
      type: notification.type,
      title: notification.title,
      body: notification.body,
      targetType: notification.targetType,
      targetId: notification.targetId ? String(notification.targetId) : undefined,
      read: notification.readAt != null,
      readAt: notification.readAt ?? undefined,
      createdAt: notification.createdAt,
    };
  }
}
