import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FileAccessRegistry } from './file-access.registry';
import { FileAsset, FileAssetSchema } from './file.schema';
import { FileScanner, FileStorage } from './file-storage';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { ClamAvScanner } from './clamav-scanner';
import { S3FileStorage } from './s3-file-storage';
import { FileReadyRef } from '../users/ports';

@Module({
  imports: [MongooseModule.forFeature([{ name: FileAsset.name, schema: FileAssetSchema }])],
  controllers: [FilesController],
  providers: [
    FileAccessRegistry,
    FilesService,
    S3FileStorage,
    ClamAvScanner,
    { provide: FileStorage, useExisting: S3FileStorage },
    { provide: FileScanner, useExisting: ClamAvScanner },
    { provide: FileReadyRef, useExisting: FilesService },
  ],
  exports: [FileAccessRegistry, FileReadyRef, FileStorage, FilesService],
})
export class FilesModule {}
