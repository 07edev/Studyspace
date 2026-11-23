import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { ApiException } from '../../common/api-error';
import type { IdentityContext } from '../../common/identity';
import { escapeRegex, pageParams, toPage } from '../../common/utils/page';
import { AuditService } from '../audit/audit.service';
import { FileAccessRegistry } from '../files/file-access.registry';
import { FilePurpose } from '../files/file.schema';
import { FilesService } from '../files/files.service';
import { OutboxService } from '../outbox/outbox.service';
import { StatsRegistry } from '../stats/stats.registry';
import { DocumentsService } from '../documents/documents.service';
import { Post, PostStatus } from './post.schema';
import { PostLike } from './post-like.schema';
import { PostSave } from './post-save.schema';
import { CreatePostDto, PatchPostDto, PostModerationDto, PostsQuery } from './dto/posts.dto';

type PostRecord = {
  _id: Types.ObjectId;
  authorId: Types.ObjectId;
  title?: string;
  content?: string;
  category?: string;
  subjectIds?: Types.ObjectId[];
  tags?: string[];
  imageFileIds?: Types.ObjectId[];
  documentIds?: Types.ObjectId[];
  status: PostStatus;
  likesCount?: number;
  commentsCount?: number;
  version?: number;
  createdAt: Date;
  updatedAt: Date;
};

const notFound = () => new ApiException(404, 'NOT_FOUND', 'Không tìm thấy bài viết.');
const invalidPost = (field: string, message: string) =>
  new ApiException(422, 'VALIDATION_ERROR', message, [{ field, rule: 'invalid', message }]);

const isDuplicateKey = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;

@Injectable()
export class PostsService implements OnModuleInit {
  constructor(
    @InjectModel(Post.name) private readonly posts: Model<Post>,
    @InjectModel(PostLike.name) private readonly likes: Model<PostLike>,
    @InjectModel(PostSave.name) private readonly saves: Model<PostSave>,
    private readonly files: FilesService,
    private readonly documents: DocumentsService,
    private readonly fileAccess: FileAccessRegistry,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly stats: StatsRegistry,
  ) {}

  onModuleInit() {
    this.fileAccess.register(FilePurpose.POST_IMAGE, 'posts', async file =>
      Boolean(await this.posts.exists({
        status: PostStatus.PUBLISHED,
        imageFileIds: new Types.ObjectId(file.id),
      })),
    );
    this.stats.register({
      name: 'posts',
      overview: async () => ({
        totalPosts: await this.posts.countDocuments({ status: PostStatus.PUBLISHED }),
      }),
      daily: async window => {
        const rows = await this.posts.aggregate<{ date: string; count: number }>([
          { $match: { status: PostStatus.PUBLISHED, createdAt: { $gte: window.from, $lt: window.to } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+07:00' } },
              count: { $sum: 1 },
            },
          },
          { $project: { _id: 0, date: '$_id', count: 1 } },
          { $sort: { date: 1 } },
        ]);
        return { posts: rows };
      },
    });
  }

  private objectId(id: string) {
    if (!isValidObjectId(id)) throw notFound();
    return new Types.ObjectId(id);
  }

  private async owned(postId: string, userId: string) {
    const post = await this.posts.findOne({
      _id: this.objectId(postId),
      status: { $ne: PostStatus.DELETED },
    });
    if (!post) throw notFound();
    if (String(post.authorId) !== userId) {
      throw new ApiException(403, 'FORBIDDEN', 'Bạn không có quyền sửa bài viết này.');
    }
    return post;
  }

  private assertPublishable(title?: string, content?: string) {
    if (!title || title.trim().length < 5 || title.trim().length > 180) {
      throw invalidPost('title', 'Tiêu đề bài viết cần từ 5 đến 180 ký tự khi đăng.');
    }
    if (!content || content.trim().length < 1 || content.trim().length > 10000) {
      throw invalidPost('content', 'Nội dung bài viết cần từ 1 đến 10000 ký tự khi đăng.');
    }
  }

