import { getModelToken } from '@nestjs/mongoose';
import request from 'supertest';
import { Model, Types } from 'mongoose';
import { Role } from '../src/common/enums';
import { Post, PostStatus } from '../src/modules/posts/post.schema';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { startEnv, type TestEnv } from './helpers';

let env: TestEnv;
let posts: Model<Post>;
const http = () => request(env.app.getHttpServer());
const call = (method: 'get' | 'post' | 'patch', path: string, token: string, body?: object) => {
  const req = http()[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
  return body ? req.send(body) : req;
};

beforeAll(async () => {
  env = await startEnv();
  posts = env.app.get<Model<Post>>(getModelToken(Post.name));
});
afterAll(async () => {
  if (env) await env.close();
});

describe('Reports and notifications', () => {
  test('isolates reports, rejects duplicates, audits decisions and delivers an idempotent notification', async () => {
    const authorId = await env.createUser();
    const reporterId = await env.createUser();
    const otherId = await env.createUser();
    const adminId = await env.createUser({
      role: Role.ADMIN,
      permissions: [
        { module: 'REPORTS', actions: ['READ', 'ASSIGN', 'MODERATE'] },
      ],
    });
    const post = await posts.create({
      authorId: new Types.ObjectId(authorId),
      title: 'A reportable post',
      content: 'Public content',
      status: PostStatus.PUBLISHED,
    });

    const create = await call('post', '/reports', env.token(reporterId), {
      targetType: 'POST',
      targetId: String(post._id),
      reasonCode: 'SPAM',
    });
    expect(create.status).toBe(201);
    expect(create.body.data).toMatchObject({
      reporterId,
      targetType: 'POST',
      status: 'PENDING',
      version: 1,
    });
    const reportId = create.body.data.id as string;
    expect((await call('post', '/reports', env.token(reporterId), {
      targetType: 'POST',
      targetId: String(post._id),
      reasonCode: 'SPAM',
    })).body.error.code).toBe('DUPLICATE_REPORT');
    expect((await call('get', `/reports/${reportId}`, env.token(otherId))).status).toBe(404);

    const assigned = await call('patch', `/admin/reports/${reportId}/assignment`, env.token(adminId), {
      assigneeId: adminId,
      expectedVersion: 1,
    });
    expect(assigned.status).toBe(200);
    expect(assigned.body.data).toMatchObject({ status: 'ASSIGNED', version: 2, assignedTo: adminId });

    const decided = await call('patch', `/admin/reports/${reportId}/decision`, env.token(adminId), {
      action: 'TAKE_DOWN',
      reason: 'Reviewed and handled according to the policy.',
      expectedVersion: 2,
      expectedTargetVersion: 1,
    });
    expect(decided.status).toBe(200);
    expect(decided.body.data).toMatchObject({ status: 'RESOLVED', version: 3 });

    const outbox = env.app.get(OutboxService);
    expect(await outbox.processBatch()).toBe(2);
    expect(await outbox.processBatch()).toBe(0);
    const notifications = await call('get', '/notifications', env.token(reporterId));
    expect(notifications.body.data.items).toHaveLength(1);
    expect(notifications.body.data.items[0]).toMatchObject({
      type: 'REPORT_RESULT',
      targetType: 'REPORT',
      targetId: reportId,
      read: false,
    });
    expect((await call('get', '/notifications/unread-count', env.token(reporterId))).body.data)
      .toEqual({ unreadCount: 1 });

    const notificationId = notifications.body.data.items[0].id as string;
    expect((await call('patch', `/notifications/${notificationId}`, env.token(otherId), { read: true })).status)
      .toBe(404);
    expect((await call('post', '/notifications/read-all', env.token(reporterId))).body.data)
      .toEqual({ updatedCount: 1 });
    expect((await call('get', '/notifications/unread-count', env.token(reporterId))).body.data)
      .toEqual({ unreadCount: 0 });
  });
});
