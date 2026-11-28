import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model, type QueryFilter, Types } from 'mongoose';
import { ApiException } from '../../common/api-error';
import type { IdentityContext } from '../../common/identity';
import { escapeRegex, pageParams, toPage, type PageQuery } from '../../common/utils/page';
import { normalizeSearchText } from '../../common/utils/text-normalize';
import { AuditService } from '../audit/audit.service';
import type {
  AdminPlacesQueryDto,
  FieldDecisionDto,
  PlacePatchDto,
  PlaceStatusPatchDto,
  PlaceUpsertDto,
} from './dto/admin-places.dto';
import { PlaceAttributesService } from './place-attributes.service';
import {
  FieldVerifiedStatus,
  PlaceStatus,
  QuietLevel,
  StudySuitability,
} from './place.enums';
import { toAdminPlaceDto, toPlaceHistoryDto } from './place.mapper';
import { PlaceFileRef } from './ports/place-file.port';
import { CandidateTokenService } from './providers/candidate-token.service';
import { DuplicateCheckService } from './providers/duplicate-check.service';
import { PlaceHistoryEntity } from './schemas/place-history.schema';
import {
  PlaceEntity,
  type FieldStateDoc,
  type ImageRefDoc,
  type PlaceSourceDoc,
} from './schemas/place.schema';
import { validateAttributeValues } from './utils/attribute-validator';
import { validateOpeningHours } from './utils/opening-hours.util';
import { computePlaceDiff, findLockedFieldConflict } from './utils/place-diff.util';

const notFound = () => new ApiException(404, 'NOT_FOUND', 'Không tìm thấy địa điểm.');

@Injectable()
export class AdminPlacesService {
  constructor(
    @InjectModel(PlaceEntity.name) private readonly places: Model<PlaceEntity>,
    @InjectModel(PlaceHistoryEntity.name) private readonly histories: Model<PlaceHistoryEntity>,
    private readonly attributes: PlaceAttributesService,
    private readonly files: PlaceFileRef,
    private readonly audit: AuditService,
    private readonly candidateTokens: CandidateTokenService,
    private readonly duplicateCheck: DuplicateCheckService,
  ) {}

  private buildImages(imageFileIds?: string[], coverFileId?: string | null): ImageRefDoc[] {
    if (!imageFileIds || imageFileIds.length === 0) {
      return [];
    }
    if (coverFileId && !imageFileIds.includes(coverFileId)) {
      throw new ApiException(422, 'VALIDATION_ERROR', 'Ảnh bìa phải nằm trong danh sách ảnh.', [
        { field: 'coverFileId', rule: 'in', message: 'Ảnh bìa phải thuộc danh sách ảnh đã chọn.' },
      ]);
    }
    const chosenCover = coverFileId ?? imageFileIds[0];
    return imageFileIds.map((fileId, idx) => ({
      fileId,
      sortOrder: idx,
      isCover: fileId === chosenCover,
    }));
  }

  private assertPriceValid(price?: { minVnd: number; maxVnd: number } | null) {
    if (price && price.minVnd > price.maxVnd) {
      throw new ApiException(422, 'VALIDATION_ERROR', 'Khoảng giá không hợp lệ.', [
        { field: 'price.minVnd', rule: 'range', message: 'Giá tối thiểu phải nhỏ hơn hoặc bằng giá tối đa.' },
      ]);
    }
  }

  async list(query: AdminPlacesQueryDto) {
    const { page, limit, skip } = pageParams(query);
    const filter: QueryFilter<PlaceEntity> = {};
    if (query.category) filter.category = query.category;
    if (query.origin) filter.origin = query.origin;
    if (query.status) filter.status = query.status;
    if (query.q) {
      const normalized = normalizeSearchText(query.q);
      const raw = new RegExp(escapeRegex(query.q), 'i');
      filter.$or = [
        { name: raw },
        ...(normalized ? [{ nameNormalized: new RegExp(escapeRegex(normalized), 'i') }] : []),
        { 'address.line1': raw },
        ...(isValidObjectId(query.q) ? [{ _id: query.q }] : []),
      ];
    }
    const [docs, total] = await Promise.all([
      this.places.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      this.places.countDocuments(filter),
    ]);
    return toPage(docs.map(toAdminPlaceDto), total, page, limit);
  }

  async detail(placeId: string) {
    if (!isValidObjectId(placeId)) throw notFound();
    const doc = await this.places.findById(placeId).lean();
    if (!doc) throw notFound();
    return toAdminPlaceDto(doc);
  }

