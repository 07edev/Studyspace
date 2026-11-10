import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateBy,
  ValidateNested,
} from 'class-validator';

// DTO names and rules follow the REST spec (ProfilePatch, PrivacySettings, NotificationSettings,
// NotificationDevice, GeoPoint). PATCH bodies are partial: send only what changes. For optional
// profile fields, `null` (or an empty string for text) clears the value.
const OBJECT_ID = /^[a-fA-F0-9]{24}$/;
const ID_MESSAGE = 'Mã không hợp lệ.';

const emptyToNull = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });

// displayName can never be cleared: only trimmed (an empty value then fails minLength).
const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

// Calendar date YYYY-MM-DD, real, not in the future and not absurdly old.
const IsPastDate = () =>
  ValidateBy({
    name: 'pastDate',
    validator: {
      validate: (value: unknown) => {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return false;
        }
        const date = new Date(`${value}T00:00:00.000Z`);
        return (
          !Number.isNaN(date.getTime()) &&
          date.toISOString().slice(0, 10) === value &&
          value >= '1900-01-01' &&
          date.getTime() <= Date.now()
        );
      },
      defaultMessage: () => 'Ngày sinh không hợp lệ hoặc lớn hơn ngày hiện tại (định dạng YYYY-MM-DD).',
    },
  });

export class GeoPoint {
  @IsNumber() @Min(-90) @Max(90)
  lat: number;

  @IsNumber() @Min(-180) @Max(180)
  lng: number;
}

export class ProfilePatch {
  @IsOptional() @trim() @IsString() @MinLength(2) @MaxLength(100)
  displayName?: string;

  @IsOptional() @IsString() @Matches(OBJECT_ID, { message: ID_MESSAGE })
  avatarFileId?: string | null;

  @IsOptional() @IsPastDate()
  dateOfBirth?: string | null;

  @IsOptional() @emptyToNull() @IsString() @MaxLength(120)
  hometown?: string | null;

  @IsOptional() @emptyToNull() @IsString() @MaxLength(500)
  bio?: string | null;

  @IsOptional() @IsString() @Matches(OBJECT_ID, { message: ID_MESSAGE })
  universityId?: string | null;

  @IsOptional() @IsString() @Matches(OBJECT_ID, { message: ID_MESSAGE })
  majorId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30, { message: 'Tối đa 30 môn học.' })
  @ArrayUnique(undefined, { message: 'Danh sách môn học bị trùng.' })
  @Matches(OBJECT_ID, { each: true, message: ID_MESSAGE })
  subjectIds?: string[] | null;

  @IsOptional() @IsIn(['MANUAL', 'CURRENT_LOCATION'])
  locationMode?: 'MANUAL' | 'CURRENT_LOCATION' | null;

  @IsOptional() @ValidateNested() @Type(() => GeoPoint)
  location?: GeoPoint | null;
}

export class PrivacySettingsDto {
  @IsOptional() @IsIn(['PUBLIC', 'PRIVATE'])
  profileVisibility?: 'PUBLIC' | 'PRIVATE';

  @IsOptional() @IsBoolean()
  showUniversity?: boolean;

  @IsOptional() @IsBoolean()
  showMajor?: boolean;
}

export class NotificationSettingsDto {
  @IsOptional() @IsBoolean()
  postInteraction?: boolean;

  @IsOptional() @IsBoolean()
  moderation?: boolean;

  @IsOptional() @IsBoolean()
  adminMessage?: boolean;

  @IsOptional() @IsBoolean()
  system?: boolean;

  @IsOptional() @IsBoolean()
  pushEnabled?: boolean;
}

export class NotificationDevice {
  @IsIn(['ANDROID', 'IOS', 'WEB'])
  platform: 'ANDROID' | 'IOS' | 'WEB';

  @IsString() @MinLength(20) @MaxLength(4096)
  pushToken: string;
}
