// Query-key convention (shared by TV1/TV2/TV3) so cache entries never collide:
//
//   [domain, resource, ...params]       e.g. ['places', 'list', { province: 'HCM' }]
//
//  - domain   : the owner's area ('users', 'places', 'taxonomy', 'posts', 'documents', 'notifications'...)
//  - resource : 'me' | 'list' | 'detail' | 'search' ...
//  - params   : ONE plain object for filters, or ids. Objects are compared by value, so key order inside
//               the object does not matter.
//
// Each owner adds a small factory below or in their own feature folder. After a mutation, invalidate the
// narrowest key that is affected, e.g. queryClient.invalidateQueries({ queryKey: queryKeys.places.all }).
export type QueryKey = readonly unknown[];

export const queryKeys = {
  users: {
    all: ['users'] as const,
    me: () => ['users', 'me'] as const,
    privacy: () => ['users', 'privacy'] as const,
    notificationSettings: () => ['users', 'notification-settings'] as const,
    publicProfile: (userId: string) => ['users', 'public-profile', userId] as const,
  },
  // TV2 and TV3: add your factories here (or export them from your feature) following the same shape.
  taxonomy: {
    all: ['taxonomy'] as const,
    categories: () => ['taxonomy', 'categories'] as const,
    amenities: () => ['taxonomy', 'amenities'] as const,
    universities: (q = '') => ['taxonomy', 'universities', { q }] as const,
    majors: (universityId?: string, q = '') => ['taxonomy', 'majors', { universityId, q }] as const,
    subjects: (q = '') => ['taxonomy', 'subjects', { q }] as const,
    provinces: () => ['taxonomy', 'provinces'] as const,
    wards: (provinceCode: string) => ['taxonomy', 'wards', { provinceCode }] as const,
  },
  places: {
    all: ['places'] as const,
    home: (params: object = {}) => ['places', 'home', params] as const,
    list: (filters: object = {}) => ['places', 'list', filters] as const,
    map: (filters: object = {}) => ['places', 'map', filters] as const,
    facets: (category?: string) => ['places', 'facets', { category }] as const,
    attributes: (category?: string) => ['places', 'attributes', { category }] as const,
    detail: (placeId: string) => ['places', 'detail', placeId] as const,
    similar: (placeId: string) => ['places', 'similar', placeId] as const,
    reviews: (placeId: string, sort = 'newest') => ['places', 'reviews', placeId, { sort }] as const,
  },
  favorites: {
    all: ['favorites'] as const,
    list: () => ['favorites', 'list'] as const,
  },
  reviews: {
    all: ['reviews'] as const,
    mine: () => ['reviews', 'mine'] as const,
  },
  suggestions: {
    all: ['suggestions'] as const,
    mine: () => ['suggestions', 'mine'] as const,
    detail: (suggestionId: string) => ['suggestions', 'detail', suggestionId] as const,
  },
  posts: {
    all: ['posts'] as const,
    list: (filters: object = {}) => ['posts', 'list', filters] as const,
    detail: (postId: string) => ['posts', 'detail', postId] as const,
  },
  documents: {
    all: ['documents'] as const,
    list: (filters: object = {}) => ['documents', 'list', filters] as const,
    detail: (documentId: string) => ['documents', 'detail', documentId] as const,
  },
};

/** "/places" + {q: 'a b', page: 2, province: undefined} -> "/places?q=a%20b&page=2" */
export function withQuery(path: string, params: Record<string, unknown> = {}): string {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .flatMap(([key, value]) =>
      (Array.isArray(value) ? value : [value]).map(
        item => `${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`,
      ),
    );
  if (parts.length === 0) {
    return path;
  }
  return `${path}${path.includes('?') ? '&' : '?'}${parts.join('&')}`;
}
