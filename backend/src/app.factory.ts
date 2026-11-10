import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { EnvelopeInterceptor } from './common/interceptors/envelope.interceptor';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { createValidationPipe } from './common/pipes/validation.pipe';
import type { AppConfig } from './config/configuration';

// One place that wires the real pipeline; main.ts and e2e tests both use it.
export async function createApp(config: AppConfig): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(config),
    { logger: config.nodeEnv === 'test' ? false : undefined },
  );
  return configureApp(app, config);
}

export function configureApp(
  app: NestExpressApplication,
  config: AppConfig,
): NestExpressApplication {
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new EnvelopeInterceptor());

  if (config.nodeEnv !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('StudySpace API')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }
  return app;
}
