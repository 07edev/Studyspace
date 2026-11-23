import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostsController } from './posts.controller';
import { AdminPostsController } from './admin-posts.controller';
import { PostsService } from './posts.service';
import { Post, PostSchema } from './post.schema';
import { PostLike, PostLikeSchema } from './post-like.schema';
import { PostSave, PostSaveSchema } from './post-save.schema';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import { DocumentsModule } from '../documents/documents.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: PostLike.name, schema: PostLikeSchema },
      { name: PostSave.name, schema: PostSaveSchema },
    ]),
    DocumentsModule,
    FilesModule,
    AuditModule,
    OutboxModule,
  ],
  controllers: [PostsController, AdminPostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
