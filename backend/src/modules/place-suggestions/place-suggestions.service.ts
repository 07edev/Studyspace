import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Connection, type Model, type QueryFilter, Types } from 'mongoose';
import { ApiException } from '../../common/api-error';
import type { IdentityContext } from '../../common/identity';
import { escapeRegex, pageParams, toPage, type PageQuery } from '../../common/utils/page';
import { normalizeSearchText } from '../../common/utils/text-normalize';
import { UserContentRegistry } from '../admin-users/ports';
import { AuditService } from '../audit/audit.service';
import { User } from '../identity/schemas/user.schema';
import { OutboxService } from '../outbox/outbox.service';
import type { PlaceUpsertDto } from '../places/dto/admin-places.dto';
import type { DuplicateCheckDto } from '../places/dto/place-providers.dto';
import { PlaceAttributesService } from '../places/place-attributes.service';
import {
  PlaceOrigin,
  PlaceStatus,
  QuietLevel,
  StudySuitability,
} from '../places/place.enums';
import { PlacesStatsContributor } from '../places/places-stats.contributor';
import { PlaceFileRef } from '../places/ports/place-file.port';
import { DuplicateCheckService } from '../places/providers/duplicate-check.service';
import { PlaceHistoryEntity } from '../places/schemas/place-history.schema';
import { PlaceEntity } from '../places/schemas/place.schema';
import { validateAttributeValues } from '../places/utils/attribute-validator';
import { validateOpeningHours } from '../places/utils/opening-hours.util';
import type {
  AdminSuggestionsQueryDto,
  ModerationDecisionDto,
  SuggestionCreateDto,
} from './dto/place-suggestions.dto';
import {
  PlaceSuggestionEntity,
  SuggestionStatus,
  SuggestionType,
} from './place-suggestion.schema';
import {
  buildPlaceUpdateFromChanges,
  readPlaceFieldValue,
  validateSuggestionChanges,
} from './utils/suggestion-rules';
import { runInOptionalTransaction } from './utils/transaction.util';

const suggestionNotFound = () => new ApiException(404, 'NOT_FOUND', 'Không tìm thấy đề xuất.');
const placeNotFound = () => new ApiException(404, 'NOT_FOUND', 'Không tìm thấy địa điểm.');

@Injectable()
export class PlaceSuggestionsService implements OnModuleInit {
  constructor(
    @InjectModel(PlaceSuggestionEntity.name)
    private readonly suggestions: Model<PlaceSuggestionEntity>,
    @InjectModel(PlaceEntity.name) private readonly places: Model<PlaceEntity>,
    @InjectModel(PlaceHistoryEntity.name) private readonly histories: Model<PlaceHistoryEntity>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectConnection() private readonly connection: Connection,
    private readonly attributes: PlaceAttributesService,
    private readonly duplicateCheck: DuplicateCheckService,
    private readonly files: PlaceFileRef,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly userContent: UserContentRegistry,
    private readonly placesStats: PlacesStatsContributor,
  ) {}

  onModuleInit() {
    this.userContent.register('suggestions', {
      count: userId =>
        this.suggestions.countDocuments({ submittedBy: new Types.ObjectId(userId) }),
      list: (userId, paging) => this.listMine(userId, paging),
    });
    this.placesStats.registerPendingSuggestionsCounter(() =>
      this.suggestions.countDocuments({ status: SuggestionStatus.PENDING }),
    );
  }

