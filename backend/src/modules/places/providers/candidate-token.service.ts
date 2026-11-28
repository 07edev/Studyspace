import { Inject, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { ApiException } from '../../../common/api-error';
import { APP_CONFIG, type AppConfig } from '../../../config/configuration';
import { PlaceOrigin } from '../place.enums';
import type { PlaceSourceDoc } from '../schemas/place.schema';

export type CandidateTokenPayload = {
  provider: PlaceOrigin;
  providerPlaceId: string;
  name: string;
  lat: number;
  lng: number;
  sourceUrl?: string;
  licenseNote: string;
  storedFields: string[];
  exp: number; // epoch ms
};

@Injectable()
export class CandidateTokenService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  private sign(bodyB64: string): string {
    return createHmac('sha256', this.config.jwtAccessSecret)
      .update(`place-candidate:${bodyB64}`)
      .digest('base64url');
  }

  issue(input: Omit<CandidateTokenPayload, 'exp'>): { token: string; expiresAt: string } {
    const ttlSeconds = this.config.placeProviders?.candidateTokenTtlSeconds ?? 900;
    const exp = Date.now() + ttlSeconds * 1000;
    const payload: CandidateTokenPayload = { ...input, exp };
    const bodyB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = this.sign(bodyB64);
    return {
      token: `${bodyB64}.${sig}`,
      expiresAt: new Date(exp).toISOString(),
    };
  }

  verify(token: string): PlaceSourceDoc {
    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new ApiException(422, 'SOURCE_TOKEN_INVALID', 'Mã nguồn dữ liệu không hợp lệ.');
    }
    const [bodyB64, providedSig] = parts;
    const expectedSig = this.sign(bodyB64);
    const a = Buffer.from(providedSig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ApiException(422, 'SOURCE_TOKEN_INVALID', 'Chữ ký mã nguồn dữ liệu không hợp lệ.');
    }

    let parsed: CandidateTokenPayload;
    try {
      parsed = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8')) as CandidateTokenPayload;
    } catch {
      throw new ApiException(422, 'SOURCE_TOKEN_INVALID', 'Mã nguồn dữ liệu không hợp lệ.');
    }

    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp <= Date.now()) {
      throw new ApiException(
        422,
        'SOURCE_TOKEN_INVALID',
        'Mã nguồn dữ liệu đã hết hạn. Vui lòng tìm kiếm lại.',
      );
    }

    return {
      provider: parsed.provider,
      providerPlaceId: parsed.providerPlaceId,
      sourceUrl: parsed.sourceUrl,
      fetchedAt: new Date(),
      licenseNote: parsed.licenseNote,
      storedFields: parsed.storedFields,
    };
  }
}
