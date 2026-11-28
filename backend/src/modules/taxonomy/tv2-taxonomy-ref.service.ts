import { Injectable } from '@nestjs/common';
import { TaxonomyRef } from '../users/ports';
import { TaxonomyService } from './taxonomy.service';

@Injectable()
export class Tv2TaxonomyRef extends TaxonomyRef {
  constructor(private readonly taxonomy: TaxonomyService) {
    super();
  }

  async assertValid(input: {
    universityId?: string;
    majorId?: string;
    subjectIds?: string[];
  }): Promise<void> {
    await this.taxonomy.assertValidProfileTaxonomy(input);
  }
}