  async create(
    actor: IdentityContext,
    dto: PlaceUpsertDto,
    requestId: string,
    extraSources: PlaceSourceDoc[] = [],
  ) {
    const targetStatus = dto.status ?? PlaceStatus.DRAFT;
    if (targetStatus === PlaceStatus.DELETED) {
      throw new ApiException(422, 'VALIDATION_ERROR', 'Không thể tạo mới địa điểm ở trạng thái đã xóa.');
    }
    this.assertPriceValid(dto.price);
    const hours = validateOpeningHours(dto.hours);
    const activeDefs = await this.attributes.findAllActiveForCategory(dto.category);
    const cleanedAttrs = validateAttributeValues(dto.attributes, activeDefs, {
      category: dto.category,
      enforceRequired: targetStatus === PlaceStatus.PUBLISHED,
    });
    if (dto.imageFileIds && dto.imageFileIds.length > 0) {
      await this.files.assertReady(dto.imageFileIds, actor.userId, 'PLACE_IMAGE');
    }

    const sources: PlaceSourceDoc[] = [...extraSources];
    if (dto.importCandidateToken) {
      const verifiedSource = this.candidateTokens.verify(dto.importCandidateToken);
      sources.push(verifiedSource);
    }

    const dupResult = await this.duplicateCheck.check({
      name: dto.name,
      location: dto.location,
      address: dto.address,
    });
    if (dupResult.requiresReview && !dto.duplicateOverrideReason) {
      throw new ApiException(
        409,
        'DUPLICATE_SUSPECTED',
        'Phát hiện địa điểm có khả năng trùng lặp. Hãy kiểm tra trùng hoặc cung cấp lý do xác nhận tạo mới.',
      );
    }

    const images = this.buildImages(dto.imageFileIds, dto.coverFileId);

    const created = await this.places.create({
      name: dto.name,
      nameNormalized: normalizeSearchText(dto.name),
      category: dto.category,
      description: dto.description,
      address: dto.address,
      location: { type: 'Point', coordinates: [dto.location.lng, dto.location.lat] },
      phone: dto.phone,
      website: dto.website,
      images,
      hours,
      price: dto.price,
      amenities: dto.amenities ?? [],
      quietLevel: dto.quietLevel ?? QuietLevel.UNKNOWN,
      studySuitability: dto.studySuitability ?? StudySuitability.UNKNOWN,
      attributes: cleanedAttrs,
      fieldStates: [],
      sources,
      origin: dto.origin,
      status: targetStatus,
      createdBy: new Types.ObjectId(actor.userId),
      version: 1,
    });

    const result = toAdminPlaceDto(created);
    await this.histories.create({
      placeId: created._id,
      actorId: new Types.ObjectId(actor.userId),
      changedAt: new Date(),
      diff: [{ field: 'place', after: { name: result.name, status: result.status }, source: dto.origin }],
    });
    await this.audit.record({
      actorId: actor.userId,
      actorType: 'ADMIN',
      action: 'PLACE_CREATED',
      resourceType: 'place',
      resourceId: result.id,
      requestId,
      after: { name: result.name, category: result.category, status: result.status, origin: result.origin },
    });
    return result;
  }

  async patch(actor: IdentityContext, placeId: string, dto: PlacePatchDto, requestId: string) {
    if (!isValidObjectId(placeId)) throw notFound();
    const current = await this.places.findById(placeId).lean();
    if (!current) throw notFound();
    if (current.status === PlaceStatus.DELETED) {
      throw new ApiException(409, 'INVALID_STATE_TRANSITION', 'Không thể chỉnh sửa địa điểm đã bị xóa mềm.');
    }

    const { version, imageFileIds, coverFileId, ...rest } = dto;
    const touchedKeys = Object.entries(rest)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k);
    if (imageFileIds !== undefined || coverFileId !== undefined) {
      touchedKeys.push('images');
    }

    const lockedConflict = findLockedFieldConflict(current.fieldStates, touchedKeys);
    if (lockedConflict) {
      throw new ApiException(
        409,
        'FIELD_LOCKED',
        `Trường "${lockedConflict}" đang bị khóa. Hãy mở khóa trước khi chỉnh sửa.`,
      );
    }

    this.assertPriceValid(dto.price);
    const nextCategory = dto.category ?? current.category;
    const update: Record<string, unknown> = {};
    const unset: Record<string, 1> = {};

