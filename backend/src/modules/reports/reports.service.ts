import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { ApiException } from '../../common/api-error';
import { AccountStatus, AdminStatus, Role } from '../../common/enums';
import type { IdentityContext } from '../../common/identity';
import { pageParams, toPage } from '../../common/utils/page';
import { AuditService } from '../audit/audit.service';
import { FileAccessRegistry } from '../files/file-access.registry';
import { FilePurpose } from '../files/file.schema';
import { FilesService } from '../files/files.service';
import { AdminProfile } from '../identity/schemas/admin-profile.schema';
import { User } from '../identity/schemas/user.schema';
import { OutboxService } from '../outbox/outbox.service';
import { StatsRegistry } from '../stats/stats.registry';
import {
  Report,
  ReportStatus,
  ReportTargetType,
} from './report.schema';
import {
  CreateReportDto,
  ReportAssignmentDto,
  ReportDecisionDto,
  ReportsQuery,
} from './dto/reports.dto';
import { ReportableTargetRef } from './ports';

const notFound = () => new ApiException(404, 'NOT_FOUND', 'Không tìm thấy báo cáo.');
const conflict = (message: string) => new ApiException(409, 'VERSION_CONFLICT', message);
const terminal = [ReportStatus.RESOLVED, ReportStatus.DISMISSED];

@Injectable()
export class ReportsService implements OnModuleInit {
  constructor(
    @InjectModel(Report.name) private readonly reports: Model<Report>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(AdminProfile.name) private readonly admins: Model<AdminProfile>,
    private readonly targets: ReportableTargetRef,
    private readonly files: FilesService,
    private readonly fileAccess: FileAccessRegistry,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly stats: StatsRegistry,
  ) {}

  onModuleInit() {
    this.stats.register({
      name: 'reports',
      overview: async () => ({
        openReports: await this.reports.countDocuments({
          status: { $in: [ReportStatus.PENDING, ReportStatus.ASSIGNED] },
        }),
      }),
      daily: async window => {
        const rows = await this.reports.aggregate<{ date: string; count: number }>([
          { $match: { createdAt: { $gte: window.from, $lt: window.to } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+07:00' } },
              count: { $sum: 1 },
            },
          },
          { $project: { _id: 0, date: '$_id', count: 1 } },
          { $sort: { date: 1 } },
        ]);
        return { reports: rows };
      },
    });
    this.fileAccess.register(FilePurpose.EVIDENCE, 'reports', async (file, actor) => {
      if (!actor) return false;
      const report = await this.reports.findOne({
        evidenceFileIds: new Types.ObjectId(file.id),
      }).select('reporterId');
      if (!report) return false;
      if (String(report.reporterId) === actor.userId) return true;
      return actor.role === Role.SUPER_ADMIN || actor.permissions.some(
        permission => permission.module === 'REPORTS' && permission.actions.includes('READ'),
      );
    });
  }

