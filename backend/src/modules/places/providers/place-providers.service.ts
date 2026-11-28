import { Inject, Injectable, Logger } from '@nestjs/common';
import { ApiException } from '../../../common/api-error';
import { pageParams, toPage } from '../../../common/utils/page';
import { APP_CONFIG, type AppConfig } from '../../../config/configuration';
import type {
  ExternalProviderName,
  PlaceCandidatesSearchQueryDto,
} from '../dto/place-providers.dto';
import { PlaceCategory, PlaceOrigin } from '../place.enums';
import { CandidateTokenService } from './candidate-token.service';

export type ProviderFetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export type RawCandidate = {
  provider: PlaceOrigin;
  providerPlaceId: string;
  name: string;
  addressText?: string;
  location: { lat: number; lng: number };
  category?: PlaceCategory;
  sourceUrl?: string;
  licenseNotice: string;
  storedFields: string[];
};

const guessCategory = (hint?: string): PlaceCategory | undefined => {
  const lower = (hint ?? '').toLowerCase();
  if (/library|thu vien|thư viện/.test(lower)) return PlaceCategory.LIBRARY;
  if (/cowork/.test(lower)) return PlaceCategory.COWORKING;
  if (/study|hoc|học/.test(lower)) return PlaceCategory.STUDY_ROOM;
  if (/cafe|coffee|ca phe|cà phê/.test(lower)) return PlaceCategory.CAFE;
  return undefined;
};

