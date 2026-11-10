import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { redact } from '../src/common/utils/normalize';
import { loadConfig } from '../src/config/configuration';
import { AuditLog } from '../src/modules/audit/audit-log.schema';
import { AuditService } from '../src/modules/audit/audit.service';
import { OutboxEvent } from '../src/modules/outbox/outbox-event.schema';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { startEnv, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await startEnv();
});
afterAll(async () => {
  await env.close();
});

describe('redact', () => {
  it('removes secrets at any depth but keeps normal fields', () => {
    const out = redact({
      email: 'a@b.test',
      password: 'p',
      nested: { refreshToken: 't', otp: '123456', list: [{ passwordHash: 'h', keep: 1 }] },
    }) as Record<string, any>;
    expect(out.email).toBe('a@b.test');
    expect(out.password).toBe('[REDACTED]');
    expect(out.nested.refreshToken).toBe('[REDACTED]');
    expect(out.nested.otp).toBe('[REDACTED]');
    expect(out.nested.list[0]).toEqual({ passwordHash: '[REDACTED]', keep: 1 });
  });
});

describe('config', () => {
  it('fails fast on a weak secret or missing database', () => {
    expect(() => loadConfig({ JWT_ACCESS_SECRET: 'short', MONGODB_URI: 'mongodb://x' })).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => loadConfig({ JWT_ACCESS_SECRET: 'x'.repeat(40) })).toThrow(/MONGODB_URI/);
  });
});

describe('AuditService', () => {
  it('stores redacted before/after and is append-only', async () => {
    const audit = env.app.get(AuditService);
    const logs = env.app.get<Model<AuditLog>>(getModelToken(AuditLog.name));
    const actor = new Types.ObjectId().toHexString();
    await audit.record({
      actorId: actor,
      actorType: 'ADMIN',
      action: 'USER_SUSPEND',
      resourceType: 'user',
      resourceId: new Types.ObjectId().toHexString(),
      requestId: 'req-1',
      before: { status: 'ACTIVE', passwordHash: 'secret' },
      after: { status: 'SUSPENDED', token: 'abc' },
    });
    const saved = await logs.findOne({ requestId: 'req-1' }).lean();
    expect(saved?.before).toEqual({ status: 'ACTIVE', passwordHash: '[REDACTED]' });
    expect(saved?.after).toEqual({ status: 'SUSPENDED', token: '[REDACTED]' });
    await expect(logs.updateOne({ requestId: 'req-1' }, { action: 'X' })).rejects.toThrow(/append-only/);
    await expect(logs.deleteMany({})).rejects.toThrow(/append-only/);
    expect(await logs.countDocuments({ requestId: 'req-1' })).toBe(1);
  });
});

describe('OutboxService', () => {
  it('delivers due events once to subscribers and marks them DONE', async () => {
    const outbox = env.app.get(OutboxService);
    const events = env.app.get<Model<OutboxEvent>>(getModelToken(OutboxEvent.name));
    const received: unknown[] = [];
    outbox.subscribe('SuggestionDecided', async e => {
      received.push(e);
    });
    const aggregateId = new Types.ObjectId().toHexString();
    await outbox.enqueue({
      eventType: 'SuggestionDecided',
      aggregateType: 'place_suggestion',
      aggregateId,
      payload: { decision: 'APPROVE', apiToken: 'leak' },
    });
    expect(await outbox.processBatch()).toBe(1);
    expect(await outbox.processBatch()).toBe(0);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ aggregateId, payload: { decision: 'APPROVE', apiToken: '[REDACTED]' } });
    expect((await events.findOne({ aggregateId }).lean())?.status).toBe('DONE');
  });

  it('retries failed events later instead of losing them', async () => {
    const outbox = env.app.get(OutboxService);
    const events = env.app.get<Model<OutboxEvent>>(getModelToken(OutboxEvent.name));
    outbox.subscribe('AlwaysFails', async () => {
      throw new Error('boom');
    });
    const aggregateId = new Types.ObjectId().toHexString();
    await outbox.enqueue({ eventType: 'AlwaysFails', aggregateType: 't', aggregateId });
    expect(await outbox.processBatch()).toBe(0);
    const saved = await events.findOne({ aggregateId }).lean();
    expect(saved?.status).toBe('PENDING');
    expect(saved?.attempts).toBe(1);
    expect(saved!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });
});
