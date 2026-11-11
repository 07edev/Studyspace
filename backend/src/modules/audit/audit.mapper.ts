import type { AuditLogDocument } from './audit-log.schema';

// API AuditEvent. before/after were already redacted when written.
export function toAuditEventDto(log: AuditLogDocument) {
  return {
    id: String(log._id),
    actorId: log.actorId ? String(log.actorId) : undefined,
    actorType: log.actorType,
    action: log.action,
    resourceType: log.resourceType,
    resourceId: log.resourceId ? String(log.resourceId) : undefined,
    before: log.before,
    after: log.after,
    requestId: log.requestId,
    createdAt: log.createdAt,
  };
}
export type AuditEventDto = ReturnType<typeof toAuditEventDto>;
