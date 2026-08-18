import { createApp } from './app.js';
import { config } from './config.js';
import { connectDb } from './db.js';
import { backfillProjectMembers } from './services/migrate-project-members.js';

async function main(): Promise<void> {
  await connectDb();
  await backfillProjectMembers();
  const app = createApp();

  app.listen(config.port, () => {
    console.log(`API listening on ${config.port}`);
  });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
