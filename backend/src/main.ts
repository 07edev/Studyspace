import './load-env';
import 'reflect-metadata';
import { createApp } from './app.factory';
import { loadConfig } from './config/configuration';
import { OutboxService } from './modules/outbox/outbox.service';

async function bootstrap() {
  const config = loadConfig();
  const app = await createApp(config);
  app.enableShutdownHooks();
  app.get(OutboxService).start();
  await app.listen(config.port);
  // eslint-disable-next-line no-console
  console.log(`StudySpace API listening on :${config.port}/api/v1`);
}

bootstrap().catch(error => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
