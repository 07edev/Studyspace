import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model, type QueryFilter } from 'mongoose';
import { ApiException } from '../../common/api-error';
import type { IdentityContext } from '../../common/identity';
import { pageParams, toPage, type PageQuery } from '../../common/utils/page';
import { AuditService } from '../audit/audit.service';
import type {
  AttributeDefinitionPatchDto,
  AttributeDefinitionsQueryDto,
  AttributeDefinitionWriteDto,
} from './dto/place-attributes.dto';
import { AttributeType, PlaceCategory } from './place.enums';
import { toAttributeDefinitionDto } from './place.mapper';
import { PlaceAttributeDefinitionEntity } from './schemas/place-attribute-definition.schema';
import { PlaceEntity } from './schemas/place.schema';

const SELECT_TYPES = new Set<AttributeType>([
  AttributeType.SINGLE_SELECT,
  AttributeType.MULTI_SELECT,
]);

export const DEFAULT_ATTRIBUTE_DEFINITIONS: AttributeDefinitionWriteDto[] = [
  {
    key: 'wifi-speed',
    label: 'Tốc độ Wi-Fi',
    type: AttributeType.SINGLE_SELECT,
    options: ['Cơ bản', 'Nhanh', 'Rất nhanh'],
    required: false,
    filterable: true,
    active: true,
  },
  {
    key: 'power-outlets',
    label: 'Mật độ ổ cắm điện',
    type: AttributeType.SINGLE_SELECT,
    options: ['Ít', 'Vừa đủ', 'Nhiều ở mọi bàn'],
    required: false,
    filterable: true,
    active: true,
  },
  {
    key: 'drink-required',
    label: 'Bắt buộc gọi đồ uống',
    type: AttributeType.BOOLEAN,
    required: false,
    filterable: true,
    active: true,
    category: PlaceCategory.CAFE,
  },
  {
    key: 'parking-fee',
    label: 'Phí gửi xe',
    type: AttributeType.SINGLE_SELECT,
    options: ['Miễn phí', 'Có thu phí', 'Không có chỗ gửi'],
    required: false,
    filterable: true,
    active: true,
  },
  {
    key: 'seat-capacity',
    label: 'Sức chứa ước tính',
    type: AttributeType.NUMBER,
    unit: 'chỗ',
    required: false,
    filterable: false,
    active: true,
  },
];

@Injectable()
export class PlaceAttributesService {
  constructor(
    @InjectModel(PlaceAttributeDefinitionEntity.name)
    private readonly definitions: Model<PlaceAttributeDefinitionEntity>,
    @InjectModel(PlaceEntity.name)
    private readonly places: Model<PlaceEntity>,
    private readonly audit: AuditService,
  ) {}

  async listPublic(query: AttributeDefinitionsQueryDto) {
    const { page, limit, skip } = pageParams(query);
    const filter: QueryFilter<PlaceAttributeDefinitionEntity> = {
      active: query.active ?? true,
    };
    if (query.filterable !== undefined) {
      filter.filterable = query.filterable;
    }
    if (query.category) {
      filter.$or = [{ category: query.category }, { category: { $exists: false } }, { category: null }];
    }
    const [items, total] = await Promise.all([
      this.definitions.find(filter).sort({ createdAt: 1, _id: 1 }).skip(skip).limit(limit).lean(),
      this.definitions.countDocuments(filter),
    ]);
    return toPage(items.map(toAttributeDefinitionDto), total, page, limit);
  }

  async listAdmin(query: PageQuery) {
    const { page, limit, skip } = pageParams(query);
    const [items, total] = await Promise.all([
      this.definitions.find({}).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      this.definitions.countDocuments({}),
    ]);
    return toPage(items.map(toAttributeDefinitionDto), total, page, limit);
  }

  async findAllActiveForCategory(category?: PlaceCategory) {
    const filter: QueryFilter<PlaceAttributeDefinitionEntity> = { active: true };
    if (category) {
      filter.$or = [{ category }, { category: { $exists: false } }, { category: null }];
    }
    return this.definitions.find(filter).lean();
  }

  private assertSelectOptions(type: AttributeType, options?: string[]) {
    if (SELECT_TYPES.has(type) && (!options || options.length === 0)) {
      throw new ApiException(
        422,
        'VALIDATION_ERROR',
        'Thuộc tính dạng chọn cần ít nhất một lựa chọn.',
        [{ field: 'options', rule: 'required', message: 'Cần ít nhất một lựa chọn.' }],
      );
    }
  }

