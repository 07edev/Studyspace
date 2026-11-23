import { Injectable } from '@nestjs/common';
import type { Page } from '../../common/utils/page';
import { DocumentsService } from '../documents/documents.service';
import { PostsService } from '../posts/posts.service';
import { UserContentRef, type ContentKind } from '../admin-users/ports';
import { ReportsService } from './reports.service';

@Injectable()
export class Tv3UserContentRef extends UserContentRef {
  constructor(
    private readonly posts: PostsService,
    private readonly documents: DocumentsService,
    private readonly reports: ReportsService,
  ) {
    super();
  }

  async count(kind: ContentKind, userId: string): Promise<number | undefined> {
    if (kind === 'posts') return this.posts.userContentCount(userId);
    if (kind === 'documents') return this.documents.userContentCount(userId);
    if (kind === 'reports') return this.reports.userContentCount(userId);
    return undefined;
  }

  async list(
    kind: ContentKind,
    userId: string,
    paging: { page: number; limit: number },
  ): Promise<Page<unknown> | undefined> {
    if (kind === 'posts') return this.posts.mine(userId, paging);
    if (kind === 'documents') return this.documents.mine(userId, paging);
    if (kind === 'reports') return this.reports.mine(userId, paging);
    return undefined;
  }
}
