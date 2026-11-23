import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PageQuery } from '../../../common/utils/page';

export class NotificationsQuery extends PageQuery {
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  unreadOnly?: boolean;
}

export class NotificationMarkDto {
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  read: boolean;
}
