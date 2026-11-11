import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditAdminController } from './audit-admin.controller';
import { AuditAdminService } from './audit-admin.service';
import { AuditLog, AuditLogSchema } from './audit-log.schema';
import { AuditService } from './audit.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }]),
  ],
  controllers: [AuditAdminController],
  providers: [AuditService, AuditAdminService],
  exports: [AuditService, MongooseModule],
})
export class AuditModule {}
