// Runs async jobs one after another within this process. Used where "check, then change" must not
// interleave (e.g. two Super Admins removing each other at the same moment). It protects a single
// server process; with several instances this needs a database-level guard instead.
export class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(job: () => Promise<T>): Promise<T> {
    const result = this.tail.then(job, job);
    this.tail = result.catch(() => undefined);
    return result;
  }
}
