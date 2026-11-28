import { Module } from '@nestjs/common';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { Tv2TaxonomyRef } from '../taxonomy/tv2-taxonomy-ref.service';
import {
  FileReadyRef,
  NotConnectedFileReadyRef,
  TaxonomyRef,
} from './ports';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TaxonomyModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    // TV2 taxonomy connected; TV3 FileReadyRef stays 503 until TV3 merges.
    { provide: TaxonomyRef, useExisting: Tv2TaxonomyRef },
    { provide: FileReadyRef, useClass: NotConnectedFileReadyRef },
  ],
  exports: [UsersService],
})
export class UsersModule {}
