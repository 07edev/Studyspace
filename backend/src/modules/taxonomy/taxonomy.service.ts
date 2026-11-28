import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model, type QueryFilter, Types } from 'mongoose';
import { ApiException } from '../../common/api-error';
import { escapeRegex, pageParams, toPage, type Page } from '../../common/utils/page';
import { normalizeSearchText } from '../../common/utils/text-normalize';
import type { MajorsQuery, TaxonomySearchQuery, WardsQuery } from './dto/taxonomy.dto';
import {
  TaxonomyItemEntity,
  TaxonomyKind,
} from './schemas/taxonomy-item.schema';
import { TAXONOMY_SEED_DATA, type TaxonomySeedEntry } from './taxonomy.data';

export type TaxonomyItemDto = {
  id: string;
  code: string;
  name: string;
  parentId?: string;
  active: boolean;
};

export function toTaxonomyItemDto(doc: TaxonomyItemEntity & { _id: unknown }): TaxonomyItemDto {
  return {
    id: String(doc._id),
    code: doc.code,
    name: doc.name,
    ...(doc.parentId ? { parentId: String(doc.parentId) } : {}),
    active: doc.active,
  };
}

@Injectable()
export class TaxonomyService {
  constructor(
    @InjectModel(TaxonomyItemEntity.name)
    private readonly items: Model<TaxonomyItemEntity>,
  ) {}