  async create(reporterId: string, dto: CreateReportDto, requestId: string) {
    const targetOwnerId = await this.targets.ownerId(dto.targetType, dto.targetId);
    if (targetOwnerId === reporterId) {
      throw new ApiException(422, 'CANNOT_REPORT_OWN_CONTENT', 'Bạn không thể báo cáo nội dung của chính mình.');
    }
    const evidenceFileIds = [...new Set(
      (dto.evidenceFileIds ?? []).map(id => new Types.ObjectId(id).toHexString()),
    )];
    await Promise.all(evidenceFileIds.map(fileId =>
      this.files.assertReadyForPurpose(fileId, reporterId, FilePurpose.EVIDENCE),
    ));

    const targetId = new Types.ObjectId(dto.targetId);
    const activeKey = `${reporterId}:${dto.targetType}:${targetId.toHexString()}`;
    let report: Report & { _id: Types.ObjectId };
    try {
      report = await this.reports.create({
        reporterId: new Types.ObjectId(reporterId),
        targetType: dto.targetType,
        targetId,
        targetOwnerId: new Types.ObjectId(targetOwnerId),
        reasonCode: dto.reasonCode,
        description: dto.description,
        evidenceFileIds: evidenceFileIds.map(id => new Types.ObjectId(id)),
        status: ReportStatus.PENDING,
        version: 1,
        activeKey,
      }) as Report & { _id: Types.ObjectId };
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        throw new ApiException(409, 'DUPLICATE_REPORT', 'Bạn đã gửi báo cáo đang được xử lý cho nội dung này.');
      }
      throw error;
    }
    await this.audit.record({
      actorId: reporterId,
      actorType: 'USER',
      action: 'REPORT_CREATED',
      resourceType: 'report',
      resourceId: String(report._id),
      requestId,
      after: { targetType: dto.targetType, targetId: dto.targetId, reasonCode: dto.reasonCode },
    });
    return this.present(report);
  }

  async mine(userId: string, query: ReportsQuery) {
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = { reporterId: new Types.ObjectId(userId) };
    if (query.status) filter.status = query.status;
    if (query.targetType) filter.targetType = query.targetType;
    if (query.reasonCode) filter.reasonCode = query.reasonCode;
    const [rows, total] = await Promise.all([
      this.reports.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      this.reports.countDocuments(filter),
    ]);
    return toPage(rows.map(row => this.present(row)), total, page, limit);
  }

  userContentCount(userId: string) {
    return this.reports.countDocuments({ reporterId: this.objectId(userId) });
  }

  async detail(userId: string, reportId: string) {
    const report = await this.reports.findOne({
      _id: this.objectId(reportId),
      reporterId: new Types.ObjectId(userId),
    }).lean();
    if (!report) throw notFound();
    return this.present(report);
  }

  async adminList(query: ReportsQuery) {
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.targetType) filter.targetType = query.targetType;
    if (query.reasonCode) filter.reasonCode = query.reasonCode;
    const [rows, total] = await Promise.all([
      this.reports.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      this.reports.countDocuments(filter),
    ]);
    return toPage(rows.map(row => this.present(row)), total, page, limit);
  }

  async adminDetail(reportId: string) {
    const report = await this.reports.findById(this.objectId(reportId)).lean();
    if (!report) throw notFound();
    const targetVersion = await this.targets.version(report.targetType, String(report.targetId));
    return { ...this.present(report), targetVersion };
  }

  async assign(
    actor: IdentityContext,
    reportId: string,
    dto: ReportAssignmentDto,
    requestId: string,
  ) {
    const report = await this.reports.findById(this.objectId(reportId)).lean();
    if (!report) throw notFound();
    if (report.version !== dto.expectedVersion || terminal.includes(report.status)) {
      throw conflict('Báo cáo đã được cập nhật hoặc xử lý.');
    }
    await this.assertEligibleAssignee(dto.assigneeId);
    const updated = await this.reports.findOneAndUpdate(
      { _id: report._id, version: dto.expectedVersion, status: { $nin: terminal } },
      {
        $set: { status: ReportStatus.ASSIGNED, assignedTo: new Types.ObjectId(dto.assigneeId) },
        $inc: { version: 1 },
      },
      { returnDocument: 'after' },
    ).lean();
    if (!updated) throw conflict('Báo cáo đã được cập nhật bởi người khác.');
    await this.audit.record({
      actorId: actor.userId,
      actorType: 'ADMIN',
      action: 'REPORT_ASSIGNED',
      resourceType: 'report',
      resourceId: reportId,
      requestId,
      before: { status: report.status, assignedTo: report.assignedTo, version: report.version },
      after: { status: updated.status, assignedTo: updated.assignedTo, version: updated.version },
    });
    return this.present(updated);
  }

  async decide(
    actor: IdentityContext,
    reportId: string,
    dto: ReportDecisionDto,
    requestId: string,
  ) {
    const report = await this.reports.findById(this.objectId(reportId)).lean();
    if (!report) throw notFound();
    if (report.version !== dto.expectedVersion || terminal.includes(report.status)) {
      throw conflict('Báo cáo đã được cập nhật hoặc xử lý.');
    }
    if (dto.action === 'TAKE_DOWN') {
      if (dto.expectedTargetVersion === undefined) {
        throw new ApiException(422, 'VALIDATION_ERROR', 'Cần cung cấp phiên bản hiện tại của nội dung.');
      }
      await this.targets.takeDown(
        report.targetType,
        String(report.targetId),
        actor,
        dto.reason,
        dto.expectedTargetVersion,
        requestId,
      );
    }
    const nextStatus = dto.action === 'TAKE_DOWN' ? ReportStatus.RESOLVED : ReportStatus.DISMISSED;
    const updated = await this.reports.findOneAndUpdate(
      { _id: report._id, version: dto.expectedVersion, status: { $nin: terminal } },
      {
        $set: {
          status: nextStatus,
          decidedBy: new Types.ObjectId(actor.userId),
          decisionReason: dto.reason,
        },
        $unset: { activeKey: 1 },
        $inc: { version: 1 },
      },
      { returnDocument: 'after' },
    ).lean();
    if (!updated) throw conflict('Báo cáo đã được cập nhật bởi người khác.');
    await this.audit.record({
      actorId: actor.userId,
      actorType: 'ADMIN',
      action: nextStatus === ReportStatus.RESOLVED ? 'REPORT_RESOLVED' : 'REPORT_DISMISSED',
      resourceType: 'report',
      resourceId: reportId,
      requestId,
      before: { status: report.status, version: report.version },
      after: { status: updated.status, reason: dto.reason, version: updated.version },
    });
    await this.outbox.enqueue({
      eventType: 'REPORT_DECISION',
      aggregateType: 'REPORT',
      aggregateId: reportId,
      payload: {
        reporterId: String(report.reporterId),
        reportId,
        action: nextStatus,
      },
    });
    return this.present(updated);
  }

  private async assertEligibleAssignee(userId: string) {
    if (!isValidObjectId(userId)) throw notFound();
    const [user, profile] = await Promise.all([
      this.users.findById(userId).select('role status').lean(),
      this.admins.findOne({ userId }).lean(),
    ]);
    if (
      !user ||
      user.status !== AccountStatus.ACTIVE ||
      !profile ||
      profile.status !== AdminStatus.ACTIVE ||
      user.role === Role.USER
    ) {
      throw new ApiException(422, 'ASSIGNEE_NOT_ELIGIBLE', 'Người được giao phải là quản trị viên đang hoạt động.');
    }
    if (user.role !== Role.SUPER_ADMIN && !profile.permissions.some(
      permission => permission.module === 'REPORTS' &&
        (permission.actions.includes('ASSIGN') || permission.actions.includes('MODERATE')),
    )) {
      throw new ApiException(422, 'ASSIGNEE_NOT_ELIGIBLE', 'Quản trị viên chưa có quyền xử lý báo cáo.');
    }
  }

  private objectId(id: string) {
    if (!isValidObjectId(id)) throw notFound();
    return new Types.ObjectId(id);
  }

  private present(report: Report & { _id: Types.ObjectId }) {
    return {
      id: String(report._id),
      reporterId: String(report.reporterId),
      targetType: report.targetType,
      targetId: String(report.targetId),
      reasonCode: report.reasonCode,
      description: report.description,
      evidenceFileIds: report.evidenceFileIds.map(String),
      status: report.status,
      assignedTo: report.assignedTo ? String(report.assignedTo) : undefined,
      decidedBy: report.decidedBy ? String(report.decidedBy) : undefined,
      decisionReason: report.decisionReason,
      version: report.version,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };
  }
}