  async feed(query: PostsQuery, viewerId?: string) {
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = { status: PostStatus.PUBLISHED };
    if (query.category) filter.category = query.category;
    if (query.subjectId) filter.subjectIds = this.objectId(query.subjectId);
    if (query.authorId) filter.authorId = this.objectId(query.authorId);
    if (query.q?.trim()) {
      const term = new RegExp(escapeRegex(query.q.trim()), 'i');
      filter.$or = [{ title: term }, { content: term }, { tags: term }];
    }
    const sort: Record<string, 1 | -1> = query.sort === 'POPULAR'
      ? { likesCount: -1, createdAt: -1, _id: -1 }
      : { createdAt: -1, _id: -1 };
    const [rows, total] = await Promise.all([
      this.posts.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      this.posts.countDocuments(filter),
    ]);
    const ids = rows.map(row => row._id);
    const [liked, saved] = viewerId && ids.length
      ? await Promise.all([
          this.likes.find({ userId: this.objectId(viewerId), postId: { $in: ids } }).distinct('postId'),
          this.saves.find({ userId: this.objectId(viewerId), postId: { $in: ids } }).distinct('postId'),
        ])
      : [[], []];
    const likedSet = new Set(liked.map(String));
    const savedSet = new Set(saved.map(String));
    return toPage(
      rows.map(row => this.present(row, likedSet.has(String(row._id)), savedSet.has(String(row._id)))),
      total,
      page,
      limit,
    );
  }

  async adminList(query: PostsQuery) {
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    if (query.subjectId) filter.subjectIds = this.objectId(query.subjectId);
    if (query.authorId) filter.authorId = this.objectId(query.authorId);
    if (query.q?.trim()) {
      const term = new RegExp(escapeRegex(query.q.trim()), 'i');
      filter.$or = [{ title: term }, { content: term }, { tags: term }];
    }
    const [rows, total] = await Promise.all([
      this.posts.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      this.posts.countDocuments(filter),
    ]);
    return toPage(rows.map(row => this.present(row, false, false)), total, page, limit);
  }

  async adminDetail(postId: string) {
    const post = await this.posts.findById(this.objectId(postId)).lean();
    if (!post) throw notFound();
    return this.present(post, false, false);
  }

