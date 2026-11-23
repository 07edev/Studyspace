import { Injectable } from '@nestjs/common';
import type { IdentityContext } from '../../common/identity';
import { FilePurpose } from './file.schema';
import type { FileAccessCheck, FileAccessDescriptor } from './file.types';

@Injectable()
export class FileAccessRegistry {
  private readonly checks = new Map<FilePurpose, Map<string, FileAccessCheck>>();

  register(purpose: FilePurpose, name: string, check: FileAccessCheck) {
    const checks = this.checks.get(purpose) ?? new Map<string, FileAccessCheck>();
    if (checks.has(name)) throw new Error(`File access policy "${name}" is already registered.`);
    checks.set(name, check);
    this.checks.set(purpose, checks);
  }

  async allows(file: FileAccessDescriptor, actor?: IdentityContext): Promise<boolean> {
    const checks = this.checks.get(file.purpose);
    if (!checks) return false;
    for (const check of checks.values()) {
      if (await check(file, actor)) return true;
    }
    return false;
  }
}
