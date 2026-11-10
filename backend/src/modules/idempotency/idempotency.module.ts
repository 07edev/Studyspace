import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IdempotencyKey, IdempotencyKeySchema } from './idempotency-key.schema';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyService } from './idempotency.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IdempotencyKey.name, schema: IdempotencyKeySchema },
    ]),
  ],
  providers: [IdempotencyService, IdempotencyInterceptor],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class IdempotencyModule {}