    if (dto.name !== undefined) {
      update.name = dto.name;
      update.nameNormalized = normalizeSearchText(dto.name);
    }
    if (dto.category !== undefined) update.category = dto.category;
    if (dto.description === null) unset.description = 1;
    else if (dto.description !== undefined) update.description = dto.description;
    if (dto.address !== undefined) update.address = dto.address;
    if (dto.location !== undefined) {
      update.location = { type: 'Point', coordinates: [dto.location.lng, dto.location.lat] };
    }
    if (dto.phone === null) unset.phone = 1;
    else if (dto.phone !== undefined) update.phone = dto.phone;
    if (dto.website === null) unset.website = 1;
    else if (dto.website !== undefined) update.website = dto.website;
    if (dto.hours !== undefined) update.hours = validateOpeningHours(dto.hours);
    if (dto.price === null) unset.price = 1;
    else if (dto.price !== undefined) update.price = dto.price;
    if (dto.amenities !== undefined) update.amenities = dto.amenities;
    if (dto.quietLevel !== undefined) update.quietLevel = dto.quietLevel;
    if (dto.studySuitability !== undefined) update.studySuitability = dto.studySuitability;

    if (dto.attributes !== undefined || dto.category !== undefined) {
      const activeDefs = await this.attributes.findAllActiveForCategory(nextCategory);
      update.attributes = validateAttributeValues(
        dto.attributes ?? current.attributes,
        activeDefs,
        {
          category: nextCategory,
          enforceRequired: current.status === PlaceStatus.PUBLISHED,
        },
      );
    }

    if (imageFileIds !== undefined) {
      if (imageFileIds.length > 0) {
        await this.files.assertReady(imageFileIds, actor.userId, 'PLACE_IMAGE');
      }
      update.images = this.buildImages(imageFileIds, coverFileId);
    } else if (coverFileId !== undefined) {
      const existingIds = (current.images ?? []).map(i => i.fileId);
      update.images = this.buildImages(existingIds, coverFileId);
    }

    const updated = await this.places
      .findOneAndUpdate(
        { _id: placeId, version },
        {
          ...(Object.keys(update).length > 0 ? { $set: update } : {}),
          ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
          $inc: { version: 1 },
        },
        { returnDocument: 'after' },
      )
      .lean();

    if (!updated) {
      throw new ApiException(
        409,
        'VERSION_CONFLICT',
        'Địa điểm vừa được người khác cập nhật. Vui lòng tải lại trước khi lưu.',
      );
    }

