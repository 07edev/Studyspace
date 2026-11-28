import { Injectable } from '@nestjs/common';

// Optional registry so FavoritesModule (M5) can attach isFavorite to public place responses
// without creating circular module dependencies.
export type FavoriteLookupFn = (userId: string, placeIds: string[]) => Promise<Set<string>>;

@Injectable()
export class FavoriteLookupRegistry {
  private lookupFn?: FavoriteLookupFn;

  register(fn: FavoriteLookupFn) {
    this.lookupFn = fn;
  }

  async lookup(userId: string | undefined, placeIds: string[]): Promise<Set<string>> {
    if (!userId || placeIds.length === 0 || !this.lookupFn) {
      return new Set();
    }
    return this.lookupFn(userId, placeIds);
  }
}
