import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../common/api-error';

export type PlaceFilePurpose = 'PLACE_IMAGE' | 'REVIEW_IMAGE' | 'EVIDENCE';

const OBJECT_ID = /^[a-fA-F0-9]{24}$/;

/**
 * Port to TV3's FilesService for validating uploaded media attached to places, reviews and
 * suggestions. Replace the provider when TV3 merges into main.
 */
export abstract class PlaceFileRef {
  abstract assertReady(
    fileIds: string[],
    ownerId: string,
    purpose: PlaceFilePurpose,
  ): Promise<void>;
}

@Injectable()
export class NotConnectedPlaceFileRef extends PlaceFileRef {
  async assertReady(
    fileIds: string[],
    _ownerId: string,
    _purpose: PlaceFilePurpose,
  ): Promise<void> {
    if (!fileIds || fileIds.length === 0) {
      return;
    }
    for (const id of fileIds) {
      if (!OBJECT_ID.test(id)) {
        throw new ApiException(422, 'VALIDATION_ERROR', 'Mã tệp không hợp lệ.');
      }
    }
    throw new ApiException(
      503,
      'FILE_SERVICE_NOT_CONNECTED',
      'Dịch vụ tải tệp chưa sẵn sàng. Vui lòng thử lại sau.',
    );
  }
}
