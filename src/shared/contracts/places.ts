import type { PublicAuthor } from './api';
import type { GeoPoint } from './auth';

export type { GeoPoint };

// Shared TV2 (Places & Explore) DTO contracts following G1 REST API Spec section 4 & 7.5.
// Imported by both Mobile App (`src/`) and Web Admin (`web-admin/` via `@contracts/places`).

export type PlaceCategory = 'CAFE' | 'LIBRARY' | 'COWORKING' | 'STUDY_ROOM' | 'OTHER';
export type PlaceOrigin =
  | 'MANUAL'
  | 'OSM'
  | 'WIKIDATA'
  | 'GOOGLE_PLACES'
  | 'MIXED'
  | 'USER_SUGGESTION';
export type PlaceStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'DELETED';
export type QuietLevel = 'VERY_QUIET' | 'QUIET' | 'MODERATE' | 'NOISY' | 'UNKNOWN';
export type StudySuitability = 'SOLO' | 'GROUP' | 'BOTH' | 'UNKNOWN';
export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export type AttributeType =
  | 'TEXT'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'SINGLE_SELECT'
  | 'MULTI_SELECT';
export type FieldVerifiedStatus = 'UNVERIFIED' | 'VERIFIED' | 'DISPUTED';
export type ReviewStatus = 'PUBLISHED' | 'HIDDEN' | 'DELETED';
export type SuggestionType = 'CREATE' | 'UPDATE';
export type SuggestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type TaxonomyItem = {
  id: string;
  code: string;
  name: string;
  parentId?: string;
  active: boolean;
};

export type Address = {
  line1: string;
  wardCode?: string;
  districtCode?: string;
  provinceCode: string;
  countryCode: 'VN';
  displayText?: string;
};

export type OpeningInterval = {
  open: string; // HH:mm
  close: string; // HH:mm
  overnight?: boolean;
};

export type OpeningDay = {
  day: DayOfWeek;
  closed: boolean;
  intervals: OpeningInterval[];
};

export type PriceRange = {
  minVnd: number;
  maxVnd: number;
  note?: string;
  currency: 'VND';
};

export type ImageRef = {
  fileId: string;
  url?: string;
  alt?: string;
  sortOrder: number;
  isCover: boolean;
};

export type PlaceSource = {
  provider: PlaceOrigin;
  providerPlaceId: string;
  sourceUrl?: string;
  fetchedAt?: string;
  licenseNote?: string;
  storedFields?: string[];
};

export type FieldState = {
  path: string;
  verified: FieldVerifiedStatus;
  locked: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  note?: string;
};

export type AttributeDefinition = {
  id: string;
  key: string;
  label: string;
  type: AttributeType;
  options?: string[];
  unit?: string;
  required: boolean;
  filterable: boolean;
  active: boolean;
  category?: PlaceCategory;
  createdAt?: string;
};

export type AttributeDefinitionWrite = {
  key: string;
  label: string;
  type: AttributeType;
  options?: string[];
  unit?: string;
  required: boolean;
  filterable: boolean;
  active: boolean;
  category?: PlaceCategory;
};

export type AttributePrimitiveValue = string | number | boolean | string[];

export type AttributeValue = {
  definitionId: string;
  value: AttributePrimitiveValue;
};

export type FieldDecision = {
  path: string;
  action?: 'LOCK' | 'UNLOCK';
  verified?: FieldVerifiedStatus;
  reason: string;
};

export type Place = {
  id: string;
  name: string;
  category: PlaceCategory;
  description?: string;
  address: Address;
  location: GeoPoint;
  phone?: string;
  website?: string;
  images: ImageRef[];
  hours: OpeningDay[];
  price?: PriceRange;
  amenities: string[];
  quietLevel: QuietLevel;
  studySuitability: StudySuitability;
  attributes?: AttributeValue[];
  // Admin-only fields (omitted on public redacted endpoints)
  fieldStates?: FieldState[];
  sources?: PlaceSource[];
  origin: PlaceOrigin;
  status: PlaceStatus;
  ratingAverage: number;
  ratingCount: number;
  reviewCount?: number;
  isFavorite?: boolean;
  distanceMeters?: number;
  openNow?: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  deletedAt?: string;
};

