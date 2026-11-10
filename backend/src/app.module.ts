import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ConfigModule } from './config/config.module';
import { APP_CONFIG, type AppConfig } from './config/configuration';
import { AuditModule } from './modules/audit/audit.module';
import { HealthController } from './modules/health/health.controller';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';
import { JwtAuthGuard } from './modules/identity/guards/jwt-auth.guard';
import { PermissionsGuard } from './modules/identity/guards/permissions.guard';
import { IdentityModule } from './modules/identity/identity.module';
import { OutboxModule } from './modules/outbox/outbox.module';

@Module({})
export class AppModule {
  // Config is injected (not read from process.env here) so tests can supply their own.
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.register(config),
        MongooseModule.forRoot(config.mongoUri, { autoIndex: true }),
        // Coarse global limit; auth endpoints set stricter per-route limits.
        ThrottlerModule.forRootAsync({
          inject: [APP_CONFIG],
          useFactory: (cfg: AppConfig) => ({
            throttlers: [{ ttl: 60_000, limit: 300 }],
            skipIf: () => cfg.disableRateLimit,
          }),
        }),
        IdentityModule,
        AuditModule,
        OutboxModule,
        IdempotencyModule,
        AuthModule,
        UsersModule,
        // TV2/TV3 register their feature modules here.
      ],
      controllers: [HealthController],
      providers: [
        // Order matters: throttle -> authenticate -> authorize.
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    };
  }
}
