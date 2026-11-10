import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiException } from '../../common/api-error';
import { sha256 } from '../../common/utils/normalize';
import { IdempotencyKey } from './idempotency-key.schema';

const TTL_MS = 24 * 60 * 60 * 1000;
export type Begin =
  | { replay: false }
  | { replay: true; response: unknown };

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectModel(IdempotencyKey.name) private readonly keys: Model<IdempotencyKey>,
  ) {}

  /** Reserves (actor, route, key). A duplicate replays the stored result or is rejected. */
  async begin(actorId: string, route: string, key: string, body: unknown): Promise<Begin> {
    const requestHash = sha256(JSON.stringify(body ?? {}));
    const actor = new Types.ObjectId(actorId);
    try {
      await this.keys.create({
        actorId: actor,
        route,
        key,
        requestHash,
        state: 'IN_PROGRESS',
        expiresAt: new Date(Date.now() + TTL_MS),
      });
      return { replay: false };
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) {
        throw error;
      }
    }
    const existing = await this.keys.findOne({ actorId: actor, route, key }).lean();
    if (!existing) {
      // Expired between insert and read; let the client retry.
      throw new ApiException(409, 'REQUEST_IN_PROGRESS', 'Yêu cầu đang được xử lý.');
    }
    if (existing.requestHash !== requestHash) {
      throw new ApiException(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'Idempotency-Key đã được dùng cho một yêu cầu khác.',
      );
    }
    if (existing.state !== 'DONE') {
      throw new ApiException(409, 'REQUEST_IN_PROGRESS', 'Yêu cầu đang được xử lý.');
    }
    return { replay: true, response: existing.response };
  }

  async complete(actorId: string, route: string, key: string, response: unknown) {
    await this.keys.updateOne(
      { actorId: new Types.ObjectId(actorId), route, key },
      {
        $set: {
          state: 'DONE',
          response: response ?? null,
          responseHash: sha256(JSON.stringify(response ?? null)),
        },
      },
    );
  }

  /** Failed handlers are not cached, so the client can retry with the same key. */
  async abort(actorId: string, route: string, key: string) {
    await this.keys.deleteOne({ actorId: new Types.ObjectId(actorId), route, key });
  }
}