class UpstreamError extends Error {
  constructor(
    public readonly code: 'UPSTREAM_RATE_LIMITED' | 'EXTERNAL_PROVIDER_UNAVAILABLE',
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

@Injectable()
export class PlaceProvidersService {
  private readonly logger = new Logger('PlaceProviders');
  private fetcher: ProviderFetchFn = (...args) => fetch(...args);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly tokens: CandidateTokenService,
  ) {}

  setFetcher(fn: ProviderFetchFn) {
    this.fetcher = fn;
  }

  private async fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
    const timeoutMs = this.config.placeProviders?.providerTimeoutMs ?? 8000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await this.fetcher(url, { ...init, signal: controller.signal });
      if (res.status === 429) {
        throw new UpstreamError(
          'UPSTREAM_RATE_LIMITED',
          429,
          'Nguồn dữ liệu bên ngoài đang giới hạn tốc độ truy vấn. Vui lòng thử lại sau.',
        );
      }
      if (!res.ok) {
        throw new UpstreamError(
          'EXTERNAL_PROVIDER_UNAVAILABLE',
          503,
          `Nguồn dữ liệu bên ngoài phản hồi lỗi (${res.status}).`,
        );
      }
      return (await res.json()) as T;
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      throw new UpstreamError(
        'EXTERNAL_PROVIDER_UNAVAILABLE',
        503,
        'Không thể kết nối nguồn dữ liệu địa điểm bên ngoài.',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async searchOsm(query: PlaceCandidatesSearchQueryDto): Promise<RawCandidate[]> {
    const base = (this.config.placeProviders?.osmNominatimUrl ?? 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
    const ua = this.config.placeProviders?.osmUserAgent ?? 'StudySpaceG1/1.0 (+https://studyspace.local)';
    const params = new URLSearchParams({
      q: query.q,
      format: 'jsonv2',
      addressdetails: '1',
      countrycodes: 'vn',
      limit: '15',
    });
    if (query.lat !== undefined && query.lng !== undefined) {
      const d = ((query.radiusMeters ?? 5000) / 111_000);
      params.set('viewbox', `${query.lng - d},${query.lat + d},${query.lng + d},${query.lat - d}`);
    }
    const rows = await this.fetchJson<
      {
        osm_type?: string;
        osm_id?: number | string;
        display_name?: string;
        name?: string;
        type?: string;
        category?: string;
        lat: string;
        lon: string;
      }[]
    >(`${base}/search?${params.toString()}`, {
      headers: { 'User-Agent': ua, Accept: 'application/json' },
    });

    return (Array.isArray(rows) ? rows : [])
      .filter(r => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lon)))
      .map(r => {
        const osmId = `${r.osm_type ?? 'node'}/${r.osm_id ?? ''}`;
        const name = (r.name || r.display_name?.split(',')[0] || query.q).slice(0, 160);
        return {
          provider: PlaceOrigin.OSM,
          providerPlaceId: osmId,
          name,
          addressText: r.display_name?.slice(0, 400),
          location: { lat: Number(r.lat), lng: Number(r.lon) },
          category: query.category ?? guessCategory(`${r.type ?? ''} ${r.category ?? ''} ${name}`),
          sourceUrl: r.osm_type && r.osm_id ? `https://www.openstreetmap.org/${r.osm_type}/${r.osm_id}` : undefined,
          licenseNotice: '© OpenStreetMap contributors (ODbL 1.0)',
          storedFields: ['name', 'address', 'location', 'category'],
        };
      });
  }

  async searchWikidata(query: PlaceCandidatesSearchQueryDto): Promise<RawCandidate[]> {
    const api = this.config.placeProviders?.wikidataApiUrl ?? 'https://www.wikidata.org/w/api.php';
    const ua = this.config.placeProviders?.osmUserAgent ?? 'StudySpaceG1/1.0 (+https://studyspace.local)';
    const searchParams = new URLSearchParams({
      action: 'wbsearchentities',
      search: query.q,
      language: 'vi',
      uselang: 'vi',
      format: 'json',
      limit: '8',
    });
    const searchRes = await this.fetchJson<{
      search?: { id: string; label?: string; description?: string; concepturi?: string }[];
    }>(`${api}?${searchParams.toString()}`, { headers: { 'User-Agent': ua } });

    const hits = searchRes.search ?? [];
    if (hits.length === 0) return [];

    const entitiesParams = new URLSearchParams({
      action: 'wbgetentities',
      ids: hits.map(h => h.id).join('|'),
      props: 'claims|labels|descriptions',
      languages: 'vi|en',
      format: 'json',
    });
    const entitiesRes = await this.fetchJson<{
      entities?: Record<
        string,
        {
          claims?: {
            P625?: { mainsnak?: { datavalue?: { value?: { latitude?: number; longitude?: number } } } }[];
          };
        }
      >;
    }>(`${api}?${entitiesParams.toString()}`, { headers: { 'User-Agent': ua } });

    const results: RawCandidate[] = [];
    for (const hit of hits) {
      const entity = entitiesRes.entities?.[hit.id];
      const coord = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
      if (typeof coord?.latitude !== 'number' || typeof coord?.longitude !== 'number') {
        continue;
      }
      results.push({
        provider: PlaceOrigin.WIKIDATA,
        providerPlaceId: hit.id,
        name: (hit.label ?? hit.id).slice(0, 160),
        addressText: hit.description?.slice(0, 400),
        location: { lat: coord.latitude, lng: coord.longitude },
        category: query.category ?? guessCategory(`${hit.label ?? ''} ${hit.description ?? ''}`),
        sourceUrl: hit.concepturi ?? `https://www.wikidata.org/wiki/${hit.id}`,
        licenseNotice: 'Wikidata (CC0 1.0 Public Domain)',
        storedFields: ['name', 'location', 'sourceUrl'],
      });
    }
    return results;
  }

  async searchGooglePlaces(query: PlaceCandidatesSearchQueryDto): Promise<RawCandidate[]> {
    const apiKey = this.config.placeProviders?.googlePlacesApiKey;
    if (!apiKey) {
      return [];
    }
    const res = await this.fetchJson<{
      places?: {
        id: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude: number; longitude: number };
        googleMapsUri?: string;
        primaryType?: string;
      }[];
    }>('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.primaryType',
      },
      body: JSON.stringify({
        textQuery: query.q,
        languageCode: 'vi',
        regionCode: 'VN',
        maxResultCount: 10,
      }),
    });

    // Strict Google Places TOS: store only providerPlaceId + link attribution, never cache arbitrary fields long-term.
    return (res.places ?? [])
      .filter(p => p.location && typeof p.location.latitude === 'number')
      .map(p => ({
        provider: PlaceOrigin.GOOGLE_PLACES,
        providerPlaceId: p.id,
        name: (p.displayName?.text ?? query.q).slice(0, 160),
        addressText: p.formattedAddress?.slice(0, 400),
        location: { lat: p.location!.latitude, lng: p.location!.longitude },
        category: query.category ?? guessCategory(`${p.primaryType ?? ''} ${p.displayName?.text ?? ''}`),
        sourceUrl: p.googleMapsUri,
        licenseNotice: 'Google Places API (chỉ lưu mã liên kết & nguồn dẫn theo điều khoản Google)',
        storedFields: ['providerPlaceId', 'sourceUrl'],
      }));
  }

  async searchCandidates(query: PlaceCandidatesSearchQueryDto) {
    const { page, limit, skip } = pageParams(query);
    const hasGoogle = Boolean(this.config.placeProviders?.googlePlacesApiKey);
    const requested: ExternalProviderName[] =
      query.providers && query.providers.length > 0
        ? query.providers
        : hasGoogle
          ? ['OSM', 'WIKIDATA', 'GOOGLE_PLACES']
          : ['OSM', 'WIKIDATA'];

    if (requested.length === 1 && requested[0] === 'GOOGLE_PLACES' && !hasGoogle) {
      throw new ApiException(
        503,
        'EXTERNAL_PROVIDER_UNAVAILABLE',
        'Google Places API chưa được cấu hình ở máy chủ.',
      );
    }

    const tasks = requested.map(async provider => {
      if (provider === 'OSM') return this.searchOsm(query);
      if (provider === 'WIKIDATA') return this.searchWikidata(query);
      return this.searchGooglePlaces(query);
    });

    const settled = await Promise.allSettled(tasks);
    const raw: RawCandidate[] = [];
    const errors: UpstreamError[] = [];

    settled.forEach((outcome, idx) => {
      if (outcome.status === 'fulfilled') {
        raw.push(...outcome.value);
      } else {
        const err = outcome.reason;
        this.logger.warn(`Provider ${requested[idx]} failed: ${(err as Error)?.message}`);
        if (err instanceof UpstreamError) errors.push(err);
      }
    });

    if (raw.length === 0 && errors.length > 0 && errors.length === requested.length) {
      const rateLimited = errors.find(e => e.code === 'UPSTREAM_RATE_LIMITED');
      const primary = rateLimited ?? errors[0];
      throw new ApiException(primary.status, primary.code, primary.message);
    }

    const total = raw.length;
    const slice = raw.slice(skip, skip + limit).map(item => {
      const { token, expiresAt } = this.tokens.issue({
        provider: item.provider,
        providerPlaceId: item.providerPlaceId,
        name: item.name,
        lat: item.location.lat,
        lng: item.location.lng,
        sourceUrl: item.sourceUrl,
        licenseNote: item.licenseNotice,
        storedFields: item.storedFields,
      });
      return {
        candidateToken: token,
        provider: item.provider,
        providerPlaceId: item.providerPlaceId,
        name: item.name,
        ...(item.addressText ? { addressText: item.addressText } : {}),
        location: item.location,
        ...(item.category ? { category: item.category } : {}),
        expiresAt,
        licenseNotice: item.licenseNotice,
      };
    });

    return toPage(slice, total, page, limit);
  }
}
