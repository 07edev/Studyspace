import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { StatsRegistry, type StatsWindow } from '../stats/stats.registry';
import { PlaceStatus } from './place.enums';
import { PlaceEntity } from './schemas/place.schema';

@Injectable()
export class PlacesStatsContributor implements OnModuleInit {
  private pendingSuggestionsCounter?: () => Promise<number>;

  constructor(
    @InjectModel(PlaceEntity.name) private readonly places: Model<PlaceEntity>,
    private readonly stats: StatsRegistry,
  ) {}

  /** PlaceSuggestionsModule (M6) attaches its pending counter here cleanly. */
  registerPendingSuggestionsCounter(fn: () => Promise<number>) {
    this.pendingSuggestionsCounter = fn;
  }

  onModuleInit() {
    this.stats.register({
      name: 'places',
      overview: () => this.overview(),
      daily: window => this.daily(window),
    });
  }

  async overview() {
    const activeFilter = { status: { $ne: PlaceStatus.DELETED } };
    const [totalPlaces, byCatRows, pendingSuggestions] = await Promise.all([
      this.places.countDocuments(activeFilter),
      this.places.aggregate<{ _id: string; count: number }>([
        { $match: activeFilter },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      this.pendingSuggestionsCounter ? this.pendingSuggestionsCounter() : Promise.resolve(undefined),
    ]);

    const placesByCategory: Record<string, number> = {};
    for (const row of byCatRows) {
      if (row._id) placesByCategory[row._id] = row.count;
    }

    return {
      totalPlaces,
      placesByCategory,
      ...(pendingSuggestions !== undefined ? { pendingSuggestions } : {}),
    };
  }

  async daily(window: StatsWindow) {
    const rows = await this.places.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          status: { $ne: PlaceStatus.DELETED },
          createdAt: { $gte: window.from, $lt: window.to },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+07:00' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return {
      places: rows.map(r => ({ date: r._id, count: r.count })),
    };
  }
}