  async moderate(
    actor: IdentityContext,
    postId: string,
    dto: PostModerationDto,
    requestId: string,
  ) {
    const id = this.objectId(postId);
    const current = await this.posts.findById(id);
    if (!current) throw notFound();
    const from = current.status;
    const expectedStatus = dto.action === 'HIDE' ? PostStatus.PUBLISHED : PostStatus.HIDDEN;
    const nextStatus = dto.action === 'HIDE' ? PostStatus.HIDDEN : PostStatus.PUBLISHED;
    const currentVersion = current.version ?? 1;
    if (currentVersion !== dto.expectedVersion || from !== expectedStatus) {
      throw new ApiException(409, 'VERSION_CONFLICT', 'Bài viết đã được cập nhật hoặc không thể chuyển trạng thái này.');
    }
    if (nextStatus === PostStatus.PUBLISHED) this.assertPublishable(current.title, current.content);
    const updated = await this.posts.findOneAndUpdate(
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
    if (!updated) throw new ApiException(409, 'VERSION_CONFLICT', 'Bài viết đã được cập nhật bởi người khác.');
    await this.audit.record({
      actorId: actor.userId,
      actorType: 'ADMIN',
      action: dto.action === 'HIDE' ? 'POST_HIDDEN' : 'POST_RESTORED',
      resourceType: 'POST',
      resourceId: postId,
      requestId,
      before: { status: from, version: currentVersion },
      after: { status: nextStatus, version: updated.version, reason: dto.reason },
    });
    await this.outbox.enqueue({
      eventType: 'POST_MODERATION_RESULT',
      aggregateType: 'POST',
      aggregateId: postId,
      payload: {
        recipientId: String(updated.authorId),
        targetType: 'POST',
        targetId: postId,
        action: dto.action,
        reason: dto.reason,
      },
    });
    return this.present(updated.toObject(), false, false);
  }

  async detail(postId: string, viewerId?: string) {
    const id = this.objectId(postId);
    const post = viewerId
      ? await this.posts.findOne({
          _id: id,
          status: { $ne: PostStatus.DELETED },
          $or: [{ status: PostStatus.PUBLISHED }, { authorId: this.objectId(viewerId) }],
        }).lean()
      : await this.posts.findOne({ _id: id, status: PostStatus.PUBLISHED }).lean();
    if (!post) throw notFound();
    const [liked, saved] = viewerId
      ? await Promise.all([
          this.likes.exists({ userId: this.objectId(viewerId), postId: post._id }),
          this.saves.exists({ userId: this.objectId(viewerId), postId: post._id }),
        ])
      : [false, false];
    return this.present(post, Boolean(liked), Boolean(saved));
  }

  async reportableOwner(postId: string) {
    const post = await this.posts.findOne({
      _id: this.objectId(postId),
      status: PostStatus.PUBLISHED,
    }).select('authorId');
    if (!post) throw notFound();
    return String(post.authorId);
  }

  async moderationVersion(postId: string) {
    const post = await this.posts.findById(this.objectId(postId)).select('version');
    if (!post) throw notFound();
    return post.version ?? 1;
  }

  async create(userId: string, dto: CreatePostDto) {
    if (dto.status === PostStatus.PUBLISHED) this.assertPublishable(dto.title, dto.content);
    await this.assertAttachments(userId, dto.imageFileIds, dto.documentIds);
    const post = await this.posts.create({
      authorId: this.objectId(userId),
      title: dto.title,
      content: dto.content,
      category: dto.category,
      subjectIds: (dto.subjectIds ?? []).map(id => this.objectId(id)),
      tags: (dto.tags ?? []).map(tag => tag.trim()).filter(Boolean),
      imageFileIds: (dto.imageFileIds ?? []).map(id => this.objectId(id)),
      documentIds: (dto.documentIds ?? []).map(id => this.objectId(id)),
      status: dto.status,
    });
    return this.present(post.toObject(), false, false);
  }

  async mine(userId: string, query: PostsQuery) {
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = {
      authorId: this.objectId(userId),
      status: query.status ?? { $ne: PostStatus.DELETED },
    };
    const [rows, total] = await Promise.all([
      this.posts.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      this.posts.countDocuments(filter),
    ]);
    return toPage(rows.map(row => this.present(row, false, false)), total, page, limit);
  }

  userContentCount(userId: string) {
    return this.posts.countDocuments({
      authorId: this.objectId(userId),
      status: { $ne: PostStatus.DELETED },
    });
  }

  async update(userId: string, postId: string, dto: PatchPostDto) {
    const post = await this.owned(postId, userId);
    if (post.status === PostStatus.HIDDEN) {
      throw new ApiException(409, 'INVALID_STATE_TRANSITION', 'Bài viết đang bị ẩn và không thể chỉnh sửa.');
    }
    if (Object.values(dto).every(value => value === undefined)) {
      throw invalidPost('body', 'Cần cung cấp ít nhất một trường để cập nhật.');
    }

    const nextTitle = dto.title ?? post.title;
    const nextContent = dto.content ?? post.content;
    const nextStatus = dto.status ?? post.status;
    if (nextStatus === PostStatus.PUBLISHED) this.assertPublishable(nextTitle, nextContent);
    await this.assertAttachments(userId, dto.imageFileIds, dto.documentIds);

    if (dto.title !== undefined) post.title = dto.title;
    if (dto.content !== undefined) post.content = dto.content;
    if (dto.category !== undefined) post.category = dto.category;
    if (dto.status !== undefined) post.status = dto.status;
    if (dto.tags !== undefined) post.tags = dto.tags.map(tag => tag.trim()).filter(Boolean);
    if (dto.subjectIds !== undefined) post.subjectIds = dto.subjectIds.map(id => this.objectId(id));
    if (dto.imageFileIds !== undefined) post.imageFileIds = dto.imageFileIds.map(id => this.objectId(id));
    if (dto.documentIds !== undefined) post.documentIds = dto.documentIds.map(id => this.objectId(id));
    post.version = (post.version ?? 1) + 1;
    await post.save();
    return this.present(post.toObject(), false, false);
  }

  async remove(userId: string, postId: string) {
    const post = await this.owned(postId, userId);
    if (post.status === PostStatus.HIDDEN) {
      throw new ApiException(409, 'INVALID_STATE_TRANSITION', 'Bài viết đang bị ẩn và không thể xóa.');
    }
    post.status = PostStatus.DELETED;
    post.version = (post.version ?? 1) + 1;
    await post.save();
  }

  async like(userId: string, postId: string) {
    const id = this.objectId(postId);
    const post = await this.posts.findOne({ _id: id, status: PostStatus.PUBLISHED }).select('_id authorId');
    if (!post) throw notFound();
    try {
      const result = await this.likes.updateOne(
        { userId: this.objectId(userId), postId: id },
        { $setOnInsert: { userId: this.objectId(userId), postId: id } },
        { upsert: true },
      );
      if (result.upsertedCount) {
        await this.posts.updateOne({ _id: id }, { $inc: { likesCount: 1 } });
        if (String(post.authorId) !== userId) {
          await this.outbox.enqueue({
            eventType: 'POST_INTERACTION',
            aggregateType: 'POST',
            aggregateId: String(id),
            payload: {
              recipientId: String(post.authorId),
              targetType: 'POST',
              targetId: String(id),
              title: 'Lượt thích mới',
              body: 'Bài viết của bạn vừa nhận được một lượt thích.',
            },
          });
        }
      }
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
    return { liked: true };
  }

  async unlike(userId: string, postId: string) {
    const id = this.objectId(postId);
    const post = await this.posts.findOne({ _id: id, status: PostStatus.PUBLISHED }).select('_id');
    if (!post) throw notFound();
    const removed = await this.likes.deleteOne({ userId: this.objectId(userId), postId: id });
    if (removed.deletedCount) {
      await this.posts.updateOne({ _id: id, likesCount: { $gt: 0 } }, { $inc: { likesCount: -1 } });
    }
  }

  async save(userId: string, postId: string) {
    const id = this.objectId(postId);
    const post = await this.posts.findOne({ _id: id, status: PostStatus.PUBLISHED }).select('_id');
    if (!post) throw notFound();
    try {
      await this.saves.updateOne(
        { userId: this.objectId(userId), postId: id },
        { $setOnInsert: { userId: this.objectId(userId), postId: id } },
        { upsert: true },
      );
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
    return { saved: true };
  }

  async unsave(userId: string, postId: string) {
    const id = this.objectId(postId);
    const post = await this.posts.findOne({ _id: id, status: PostStatus.PUBLISHED }).select('_id');
    if (!post) throw notFound();
    await this.saves.deleteOne({ userId: this.objectId(userId), postId: id });
  }

  async saved(userId: string, query: PostsQuery) {
    const { page, limit, skip } = pageParams(query);
    const filter = { userId: this.objectId(userId) };
    const [links, total] = await Promise.all([
      this.saves.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      this.saves.countDocuments(filter),
    ]);
    const ids = links.map(link => link.postId);
    const rows = await this.posts.find({ _id: { $in: ids }, status: PostStatus.PUBLISHED }).lean();
    const byId = new Map(rows.map(row => [String(row._id), row]));
    const ordered = ids.map(id => byId.get(String(id))).filter((row): row is NonNullable<typeof row> => !!row);
    return toPage(ordered.map(row => this.present(row, false, true)), total, page, limit);
  }

  private async assertAttachments(userId: string, imageFileIds?: string[], documentIds?: string[]) {
    await Promise.all([
      ...(imageFileIds ?? []).map(fileId =>
        this.files.assertReadyForPurpose(fileId, userId, FilePurpose.POST_IMAGE),
      ),
      ...(documentIds ?? []).map(documentId => this.documents.assertPublicAttachable(documentId)),
    ]);
  }

  private present(post: PostRecord, liked: boolean, saved: boolean) {
    return {
      id: String(post._id),
      authorId: String(post.authorId),
      title: post.title,
      content: post.content,
      category: post.category,
      subjectIds: (post.subjectIds ?? []).map(String),
      tags: post.tags ?? [],
      imageFileIds: (post.imageFileIds ?? []).map(String),
      documentIds: (post.documentIds ?? []).map(String),
      status: post.status,
      likesCount: post.likesCount ?? 0,
      commentsCount: post.commentsCount ?? 0,
      version: post.version ?? 1,
      liked,
      saved,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