  async listByKind(
    kind: TaxonomyKind,
    query: TaxonomySearchQuery = {},
    extra: QueryFilter<TaxonomyItemEntity> = {},
  ): Promise<Page<TaxonomyItemDto>> {
    const { page, limit, skip } = pageParams(query);
    const filter: QueryFilter<TaxonomyItemEntity> = { kind, active: true, ...extra };
    if (query.q) {
      const raw = new RegExp(escapeRegex(query.q), 'i');
      const normalized = normalizeSearchText(query.q);
      filter.$or = [
        { code: raw },
        { name: raw },
        ...(normalized ? [{ nameNormalized: new RegExp(escapeRegex(normalized), 'i') }] : []),
      ];
    }
    const [docs, total] = await Promise.all([
      this.items
        .find(filter)
        .sort({ sortOrder: 1, name: 1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.items.countDocuments(filter),
    ]);
    return toPage(docs.map(toTaxonomyItemDto), total, page, limit);
  }

  async listMajors(query: MajorsQuery = {}): Promise<Page<TaxonomyItemDto>> {
    const extra: QueryFilter<TaxonomyItemEntity> = {};
    if (query.universityId) {
      extra.parentId = new Types.ObjectId(query.universityId);
    }
    return this.listByKind(TaxonomyKind.MAJOR, query, extra);
  }

  async listWards(query: WardsQuery = {}): Promise<Page<TaxonomyItemDto>> {
    const extra: QueryFilter<TaxonomyItemEntity> = {};
    if (query.provinceCode) {
      extra.parentCode = query.provinceCode;
    }
    return this.listByKind(TaxonomyKind.WARD, query, extra);
  }

  async assertValidProfileTaxonomy(input: {
    universityId?: string;
    majorId?: string;
    subjectIds?: string[];
  }): Promise<void> {
    if (input.universityId) {
      if (!isValidObjectId(input.universityId)) {
        throw new ApiException(422, 'VALIDATION_ERROR', 'Trường đại học không hợp lệ.', [
          { field: 'universityId', rule: 'exists', message: 'Trường đại học không tồn tại.' },
        ]);
      }
      const university = await this.items
        .findOne({ _id: input.universityId, kind: TaxonomyKind.UNIVERSITY, active: true })
        .select('_id')
        .lean();
      if (!university) {
        throw new ApiException(422, 'VALIDATION_ERROR', 'Trường đại học không tồn tại.', [
          { field: 'universityId', rule: 'exists', message: 'Trường đại học không tồn tại.' },
        ]);
      }
    }

    if (input.majorId) {
      if (!isValidObjectId(input.majorId)) {
        throw new ApiException(422, 'VALIDATION_ERROR', 'Ngành học không hợp lệ.', [
          { field: 'majorId', rule: 'exists', message: 'Ngành học không tồn tại.' },
        ]);
      }
      const major = await this.items
        .findOne({ _id: input.majorId, kind: TaxonomyKind.MAJOR, active: true })
        .select('_id parentId')
        .lean();
      if (!major) {
        throw new ApiException(422, 'VALIDATION_ERROR', 'Ngành học không tồn tại.', [
          { field: 'majorId', rule: 'exists', message: 'Ngành học không tồn tại.' },
        ]);
      }
      if (!input.universityId || !major.parentId || String(major.parentId) !== input.universityId) {
        throw new ApiException(
          422,
          'UNIVERSITY_MAJOR_MISMATCH',
          'Ngành học không thuộc trường đại học đã chọn.',
          [
            {
              field: 'majorId',
              rule: 'universityMajor',
              message: 'Ngành học không thuộc trường đại học đã chọn.',
            },
          ],
        );
      }
    }

    if (input.subjectIds && input.subjectIds.length > 0) {
      const uniqueIds = [...new Set(input.subjectIds)];
      if (uniqueIds.some(id => !isValidObjectId(id))) {
        throw new ApiException(422, 'VALIDATION_ERROR', 'Danh sách môn học không hợp lệ.', [
          { field: 'subjectIds', rule: 'exists', message: 'Có môn học không hợp lệ.' },
        ]);
      }
      const count = await this.items.countDocuments({
        _id: { $in: uniqueIds.map(id => new Types.ObjectId(id)) },
        kind: TaxonomyKind.SUBJECT,
        active: true,
      });
      if (count !== uniqueIds.length) {
        throw new ApiException(422, 'VALIDATION_ERROR', 'Có môn học không tồn tại.', [
          { field: 'subjectIds', rule: 'exists', message: 'Có môn học không tồn tại.' },
        ]);
      }
    }
  }

  /** Idempotent upsert by { kind, code } so static IDs remain stable across re-seeds. */
  async seedEntries(entries: TaxonomySeedEntry[] = TAXONOMY_SEED_DATA): Promise<{ upserted: number }> {
    const parentIds = new Map<string, Types.ObjectId>();
    const roots = entries.filter(e => !e.parentCode);
    const children = entries.filter(e => Boolean(e.parentCode));

    let upserted = 0;
    for (const entry of roots) {
      const doc = await this.items.findOneAndUpdate(
        { kind: entry.kind, code: entry.code },
        {
          $set: {
            name: entry.name,
            nameNormalized: normalizeSearchText(entry.name),
            sortOrder: entry.sortOrder ?? 0,
            active: true,
          },
          $setOnInsert: { kind: entry.kind, code: entry.code },
        },
        { upsert: true, returnDocument: 'after' },
      );
      parentIds.set(`${entry.kind}:${entry.code}`, doc._id);
      upserted += 1;
    }

    for (const entry of children) {
      let parentId = entry.parentKind
        ? parentIds.get(`${entry.parentKind}:${entry.parentCode}`)
        : undefined;
      if (!parentId && entry.parentKind && entry.parentCode) {
        const parentDoc = await this.items
          .findOne({ kind: entry.parentKind, code: entry.parentCode })
          .select('_id')
          .lean();
        parentId = parentDoc?._id;
      }
      await this.items.findOneAndUpdate(
        { kind: entry.kind, code: entry.code },
        {
          $set: {
            name: entry.name,
            nameNormalized: normalizeSearchText(entry.name),
            parentId,
            parentCode: entry.parentCode,
            sortOrder: entry.sortOrder ?? 0,
            active: true,
          },
          $setOnInsert: { kind: entry.kind, code: entry.code },
        },
        { upsert: true, returnDocument: 'after' },
      );
      upserted += 1;
    }
    return { upserted };
  }
}
