import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, isValidObjectId, Model, Types } from 'mongoose';
import { redact } from '../../common/utils/normalize';
import { OutboxEvent } from './outbox-event.schema';

export type OutboxInput = {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload?: Record<string, unknown>;
};
export type OutboxHandler = (event: {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}) => Promise<void>;

const MAX_ATTEMPTS = 8;
const backoffMs = (attempts: number) => Math.min(2 ** attempts * 1000, 10 * 60 * 1000);

@Injectable()
export class OutboxService {
  private readonly logger = new Logger('Outbox');
  private readonly handlers = new Map<string, OutboxHandler[]>();
  private timer?: NodeJS.Timeout;

  constructor(@InjectModel(OutboxEvent.name) private readonly events: Model<OutboxEvent>) {}

  /** Write inside the same transaction/session as the domain change ("after-commit" delivery). */
  async enqueue(input: OutboxInput, session?: ClientSession): Promise<void> {
    if (!isValidObjectId(input.aggregateId)) {
      throw new Error('Outbox aggregateId must be an ObjectId');
    }
    await this.events.create(
      [
        {
          eventType: input.eventType,
          aggregateType: input.aggregateType,
          aggregateId: new Types.ObjectId(input.aggregateId),
          payload: redact(input.payload ?? {}) as Record<string, unknown>,
          status: 'PENDING',
          attempts: 0,
          nextAttemptAt: new Date(),
        },
      ],
      { session },
    );
  }

  /** TV3 registers the notification subscriber here; TV1 only owns the dispatcher. */
  subscribe(eventType: string, handler: OutboxHandler) {
    this.handlers.set(eventType, [...(this.handlers.get(eventType) ?? []), handler]);
  }

  /** Claims and processes due events. Returns how many were handled successfully. */
  async processBatch(limit = 20): Promise<number> {
    let done = 0;
    for (let i = 0; i < limit; i += 1) {
      // Atomic claim so two instances never process the same event.
      const event = await this.events.findOneAndUpdate(
        { status: 'PENDING', nextAttemptAt: { $lte: new Date() } },
        { $set: { status: 'PROCESSING' }, $inc: { attempts: 1 } },
        { sort: { nextAttemptAt: 1 }, returnDocument: 'after' },
      );
      if (!event) {
        break;
      }
      try {
        for (const handler of this.handlers.get(event.eventType) ?? []) {
          await handler({
            eventType: event.eventType,
            aggregateType: event.aggregateType,
            aggregateId: String(event.aggregateId),
            payload: event.payload,
          });
        }
        await this.events.updateOne({ _id: event._id }, { $set: { status: 'DONE' } });
        done += 1;
      } catch (error) {
        this.logger.warn(`${event.eventType} failed: ${(error as Error).message}`);
        const failed = event.attempts >= MAX_ATTEMPTS;
        await this.events.updateOne(
          { _id: event._id },
          {
            $set: {
              status: failed ? 'FAILED' : 'PENDING',
              nextAttemptAt: new Date(Date.now() + backoffMs(event.attempts)),
            },
          },
        );
      }
    }
    return done;
  }

  start(intervalMs = 5000) {
    this.timer ??= setInterval(() => {
      this.processBatch().catch(e => this.logger.error((e as Error).message));
    }, intervalMs);
    this.timer.unref();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
