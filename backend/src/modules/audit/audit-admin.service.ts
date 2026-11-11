import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model, type QueryFilter } from 'mongoose';
import { ApiException } from '../../common/api-error';
import { escapeRegex, pageParams, toPage } from '../../common/utils/page';
import { User } from '../identity/schemas/user.schema';
import { AuditLog, type AuditLogDocument } from './audit-log.schema';
import type { AuditLogQuery } from './audit-admin.dto';
import { toAuditEventDto } from './audit.mapper';

// Read side of the audit log for the admin site (ADM-25, A50, A51). Writing stays in
// AuditService; rows are append-only and already redacted when written.
@Injectable()
export class AuditAdminService {
  constructor(
    @InjectModel(AuditLog.name) private readonly logs: Model<AuditLog>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  // Adds who did it (name + email) so the screen does not show a bare id. Only for actors that
  // are accounts; SYSTEM events have none.
  private async withActors(rows: AuditLogDocument[]) {
    const ids = [...new Set(rows.flatMap(r => (r.actorId ? [String(r.actorId)] : [])))];
    const people = ids.length
      ? await this.users.find({ _id: { $in: ids } }).select('emailNormalized profile.displayName').lean()
      : [];
    const byId = new Map(people.map(p => [String(p._id), p]));
    return rows.map(row => {
      const person = row.actorId ? byId.get(String(row.actorId)) : undefined;
      return {
        ...toAuditEventDto(row),
        ...(person
          ? { actor: { displayName: person.profile?.displayName as string | undefined, email: person.emailNormalized } }
          : {}),
      };
    });
  }

  async list(query: AuditLogQuery) {
    const { page, limit, skip } = pageParams(query);
    const filter: QueryFilter<AuditLog> = {};
    if (query.actorId) filter.actorId = query.actorId;
    if (query.actorType) filter.actorType = query.actorType;
    if (query.resourceType) filter.resourceType = query.resourceType;
    if (query.resourceId) filter.resourceId = query.resourceId;
    if (query.requestId) filter.requestId = query.requestId;
    if (query.action) filter.action = new RegExp(escapeRegex(query.action), 'i');
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from > to) {
      throw new ApiException(422, 'QUERY_INVALID', 'Khoảng thời gian không hợp lệ.', [
        { field: 'from', rule: 'range', message: 'Thời điểm bắt đầu phải trước thời điểm kết thúc.' },
      ]);
    }
    if (from || to) {
      filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    }
    const [rows, total] = await Promise.all([
      this.logs.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
      this.logs.countDocuments(filter),
    ]);
    return toPage(await this.withActors(rows), total, page, limit);
  }

  async get(id: string) {
    const row = isValidObjectId(id) ? await this.logs.findById(id) : null;
    if (!row) {
      throw new ApiException(404, 'NOT_FOUND', 'Không tìm thấy bản ghi nhật ký.');
    }
    return (await this.withActors([row]))[0];
  }
}