  async create(actor: IdentityContext, dto: AttributeDefinitionWriteDto, requestId: string) {
    this.assertSelectOptions(dto.type, dto.options);
    const existing = await this.definitions
      .findOne({ key: dto.key, category: dto.category ?? null })
      .lean();
    if (existing) {
      throw new ApiException(
        409,
        'DUPLICATE_ATTRIBUTE_KEY',
        `Mã thuộc tính "${dto.key}" đã tồn tại.`,
        [{ field: 'key', rule: 'unique', message: 'Mã thuộc tính đã tồn tại.' }],
      );
    }
    const created = await this.definitions.create({
      key: dto.key,
      label: dto.label,
      type: dto.type,
      options: SELECT_TYPES.has(dto.type) ? dto.options : undefined,
      unit: dto.unit,
      required: dto.required,
      filterable: dto.filterable,
      active: dto.active,
      category: dto.category,
    });
    const result = toAttributeDefinitionDto(created);
    await this.audit.record({
      actorId: actor.userId,
      actorType: 'ADMIN',
      action: 'PLACE_ATTRIBUTE_CREATED',
      resourceType: 'place_attribute',
      resourceId: result.id,
      requestId,
      after: result,
    });
    return result;
  }

  async patch(
    actor: IdentityContext,
    attributeId: string,
    dto: AttributeDefinitionPatchDto,
    requestId: string,
  ) {
    if (!isValidObjectId(attributeId)) {
      throw new ApiException(404, 'NOT_FOUND', 'Không tìm thấy định nghĩa thuộc tính.');
    }
    const current = await this.definitions.findById(attributeId).lean();
    if (!current) {
      throw new ApiException(404, 'NOT_FOUND', 'Không tìm thấy định nghĩa thuộc tính.');
    }

    const changingKeyOrType =
      (dto.key !== undefined && dto.key !== current.key) ||
      (dto.type !== undefined && dto.type !== current.type);
    if (changingKeyOrType) {
      const inUse = await this.places.exists({ 'attributes.definitionId': attributeId });
      if (inUse) {
        throw new ApiException(
          409,
          'ATTRIBUTE_IN_USE',
          'Không thể đổi mã hoặc kiểu dữ liệu của thuộc tính đang được địa điểm sử dụng.',
        );
      }
    }

    const nextType = dto.type ?? current.type;
    const nextOptions = dto.options !== undefined ? dto.options : current.options;
    this.assertSelectOptions(nextType, nextOptions);

    if (dto.key !== undefined && dto.key !== current.key) {
      const dup = await this.definitions
        .findOne({
          _id: { $ne: attributeId },
          key: dto.key,
          category: (dto.category ?? current.category) ?? null,
        })
        .lean();
      if (dup) {
        throw new ApiException(
          409,
          'DUPLICATE_ATTRIBUTE_KEY',
          `Mã thuộc tính "${dto.key}" đã tồn tại.`,
        );
      }
    }

    const update: Record<string, unknown> = {
      ...(dto.key !== undefined ? { key: dto.key } : {}),
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
      ...(dto.required !== undefined ? { required: dto.required } : {}),
      ...(dto.filterable !== undefined ? { filterable: dto.filterable } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
    };
    if (SELECT_TYPES.has(nextType)) {
      update.options = nextOptions;
    }

    const updated = await this.definitions
      .findByIdAndUpdate(attributeId, { $set: update }, { returnDocument: 'after' })
      .lean();
    const result = toAttributeDefinitionDto(updated as NonNullable<typeof updated>);
    await this.audit.record({
      actorId: actor.userId,
      actorType: 'ADMIN',
      action: 'PLACE_ATTRIBUTE_UPDATED',
      resourceType: 'place_attribute',
      resourceId: result.id,
      requestId,
      before: toAttributeDefinitionDto(current),
      after: result,
    });
    return result;
  }

  async seedDefaults(entries = DEFAULT_ATTRIBUTE_DEFINITIONS): Promise<number> {
    let count = 0;
    for (const item of entries) {
      await this.definitions.findOneAndUpdate(
        { key: item.key, category: item.category ?? null },
        {
          $set: {
            label: item.label,
            type: item.type,
            options: item.options,
            unit: item.unit,
            required: item.required,
            filterable: item.filterable,
            active: item.active,
            ...(item.category ? { category: item.category } : {}),
          },
          $setOnInsert: { key: item.key },
        },
        { upsert: true },
      );
      count += 1;
    }
    return count;
  }
}
