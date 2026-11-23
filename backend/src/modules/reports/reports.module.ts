import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { CommentsModule } from '../comments/comments.module';
import { DocumentsModule } from '../documents/documents.module';
import { FilesModule } from '../files/files.module';
import { OutboxModule } from '../outbox/outbox.module';
import { PostsModule } from '../posts/posts.module';
import { AdminReportsController } from './admin-reports.controller';
import { Report, ReportSchema } from './report.schema';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportableTargetRef, Tv3ReportableTargetRef } from './ports';
import { Tv3UserContentRef } from './user-content-ref';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Report.name, schema: ReportSchema }]),
    PostsModule,
    CommentsModule,
    DocumentsModule,
    FilesModule,
    AuditModule,
    OutboxModule,
  ],
  controllers: [ReportsController, AdminReportsController],
  providers: [
    ReportsService,
    Tv3UserContentRef,
    Tv3ReportableTargetRef,
    { provide: ReportableTargetRef, useExisting: Tv3ReportableTargetRef },
  ],
  exports: [ReportsService, Tv3UserContentRef],
})
export class ReportsModule {}
