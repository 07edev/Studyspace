import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { ApiException } from '../../common/api-error';
import { escapeRegex, pageParams, toPage } from '../../common/utils/page';
import { Post, PostStatus } from './post.schema';
import { PostLike } from './post-like.schema';
import { PostSave } from './post-save.schema';
import { CreatePostDto, PatchPostDto, PostsQuery } from './dto/posts.dto';

const notFound = () => new ApiException(404, 'NOT_FOUND', 'Không tìm thấy bài viết.');
const badId = () => new ApiException(404, 'NOT_FOUND', 'Không tìm thấy bài viết.');

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private readonly posts: Model<Post>,
    @InjectModel(PostLike.name) private readonly likes: Model<PostLike>,
    @InjectModel(PostSave.name) private readonly saves: Model<PostSave>,
  ) {}

  private objectId(id: string) {
    if (!isValidObjectId(id)) throw badId();
    return new Types.ObjectId(id);
  }

  private async owned(postId: string, userId: string) {
    const post = await this.posts.findOne({ _id: this.objectId(postId), authorId: this.objectId(userId) });
    if (!post) throw notFound();
    return post;
  }

  async feed(query: PostsQuery, viewerId?: string) {
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = { status: PostStatus.PUBLISHED };
    if (query.category) filter.category = query.category;
    if (query.authorId) filter.authorId = this.objectId(query.authorId);
    if (query.q?.trim()) {
      const term = new RegExp(escapeRegex(query.q.trim()), 'i');
      filter.$or = [{ title: term }, { content: term }];
    }
    const [rows, total] = await Promise.all([
      this.posts.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      this.posts.countDocuments(filter),
    ]);
    const ids = rows.map(row => row._id);
    const liked = viewerId && ids.length
      ? await this.likes.find({ userId: this.objectId(viewerId), postId: { $in: ids } }).distinct('postId')
      : [];
    const saved = viewerId && ids.length
      ? await this.saves.find({ userId: this.objectId(viewerId), postId: { $in: ids } }).distinct('postId')
      : [];
    const likedSet = new Set(liked.map(String));
    const savedSet = new Set(saved.map(String));
    return toPage(rows.map(row => this.present(row, likedSet.has(String(row._id)), savedSet.has(String(row._id)))), total, page, limit);
  }

  async detail(postId: string, viewerId?: string) {
    const post = await this.posts.findOne({ _id: this.objectId(postId), status: PostStatus.PUBLISHED }).lean();
    if (!post) throw notFound();
    const [liked, saved] = viewerId
      ? await Promise.all([
          this.likes.exists({ userId: this.objectId(viewerId), postId: post._id }),
          this.saves.exists({ userId: this.objectId(viewerId), postId: post._id }),
        ])
      : [false, false];
    return this.present(post, Boolean(liked), Boolean(saved));
  }

  async create(userId: string, dto: CreatePostDto) {
    // File ownership/READY checks are deliberately connected in C04 before image uploads are enabled.
    const post = await this.posts.create({
      authorId: this.objectId(userId),
      title: dto.title,
      content: dto.content,
      category: dto.category,
      imageFileIds: (dto.imageFileIds ?? []).map(id => this.objectId(id)),
      status: dto.status ?? PostStatus.PUBLISHED,
    });
    return this.present(post.toObject(), false, false);
  }

  async mine(userId: string, query: PostsQuery) {
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = { authorId: this.objectId(userId) };
    if (query.status) filter.status = query.status;
    const [rows, total] = await Promise.all([
      this.posts.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.posts.countDocuments(filter),
    ]);
    return toPage(rows.map(row => this.present(row, false, false)), total, page, limit);
  }

  async update(userId: string, postId: string, dto: PatchPostDto) {
    const post = await this.owned(postId, userId);
    const patch: Record<string, unknown> = {};
    for (const key of ['title', 'content', 'category', 'status'] as const) {
      if (dto[key] !== undefined) patch[key] = dto[key];
    }
    if (dto.imageFileIds !== undefined) patch.imageFileIds = dto.imageFileIds.map(id => this.objectId(id));
    Object.assign(post, patch);
    await post.save();
    return this.present(post.toObject(), false, false);
  }

  async remove(userId: string, postId: string) {
    const post = await this.owned(postId, userId);
    await Promise.all([
      this.posts.deleteOne({ _id: post._id }),
      this.likes.deleteMany({ postId: post._id }),
      this.saves.deleteMany({ postId: post._id }),
    ]);
  }

  async like(userId: string, postId: string) {
    const id = this.objectId(postId);
    const post = await this.posts.findOne({ _id: id, status: PostStatus.PUBLISHED });
    if (!post) throw notFound();
    const result = await this.likes.updateOne(
      { userId: this.objectId(userId), postId: id },
      { $setOnInsert: { userId: this.objectId(userId), postId: id } },
      { upsert: true },
    );
    if (result.upsertedCount) await this.posts.updateOne({ _id: id }, { $inc: { likesCount: 1 } });
    return { liked: true };
  }

  async unlike(userId: string, postId: string) {
    const id = this.objectId(postId);
    const removed = await this.likes.deleteOne({ userId: this.objectId(userId), postId: id });
    if (removed.deletedCount) await this.posts.updateOne({ _id: id, likesCount: { $gt: 0 } }, { $inc: { likesCount: -1 } });
    return { liked: false };
  }

  async save(userId: string, postId: string) {
    const id = this.objectId(postId);
    const post = await this.posts.findOne({ _id: id, status: PostStatus.PUBLISHED }).select('_id');
    if (!post) throw notFound();
    await this.saves.updateOne(
      { userId: this.objectId(userId), postId: id },
      { $setOnInsert: { userId: this.objectId(userId), postId: id } },
      { upsert: true },
    );
    return { saved: true };
  }

  async unsave(userId: string, postId: string) {
    await this.saves.deleteOne({ userId: this.objectId(userId), postId: this.objectId(postId) });
    return { saved: false };
  }

  async saved(userId: string, query: PostsQuery) {
    const { page, limit, skip } = pageParams(query);
    const filter = { userId: this.objectId(userId) };
    const [links, total] = await Promise.all([
      this.saves.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.saves.countDocuments(filter),
    ]);
    const ids = links.map(link => link.postId);
    const rows = await this.posts.find({ _id: { $in: ids }, status: PostStatus.PUBLISHED }).lean();
    const byId = new Map(rows.map(row => [String(row._id), row]));
    const ordered = ids.map(id => byId.get(String(id))).filter(Boolean);
    return toPage(ordered.map(row => this.present(row!, false, true)), total, page, limit);
  }

  private present(post: any, liked: boolean, saved: boolean) {
    return {
      id: String(post._id),
      authorId: String(post.authorId),
      title: post.title,
      content: post.content,
      category: post.category,
      status: post.status,
      imageFileIds: (post.imageFileIds ?? []).map((id: Types.ObjectId) => String(id)),
      likesCount: post.likesCount ?? 0,
      commentsCount: post.commentsCount ?? 0,
      liked,
      saved,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
