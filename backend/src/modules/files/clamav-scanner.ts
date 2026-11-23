import { Inject, Injectable } from '@nestjs/common';
import { once } from 'node:events';
import { createConnection } from 'node:net';
import { ApiException } from '../../common/api-error';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { FileScanner } from './file-storage';

const CHUNK_SIZE = 64 * 1024;

@Injectable()
export class ClamAvScanner extends FileScanner {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super();
  }

  async scan(bytes: Buffer): Promise<'CLEAN' | 'INFECTED'> {
    const files = this.config.files;
    const host = files?.clamAvHost;
    if (!host || !files) {
      throw new ApiException(503, 'FILE_SCANNER_NOT_CONFIGURED', 'Dịch vụ quét tệp chưa được cấu hình.');
    }

    return new Promise((resolve, reject) => {
      const socket = createConnection({ host, port: files.clamAvPort });
      let response = '';
      let settled = false;
      const finish = (error?: Error, result?: 'CLEAN' | 'INFECTED') => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (error) reject(error);
        else if (result) resolve(result);
        else reject(new ApiException(503, 'FILE_SCANNER_INVALID_RESPONSE', 'Dịch vụ quét tệp trả kết quả không hợp lệ.'));
      };
      const write = async (chunk: Buffer) => {
        if (!socket.write(chunk)) await once(socket, 'drain');
      };

      socket.setTimeout(files.clamAvTimeoutMs, () => {
        finish(new ApiException(503, 'FILE_SCANNER_TIMEOUT', 'Dịch vụ quét tệp không phản hồi kịp thời.'));
      });
      socket.once('error', () => {
        finish(new ApiException(503, 'FILE_SCANNER_UNAVAILABLE', 'Không thể kết nối dịch vụ quét tệp.'));
      });
      socket.on('data', (chunk: Buffer) => {
        response += chunk.toString('utf8');
        const end = response.indexOf('\0');
        if (end < 0) return;
        const result = response.slice(0, end).trim();
        if (result.endsWith(': OK')) finish(undefined, 'CLEAN');
        else if (result.includes(' FOUND')) finish(undefined, 'INFECTED');
        else finish(new ApiException(503, 'FILE_SCANNER_INVALID_RESPONSE', 'Dịch vụ quét tệp trả kết quả không hợp lệ.'));
      });
      socket.once('connect', () => {
        void (async () => {
          await write(Buffer.from('zINSTREAM\0', 'ascii'));
          for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
            const chunk = bytes.subarray(offset, Math.min(offset + CHUNK_SIZE, bytes.length));
            const length = Buffer.allocUnsafe(4);
            length.writeUInt32BE(chunk.length, 0);
            await write(length);
            await write(chunk);
          }
          socket.end(Buffer.alloc(4));
        })().catch(error => {
          finish(error instanceof Error ? error : new Error(String(error)));
        });
      });
    });
  }
}
