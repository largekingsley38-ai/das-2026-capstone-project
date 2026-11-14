import { createApp } from './http/app.js';
import { config } from './config.js';
import { openDatabase } from './db/connection.js';
import { createSqliteRepository } from './repositories/sqlite.js';
import { createMaintenance } from './jobs/maintenance.js';
import { createWaitlistService } from './services/waitlistService.js';

// The server now keeps its data in a file, so it survives a restart.
const db = openDatabase(config.dbFile);
const repository = createSqliteRepository(db);
const server = createApp({ repository });

// Every 30 seconds: cancel unpaid bookings that ran out of time.
const waitlist = createWaitlistService(repository);
const maintenance = createMaintenance({ repository, waitlist });
setInterval(() => {
  maintenance.run().catch((error) => console.error('maintenance failed', error));
}, 30_000).unref();

server.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`Database file: ${config.dbFile}`);
});