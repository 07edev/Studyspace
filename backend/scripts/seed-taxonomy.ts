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
  PlaceAttributeDefinitionEntity,
  PlaceAttributeDefinitionSchema,
} from '../src/modules/places/schemas/place-attribute-definition.schema';
import { DEFAULT_ATTRIBUTE_DEFINITIONS } from '../src/modules/places/place-attributes.service';
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

    const attrModel = mongoose.model(
      PlaceAttributeDefinitionEntity.name,
      PlaceAttributeDefinitionSchema,
    );
    let attrs = 0;
    for (const item of DEFAULT_ATTRIBUTE_DEFINITIONS) {
      await attrModel.findOneAndUpdate(
        { key: item.key, category: item.category ?? null },
        {
          $set: {
            label: item.label,
            type: item.type,
            options: item.options,
            unit: item.unit,
            required: item.required,
            filterable: item.filterable,
            active: item.active,
            ...(item.category ? { category: item.category } : {}),
          },
          $setOnInsert: { key: item.key },
        },
        { upsert: true },
      );
      attrs += 1;
    }
    console.log(`Seeded ${upserted} taxonomy/location entries and ${attrs} place attributes.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error('Failed to seed taxonomy:', error?.message ?? error);
  process.exit(1);
});
