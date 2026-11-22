import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { ApiException } from '../../common/api-error';
import { pageParams, toPage, PageQuery } from '../../common/utils/page';
import { Post, PostStatus } from '../posts/post.schema';
import { Comment, CommentStatus } from './comment.schema';
import { CommentBodyDto } from './dto/comments.dto';

const missing = () => new ApiException(404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name) private readonly comments: Model<Comment>,
    @InjectModel(Post.name) private readonly posts: Model<Post>,
  ) {}

  private id(value: string) {
    if (!isValidObjectId(value)) throw missing();
    return new Types.ObjectId(value);
  }

  async list(postId: string, query: PageQuery) {
    const post = await this.posts.findOne({ _id: this.id(postId), status: PostStatus.PUBLISHED }).select('_id');
    if (!post) throw missing();
    const { page, limit, skip } = pageParams(query);
    const filter = { postId: post._id, status: CommentStatus.VISIBLE };
    const [rows, total] = await Promise.all([
      this.comments.find(filter).sort({ createdAt: 1, _id: 1 }).skip(skip).limit(limit).lean(),
      this.comments.countDocuments(filter),
    ]);
    return toPage(rows.map(row => this.present(row)), total, page, limit);
  }

  async create(postId: string, userId: string, dto: CommentBodyDto) {
    const id = this.id(postId);
    const post = await this.posts.findOne({ _id: id, status: PostStatus.PUBLISHED }).select('_id');
    if (!post) throw missing();
    const comment = await this.comments.create({
      postId: id, authorId: this.id(userId), content: dto.content, status: CommentStatus.VISIBLE,
    });
    await this.posts.updateOne({ _id: id }, { $inc: { commentsCount: 1 } });
    return this.present(comment.toObject());
  }

  async update(commentId: string, userId: string, dto: CommentBodyDto) {
    const comment = await this.comments.findOne({ _id: this.id(commentId), authorId: this.id(userId) });
    if (!comment) throw missing();
    comment.content = dto.content;
    await comment.save();
    return this.present(comment.toObject());
  }

  async remove(commentId: string, userId: string) {
    const comment = await this.comments.findOneAndDelete({
      _id: this.id(commentId), authorId: this.id(userId),
    });
    if (!comment) throw missing();
    await this.posts.updateOne(
      { _id: comment.postId, commentsCount: { $gt: 0 } },
      { $inc: { commentsCount: -1 } },
    );
  }

  private present(comment: any) {
    return {
      id: String(comment._id), postId: String(comment.postId), authorId: String(comment.authorId),
      content: comment.content, createdAt: comment.createdAt, updatedAt: comment.updatedAt,
    };
  }
}
