import { ApiException } from '../../common/api-error';
import type { Page } from '../../common/utils/page';

// Content a user created lives in TV2 (reviews, place suggestions) and TV3 (posts, documents).
// TV1 shows it on the admin user page through this port and never reads those collections.
// Until an owner connects its kind, counts are left out of the response and the tab answers 503:
// nothing is invented.
export type ContentKind = 'posts' | 'documents' | 'reviews' | 'suggestions';
export const CONTENT_KINDS: ContentKind[] = ['posts', 'documents', 'reviews', 'suggestions'];

export abstract class UserContentRef {
  /** Number of items of this kind the user created, or undefined while the owner is not connected. */
  abstract count(kind: ContentKind, userId: string): Promise<number | undefined>;
  /** One page of the user's items of this kind, or undefined while the owner is not connected. */
  abstract list(
    kind: ContentKind,
    userId: string,
    paging: { page: number; limit: number },
  ): Promise<Page<unknown> | undefined>;
}

/**
 * Default provider. TV2/TV3: extend it, override the kinds you own and register your class in
 * admin-users.module.ts. Kinds you do not override stay "not connected".
 */
export class NotConnectedUserContentRef extends UserContentRef {
  async count(): Promise<number | undefined> {
    return undefined;
  }
  async list(): Promise<Page<unknown> | undefined> {
    return undefined;
  }
}

export const contentNotConnected = () =>
  new ApiException(
    503,
    'CONTENT_NOT_CONNECTED',
    'Dữ liệu này chưa sẵn sàng. Vui lòng thử lại sau.',
  );
