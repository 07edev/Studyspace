import { ApiException } from '../../common/api-error';

// Ports to data owned by other members. TV1 only checks references through these; it never
// copies their business logic. Until TV2/TV3 deliver, the defaults below refuse the request
// (503) instead of pretending a reference is valid.

/** TV2: universities / majors / subjects. Replace the provider in users.module.ts. */
export abstract class TaxonomyRef {
  /**
   * Must throw ApiException(422, 'UNIVERSITY_MAJOR_MISMATCH', ...) when the major does not
   * belong to the university, or (422, 'VALIDATION_ERROR', ...) when an id does not exist.
   */
  abstract assertValid(input: {
    universityId?: string;
    majorId?: string;
    subjectIds?: string[];
  }): Promise<void>;
}

/** TV3: uploaded files. Replace the provider in users.module.ts. */
export abstract class FileReadyRef {
  /**
   * Must throw ApiException(409, 'FILE_NOT_READY', ...) unless the file exists, is READY,
   * was uploaded for the avatar purpose and belongs to `ownerId`.
   */
  abstract assertReady(fileId: string, ownerId: string): Promise<void>;
}

export class NotConnectedTaxonomyRef extends TaxonomyRef {
  async assertValid(): Promise<void> {
    throw new ApiException(
      503,
      'TAXONOMY_NOT_CONNECTED',
      'Danh mục trường, ngành, môn học chưa sẵn sàng. Vui lòng thử lại sau.',
    );
  }
}

export class NotConnectedFileReadyRef extends FileReadyRef {
  async assertReady(): Promise<void> {
    throw new ApiException(
      503,
      'FILE_SERVICE_NOT_CONNECTED',
      'Dịch vụ tải ảnh chưa sẵn sàng. Vui lòng thử lại sau.',
    );
  }
}
