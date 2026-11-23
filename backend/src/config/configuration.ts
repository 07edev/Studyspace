export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

export type FileStorageConfig = {
  s3Bucket?: string;
  s3Region: string;
  s3Endpoint?: string;
  s3ForcePathStyle: boolean;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  uploadUrlTtlSeconds: number;
  accessUrlTtlSeconds: number;
  dailyQuotaBytes: number;
  clamAvHost?: string;
  clamAvPort: number;
  clamAvTimeoutMs: number;
};

export type AppConfig = {
  nodeEnv: string;
  port: number;
  mongoUri: string;
  jwtAccessSecret: string;
  jwtAccessTtlSeconds: number;
  refreshTtlDays: number;
  otpTtlSeconds: number;
  otpMaxAttempts: number;
  otpCooldownSeconds: number;
  googleClientIds: string[];
  smtp?: SmtpConfig;
  files?: FileStorageConfig;
  disableRateLimit: boolean;
  corsOrigins: string[];
};

export const APP_CONFIG = 'APP_CONFIG';

const int = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const list = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

// Fails fast on missing/weak secrets instead of silently running insecurely.
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const secret = env.JWT_ACCESS_SECRET ?? '';
  if (secret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be set and at least 32 characters');
  }
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }
  const nodeEnv = env.NODE_ENV ?? 'development';
  const smtpPort = int(env.SMTP_PORT, 587);
  const smtp: SmtpConfig | undefined = env.SMTP_HOST
    ? {
        host: env.SMTP_HOST,
        port: smtpPort,
        // Port 465 is implicit TLS; 587 upgrades with STARTTLS.
        secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : smtpPort === 465,
        user: env.SMTP_USER || undefined,
        pass: env.SMTP_PASS || undefined,
        from: env.MAIL_FROM ?? '',
      }
    : undefined;
  if (smtp && !smtp.from) {
    throw new Error('MAIL_FROM is required when SMTP_HOST is set');
  }
  if (nodeEnv === 'production' && !smtp) {
    // Without email nobody can verify an account or reset a password.
    throw new Error('SMTP_HOST (and MAIL_FROM) must be configured in production');
  }
  const s3AccessKeyId = env.FILE_S3_ACCESS_KEY_ID || undefined;
  const s3SecretAccessKey = env.FILE_S3_SECRET_ACCESS_KEY || undefined;
  if (Boolean(s3AccessKeyId) !== Boolean(s3SecretAccessKey)) {
    throw new Error('FILE_S3_ACCESS_KEY_ID and FILE_S3_SECRET_ACCESS_KEY must be configured together');
  }
  const files: FileStorageConfig = {
    s3Bucket: env.FILE_S3_BUCKET || undefined,
    s3Region: env.FILE_S3_REGION || 'us-east-1',
    s3Endpoint: env.FILE_S3_ENDPOINT || undefined,
    s3ForcePathStyle: env.FILE_S3_FORCE_PATH_STYLE
      ? env.FILE_S3_FORCE_PATH_STYLE === 'true'
      : Boolean(env.FILE_S3_ENDPOINT),
    s3AccessKeyId,
    s3SecretAccessKey,
    uploadUrlTtlSeconds: int(env.FILE_UPLOAD_URL_TTL_SECONDS, 600),
    accessUrlTtlSeconds: int(env.FILE_ACCESS_URL_TTL_SECONDS, 300),
    dailyQuotaBytes: int(env.FILE_DAILY_QUOTA_BYTES, 100_000_000),
    clamAvHost: env.CLAMAV_HOST || undefined,
    clamAvPort: int(env.CLAMAV_PORT, 3310),
    clamAvTimeoutMs: int(env.CLAMAV_TIMEOUT_MS, 30_000),
  };
  if (nodeEnv === 'production' && (!files.s3Bucket || !files.clamAvHost)) {
    throw new Error('FILE_S3_BUCKET and CLAMAV_HOST must be configured in production');
  }
  return {
    nodeEnv,
    port: int(env.PORT, 3000),
    mongoUri: env.MONGODB_URI,
    jwtAccessSecret: secret,
    jwtAccessTtlSeconds: int(env.JWT_ACCESS_TTL_SECONDS, 900),
    refreshTtlDays: int(env.REFRESH_TTL_DAYS, 30),
    otpTtlSeconds: int(env.OTP_TTL_SECONDS, 300),
    otpMaxAttempts: int(env.OTP_MAX_ATTEMPTS, 5),
    otpCooldownSeconds: int(env.OTP_COOLDOWN_SECONDS, 60),
    googleClientIds: list(env.GOOGLE_CLIENT_IDS),
    smtp,
    files,
    // Only honoured outside production so it cannot be left on by mistake.
    disableRateLimit: env.RATE_LIMIT_DISABLED === 'true' && nodeEnv !== 'production',
    corsOrigins: list(env.CORS_ORIGINS),
  };
}
