import { Injectable } from '@nestjs/common';
import { ApiException } from '../../common/api-error';
import type { IdentityContext } from '../../common/identity';
import { CommentsService } from '../comments/comments.service';
import { DocumentsService } from '../documents/documents.service';
import { PostsService } from '../posts/posts.service';
import { ReportTargetType } from './report.schema';

export abstract class ReportableTargetRef {
  abstract ownerId(type: ReportTargetType, targetId: string): Promise<string>;
  abstract version(type: ReportTargetType, targetId: string): Promise<number>;
  abstract takeDown(
    type: ReportTargetType,
    targetId: string,
    actor: IdentityContext,
    reason: string,
    expectedVersion: number,
    requestId: string,
  ): Promise<void>;
}

@Injectable()
export class Tv3ReportableTargetRef extends ReportableTargetRef {
  constructor(
    private readonly posts: PostsService,
    private readonly comments: CommentsService,
    private readonly documents: DocumentsService,
  ) {
    super();
  }

  ownerId(type: ReportTargetType, targetId: string) {
    if (type === ReportTargetType.POST) return this.posts.reportableOwner(targetId);
    if (type === ReportTargetType.COMMENT) return this.comments.reportableOwner(targetId);
    if (type === ReportTargetType.DOCUMENT) return this.documents.reportableOwner(targetId);
    throw new ApiException(422, 'REPORT_TARGET_UNSUPPORTED', 'Loại nội dung này chưa thể báo cáo.');
  }

  version(type: ReportTargetType, targetId: string) {
    if (type === ReportTargetType.POST) return this.posts.moderationVersion(targetId);
    if (type === ReportTargetType.COMMENT) return this.comments.moderationVersion(targetId);
    if (type === ReportTargetType.DOCUMENT) return this.documents.moderationVersion(targetId);
    throw new ApiException(422, 'REPORT_TARGET_UNSUPPORTED', 'Loại nội dung này chưa thể kiểm duyệt.');
  }

  async takeDown(
    type: ReportTargetType,
    targetId: string,
    actor: IdentityContext,
    reason: string,
    expectedVersion: number,
    requestId: string,
  ) {
    if (type === ReportTargetType.POST) {
      await this.posts.moderate(actor, targetId, { action: 'HIDE', reason, expectedVersion }, requestId);
      return;
    }
    if (type === ReportTargetType.COMMENT) {
      await this.comments.moderate(actor, targetId, { action: 'HIDE', reason, expectedVersion }, requestId);
      return;
    }
    if (type === ReportTargetType.DOCUMENT) {
      await this.documents.moderate(
        actor,
        targetId,
        { action: 'HIDE', reason, expectedVersion },
        requestId,
      );
      return;
    }
    throw new ApiException(422, 'REPORT_TARGET_UNSUPPORTED', 'Loại nội dung này chưa thể kiểm duyệt.');
  }
}
