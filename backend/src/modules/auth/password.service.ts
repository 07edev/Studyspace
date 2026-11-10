import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { ApiException } from '../../common/api-error';

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

const derive = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, KEYLEN, { N, r: R, p: P }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );

/** Rules from the spec: 10-72 chars with upper, lower and digit. Returns violated messages. */
export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 10) problems.push('Mật khẩu cần tối thiểu 10 ký tự.');
  if (password.length > 72) problems.push('Mật khẩu tối đa 72 ký tự.');
  if (!/[A-Z]/.test(password)) problems.push('Cần ít nhất một chữ hoa.');
  if (!/[a-z]/.test(password)) problems.push('Cần ít nhất một chữ thường.');
  if (!/[0-9]/.test(password)) problems.push('Cần ít nhất một chữ số.');
  return problems;
}

/** Throws a 422 with the given spec code (VALIDATION_ERROR for register, WEAK_PASSWORD for reset/change). */
export function assertPasswordAcceptable(
  password: string,
  confirmPassword: string,
  opts: { field: string; confirmField?: string; code: 'VALIDATION_ERROR' | 'WEAK_PASSWORD' },
) {
  const details = passwordProblems(password).map(message => ({
    field: opts.field,
    rule: 'strength',
    message,
  }));
  if (password !== confirmPassword) {
    details.push({
      field: opts.confirmField ?? 'confirmPassword',
      rule: 'match',
      message: 'Mật khẩu xác nhận không khớp.',
    });
  }
  if (details.length) {
    throw new ApiException(422, opts.code, 'Mật khẩu chưa hợp lệ.', details);
  }
}

@Injectable()
export class PasswordService {
  private dummy?: Promise<string>;

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await derive(password, salt);
    return `scrypt$${N}$${R}$${P}$${salt.toString('hex')}$${key.toString('hex')}`;
  }

  /**
   * Constant-ish time: when there is no stored hash (unknown account / Google-only) a dummy
   * hash is verified so response time does not reveal whether the account exists.
   */
  async verify(password: string, stored?: string | null): Promise<boolean> {
    if (!stored) {
      this.dummy ??= this.hash('dummy-password-for-timing');
      const [, , , , salt, key] = (await this.dummy).split('$');
      await derive(password, Buffer.from(salt, 'hex'));
      void key;
      return false;
    }
    const [scheme, n, r, p, salt, key] = stored.split('$');
    if (scheme !== 'scrypt' || !salt || !key) {
      return false;
    }
    const expected = Buffer.from(key, 'hex');
    const actual = await new Promise<Buffer>((resolve, reject) =>
      scrypt(
        password,
        Buffer.from(salt, 'hex'),
        expected.length,
        { N: Number(n), r: Number(r), p: Number(p) },
        (err, derived) => (err ? reject(err) : resolve(derived)),
      ),
    );
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
