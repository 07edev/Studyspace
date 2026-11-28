import { describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { normalizeSearchText } from '../src/common/utils/text-normalize';
import { TAXONOMY_SEED_DATA } from '../src/modules/taxonomy/taxonomy.data';
import { TaxonomyKind } from '../src/modules/taxonomy/schemas/taxonomy-item.schema';
import { TaxonomyService, toTaxonomyItemDto } from '../src/modules/taxonomy/taxonomy.service';

describe('normalizeSearchText', () => {
  it('removes Vietnamese accents, converts đ/Đ, strips punctuation and lowercases', () => {
    expect(normalizeSearchText('Đại học Bách Khoa - ĐHQG TP.HCM!')).toBe(
      'dai hoc bach khoa dhqg tp hcm',
    );
    expect(normalizeSearchText('Phường Bến Nghé, Quận 1')).toBe('phuong ben nghe quan 1');
  });
});

describe('TAXONOMY_SEED_DATA integrity', () => {
  it('has unique (kind, code) pairs and every child references an existing parent', () => {
    const keys = new Set<string>();
    for (const entry of TAXONOMY_SEED_DATA) {
      const key = `${entry.kind}:${entry.code}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
    for (const entry of TAXONOMY_SEED_DATA) {
      if (entry.parentCode) {
        expect(entry.parentKind).toBeDefined();
        expect(keys.has(`${entry.parentKind}:${entry.parentCode}`)).toBe(true);
      }
    }
  });
});

describe('TaxonomyService.assertValidProfileTaxonomy (unit)', () => {
  const uniA = new Types.ObjectId();
  const uniB = new Types.ObjectId();
  const majorOfA = new Types.ObjectId();
  const subject1 = new Types.ObjectId();

  function makeService() {
    const docs = [
      { _id: uniA, kind: TaxonomyKind.UNIVERSITY, active: true },
      { _id: uniB, kind: TaxonomyKind.UNIVERSITY, active: true },
      { _id: majorOfA, kind: TaxonomyKind.MAJOR, parentId: uniA, active: true },
      { _id: subject1, kind: TaxonomyKind.SUBJECT, active: true },
    ];
    const model = {
      findOne: vi.fn((filter: Record<string, unknown>) => ({
        select: () => ({
          lean: async () =>
            docs.find(
              d =>
                String(d._id) === String(filter._id) &&
                d.kind === filter.kind &&
                d.active === filter.active,
            ) ?? null,
        }),
      })),
      countDocuments: vi.fn(async (filter: { _id: { $in: Types.ObjectId[] }; kind: TaxonomyKind }) => {
        const wanted = new Set(filter._id.$in.map(String));
        return docs.filter(d => d.kind === filter.kind && wanted.has(String(d._id))).length;
      }),
    };
    return new TaxonomyService(model as never);
  }

  it('accepts valid university, matching major and existing subjects', async () => {
    const service = makeService();
    await expect(
      service.assertValidProfileTaxonomy({
        universityId: String(uniA),
        majorId: String(majorOfA),
        subjectIds: [String(subject1)],
      }),
    ).resolves.toBeUndefined();
  });

  it('throws 422 UNIVERSITY_MAJOR_MISMATCH when major belongs to another university', async () => {
    const service = makeService();
    await expect(
      service.assertValidProfileTaxonomy({
        universityId: String(uniB),
        majorId: String(majorOfA),
      }),
    ).rejects.toMatchObject({ code: 'UNIVERSITY_MAJOR_MISMATCH' });
  });

  it('throws 422 VALIDATION_ERROR when university or subject does not exist', async () => {
    const service = makeService();
    const missing = new Types.ObjectId();
    await expect(
      service.assertValidProfileTaxonomy({ universityId: String(missing) }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      service.assertValidProfileTaxonomy({ subjectIds: [String(subject1), String(missing)] }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('maps TaxonomyItemEntity to clean API DTO without _id', () => {
    const dto = toTaxonomyItemDto({
      _id: majorOfA,
      kind: TaxonomyKind.MAJOR,
      code: 'HCMUS-CS',
      name: 'Khoa học máy tính',
      nameNormalized: 'khoa hoc may tinh',
      parentId: uniA,
      sortOrder: 1,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(dto).toEqual({
      id: String(majorOfA),
      code: 'HCMUS-CS',
      name: 'Khoa học máy tính',
      parentId: String(uniA),
      active: true,
    });
    expect(dto).not.toHaveProperty('_id');
  });
});
