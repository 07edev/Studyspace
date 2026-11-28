import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import { PageQuery } from '../../common/utils/page';
import { AdminPlacesService } from './admin-places.service';
import {
  AdminPlacesQueryDto,
  FieldDecisionDto,
  PlacePatchDto,
  PlaceStatusPatchDto,
  PlaceUpsertDto,
} from './dto/admin-places.dto';

type ReqWithId = Request & { requestId?: string };

@ApiTags('AdminPlaces')
@Controller('admin/places')
export class AdminPlacesController {
  constructor(private readonly adminPlaces: AdminPlacesService) {}

  @RequirePermission('PLACES', 'READ')
  @Get()
  list(@Query() query: AdminPlacesQueryDto) {
    return this.adminPlaces.list(query);
  }

  @RequirePermission('PLACES', 'READ')
  @Get(':placeId')
  detail(@Param('placeId') placeId: string) {
    return this.adminPlaces.detail(placeId);
  }

  @RequirePermission('PLACES', 'CREATE')
  @Post()
  create(
    @CurrentUser() actor: IdentityContext,
    @Body() dto: PlaceUpsertDto,
    @Req() req: ReqWithId,
  ) {
    return this.adminPlaces.create(actor, dto, req.requestId ?? 'unknown');
  }

  @RequirePermission('PLACES', 'UPDATE')
  @Patch(':placeId')
  patch(
    @CurrentUser() actor: IdentityContext,
    @Param('placeId') placeId: string,
    @Body() dto: PlacePatchDto,
    @Req() req: ReqWithId,
  ) {
    return this.adminPlaces.patch(actor, placeId, dto, req.requestId ?? 'unknown');
  }

  @RequirePermission('PLACES', 'UPDATE')
  @Patch(':placeId/status')
  changeStatus(
    @CurrentUser() actor: IdentityContext,
    @Param('placeId') placeId: string,
    @Body() dto: PlaceStatusPatchDto,
    @Req() req: ReqWithId,
  ) {
    return this.adminPlaces.changeStatus(actor, placeId, dto, req.requestId ?? 'unknown');
  }

  @RequirePermission('PLACES', 'READ')
  @Get(':placeId/history')
  history(@Param('placeId') placeId: string, @Query() query: PageQuery) {
    return this.adminPlaces.history(placeId, query);
  }

  @RequirePermission('PLACES', 'UPDATE')
  @Patch(':placeId/fields/state')
  updateFieldState(
    @CurrentUser() actor: IdentityContext,
    @Param('placeId') placeId: string,
    @Body() dto: FieldDecisionDto,
    @Req() req: ReqWithId,
  ) {
    return this.adminPlaces.updateFieldState(actor, placeId, dto, req.requestId ?? 'unknown');
  }
}
