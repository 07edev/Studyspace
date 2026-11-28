import { describe, expect, it } from 'vitest';
import { FieldVerifiedStatus } from '../src/modules/places/place.enums';
import { NotConnectedPlaceFileRef } from '../src/modules/places/ports/place-file.port';
import {
  computePlaceDiff,
  findLockedFieldConflict,
} from '../src/modules/places/utils/place-diff.util';

describe('place-diff.util', () => {
  it('detects only changed fields for place_history', () => {
    const diff = computePlaceDiff(
      { name: 'Quán A', category: 'CAFE', phone: '+84901112222' },
      { name: 'Quán B', category: 'CAFE', phone: '+84901112222' },
      ['name', 'category', 'phone'],
      'ADMIN_EDIT',
    );
    expect(diff).toEqual([{ field: 'name', before: 'Quán A', after: 'Quán B', source: 'ADMIN_EDIT' }]);
  });

  it('detects locked field conflicts for exact and nested paths', () => {
    const states = [
      { path: 'name', verified: FieldVerifiedStatus.VERIFIED, locked: true },
      { path: 'address.line1', verified: FieldVerifiedStatus.VERIFIED, locked: true },
      { path: 'phone', verified: FieldVerifiedStatus.UNVERIFIED, locked: false },
    ];
    expect(findLockedFieldConflict(states, ['phone'])).toBeUndefined();
    expect(findLockedFieldConflict(states, ['name'])).toBe('name');
    expect(findLockedFieldConflict(states, ['address'])).toBe('address.line1');
    expect(findLockedFieldConflict(states, ['name.sub'])).toBe('name');
  });
});

describe('NotConnectedPlaceFileRef', () => {
  const ref = new NotConnectedPlaceFileRef();

  it('allows empty file lists and fails closed with 503 for real fileIds until TV3 connects', async () => {
    await expect(ref.assertReady([], 'u1', 'PLACE_IMAGE')).resolves.toBeUndefined();
    await expect(ref.assertReady(['bad-id'], 'u1', 'PLACE_IMAGE')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(ref.assertReady(['a'.repeat(24)], 'u1', 'PLACE_IMAGE')).rejects.toMatchObject({
      code: 'FILE_SERVICE_NOT_CONNECTED',
    });
  });
});
