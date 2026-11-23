import request from 'supertest';
import { startEnv, type TestEnv } from './helpers';

let env: TestEnv;
const http = () => request(env.app.getHttpServer());
type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';
const call = (method: Method, path: string, userId?: string, body?: object) => {
  const req = http()[method](`/api/v1${path}`);
  if (userId) req.set('Authorization', `Bearer ${env.token(userId)}`);
  return body ? req.send(body) : req;
};

let authorId: string;
let otherId: string;

beforeAll(async () => {
  env = await startEnv();
});
afterAll(async () => {
  await env.close();
});
beforeEach(async () => {
  authorId = await env.createUser();
  otherId = await env.createUser();
});

describe('Posts', () => {
  const publishedPost = (overrides: object = {}) =>
    call('post', '/posts', authorId, {
      title: 'A complete study post',
      content: 'Useful notes for the exam.',
      status: 'PUBLISHED',
      ...overrides,
    });

  it('allows incomplete drafts, but requires publishable fields and hides drafts from others', async () => {
    const draft = await call('post', '/posts', authorId, { status: 'DRAFT' }).expect(201);
    expect(draft.body.data).toMatchObject({ status: 'DRAFT', authorId });
    expect(draft.body.data.title).toBeUndefined();
    await call('get', `/posts/${draft.body.data.id}`).expect(404);
    await call('get', `/posts/${draft.body.data.id}`, otherId).expect(404);
    await call('get', `/posts/${draft.body.data.id}`, authorId).expect(200);

    await call('post', '/posts', authorId, { status: 'PUBLISHED' })
      .expect(422)
      .expect(res => expect(res.body.error.code).toBe('VALIDATION_ERROR'));
    await call('patch', `/posts/${draft.body.data.id}`, authorId, {})
      .expect(422)
      .expect(res => expect(res.body.error.code).toBe('VALIDATION_ERROR'));
  });

  it('filters public feed, protects owner mutations, and soft-deletes posts', async () => {
    const created = await publishedPost({
      category: 'Study',
      subjectIds: ['111111111111111111111111'],
      tags: ['exam'],
    }).expect(201);
    const postId = created.body.data.id as string;
    await publishedPost({ title: 'A second public post', category: 'Other' }).expect(201);

    const filtered = await call(
      'get',
      '/posts?category=Study&subjectId=111111111111111111111111&q=exam',
    ).expect(200);
    expect(filtered.body.data.items.map((post: { id: string }) => post.id)).toEqual([postId]);
    await call('patch', `/posts/${postId}`, otherId, { title: 'Changed by another user' }).expect(403);

    await call('delete', `/posts/${postId}`, authorId).expect(204);
    await call('get', `/posts/${postId}`).expect(404);
    const mine = await call('get', '/users/me/posts', authorId).expect(200);
    expect(mine.body.data.items.map((post: { id: string }) => post.id)).not.toContain(postId);
  });

  it('keeps likes and saves idempotent and exposes interaction state', async () => {
    const created = await publishedPost().expect(201);
    const postId = created.body.data.id as string;
    await call('put', `/posts/${postId}/likes/me`, otherId).expect(200);
    await call('put', `/posts/${postId}/likes/me`, otherId).expect(200);
    await call('put', `/posts/${postId}/saves/me`, otherId).expect(200);
    await call('put', `/posts/${postId}/saves/me`, otherId).expect(200);

    const detail = await call('get', `/posts/${postId}`, otherId).expect(200);
    expect(detail.body.data).toMatchObject({ likesCount: 1, liked: true, saved: true });
    const saved = await call('get', '/users/me/saved-posts', otherId).expect(200);
    expect(saved.body.data.items.map((post: { id: string }) => post.id)).toContain(postId);

    await call('delete', `/posts/${postId}/likes/me`, otherId).expect(204);
    await call('delete', `/posts/${postId}/likes/me`, otherId).expect(204);
    const afterUnlike = await call('get', `/posts/${postId}`, otherId).expect(200);
    expect(afterUnlike.body.data).toMatchObject({ likesCount: 0, liked: false });
    await call('delete', `/posts/${postId}/saves/me`, otherId).expect(204);
    await call('delete', `/posts/${postId}/saves/me`, otherId).expect(204);
    await call('delete', `/posts/${postId}/likes/me`, otherId).expect(404);
  });
});

describe('Comments', () => {
  it('validates single-level replies and keeps post/reply counters in sync', async () => {
    const post = await call('post', '/posts', authorId, {
      title: 'A post with replies',
      content: 'Comment threads are limited to one reply level.',
      status: 'PUBLISHED',
    }).expect(201);
    const postId = post.body.data.id as string;

    await call('post', `/posts/${postId}/comments`, otherId, { content: 'No login needed?' }).expect(201);
    const root = await call('post', `/posts/${postId}/comments`, authorId, {
      content: 'Root comment',
    }).expect(201);
    const rootId = root.body.data.id as string;
    const reply = await call('post', `/posts/${postId}/comments`, otherId, {
      content: 'A valid reply',
      parentId: rootId,
    }).expect(201);
    const replyId = reply.body.data.id as string;

    await call('post', `/posts/${postId}/comments`, otherId, {
      content: 'Nested replies are not supported',
      parentId: replyId,
    }).expect(422);
    const roots = await call('get', `/posts/${postId}/comments`).expect(200);
    expect(roots.body.data.items.map((comment: { id: string }) => comment.id)).toContain(rootId);
    expect(roots.body.data.items.map((comment: { id: string }) => comment.id)).not.toContain(replyId);

    const replies = await call('get', `/posts/${postId}/comments?parentId=${rootId}`).expect(200);
    expect(replies.body.data.items.map((comment: { id: string }) => comment.id)).toEqual([replyId]);
    const detail = await call('get', `/posts/${postId}`).expect(200);
    expect(detail.body.data.commentsCount).toBe(3);
    expect(roots.body.data.items.find((comment: { id: string }) => comment.id === rootId).replyCount).toBe(1);

    await call('patch', `/comments/${rootId}`, otherId, { content: 'Not the author' }).expect(403);
    await call('delete', `/comments/${rootId}`, authorId).expect(204);
    const deletedRoot = await call('get', `/posts/${postId}/comments`).expect(200);
    expect(deletedRoot.body.data.items.find((comment: { id: string }) => comment.id === rootId))
      .toMatchObject({ status: 'DELETED', content: '', replyCount: 1 });
    const afterDelete = await call('get', `/posts/${postId}`).expect(200);
    expect(afterDelete.body.data.commentsCount).toBe(2);
    await call('get', `/posts/${postId}/comments?parentId=${rootId}`).expect(200);
  });

  it('requires a valid published post and parent from the same post', async () => {
    const postA = await call('post', '/posts', authorId, {
      title: 'Post A for comments',
      content: 'Content A.',
      status: 'PUBLISHED',
    }).expect(201);
    const postB = await call('post', '/posts', authorId, {
      title: 'Post B for comments',
      content: 'Content B.',
      status: 'PUBLISHED',
    }).expect(201);
    const root = await call('post', `/posts/${postA.body.data.id}/comments`, authorId, {
      content: 'A root for another post',
    }).expect(201);

    await call('post', `/posts/${postB.body.data.id}/comments`, authorId, {
      content: 'Wrong parent',
      parentId: root.body.data.id,
    }).expect(422);
    await call('post', `/posts/${postA.body.data.id}/comments`, undefined, { content: 'Guest' }).expect(401);
  });
});
