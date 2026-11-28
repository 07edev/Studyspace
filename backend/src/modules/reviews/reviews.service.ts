import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model, type QueryFilter, Types } from 'mongoose';
import { ApiException } from '../../common/api-error';
import type { IdentityContext } from '../../common/identity';
import { escapeRegex, pageParams, toPage, type PageQuery } from '../../common/utils/page';
import { UserContentRegistry } from '../admin-users/ports';
import { AuditService } from '../audit/audit.service';
import { User } from '../identity/schemas/user.schema';
import { PlaceStatus } from '../places/place.enums';
import { PlaceFileRef } from '../places/ports/place-file.port';
import { PlaceEntity, type ImageRefDoc } from '../places/schemas/place.schema';
import type {
  AdminReviewsQueryDto,
  PlaceReviewsQueryDto,
  ReviewModerateDto,
  ReviewWriteDto,
} from './dto/reviews.dto';
import { ReviewEntity, ReviewStatus } from './review.schema';

const reviewNotFound = () => new ApiException(404, 'NOT_FOUND', 'Không tìm thấy đánh giá.');
const placeNotFound = () => new ApiException(404, 'NOT_FOUND', 'Không tìm thấy địa điểm.');

export function computeRatingSummary(ratings: number[]): {
  ratingAverage: number;
  ratingCount: number;
} {
  if (ratings.length === 0) {
    return { ratingAverage: 0, ratingCount: 0 };
  }
  const sum = ratings.reduce((acc, r) => acc + r, 0);
  return {
    ratingAverage: Number((sum / ratings.length).toFixed(2)),
    ratingCount: ratings.length,
  };
}

@Injectable()
export class ReviewsService implements OnModuleInit {
  constructor(
    @InjectModel(ReviewEntity.name) private readonly reviews: Model<ReviewEntity>,
    @InjectModel(PlaceEntity.name) private readonly places: Model<PlaceEntity>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly files: PlaceFileRef,
    private readonly audit: AuditService,
    private readonly userContent: UserContentRegistry,
  ) {}

  onModuleInit() {
    this.userContent.register('reviews', {
      count: userId =>
        this.reviews.countDocuments({
          authorId: new Types.ObjectId(userId),
          status: { $ne: ReviewStatus.DELETED },
        }),
      list: (userId, paging) => this.listMine(userId, paging),
    });
  }

  private async presentMany(docs: (ReviewEntity & { _id: unknown })[], includePlaceName = false) {
    if (docs.length === 0) return [];
    const authorIds = [...new Set(docs.map(d => String(d.authorId)))];
    const placeIds = includePlaceName ? [...new Set(docs.map(d => String(d.placeId)))] : [];

    const [userRows, placeRows] = await Promise.all([
      this.users
        .find({ _id: { $in: authorIds.map(id => new Types.ObjectId(id)) } })
        .select('profile')
        .lean(),
      placeIds.length > 0
        ? this.places
            .find({ _id: { $in: placeIds.map(id => new Types.ObjectId(id)) } })
            .select('name')
            .lean()
        : Promise.resolve([]),
    ]);

    const authorById = new Map(
      userRows.map(u => {
        const profile = (u.profile ?? {}) as Record<string, unknown>;
        return [
          String(u._id),
          {
            id: String(u._id),
            displayName: (profile.displayName as string | undefined) ?? 'Người dùng StudySpace',
            ...(profile.avatarUrl ? { avatarUrl: String(profile.avatarUrl) } : {}),
          },
        ];
      }),
    );
    const placeNameById = new Map(placeRows.map(p => [String(p._id), p.name]));

    return docs.map(doc => ({
      id: String(doc._id),
      placeId: String(doc.placeId),
      ...(includePlaceName && placeNameById.has(String(doc.placeId))
        ? { placeName: placeNameById.get(String(doc.placeId)) }
        : {}),
      author: authorById.get(String(doc.authorId)) ?? {
        id: String(doc.authorId),
        displayName: 'Người dùng StudySpace',
      },
      rating: doc.rating,
      ...(doc.content !== undefined ? { content: doc.content } : {}),
      images: doc.images ?? [],
      status: doc.status,
      createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
      ...(doc.updatedAt
        ? { updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt }
        : {}),
    }));
  }

  private toImageRefs(fileIds?: string[]): ImageRefDoc[] {
    return (fileIds ?? []).map((fileId, idx) => ({
      fileId,
      sortOrder: idx,
      isCover: idx === 0,
    }));
  }

