export type AppConfig = {
  nodeEnv: string;
  port: number;
  mongoUri: string;
  jwtAccessSecret: string;
  jwtAccessTtlSeconds: number;
  refreshTtlDays: number;
  otpTtlSeconds: number;
  otpMaxAttempts: number;
  corsOrigins: string[];
};

export const APP_CONFIG = 'APP_CONFIG';

const int = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// Fails fast on missing/weak secrets instead of silently running insecurely.
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const secret = env.JWT_ACCESS_SECRET ?? '';
  if (secret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be set and at least 32 characters');
  }
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: int(env.PORT, 3000),
    mongoUri: env.MONGODB_URI,
    jwtAccessSecret: secret,
    jwtAccessTtlSeconds: int(env.JWT_ACCESS_TTL_SECONDS, 900),
    refreshTtlDays: int(env.REFRESH_TTL_DAYS, 30),
    otpTtlSeconds: int(env.OTP_TTL_SECONDS, 300),
    otpMaxAttempts: int(env.OTP_MAX_ATTEMPTS, 5),
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
  };
}
