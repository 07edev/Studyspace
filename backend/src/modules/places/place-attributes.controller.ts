import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  Public,
  RequirePermission,
} from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import { PageQuery } from '../../common/utils/page';
import {
  AttributeDefinitionPatchDto,
  AttributeDefinitionsQueryDto,
  AttributeDefinitionWriteDto,
} from './dto/place-attributes.dto';
import { PlaceAttributesService } from './place-attributes.service';

type ReqWithId = Request & { requestId?: string };

@ApiTags('PlaceAttributes')
@Controller()
export class PlaceAttributesController {
  constructor(private readonly attributes: PlaceAttributesService) {}

  @Public()
  @Get('places/attribute-definitions')
  listPublic(@Query() query: AttributeDefinitionsQueryDto) {
    return this.attributes.listPublic(query);
  }

  @RequirePermission('PLACES', 'READ')
  @Get('admin/place-attributes')
  listAdmin(@Query() query: PageQuery) {
    return this.attributes.listAdmin(query);
  }

  @RequirePermission('PLACES', 'UPDATE')
  @Post('admin/place-attributes')
  create(
    @CurrentUser() actor: IdentityContext,
    @Body() dto: AttributeDefinitionWriteDto,
    @Req() req: ReqWithId,
  ) {
    return this.attributes.create(actor, dto, req.requestId ?? 'unknown');
  }

  @RequirePermission('PLACES', 'UPDATE')
  @Patch('admin/place-attributes/:attributeId')
  patch(
    @CurrentUser() actor: IdentityContext,
    @Param('attributeId') attributeId: string,
    @Body() dto: AttributeDefinitionPatchDto,
    @Req() req: ReqWithId,
  ) {
    return this.attributes.patch(actor, attributeId, dto, req.requestId ?? 'unknown');
  }
}