  async recalculatePlaceRating(placeId: Types.ObjectId | string): Promise<void> {
    const pid = typeof placeId === 'string' ? new Types.ObjectId(placeId) : placeId;
    const agg = await this.reviews.aggregate<{ _id: null; avg: number; count: number }>([
      { $match: { placeId: pid, status: ReviewStatus.PUBLISHED } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    const ratingCount = agg[0]?.count ?? 0;
    const ratingAverage = ratingCount > 0 ? Number(agg[0].avg.toFixed(2)) : 0;
    await this.places.updateOne(
      { _id: pid },
      { $set: { ratingAverage, ratingCount, reviewCount: ratingCount } },
    );
  }

  async listByPlace(placeId: string, query: PlaceReviewsQueryDto) {
    if (!isValidObjectId(placeId)) throw placeNotFound();
    const exists = await this.places.exists({ _id: placeId, status: PlaceStatus.PUBLISHED });
    if (!exists) throw placeNotFound();

    const { page, limit, skip } = pageParams(query);
    const sortSpec: Record<string, 1 | -1> =
      query.sort === 'oldest'
        ? { createdAt: 1, _id: 1 }
        : query.sort === 'highest'
          ? { rating: -1, createdAt: -1, _id: -1 }
          : query.sort === 'lowest'
            ? { rating: 1, createdAt: -1, _id: -1 }
            : { createdAt: -1, _id: -1 };

    const filter = { placeId: new Types.ObjectId(placeId), status: ReviewStatus.PUBLISHED };
    const [docs, total] = await Promise.all([
      this.reviews.find(filter).sort(sortSpec).skip(skip).limit(limit).lean(),
      this.reviews.countDocuments(filter),
    ]);
    return toPage(await this.presentMany(docs), total, page, limit);
  }

  async create(actor: IdentityContext, placeId: string, dto: ReviewWriteDto) {
    if (!isValidObjectId(placeId)) throw placeNotFound();
    const placeExists = await this.places.exists({ _id: placeId, status: PlaceStatus.PUBLISHED });
    if (!placeExists) throw placeNotFound();

    const pid = new Types.ObjectId(placeId);
    const uid = new Types.ObjectId(actor.userId);
    const existing = await this.reviews.exists({
      placeId: pid,
      authorId: uid,
      status: { $in: [ReviewStatus.PUBLISHED, ReviewStatus.HIDDEN] },
    });
    if (existing) {
      throw new ApiException(
        409,
        'REVIEW_ALREADY_EXISTS',
        'Bạn đã đánh giá địa điểm này rồi. Bạn có thể chỉnh sửa đánh giá hiện có.',
      );
    }

    if (dto.imageFileIds && dto.imageFileIds.length > 0) {
      await this.files.assertReady(dto.imageFileIds, actor.userId, 'REVIEW_IMAGE');
    }

    let created;
    try {
      created = await this.reviews.create({
        placeId: pid,
        authorId: uid,
        rating: dto.rating,
        content: dto.content,
        images: this.toImageRefs(dto.imageFileIds),
        status: ReviewStatus.PUBLISHED,
      });
    } catch (err) {
      if ((err as { code?: number })?.code === 11000) {
        throw new ApiException(
          409,
          'REVIEW_ALREADY_EXISTS',
          'Bạn đã đánh giá địa điểm này rồi.',
        );
      }
      throw err;
    }

    await this.recalculatePlaceRating(pid);
    const [presented] = await this.presentMany([created], true);
    return presented;
  }

  async patch(actor: IdentityContext, reviewId: string, dto: ReviewWriteDto) {
    if (!isValidObjectId(reviewId)) throw reviewNotFound();
    const current = await this.reviews.findById(reviewId).lean();
    if (!current || current.status === ReviewStatus.DELETED) throw reviewNotFound();
    if (String(current.authorId) !== actor.userId) {
      throw new ApiException(403, 'FORBIDDEN', 'Bạn chỉ có thể chỉnh sửa đánh giá của chính mình.');
    }

    if (dto.imageFileIds && dto.imageFileIds.length > 0) {
      await this.files.assertReady(dto.imageFileIds, actor.userId, 'REVIEW_IMAGE');
    }

    const updated = await this.reviews
      .findByIdAndUpdate(
        reviewId,
        {
          $set: {
            rating: dto.rating,
            ...(dto.content !== undefined ? { content: dto.content } : {}),
            ...(dto.imageFileIds !== undefined ? { images: this.toImageRefs(dto.imageFileIds) } : {}),
          },
        },
        { returnDocument: 'after' },
      )
      .lean();

    await this.recalculatePlaceRating(current.placeId);
    const [presented] = await this.presentMany([updated as NonNullable<typeof updated>], true);
    return presented;
  }

  async remove(actor: IdentityContext, reviewId: string): Promise<void> {
    if (!isValidObjectId(reviewId)) throw reviewNotFound();
    const current = await this.reviews.findById(reviewId).lean();
    if (!current || current.status === ReviewStatus.DELETED) throw reviewNotFound();
    if (String(current.authorId) !== actor.userId) {
      throw new ApiException(403, 'FORBIDDEN', 'Bạn chỉ có thể xóa đánh giá của chính mình.');
    }
    await this.reviews.updateOne({ _id: reviewId }, { $set: { status: ReviewStatus.DELETED } });
    await this.recalculatePlaceRating(current.placeId);
  }

  async listMine(userId: string, query: PageQuery) {
    const { page, limit, skip } = pageParams(query);
    const filter = {
      authorId: new Types.ObjectId(userId),
      status: { $ne: ReviewStatus.DELETED },
    };
    const [docs, total] = await Promise.all([
      this.reviews.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      this.reviews.countDocuments(filter),
    ]);
    return toPage(await this.presentMany(docs, true), total, page, limit);
  }

  async listAdmin(query: AdminReviewsQueryDto) {
    const { page, limit, skip } = pageParams(query);
    const filter: QueryFilter<ReviewEntity> = {};
    if (query.placeId) filter.placeId = new Types.ObjectId(query.placeId);
    if (query.rating) filter.rating = query.rating;
    if (query.status) filter.status = query.status;
    if (query.q) {
      filter.content = new RegExp(escapeRegex(query.q), 'i');
    }
    const [docs, total] = await Promise.all([
      this.reviews.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      this.reviews.countDocuments(filter),
    ]);
    return toPage(await this.presentMany(docs, true), total, page, limit);
  }

  async detailAdmin(reviewId: string) {
    if (!isValidObjectId(reviewId)) throw reviewNotFound();
    const doc = await this.reviews.findById(reviewId).lean();
    if (!doc) throw reviewNotFound();
    const [presented] = await this.presentMany([doc], true);
    return presented;
  }

  async moderate(
    actor: IdentityContext,
    reviewId: string,
    dto: ReviewModerateDto,
    requestId: string,
  ) {
    if (!isValidObjectId(reviewId)) throw reviewNotFound();
    const current = await this.reviews.findById(reviewId).lean();
    if (!current) throw reviewNotFound();
    if (current.status === ReviewStatus.DELETED) {
      throw new ApiException(
        409,
        'INVALID_STATE_TRANSITION',
        'Không thể kiểm duyệt hoặc khôi phục đánh giá đã bị xóa.',
      );
    }
    const nextStatus = dto.action === 'HIDE' ? ReviewStatus.HIDDEN : ReviewStatus.PUBLISHED;
    if (current.status === nextStatus) {
      throw new ApiException(
        409,
        'INVALID_STATE_TRANSITION',
        dto.action === 'HIDE' ? 'Đánh giá này đã bị ẩn.' : 'Đánh giá này đang hiển thị.',
      );
    }

    const updated = await this.reviews
      .findOneAndUpdate(
        { _id: reviewId, status: current.status },
        { $set: { status: nextStatus } },
        { returnDocument: 'after' },
      )
      .lean();
    if (!updated) {
      throw new ApiException(409, 'INVALID_STATE_TRANSITION', 'Trạng thái đánh giá vừa thay đổi.');
    }

    await this.recalculatePlaceRating(current.placeId);
    await this.audit.record({
      actorId: actor.userId,
      actorType: 'ADMIN',
      action: dto.action === 'HIDE' ? 'REVIEW_HIDDEN' : 'REVIEW_RESTORED',
      resourceType: 'review',
      resourceId: reviewId,
      requestId,
      before: { status: current.status },
      after: { status: nextStatus, reason: dto.reason },
    });
    const [presented] = await this.presentMany([updated], true);
    return presented;
  }

  /** Domain action exposed for TV3 ReportableTargetRef when resolving REVIEW reports. */
  async moderateFromReport(
    reviewId: string,
    actor: IdentityContext,
    resolution: 'HIDE_CONTENT' | 'REMOVE_CONTENT',
    reason: string,
    requestId: string,
  ) {
    if (resolution === 'HIDE_CONTENT') {
      return this.moderate(actor, reviewId, { action: 'HIDE', reason }, requestId);
    }
    if (!isValidObjectId(reviewId)) throw reviewNotFound();
    const current = await this.reviews.findById(reviewId).lean();
    if (!current) throw reviewNotFound();
    await this.reviews.updateOne({ _id: reviewId }, { $set: { status: ReviewStatus.DELETED } });
    await this.recalculatePlaceRating(current.placeId);
    await this.audit.record({
      actorId: actor.userId,
      actorType: 'ADMIN',
      action: 'REVIEW_REMOVED_BY_REPORT',
      resourceType: 'review',
      resourceId: reviewId,
      requestId,
      before: { status: current.status },
      after: { status: ReviewStatus.DELETED, reason },
    });
  }
}
