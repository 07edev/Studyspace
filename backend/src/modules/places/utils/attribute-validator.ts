import { ApiException, type FieldErrorDto } from '../../../common/api-error';
import { AttributeType, type PlaceCategory } from '../place.enums';
import type { PlaceAttributeDefinitionEntity } from '../schemas/place-attribute-definition.schema';
import type { AttributeValueDoc } from '../schemas/place.schema';

export type AttributeDefinitionWithId = PlaceAttributeDefinitionEntity & { _id: unknown };

/**
 * Runtime validation of dynamic place attributes against active AttributeDefinitions.
 * Enforces strict typing for TEXT, NUMBER, BOOLEAN, SINGLE_SELECT and MULTI_SELECT,
 * and ensures required definitions are present when publishing a place.
 */
export function validateAttributeValues(
  values: AttributeValueDoc[] | undefined,
  definitions: AttributeDefinitionWithId[],
  options: { category: PlaceCategory; enforceRequired: boolean },
): AttributeValueDoc[] {
  const list = values ?? [];
  const errors: FieldErrorDto[] = [];
  const defById = new Map(definitions.map(d => [String(d._id), d]));
  const seen = new Set<string>();
  const cleaned: AttributeValueDoc[] = [];

  list.forEach((entry, idx) => {
    const field = `attributes.${idx}`;
    if (seen.has(entry.definitionId)) {
      errors.push({ field, rule: 'unique', message: 'Thuộc tính bị khai báo lặp.' });
      return;
    }
    seen.add(entry.definitionId);

    const def = defById.get(entry.definitionId);
    if (!def || !def.active) {
      errors.push({
        field: `${field}.definitionId`,
        rule: 'exists',
        message: 'Định nghĩa thuộc tính không tồn tại hoặc đã tắt.',
      });
      return;
    }
    if (def.category && def.category !== options.category) {
      errors.push({
        field: `${field}.definitionId`,
        rule: 'category',
        message: `Thuộc tính "${def.label}" không áp dụng cho loại địa điểm này.`,
      });
      return;
    }

    const val = entry.value;
    switch (def.type) {
      case AttributeType.TEXT:
        if (typeof val !== 'string' || val.trim().length === 0 || val.length > 500) {
          errors.push({
            field: `${field}.value`,
            rule: 'text',
            message: `Thuộc tính "${def.label}" phải là chuỗi 1-500 ký tự.`,
          });
          return;
        }
        cleaned.push({ definitionId: entry.definitionId, value: val.trim() });
        break;

      case AttributeType.NUMBER:
        if (typeof val !== 'number' || !Number.isFinite(val)) {
          errors.push({
            field: `${field}.value`,
            rule: 'number',
            message: `Thuộc tính "${def.label}" phải là một số hợp lệ.`,
          });
          return;
        }
        cleaned.push({ definitionId: entry.definitionId, value: val });
        break;

      case AttributeType.BOOLEAN:
        if (typeof val !== 'boolean') {
          errors.push({
            field: `${field}.value`,
            rule: 'boolean',
            message: `Thuộc tính "${def.label}" phải là giá trị đúng/sai.`,
          });
          return;
        }
        cleaned.push({ definitionId: entry.definitionId, value: val });
        break;

      case AttributeType.SINGLE_SELECT:
        if (typeof val !== 'string' || !(def.options ?? []).includes(val)) {
          errors.push({
            field: `${field}.value`,
            rule: 'options',
            message: `Giá trị của "${def.label}" không nằm trong danh sách lựa chọn.`,
          });
          return;
        }
        cleaned.push({ definitionId: entry.definitionId, value: val });
        break;

      case AttributeType.MULTI_SELECT: {
        if (!Array.isArray(val) || val.length === 0) {
          errors.push({
            field: `${field}.value`,
            rule: 'options',
            message: `Thuộc tính "${def.label}" cần chọn ít nhất một giá trị.`,
          });
          return;
        }
        const allowed = new Set(def.options ?? []);
        const uniq = new Set<string>();
        for (const item of val) {
          if (typeof item !== 'string' || !allowed.has(item)) {
            errors.push({
              field: `${field}.value`,
              rule: 'options',
              message: `Giá trị của "${def.label}" chứa lựa chọn không hợp lệ.`,
            });
            return;
          }
          uniq.add(item);
        }
        cleaned.push({ definitionId: entry.definitionId, value: [...uniq] });
        break;
      }
    }
  });

  if (options.enforceRequired) {
    for (const def of definitions) {
      if (!def.active || !def.required) continue;
      if (def.category && def.category !== options.category) continue;
      if (!seen.has(String(def._id))) {
        errors.push({
          field: 'attributes',
          rule: 'required',
          message: `Thiếu thuộc tính bắt buộc "${def.label}".`,
        });
      }
    }
  }

  if (errors.length > 0) {
    throw new ApiException(422, 'VALIDATION_ERROR', 'Thuộc tính địa điểm chưa hợp lệ.', errors);
  }
  return cleaned;
}
