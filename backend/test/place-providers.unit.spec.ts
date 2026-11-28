import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../src/config/configuration';
import { PlaceOrigin } from '../src/modules/places/place.enums';
import { CandidateTokenService } from '../src/modules/places/providers/candidate-token.service';
import { nameSimilarityScore } from '../src/modules/places/providers/duplicate-check.service';
import { PlaceProvidersService } from '../src/modules/places/providers/place-providers.service';

const baseConfig = (over: Partial<AppConfig> = {}): AppConfig => ({
  nodeEnv: 'test',
  port: 3000,
  mongoUri: 'mongodb://127.0.0.1:27017/test',
  jwtAccessSecret: 'a-very-long-test-secret-for-hmac-signing-123456',
  jwtAccessTtlSeconds: 900,
  refreshTtlDays: 30,
  otpTtlSeconds: 300,
  otpMaxAttempts: 5,
  otpCooldownSeconds: 60,
  googleClientIds: [],
  disableRateLimit: true,
  corsOrigins: [],
  placeProviders: {
    osmOverpassUrl: 'https://overpass.test',
    osmNominatimUrl: 'https://nominatim.test',
    osmUserAgent: 'StudySpaceTest/1.0',
    wikidataApiUrl: 'https://wikidata.test/w/api.php',
    candidateTokenTtlSeconds: 60,
    providerTimeoutMs: 2000,
  },
  ...over,
});

describe('CandidateTokenService', () => {
  it('issues and verifies HMAC-signed candidate tokens and rejects tampering or expiry', () => {
    const svc = new CandidateTokenService(baseConfig());
    const { token, expiresAt } = svc.issue({
      provider: PlaceOrigin.OSM,
      providerPlaceId: 'node/999',
      name: 'Quán Cà Phê Học Tập',
      lat: 10.77,
      lng: 106.7,
      licenseNote: '© OpenStreetMap contributors (ODbL 1.0)',
      storedFields: ['name', 'location'],
    });
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
    const source = svc.verify(token);
    expect(source.provider).toBe(PlaceOrigin.OSM);
    expect(source.providerPlaceId).toBe('node/999');

    // Tampered token -> SOURCE_TOKEN_INVALID
    expect(() => svc.verify(`${token}x`)).toThrow(/không hợp lệ/);

    // Expired token -> SOURCE_TOKEN_INVALID
    const expiredSvc = new CandidateTokenService(
      baseConfig({
        placeProviders: {
          ...baseConfig().placeProviders!,
          candidateTokenTtlSeconds: -5,
        },
      }),
    );
    const expired = expiredSvc.issue({
      provider: PlaceOrigin.WIKIDATA,
      providerPlaceId: 'Q123',
      name: 'Thư viện',
      lat: 10.77,
      lng: 106.7,
      licenseNote: 'CC0',
      storedFields: ['name'],
    });
    expect(() => expiredSvc.verify(expired.token)).toThrow(/hết hạn/);
  });
});

describe('nameSimilarityScore', () => {
  it('matches Vietnamese names ignoring accents and punctuation', () => {
    expect(nameSimilarityScore('Thư viện Tổng hợp', 'thu vien tong hop')).toBe(1);
    expect(nameSimilarityScore('Highlands Coffee Bách Khoa', 'Highlands Coffee')).toBeGreaterThanOrEqual(0.8);
    expect(nameSimilarityScore('Quán Cà Phê Xanh', 'Thư viện Quốc gia')).toBeLessThan(0.2);
  });
});

describe('PlaceProvidersService (mocked upstream HTTP)', () => {
  it('combines OSM and Wikidata results, skips unconfigured Google Places, and signs tokens', async () => {
    const cfg = baseConfig();
    const tokens = new CandidateTokenService(cfg);
    const svc = new PlaceProvidersService(cfg, tokens);

    svc.setFetcher(
      vi.fn(async (url: string) => {
        if (url.startsWith('https://nominatim.test')) {
          return new Response(
            JSON.stringify([
              {
                osm_type: 'node',
                osm_id: 101,
                name: 'Cà Phê Học Bài',
                display_name: 'Cà Phê Học Bài, Quận 1, TP.HCM',
                type: 'cafe',
                lat: '10.775',
                lon: '106.701',
              },
            ]),
            { status: 200 },
          );
        }
        if (url.includes('wbsearchentities')) {
          return new Response(
            JSON.stringify({
              search: [{ id: 'Q42', label: 'Thư viện Khoa học Tổng hợp', description: 'Thư viện tại TP.HCM' }],
            }),
            { status: 200 },
          );
        }
        if (url.includes('wbgetentities')) {
          return new Response(
            JSON.stringify({
              entities: {
                Q42: {
                  claims: {
                    P625: [{ mainsnak: { datavalue: { value: { latitude: 10.777, longitude: 106.697 } } } }],
                  },
                },
              },
            }),
            { status: 200 },
          );
        }
        return new Response('[]', { status: 404 });
      }),
    );

    const page = await svc.searchCandidates({ q: 'thư viện' });
    expect(page.items).toHaveLength(2);
    expect(page.items.map(i => i.provider)).toEqual([PlaceOrigin.OSM, PlaceOrigin.WIKIDATA]);
    expect(JSON.stringify(page)).not.toContain('GOOGLE_PLACES_API_KEY');
    // Verify issued candidate token parses cleanly
    const verified = tokens.verify(page.items[0].candidateToken);
    expect(verified.providerPlaceId).toBe('node/101');
  });

  it('returns 429 UPSTREAM_RATE_LIMITED when upstream rate-limits and 503 when Google requested without key', async () => {
    const cfg = baseConfig();
    const svc = new PlaceProvidersService(cfg, new CandidateTokenService(cfg));
    svc.setFetcher(vi.fn(async () => new Response('too many', { status: 429 })));

    await expect(svc.searchCandidates({ q: 'cafe', providers: ['OSM'] })).rejects.toMatchObject({
      code: 'UPSTREAM_RATE_LIMITED',
    });

    await expect(
      svc.searchCandidates({ q: 'cafe', providers: ['GOOGLE_PLACES'] }),
    ).rejects.toMatchObject({
      code: 'EXTERNAL_PROVIDER_UNAVAILABLE',
    });
  });
});
