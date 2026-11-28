export enum PlaceCategory {
  CAFE = 'CAFE',
  LIBRARY = 'LIBRARY',
  COWORKING = 'COWORKING',
  STUDY_ROOM = 'STUDY_ROOM',
  OTHER = 'OTHER',
}

export enum PlaceOrigin {
  MANUAL = 'MANUAL',
  OSM = 'OSM',
  WIKIDATA = 'WIKIDATA',
  GOOGLE_PLACES = 'GOOGLE_PLACES',
  MIXED = 'MIXED',
  USER_SUGGESTION = 'USER_SUGGESTION',
}

export enum PlaceStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  HIDDEN = 'HIDDEN',
  DELETED = 'DELETED',
}

export enum QuietLevel {
  VERY_QUIET = 'VERY_QUIET',
  QUIET = 'QUIET',
  MODERATE = 'MODERATE',
  NOISY = 'NOISY',
  UNKNOWN = 'UNKNOWN',
}

export enum StudySuitability {
  SOLO = 'SOLO',
  GROUP = 'GROUP',
  BOTH = 'BOTH',
  UNKNOWN = 'UNKNOWN',
}

export enum DayOfWeek {
  MON = 'MON',
  TUE = 'TUE',
  WED = 'WED',
  THU = 'THU',
  FRI = 'FRI',
  SAT = 'SAT',
  SUN = 'SUN',
}

export enum AttributeType {
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  SINGLE_SELECT = 'SINGLE_SELECT',
  MULTI_SELECT = 'MULTI_SELECT',
}

export enum FieldVerifiedStatus {
  UNVERIFIED = 'UNVERIFIED',
  VERIFIED = 'VERIFIED',
  DISPUTED = 'DISPUTED',
}