  private async presentMany(docs: (PlaceSuggestionEntity & { _id: unknown })[], refreshOld = false) {
    if (docs.length === 0) return [];
    const authorIds = [...new Set(docs.map(d => String(d.submittedBy)))];
    const placeIds = [...new Set(docs.filter(d => d.placeId).map(d => String(d.placeId)))];

    const [userRows, placeRows] = await Promise.all([
      this.users
        .find({ _id: { $in: authorIds.map(id => new Types.ObjectId(id)) } })
        .select('profile')
        .lean(),
      placeIds.length > 0
        ? this.places
            .find({ _id: { $in: placeIds.map(id => new Types.ObjectId(id)) } })
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
    const placeById = new Map(placeRows.map(p => [String(p._id), p]));

    return docs.map(doc => {
      const place = doc.placeId ? placeById.get(String(doc.placeId)) : undefined;
      const changes =
        refreshOld && doc.status === SuggestionStatus.PENDING && place
          ? (doc.changes ?? []).map(c => ({
              ...c,
              oldValue: readPlaceFieldValue(place, c.fieldPath),
            }))
          : doc.changes ?? [];
      return {
        id: String(doc._id),
        type: doc.type,
        ...(doc.placeId ? { placeId: String(doc.placeId) } : {}),
        ...(place?.name
          ? { placeName: place.name }
          : typeof doc.proposedPlace?.name === 'string'
            ? { placeName: doc.proposedPlace.name }
            : {}),
        ...(doc.proposedPlace ? { proposedPlace: doc.proposedPlace } : {}),
        ...(changes.length > 0 ? { changes } : {}),
        evidenceFileIds: doc.evidenceFileIds ?? [],
        status: doc.status,
        submittedBy: authorById.get(String(doc.submittedBy)) ?? {
          id: String(doc.submittedBy),
          displayName: 'Người dùng StudySpace',
        },
        ...(doc.reviewedBy ? { reviewedBy: String(doc.reviewedBy) } : {}),
        ...(doc.reviewedAt
          ? { reviewedAt: doc.reviewedAt instanceof Date ? doc.reviewedAt.toISOString() : doc.reviewedAt }
          : {}),
        ...(doc.rejectionReason ? { rejectionReason: doc.rejectionReason } : {}),
        createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
        ...(doc.updatedAt
          ? { updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt }
          : {}),
        version: doc.version ?? 1,
      };
    });
  }

  checkDuplicate(dto: DuplicateCheckDto) {
    return this.duplicateCheck.check(dto);
  }

  async create(actor: IdentityContext, dto: SuggestionCreateDto) {
    if (dto.evidenceFileIds && dto.evidenceFileIds.length > 0) {
      await this.files.assertReady(dto.evidenceFileIds, actor.userId, 'EVIDENCE');
    }

    if (dto.type === SuggestionType.CREATE) {
      if (!dto.proposedPlace || dto.placeId) {
        throw new ApiException(
          422,
          'VALIDATION_ERROR',
          'Đề xuất tạo mới cần proposedPlace và không được truyền placeId.',
        );
      }
      const proposed = dto.proposedPlace;
      if (proposed.price && proposed.price.minVnd > proposed.price.maxVnd) {
        throw new ApiException(422, 'VALIDATION_ERROR', 'Khoảng giá không hợp lệ.');
      }
      validateOpeningHours(proposed.hours);
      const defs = await this.attributes.findAllActiveForCategory(proposed.category);
      validateAttributeValues(proposed.attributes, defs, {
        category: proposed.category,
        enforceRequired: false,
      });
      if (proposed.imageFileIds && proposed.imageFileIds.length > 0) {
        await this.files.assertReady(proposed.imageFileIds, actor.userId, 'PLACE_IMAGE');
      }

      const dup = await this.duplicateCheck.check({
        name: proposed.name,
        location: proposed.location,
        address: proposed.address,
      });
      if (dup.requiresReview && !proposed.duplicateOverrideReason) {
        throw new ApiException(
          409,
          'DUPLICATE_SUSPECTED',
          'Phát hiện địa điểm tương tự đã tồn tại. Vui lòng kiểm tra trước khi gửi đề xuất.',
        );
      }

      // PENDING suggestions NEVER mutate the official `places` collection.
      const created = await this.suggestions.create({
        submittedBy: new Types.ObjectId(actor.userId),
        type: SuggestionType.CREATE,
        proposedPlace: { ...proposed, origin: PlaceOrigin.USER_SUGGESTION },
        changes: [],
        evidenceFileIds: dto.evidenceFileIds ?? [],
        status: SuggestionStatus.PENDING,
        version: 1,
      });
      const [presented] = await this.presentMany([created]);
      return presented;
    }

    // UPDATE suggestion
    if (!dto.placeId || !dto.changes || dto.changes.length === 0 || dto.proposedPlace) {
      throw new ApiException(
        422,
        'VALIDATION_ERROR',
        'Đề xuất chỉnh sửa cần placeId và danh sách changes (không truyền proposedPlace).',
      );
    }
    if (!isValidObjectId(dto.placeId)) throw placeNotFound();
    const place = await this.places
      .findOne({ _id: dto.placeId, status: PlaceStatus.PUBLISHED })
      .lean();
    if (!place) throw placeNotFound();

    validateSuggestionChanges(dto.changes, place.fieldStates);

    const changesWithSnapshot = dto.changes.map(c => ({
      fieldPath: c.fieldPath,
      oldValue: readPlaceFieldValue(place, c.fieldPath),
      newValue: c.newValue,
      reason: c.reason,
    }));

    const created = await this.suggestions.create({
      submittedBy: new Types.ObjectId(actor.userId),
      type: SuggestionType.UPDATE,
      placeId: new Types.ObjectId(dto.placeId),
      changes: changesWithSnapshot,
      evidenceFileIds: dto.evidenceFileIds ?? [],
      status: SuggestionStatus.PENDING,
      version: 1,
    });
    const [presented] = await this.presentMany([created]);
    return presented;
  }

  async listMine(userId: string, query: PageQuery) {
    const { page, limit, skip } = pageParams(query);
    const filter = { submittedBy: new Types.ObjectId(userId) };
    const [docs, total] = await Promise.all([
      this.suggestions.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      this.suggestions.countDocuments(filter),
    ]);
    return toPage(await this.presentMany(docs), total, page, limit);
  }

  async detailMine(userId: string, suggestionId: string) {
    if (!isValidObjectId(suggestionId)) throw suggestionNotFound();
    const doc = await this.suggestions.findById(suggestionId).lean();
    if (!doc) throw suggestionNotFound();
    if (String(doc.submittedBy) !== userId) {
      throw new ApiException(403, 'FORBIDDEN', 'Bạn không có quyền xem đề xuất này.');
    }
    const [presented] = await this.presentMany([doc]);
    return presented;
  }

  async listAdmin(query: AdminSuggestionsQueryDto) {
    const { page, limit, skip } = pageParams(query);
    const filter: QueryFilter<PlaceSuggestionEntity> = {};
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    if (query.q) {
      const raw = new RegExp(escapeRegex(query.q), 'i');
      filter.$or = [
        { 'proposedPlace.name': raw },
        { rejectionReason: raw },
        ...(isValidObjectId(query.q) ? [{ _id: query.q }, { placeId: query.q }] : []),
      ];
    }
    const [docs, total] = await Promise.all([
      this.suggestions.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      this.suggestions.countDocuments(filter),
    ]);
    return toPage(await this.presentMany(docs), total, page, limit);
  }

  async detailAdmin(suggestionId: string) {
    if (!isValidObjectId(suggestionId)) throw suggestionNotFound();
    const doc = await this.suggestions.findById(suggestionId).lean();
    if (!doc) throw suggestionNotFound();
    const [presented] = await this.presentMany([doc], true);
    return presented;
  }

  async decide(
    actor: IdentityContext,
    suggestionId: string,
    dto: ModerationDecisionDto,
    requestId: string,
  ) {
    if (!isValidObjectId(suggestionId)) throw suggestionNotFound();
    if (dto.action === 'REJECT' && (!dto.reason || dto.reason.trim().length < 10)) {
      throw new ApiException(422, 'VALIDATION_ERROR', 'Từ chối đề xuất cần lý do tối thiểu 10 ký tự.', [
        { field: 'reason', rule: 'minLength', message: 'Lý do từ chối cần tối thiểu 10 ký tự.' },
      ]);
    }

    const updated = await runInOptionalTransaction(this.connection, async session => {
      const current = await this.suggestions.findById(suggestionId).session(session ?? null).lean();
      if (!current) throw suggestionNotFound();
      if (current.status !== SuggestionStatus.PENDING) {
        throw new ApiException(
          409,
          'INVALID_STATE_TRANSITION',
          'Đề xuất này đã được xử lý trước đó.',
        );
      }
      if (current.version !== dto.expectedVersion) {
        throw new ApiException(
          409,
          'VERSION_CONFLICT',
          'Đề xuất vừa được cập nhật. Vui lòng tải lại trước khi quyết định.',
        );
      }

      let resultingPlaceId = current.placeId;
      let placeName =
        typeof current.proposedPlace?.name === 'string' ? current.proposedPlace.name : undefined;

      if (dto.action === 'APPROVE') {
        if (current.type === SuggestionType.CREATE) {
          const proposed = current.proposedPlace as unknown as PlaceUpsertDto;
          const dup = await this.duplicateCheck.check({
            name: proposed.name,
            location: proposed.location,
            address: proposed.address,
          });
          if (dup.requiresReview && !proposed.duplicateOverrideReason) {
            throw new ApiException(
              409,
              'DUPLICATE_SUSPECTED',
              'Phát hiện địa điểm trùng lặp trước khi phê duyệt. Hãy kiểm tra trùng lặp.',
            );
          }
          const defs = await this.attributes.findAllActiveForCategory(proposed.category);
          const cleanedAttrs = validateAttributeValues(proposed.attributes, defs, {
            category: proposed.category,
            enforceRequired: true,
          });
          const hours = validateOpeningHours(proposed.hours);
          const [createdPlace] = await this.places.create(
            [
              {
                name: proposed.name,
                nameNormalized: normalizeSearchText(proposed.name),
                category: proposed.category,
                description: proposed.description,
                address: proposed.address,
                location: {
                  type: 'Point',
                  coordinates: [proposed.location.lng, proposed.location.lat],
                },
                phone: proposed.phone,
                website: proposed.website,
                images: (proposed.imageFileIds ?? []).map((fileId, idx) => ({
                  fileId,
                  sortOrder: idx,
                  isCover: fileId === (proposed.coverFileId ?? proposed.imageFileIds?.[0]),
                })),
                hours,
                price: proposed.price,
                amenities: proposed.amenities ?? [],
                quietLevel: proposed.quietLevel ?? QuietLevel.UNKNOWN,
                studySuitability: proposed.studySuitability ?? StudySuitability.UNKNOWN,
                attributes: cleanedAttrs,
                fieldStates: [],
                sources: [
                  {
                    provider: PlaceOrigin.USER_SUGGESTION,
                    providerPlaceId: suggestionId,
                    fetchedAt: new Date(),
                    licenseNote: 'Đóng góp từ người dùng StudySpace',
                  },
                ],
                origin: PlaceOrigin.USER_SUGGESTION,
                status: PlaceStatus.PUBLISHED,
                createdBy: current.submittedBy,
                version: 1,
              },
            ],
            { session },
          );
          resultingPlaceId = createdPlace._id;
          placeName = createdPlace.name;
          await this.histories.create(
            [
              {
                placeId: createdPlace._id,
                actorId: new Types.ObjectId(actor.userId),
                changedAt: new Date(),
                diff: [
                  {
                    field: 'place',
                    after: { name: createdPlace.name, status: PlaceStatus.PUBLISHED },
                    source: `SUGGESTION:${suggestionId}`,
                  },
                ],
              },
            ],
            { session },
          );
        } else {
          // UPDATE existing place
          const targetPlace = await this.places
            .findById(current.placeId)
            .session(session ?? null)
            .lean();
          if (!targetPlace || targetPlace.status === PlaceStatus.DELETED) {
            throw new ApiException(
              409,
              'INVALID_STATE_TRANSITION',
              'Địa điểm mục tiêu không còn tồn tại hoặc đã bị xóa.',
            );
          }
          validateSuggestionChanges(current.changes, targetPlace.fieldStates);
          const { setPayload, diff } = buildPlaceUpdateFromChanges(targetPlace, current.changes);

          const nextCategory = (setPayload.category as typeof targetPlace.category) ?? targetPlace.category;
          if (setPayload.attributes !== undefined || setPayload.category !== undefined) {
            const defs = await this.attributes.findAllActiveForCategory(nextCategory);
            setPayload.attributes = validateAttributeValues(
              (setPayload.attributes as typeof targetPlace.attributes) ?? targetPlace.attributes,
              defs,
              {
                category: nextCategory,
                enforceRequired: targetPlace.status === PlaceStatus.PUBLISHED,
              },
            );
          }

          const updatedPlace = await this.places.findOneAndUpdate(
            { _id: targetPlace._id, version: targetPlace.version },
            { $set: setPayload, $inc: { version: 1 } },
            { session, returnDocument: 'after' },
          );
          if (!updatedPlace) {
            throw new ApiException(
              409,
              'VERSION_CONFLICT',
              'Địa điểm vừa bị thay đổi đồng thời. Vui lòng thử lại.',
            );
          }
          placeName = updatedPlace.name;
          if (diff.length > 0) {
            await this.histories.create(
              [
                {
                  placeId: targetPlace._id,
                  actorId: new Types.ObjectId(actor.userId),
                  changedAt: new Date(),
                  diff,
                },
              ],
              { session },
            );
          }
        }
      }

      const nextStatus =
        dto.action === 'APPROVE' ? SuggestionStatus.APPROVED : SuggestionStatus.REJECTED;
      const claimed = await this.suggestions
        .findOneAndUpdate(
          { _id: suggestionId, status: SuggestionStatus.PENDING, version: dto.expectedVersion },
          {
            $set: {
              status: nextStatus,
              reviewedBy: new Types.ObjectId(actor.userId),
              reviewedAt: new Date(),
              ...(resultingPlaceId ? { placeId: resultingPlaceId } : {}),
              ...(dto.action === 'REJECT' ? { rejectionReason: dto.reason } : {}),
            },
            $inc: { version: 1 },
          },
          { session, returnDocument: 'after' },
        )
        .lean();

      if (!claimed) {
        throw new ApiException(
          409,
          'VERSION_CONFLICT',
          'Đề xuất vừa được quản trị viên khác xử lý.',
        );
      }

      await this.audit.record(
        {
          actorId: actor.userId,
          actorType: 'ADMIN',
          action: dto.action === 'APPROVE' ? 'SUGGESTION_APPROVED' : 'SUGGESTION_REJECTED',
          resourceType: 'place_suggestion',
          resourceId: suggestionId,
          requestId,
          before: { status: SuggestionStatus.PENDING, version: dto.expectedVersion },
          after: {
            status: nextStatus,
            ...(resultingPlaceId ? { placeId: String(resultingPlaceId) } : {}),
            ...(dto.reason ? { reason: dto.reason } : {}),
          },
        },
        session,
      );

      // Outbox event consumed by TV3 NotificationsService (NotificationType.SUGGESTION_RESULT).
      await this.outbox.enqueue(
        {
          eventType: 'SUGGESTION_DECIDED',
          aggregateType: 'place_suggestion',
          aggregateId: suggestionId,
          payload: {
            recipientId: String(current.submittedBy),
            suggestionId,
            action: dto.action,
            ...(resultingPlaceId ? { placeId: String(resultingPlaceId) } : {}),
            ...(placeName ? { placeName } : {}),
            ...(dto.action === 'REJECT' && dto.reason ? { reason: dto.reason } : {}),
          },
        },
        session,
      );

      return claimed;
    });

    const [presented] = await this.presentMany([updated]);
    return presented;
  }
}
