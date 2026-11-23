import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { ApiException } from '../../common/api-error';
import type { IdentityContext } from '../../common/identity';
import { pageParams, toPage } from '../../common/utils/page';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../outbox/outbox.service';
import { Post, PostStatus } from '../posts/post.schema';
import { Comment, CommentStatus } from './comment.schema';
import {
  AdminCommentsQuery,
  CommentModerationDto,
  CommentsQuery,
  CreateCommentDto,
  PatchCommentDto,
} from './dto/comments.dto';

type CommentRecord = {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  parentId?: Types.ObjectId;
  authorId: Types.ObjectId;
  content: string;
  status: CommentStatus;
  replyCount?: number;
  version?: number;
  createdAt: Date;
  updatedAt: Date;
};

const notFound = () => new ApiException(404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');
const invalidParent = () =>
  new ApiException(422, 'PARENT_COMMENT_INVALID', 'Bình luận cha không hợp lệ.');
const forbidden = () => new ApiException(403, 'FORBIDDEN', 'Bạn không có quyền sửa bình luận này.');

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name) private readonly comments: Model<Comment>,
    @InjectModel(Post.name) private readonly posts: Model<Post>,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  private id(value: string) {
    if (!isValidObjectId(value)) throw notFound();
    return new Types.ObjectId(value);
  }

  async reportableOwner(commentId: string) {
    const comment = await this.comments.findOne({
      _id: this.id(commentId),
      status: CommentStatus.PUBLISHED,
    }).select('authorId postId');
    if (!comment) throw notFound();
    const post = await this.posts.findOne({
      _id: comment.postId,
      status: PostStatus.PUBLISHED,
    }).select('_id');
    if (!post) throw notFound();
    return String(comment.authorId);
  }

  async moderationVersion(commentId: string) {
    const comment = await this.comments.findById(this.id(commentId)).select('version');
    if (!comment) throw notFound();
    return comment.version ?? 1;
  }

  async list(postId: string, query: CommentsQuery) {
    const post = await this.posts.findOne({
      _id: this.id(postId),
      status: PostStatus.PUBLISHED,
    }).select('_id');
    if (!post) throw notFound();

    const filter: Record<string, unknown> = {
      postId: post._id,
      status: { $in: [CommentStatus.PUBLISHED, CommentStatus.HIDDEN, CommentStatus.DELETED] },
    };
    if (query.parentId) {
      const parent = await this.comments.findOne({
        _id: this.id(query.parentId),
        postId: post._id,
        parentId: { $exists: false },
        status: { $in: [CommentStatus.PUBLISHED, CommentStatus.HIDDEN, CommentStatus.DELETED] },
      }).select('_id');
      if (!parent) throw invalidParent();
      filter.parentId = parent._id;
    } else {
      filter.parentId = { $exists: false };
    }

    const { page, limit, skip } = pageParams(query);
    const [rows, total] = await Promise.all([
      this.comments.find(filter).sort({ createdAt: 1, _id: 1 }).skip(skip).limit(limit).lean(),
      this.comments.countDocuments(filter),
    ]);
    return toPage(rows.map(row => this.present(row)), total, page, limit);
  }

  async adminList(query: AdminCommentsQuery) {
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = {};
    if (query.postId) filter.postId = this.id(query.postId);
    if (query.status) filter.status = query.status;
    const [rows, total] = await Promise.all([
      this.comments.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      this.comments.countDocuments(filter),
    ]);
    return toPage(rows.map(row => this.present(row, true)), total, page, limit);
  }

  async adminDetail(commentId: string) {
    const comment = await this.comments.findById(this.id(commentId)).lean();
    if (!comment) throw notFound();
    return this.present(comment, true);
  }

  async moderate(
    actor: IdentityContext,
    commentId: string,
    dto: CommentModerationDto,
    requestId: string,
  ) {
    const id = this.id(commentId);
    const comment = await this.comments.findById(id);
    if (!comment) throw notFound();
    const expectedStatus = dto.action === 'HIDE' ? CommentStatus.PUBLISHED : CommentStatus.HIDDEN;
    const nextStatus = dto.action === 'HIDE' ? CommentStatus.HIDDEN : CommentStatus.PUBLISHED;
    const currentVersion = comment.version ?? 1;
    if (currentVersion !== dto.expectedVersion || comment.status !== expectedStatus) {
      throw new ApiException(409, 'VERSION_CONFLICT', 'Bình luận đã được cập nhật hoặc không thể chuyển trạng thái này.');
    }
    if (nextStatus === CommentStatus.PUBLISHED) {
      const post = await this.posts.findOne({ _id: comment.postId, status: PostStatus.PUBLISHED }).select('_id');
      if (!post) throw new ApiException(409, 'INVALID_STATE_TRANSITION', 'Không thể khôi phục bình luận khi bài viết chưa được đăng.');
    }
    const updated = await this.comments.findOneAndUpdate(
      {
        _id: id,
        status: expectedStatus,
        ...(dto.expectedVersion === 1
          ? { $or: [{ version: 1 }, { version: { $exists: false } }] }
          : { version: dto.expectedVersion }),
      },
      { $set: { status: nextStatus, version: dto.expectedVersion + 1 } },
      { returnDocument: 'after' },
    );
    if (!updated) throw new ApiException(409, 'VERSION_CONFLICT', 'Bình luận đã được cập nhật bởi người khác.');

    const counter = dto.action === 'HIDE' ? -1 : 1;
    const changes: Promise<unknown>[] = [
      this.posts.updateOne(
        { _id: comment.postId, ...(counter < 0 ? { commentsCount: { $gt: 0 } } : {}) },
        { $inc: { commentsCount: counter } },
      ),
    ];
    if (comment.parentId) {
      changes.push(this.comments.updateOne(
        { _id: comment.parentId, ...(counter < 0 ? { replyCount: { $gt: 0 } } : {}) },
        { $inc: { replyCount: counter } },
      ));
    }
    await Promise.all(changes);
    await this.audit.record({
      actorId: actor.userId,
      actorType: 'ADMIN',
      action: dto.action === 'HIDE' ? 'COMMENT_HIDDEN' : 'COMMENT_RESTORED',
      resourceType: 'COMMENT',
      resourceId: commentId,
      requestId,
      before: { status: expectedStatus, version: currentVersion },
      after: { status: nextStatus, version: updated.version, reason: dto.reason },
    });
    await this.outbox.enqueue({
      eventType: 'POST_MODERATION_RESULT',
      aggregateType: 'COMMENT',
      aggregateId: commentId,
      payload: {
        recipientId: String(comment.authorId),
        targetType: 'COMMENT',
        targetId: commentId,
        action: dto.action,
        reason: dto.reason,
      },
    });
    return this.present(updated.toObject());
  }

  async create(postId: string, userId: string, dto: CreateCommentDto) {
    const id = this.id(postId);
    const post = await this.posts.findOne({ _id: id, status: PostStatus.PUBLISHED }).select('_id authorId');
    if (!post) throw notFound();

    let parentId: Types.ObjectId | undefined;
    let parentAuthorId: Types.ObjectId | undefined;
    if (dto.parentId) {
      parentId = this.id(dto.parentId);
      const parent = await this.comments.findOne({
        _id: parentId,
        postId: id,
        parentId: { $exists: false },
        status: CommentStatus.PUBLISHED,
      }).select('_id authorId');
      if (!parent) throw invalidParent();
      parentAuthorId = parent.authorId;
    }

    const comment = await this.comments.create({
      postId: id,
      parentId,
      authorId: this.id(userId),
      content: dto.content,
      status: CommentStatus.PUBLISHED,
    });
    const changes: Promise<unknown>[] = [
      this.posts.updateOne({ _id: id, status: PostStatus.PUBLISHED }, { $inc: { commentsCount: 1 } }),
    ];
    if (parentId) {
      changes.push(this.comments.updateOne(
        { _id: parentId, status: CommentStatus.PUBLISHED },
        { $inc: { replyCount: 1 } },
      ));
    }
    await Promise.all(changes);
    const recipients = new Set([String(post.authorId), ...(parentAuthorId ? [String(parentAuthorId)] : [])]);
    recipients.delete(userId);
    await Promise.all([...recipients].map(recipientId => {
      const isReplyRecipient = parentAuthorId !== undefined && recipientId === String(parentAuthorId);
      return this.outbox.enqueue({
        eventType: 'POST_INTERACTION',
        aggregateType: 'POST',
        aggregateId: String(id),
        payload: {
          recipientId,
          targetType: isReplyRecipient ? 'COMMENT' : 'POST',
          targetId: isReplyRecipient ? String(parentId) : String(id),
          title: isReplyRecipient ? 'Có phản hồi mới' : 'Bình luận mới',
          body: 'Nội dung bạn theo dõi vừa có hoạt động mới.',
        },
      });
    }));
    return this.present(comment.toObject());
  }

  async update(commentId: string, userId: string, dto: PatchCommentDto) {
    const comment = await this.comments.findById(this.id(commentId));
    if (!comment || comment.status === CommentStatus.DELETED) throw notFound();
    if (String(comment.authorId) !== userId) throw forbidden();
    if (comment.status !== CommentStatus.PUBLISHED) {
      throw new ApiException(409, 'INVALID_STATE_TRANSITION', 'Bình luận đang bị ẩn và không thể chỉnh sửa.');
    }
    comment.content = dto.content;
    comment.version = (comment.version ?? 1) + 1;
    await comment.save();
    return this.present(comment.toObject());
  }

  async remove(commentId: string, userId: string) {
    const comment = await this.comments.findById(this.id(commentId));
    if (!comment || comment.status === CommentStatus.DELETED) throw notFound();
    if (String(comment.authorId) !== userId) throw forbidden();

    const wasPublished = comment.status === CommentStatus.PUBLISHED;
    comment.status = CommentStatus.DELETED;
    comment.version = (comment.version ?? 1) + 1;
    await comment.save();
    if (wasPublished) {
      const changes: Promise<unknown>[] = [
        this.posts.updateOne(
          { _id: comment.postId, commentsCount: { $gt: 0 } },
          { $inc: { commentsCount: -1 } },
        ),
      ];
      if (comment.parentId) {
        changes.push(this.comments.updateOne(
          { _id: comment.parentId, replyCount: { $gt: 0 } },
          { $inc: { replyCount: -1 } },
        ));
      }
      await Promise.all(changes);
    }
  }

  private present(comment: CommentRecord, includeModerated = false) {
    return {
      id: String(comment._id),
      postId: String(comment.postId),
      parentId: comment.parentId ? String(comment.parentId) : undefined,
      authorId: String(comment.authorId),
      content: includeModerated || comment.status === CommentStatus.PUBLISHED ? comment.content : '',
      status: comment.status,
      replyCount: comment.replyCount ?? 0,
      version: comment.version ?? 1,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }
}