    const beforeDto = toAdminPlaceDto(current);
    const afterDto = toAdminPlaceDto(updated);
    const diff = computePlaceDiff(beforeDto, afterDto);
    if (diff.length > 0) {
      await this.histories.create({
        placeId: updated._id,
        actorId: new Types.ObjectId(actor.userId),
        changedAt: new Date(),
        diff,
      });
    }
    await this.audit.record({
      actorId: actor.userId,
      actorType: 'ADMIN',
      action: 'PLACE_UPDATED',
      resourceType: 'place',
      resourceId: afterDto.id,
      requestId,
      before: Object.fromEntries(diff.map(d => [d.field, d.before])),
      after: Object.fromEntries(diff.map(d => [d.field, d.after])),
    });
    return afterDto;
  }

  async changeStatus(
    actor: IdentityContext,
    placeId: string,
    dto: PlaceStatusPatchDto,
    requestId: string,
  ) {
    if (!isValidObjectId(placeId)) throw notFound();
    const current = await this.places.findById(placeId).lean();
    if (!current) throw notFound();
    if (current.status === PlaceStatus.DELETED || current.status === dto.status) {
      throw new ApiException(
        409,
        'INVALID_STATE_TRANSITION',
        current.status === PlaceStatus.DELETED
          ? 'Địa điểm đã bị xóa mềm, không thể đổi trạng thái.'
          : `Địa điểm hiện đã ở trạng thái ${dto.status}.`,
      );
    }
    if (dto.status === PlaceStatus.PUBLISHED) {
      const activeDefs = await this.attributes.findAllActiveForCategory(current.category);
      validateAttributeValues(current.attributes, activeDefs, {
        category: current.category,
        enforceRequired: true,
      });
    }

    const setPayload: Record<string, unknown> = { status: dto.status };
    if (dto.status === PlaceStatus.DELETED) {
      setPayload.deletedAt = new Date();
    }
    const updated = await this.places
      .findOneAndUpdate(
        { _id: placeId, status: current.status },
        { $set: setPayload, $inc: { version: 1 } },
        { returnDocument: 'after' },
      )
      .lean();
    if (!updated) {
      throw new ApiException(409, 'INVALID_STATE_TRANSITION', 'Trạng thái địa điểm vừa thay đổi.');
    }

    await this.histories.create({
      placeId: updated._id,
      actorId: new Types.ObjectId(actor.userId),
      changedAt: new Date(),
      diff: [{ field: 'status', before: current.status, after: dto.status, source: dto.reason }],
    });
    await this.audit.record({
      actorId: actor.userId,
      actorType: 'ADMIN',
      action: 'PLACE_STATUS_CHANGED',
      resourceType: 'place',
      resourceId: placeId,
      requestId,
      before: { status: current.status },
      after: { status: dto.status, reason: dto.reason },
    });
    return toAdminPlaceDto(updated);
  }

  async history(placeId: string, query: PageQuery) {
    if (!isValidObjectId(placeId)) throw notFound();
    const exists = await this.places.exists({ _id: placeId });
    if (!exists) throw notFound();
    const { page, limit, skip } = pageParams(query);
    const filter = { placeId: new Types.ObjectId(placeId) };
    const [items, total] = await Promise.all([
      this.histories.find(filter).sort({ changedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      this.histories.countDocuments(filter),
    ]);
    return toPage(items.map(toPlaceHistoryDto), total, page, limit);
  }

  async updateFieldState(
    actor: IdentityContext,
    placeId: string,
    dto: FieldDecisionDto,
    requestId: string,
  ) {
    if (!dto.action && !dto.verified) {
      throw new ApiException(
        422,
        'VALIDATION_ERROR',
        'Cần chọn ít nhất một hành động khóa/mở khóa hoặc trạng thái xác minh.',
      );
    }
    if (!isValidObjectId(placeId)) throw notFound();
    const current = await this.places.findById(placeId).lean();
    if (!current) throw notFound();

    const states: FieldStateDoc[] = [...(current.fieldStates ?? [])];
    const idx = states.findIndex(s => s.path === dto.path);
    const prev: FieldStateDoc =
      idx >= 0
        ? states[idx]
        : { path: dto.path, verified: FieldVerifiedStatus.UNVERIFIED, locked: false };
    const next: FieldStateDoc = {
      path: dto.path,
      verified: dto.verified ?? prev.verified,
      locked: dto.action === 'LOCK' ? true : dto.action === 'UNLOCK' ? false : prev.locked,
      verifiedBy: actor.userId,
      verifiedAt: new Date(),
      note: dto.reason,
    };
    if (idx >= 0) states[idx] = next;
    else states.push(next);

    const updated = await this.places
      .findByIdAndUpdate(
        placeId,
        { $set: { fieldStates: states }, $inc: { version: 1 } },
        { returnDocument: 'after' },
      )
      .lean();

    await this.histories.create({
      placeId: new Types.ObjectId(placeId),
      actorId: new Types.ObjectId(actor.userId),
      changedAt: new Date(),
      diff: [{ field: `fieldStates.${dto.path}`, before: prev, after: next, source: dto.reason }],
    });
    await this.audit.record({
      actorId: actor.userId,
      actorType: 'ADMIN',
      action: 'PLACE_FIELD_STATE_UPDATED',
      resourceType: 'place',
      resourceId: placeId,
      requestId,
      before: prev,
      after: next,
    });
    return toAdminPlaceDto(updated as NonNullable<typeof updated>);
  }

  /** Domain action exposed for TV3 ReportableTargetRef when resolving PLACE reports. */
  async moderateFromReport(
    placeId: string,
    actor: IdentityContext,
    resolution: 'HIDE_CONTENT' | 'REMOVE_CONTENT',
    reason: string,
    expectedVersion: number,
    requestId: string,
  ) {
    if (!isValidObjectId(placeId)) throw notFound();
    const current = await this.places.findById(placeId).lean();
    if (!current) throw notFound();
    if (current.version !== expectedVersion) {
      throw new ApiException(409, 'VERSION_CONFLICT', 'Phiên bản địa điểm đã thay đổi.');
    }
    const nextStatus =
      resolution === 'REMOVE_CONTENT' ? PlaceStatus.DELETED : PlaceStatus.HIDDEN;
    return this.changeStatus(actor, placeId, { status: nextStatus, reason }, requestId);
  }
}
