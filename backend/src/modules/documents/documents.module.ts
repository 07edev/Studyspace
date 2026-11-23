import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { FilesModule } from '../files/files.module';
import { OutboxModule } from '../outbox/outbox.module';
import { StatsModule } from '../stats/stats.module';
import { UsersModule } from '../users/users.module';
import { AdminDocumentsController } from './admin-documents.controller';
import { Document, DocumentSchema } from './document.schema';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Document.name, schema: DocumentSchema }]),
    FilesModule,
    UsersModule,
    AuditModule,
    OutboxModule,
    StatsModule,
  ],
  controllers: [DocumentsController, AdminDocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
