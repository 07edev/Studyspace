import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TaxonomyItemEntity, TaxonomyItemSchema } from './schemas/taxonomy-item.schema';
import { TaxonomyController } from './taxonomy.controller';
import { TaxonomyService } from './taxonomy.service';
import { Tv2TaxonomyRef } from './tv2-taxonomy-ref.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TaxonomyItemEntity.name, schema: TaxonomyItemSchema },
    ]),
  ],
  controllers: [TaxonomyController],
  providers: [TaxonomyService, Tv2TaxonomyRef],
  exports: [TaxonomyService, Tv2TaxonomyRef, MongooseModule],
})
export class TaxonomyModule {}
