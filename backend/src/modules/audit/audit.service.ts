import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, isValidObjectId, Model, Types } from 'mongoose';
import { redact } from '../../common/utils/normalize';
import { AuditLog } from './audit-log.schema';

// Shape shared with TV2/TV3 (AuditAction interface). They call record(); they never
// write to audit_logs directly.
export type AuditAction = {
  actorId?: string;
  actorType: 'SYSTEM' | 'USER' | 'ADMIN';
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId: string;
  before?: unknown;
  after?: unknown;
};

const toId = (value?: string) =>
  value && isValidObjectId(value) ? new Types.ObjectId(value) : undefined;

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog.name) private readonly logs: Model<AuditLog>) {}

  /** Pass the same session as the mutation so audit commits atomically with it. */
  async record(input: AuditAction, session?: ClientSession): Promise<void> {
    await this.logs.create(
      [
        {
          actorId: toId(input.actorId),
          actorType: input.actorType,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: toId(input.resourceId),
          requestId: input.requestId,
          before: redact(input.before),
          after: redact(input.after),
        },
      ],
      { session },
    );
  }
}
