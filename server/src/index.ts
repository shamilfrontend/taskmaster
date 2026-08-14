import { createApp } from './app.js';
import { config } from './config.js';
import { connectDb } from './db.js';

async function main(): Promise<void> {
  await connectDb();
  const app = createApp();

  app.listen(config.port, () => {
    console.log(`API listening on ${config.port}`);
  });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
