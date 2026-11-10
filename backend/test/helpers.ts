import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { IsString, MinLength } from 'class-validator';
import { randomBytes } from 'crypto';
import mongoose, { Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/modules/auth/password.service';
import { configureApp } from '../src/app.factory';
import {
  CurrentUser,
  OptionalAuth,
  RequirePermission,
  SuperAdminOnly,
} from '../src/common/decorators/auth.decorators';
import { AccountStatus, AdminStatus, Role, type Permission } from '../src/common/enums';
import type { IdentityContext } from '../src/common/identity';
import type { AppConfig } from '../src/config/configuration';
import { Idempotent } from '../src/modules/idempotency/idempotency.interceptor';
import { AccessTokenService } from '../src/modules/identity/access-token.service';
import { GoogleTokenVerifier, type GoogleProfile } from '../src/modules/auth/google-verifier';
import { MailService } from '../src/modules/auth/mail.service';
import { Session } from '../src/modules/identity/schemas/session.schema';
import { randomUUID } from 'crypto';
import { AdminProfile } from '../src/modules/identity/schemas/admin-profile.schema';
import { User } from '../src/modules/identity/schemas/user.schema';

class EchoDto {
  @IsString()
  @MinLength(3)
  name: string;
}

export let sideEffects = 0;
export const resetSideEffects = () => {
  sideEffects = 0;
};

// Probe routes that only exist in tests, to exercise the shared guards/interceptors.
@Controller('probe')
export class ProbeController {
  @Get('me')
  me(@CurrentUser() user: IdentityContext) {
    return user;
  }
  @OptionalAuth()
  @Get('optional')
  optional(@CurrentUser() user?: IdentityContext) {
    return { authenticated: !!user };
  }
  @RequirePermission('USERS', 'READ')
  @Get('users-read')
  usersRead() {
    return { ok: true };
  }
  @SuperAdminOnly()
  @Get('super')
  superOnly() {
    return { ok: true };
  }
  @Post('echo')
  echo(@Body() body: EchoDto) {
    return { name: body.name };
  }
  @Idempotent()
  @Post('once')
  once(@Body() body: EchoDto) {
    sideEffects += 1;
    return { name: body.name, n: sideEffects };
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

export type StartOptions = {
  config?: Partial<AppConfig>;
  // Stub for Google ID-token verification (the real one calls Google).
  google?: (idToken: string) => Promise<GoogleProfile>;
  // Replace providers (e.g. the TV2/TV3 ports) with test doubles.
  overrides?: { provide: unknown; useValue: unknown }[];
};

export type TestEnv = {
  app: NestExpressApplication;
  config: AppConfig;
  // Bearer token of the session created together with the user.
  token: (userId: string) => string;
  createUser: (opts?: {
    email?: string;
    role?: Role;
    status?: AccountStatus;
    permissions?: Permission[];
    adminStatus?: AdminStatus;
    noProfile?: boolean;
    password?: string;
  }) => Promise<string>;
  // Last OTP the dev mail service "sent".
  otp: (address: string, purpose: string) => string | undefined;
  users: Model<User>;
  sessions: Model<Session>;
  close: () => Promise<void>;
};

let counter = 0;

export async function startEnv(options: StartOptions = {}): Promise<TestEnv> {
  // Uses the developer's local MongoDB with a throwaway database per run (dropped on close).
  const base = process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
  const dbName = `studyspace_test_${randomBytes(4).toString('hex')}`;
  const mongoUri = `${base.replace(/\/$/, '')}/${dbName}`;
  const config: AppConfig = {
    nodeEnv: 'test',
    port: 0,
    mongoUri,
    jwtAccessSecret: 'test-secret-test-secret-test-secret-123456',
    jwtAccessTtlSeconds: 900,
    refreshTtlDays: 30,
    otpTtlSeconds: 300,
    otpMaxAttempts: 5,
    otpCooldownSeconds: 0,
    googleClientIds: ['test-client'],
    disableRateLimit: true,
    corsOrigins: [],
    ...options.config,
  };
  let builder = Test.createTestingModule({
    imports: [AppModule.register(config), ProbeModule],
  });
  if (options.google) {
    const verify = options.google;
    builder = builder
      .overrideProvider(GoogleTokenVerifier)
      .useValue({ verify } satisfies GoogleTokenVerifier);
  }
  for (const override of options.overrides ?? []) {
    builder = builder.overrideProvider(override.provide as never).useValue(override.useValue);
  }
  const moduleRef = await builder.compile();
  const app = configureApp(
    moduleRef.createNestApplication<NestExpressApplication>(),
    config,
  );
  await app.init();
  const users = app.get<Model<User>>(getModelToken(User.name));
  const admins = app.get<Model<AdminProfile>>(getModelToken(AdminProfile.name));
  const sessions = app.get<Model<Session>>(getModelToken(Session.name));
  const tokens = app.get(AccessTokenService);
  const mail = app.get(MailService);
  const issued = new Map<string, string>();
  return {
    app,
    config,
    users,
    sessions,
    token: id => issued.get(id) as string,
    otp: (address, purpose) => mail.peekOtp(address, purpose),
    async createUser(opts = {}) {
      counter += 1;
      const role = opts.role ?? Role.USER;
      const passwordHash = opts.password
        ? await app.get(PasswordService).hash(opts.password)
        : undefined;
      const user = await users.create({
        emailNormalized: opts.email ?? `user${counter}@example.test`,
        passwordHash,
        authProviders: passwordHash ? ['PASSWORD'] : [],
        role,
        status: opts.status ?? AccountStatus.ACTIVE,
        emailVerified: true,
        profile: { displayName: `User ${counter}` },
        lastLoginAt: new Date(),
      });
      if (role !== Role.USER && !opts.noProfile) {
        await admins.create({
          userId: user._id,
          status: opts.adminStatus ?? AdminStatus.ACTIVE,
          permissions: opts.permissions ?? [],
        });
      }
      const familyId = randomUUID();
      await sessions.create({
        userId: user._id,
        refreshTokenHash: `test-${familyId}`,
        familyId,
        client: 'MOBILE',
        expiresAt: new Date(Date.now() + 86_400_000),
      });
      issued.set(String(user._id), tokens.sign(String(user._id), familyId).accessToken);
      return String(user._id);
    },
    async close() {
      await mongoose.createConnection(mongoUri).dropDatabase().catch(() => undefined);
      await app.close();
    },
  };
}
