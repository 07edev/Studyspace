// Usage:
//   npm run seed:taxonomy
//
// Idempotently upserts static Vietnam taxonomy & administrative data (place categories,
// amenities, provinces, wards, universities, majors, subjects) by { kind, code }.
// Safe to run repeatedly: existing ObjectIds remain unchanged.
import '../src/load-env';
import mongoose, { type Model } from 'mongoose';
import { loadConfig } from '../src/config/configuration';
import {
  TaxonomyItemEntity,
  TaxonomyItemSchema,
} from '../src/modules/taxonomy/schemas/taxonomy-item.schema';
import { TaxonomyService } from '../src/modules/taxonomy/taxonomy.service';

async function main() {
  const config = loadConfig();
  await mongoose.connect(config.mongoUri);
  try {
    const model = mongoose.model(
      TaxonomyItemEntity.name,
      TaxonomyItemSchema,
    ) as unknown as Model<TaxonomyItemEntity>;
    const service = new TaxonomyService(model);
    const { upserted } = await service.seedEntries();
    console.log(`Seeded ${upserted} taxonomy & location entries.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error('Failed to seed taxonomy:', error?.message ?? error);
  process.exit(1);
});
