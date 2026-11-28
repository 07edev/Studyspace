import type { ClientSession, Connection } from 'mongoose';

const isStandaloneTxError = (err: unknown): boolean => {
  const msg = String((err as Error)?.message ?? '');
  const code = (err as { code?: number })?.code;
  return (
    code === 20 ||
    msg.includes('Transaction numbers are only allowed on a replica set') ||
    msg.includes('replica set')
  );
};

/**
 * Runs work inside a MongoDB ACID transaction when connected to a Replica Set / Atlas.
 * Falls back cleanly to CAS-guarded operations when developing against standalone local MongoDB.
 */
export async function runInOptionalTransaction<T>(
  connection: Connection,
  work: (session?: ClientSession) => Promise<T>,
): Promise<T> {
  const session = await connection.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (err) {
    if (isStandaloneTxError(err)) {
      return work(undefined);
    }
    throw err;
  } finally {
    await session.endSession().catch(() => undefined);
  }
}
