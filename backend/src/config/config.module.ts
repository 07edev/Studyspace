import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from './configuration';

// Global so every feature module (TV1/TV2/TV3) can @Inject(APP_CONFIG).
@Global()
@Module({})
export class ConfigModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}
