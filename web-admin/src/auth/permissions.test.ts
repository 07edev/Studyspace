import { describe, expect, it } from 'vitest';
import { makeAdmin } from '../test/helpers';
import { can } from './permissions';

const usersRead = { module: 'USERS', action: 'READ' };

describe('can()', () => {
  it('lets a super admin do everything', () => {
    const root = makeAdmin({ role: 'SUPER_ADMIN', admin: { status: 'ACTIVE', permissions: [] } });
    expect(can(root, usersRead)).toBe(true);
    expect(can(root, { superAdmin: true })).toBe(true);
  });

  it('checks module and action for a normal admin', () => {
    const admin = makeAdmin();
    expect(can(admin, usersRead)).toBe(true);
    expect(can(admin, { module: 'USERS', action: 'UPDATE' })).toBe(false);
    expect(can(admin, { module: 'PLACES', action: 'READ' })).toBe(false);
    expect(can(admin, { superAdmin: true })).toBe(false);
    expect(can(admin, 'any-admin')).toBe(true);
  });

  it('denies everyone who is not an active admin', () => {
    expect(can(undefined, usersRead)).toBe(false);
    expect(can(makeAdmin({ role: 'USER' }), usersRead)).toBe(false);
    expect(can(makeAdmin({ admin: { status: 'DISABLED', permissions: [{ module: 'USERS', actions: ['READ'] }] } }), usersRead)).toBe(false);
    expect(can(makeAdmin({ admin: undefined }), usersRead)).toBe(false);
  });
});
