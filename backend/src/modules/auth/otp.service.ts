import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { isValidObjectId, Model, Types } from 'mongoose';
import { ApiException } from '../../common/api-error';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import {
  OtpChallenge,
  type OtpChallengeDocument,
} from '../identity/schemas/otp-challenge.schema';

export type IssuedOtp = {
  code: string;
  challengeId: string;
  expiresAt: Date;
  resendAvailableAt: Date;
};

@Injectable()
export class OtpService {
  constructor(
    @InjectModel(OtpChallenge.name) private readonly challenges: Model<OtpChallenge>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // Keyed hash: a leaked database alone cannot be used to brute-force 6 digit codes offline.
  private hash(emailNormalized: string, purpose: string, code: string) {
    return createHmac('sha256', this.config.jwtAccessSecret)
      .update(`${purpose}:${emailNormalized}:${code}`)
      .digest('hex');
  }

  async issue(input: {
    purpose: string;
    emailNormalized: string;
    userId?: string;
    target?: string;
  }): Promise<IssuedOtp> {
    const now = new Date();
    const cooldownMs = this.config.otpCooldownSeconds * 1000;
    if (cooldownMs > 0) {
      const last = await this.challenges
        .findOne({ emailNormalized: input.emailNormalized, purpose: input.purpose })
        .sort({ createdAt: -1 })
        .lean();
      const wait = last ? last.createdAt.getTime() + cooldownMs - now.getTime() : 0;
      if (wait > 0) {
        throw new ApiException(
          429,
          'OTP_COOLDOWN',
          'Vui lòng đợi trước khi yêu cầu mã mới.',
          undefined,
          Math.ceil(wait / 1000),
        );
      }
    }
    // A new code invalidates every older one for the same flow.
    await this.challenges.updateMany(
      { emailNormalized: input.emailNormalized, purpose: input.purpose, consumedAt: null },
      { $set: { consumedAt: now } },
    );
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const doc = await this.challenges.create({
      userId: input.userId ? new Types.ObjectId(input.userId) : undefined,
      emailNormalized: input.emailNormalized,
      purpose: input.purpose,
      otpHash: this.hash(input.emailNormalized, input.purpose, code),
      target: input.target,
      attemptCount: 0,
      expiresAt: new Date(now.getTime() + this.config.otpTtlSeconds * 1000),
    });
    return {
      code,
      challengeId: String(doc._id),
      expiresAt: doc.expiresAt,
      resendAvailableAt: new Date(now.getTime() + cooldownMs),
    };
  }

  /** Verifies the latest open challenge of a flow and consumes it atomically. */
  async verify(input: {
    purpose: string;
    emailNormalized: string;
    code: string;
  }): Promise<OtpChallengeDocument> {
    const latest = await this.challenges
      .findOne({
        emailNormalized: input.emailNormalized,
        purpose: input.purpose,
        consumedAt: null,
      })
      .sort({ createdAt: -1 });
    return this.check(latest, input.code);
  }

  /** For flows that hand the client a challengeId (contact change). Must belong to the user. */
  async verifyById(input: {
    challengeId: string;
    userId: string;
    purpose: string;
    code: string;
  }): Promise<OtpChallengeDocument> {
    const challenge = isValidObjectId(input.challengeId)
      ? await this.challenges.findOne({
          _id: input.challengeId,
          userId: input.userId,
          purpose: input.purpose,
          consumedAt: null,
        })
      : null;
    return this.check(challenge, input.code);
  }

  private async check(
    challenge: OtpChallengeDocument | null,
    code: string,
  ): Promise<OtpChallengeDocument> {
    const invalid = () =>
      new ApiException(422, 'OTP_INVALID', 'Mã xác minh không đúng.', [
        { field: 'otp', rule: 'invalid', message: 'Mã xác minh không đúng.' },
      ]);
    if (!challenge) {
      throw invalid();
    }
    if (challenge.expiresAt.getTime() <= Date.now()) {
      throw new ApiException(410, 'OTP_EXPIRED', 'Mã xác minh đã hết hạn.');
    }
    const tooMany = () =>
      new ApiException(
        429,
        'OTP_ATTEMPTS_EXCEEDED',
        'Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.',
      );
    // Count the attempt first and atomically, so parallel guesses cannot exceed the limit.
    const counted = await this.challenges.findOneAndUpdate(
      {
        _id: challenge._id,
        consumedAt: null,
        attemptCount: { $lt: this.config.otpMaxAttempts },
      },
      { $inc: { attemptCount: 1 } },
      { returnDocument: 'after' },
    );
    if (!counted) {
      throw tooMany();
    }
    const expected = Buffer.from(counted.otpHash, 'hex');
    const actual = Buffer.from(
      this.hash(counted.emailNormalized, counted.purpose, code),
      'hex',
    );
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw invalid();
    }
    const consumed = await this.challenges.findOneAndUpdate(
      { _id: counted._id, consumedAt: null },
      { $set: { consumedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!consumed) {
      throw invalid();
    }
    return consumed;
  }
}