export type PlaceUpsert = {
  name: string;
  category: PlaceCategory;
  description?: string;
  address: Address;
  location: GeoPoint;
  phone?: string;
  website?: string;
  imageFileIds?: string[];
  coverFileId?: string;
  hours?: OpeningDay[];
  price?: PriceRange;
  amenities?: string[];
  quietLevel?: QuietLevel;
  studySuitability?: StudySuitability;
  attributes?: AttributeValue[];
  origin: PlaceOrigin;
  importCandidateToken?: string;
  sourceLinkId?: string;
  status?: PlaceStatus;
  duplicateOverrideReason?: string;
};

export type PlacePatch = {
  name?: string;
  category?: PlaceCategory;
  description?: string | null;
  address?: Address;
  location?: GeoPoint;
  phone?: string | null;
  website?: string | null;
  imageFileIds?: string[];
  coverFileId?: string | null;
  hours?: OpeningDay[];
  price?: PriceRange | null;
  amenities?: string[];
  quietLevel?: QuietLevel;
  studySuitability?: StudySuitability;
  attributes?: AttributeValue[];
  version: number;
};

export type PlaceStatusPatch = {
  status: 'PUBLISHED' | 'HIDDEN' | 'DELETED';
  reason: string;
};

export type PlaceCandidate = {
  candidateToken: string;
  provider: PlaceOrigin;
  providerPlaceId?: string;
  name: string;
  addressText?: string;
  location: GeoPoint;
  category?: PlaceCategory;
  expiresAt: string;
  licenseNotice?: string;
};

export type DuplicateCheck = {
  name: string;
  location: GeoPoint;
  address?: Address;
  excludePlaceId?: string;
};

export type DuplicateMatch = {
  placeId: string;
  name: string;
  addressText?: string;
  category: PlaceCategory;
  status: PlaceStatus;
  distanceMeters: number;
  similarityScore: number;
};

export type DuplicateResult = {
  possibleDuplicates: DuplicateMatch[];
  requiresReview: boolean;
};

export type PlaceMapFeature = {
  placeId: string;
  name: string;
  location: GeoPoint;
  category: PlaceCategory;
  ratingAverage?: number;
  coverUrl?: string;
};

export type FacetItem = {
  value: string;
  label: string;
  count: number;
};

export type PlaceFacets = {
  categories: FacetItem[];
  amenities: FacetItem[];
  customAttributes: AttributeDefinition[];
};

export type Homepage = {
  categories: TaxonomyItem[];
  nearby: Place[];
  topRated: Place[];
  recentlyUpdated: Place[];
};

export type PlaceHistoryDiff = {
  field: string;
  before?: unknown;
  after?: unknown;
  source?: string;
};

export type PlaceHistory = {
  id: string;
  placeId: string;
  actorId: string;
  changedAt: string;
  diff: PlaceHistoryDiff[];
};

export type BooleanResult = {
  value: boolean;
};

export type Review = {
  id: string;
  placeId: string;
  placeName?: string;
  author: PublicAuthor;
  rating: number;
  content?: string;
  images?: ImageRef[];
  status: ReviewStatus;
  createdAt: string;
  updatedAt?: string;
};

export type ReviewWrite = {
  rating: number;
  content?: string;
  imageFileIds?: string[];
};

export type ContentModerate = {
  action: 'HIDE' | 'RESTORE';
  reason: string;
};

export type SuggestionChange = {
  fieldPath: string;
  oldValue?: unknown;
  newValue: unknown;
  reason: string;
};

export type Suggestion = {
  id: string;
  type: SuggestionType;
  placeId?: string;
  placeName?: string;
  proposedPlace?: PlaceUpsert;
  changes?: SuggestionChange[];
  evidenceFileIds?: string[];
  status: SuggestionStatus;
  submittedBy: PublicAuthor;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt?: string;
  version: number;
};

export type SuggestionCreate = {
  type: SuggestionType;
  placeId?: string;
  proposedPlace?: PlaceUpsert;
  changes?: SuggestionChange[];
  evidenceFileIds?: string[];
};

export type ModerationDecision = {
  action: 'APPROVE' | 'REJECT';
  reason?: string;
  expectedVersion: number;
};
