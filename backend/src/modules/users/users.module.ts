import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import {
  NotConnectedTaxonomyRef,
  TaxonomyRef,
} from './ports';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [FilesModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    { provide: TaxonomyRef, useClass: NotConnectedTaxonomyRef },
  ],
  exports: [UsersService, TaxonomyRef],
})
export class UsersModule {}
