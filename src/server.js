import { createApp } from './http/app.js';
import { config } from './config.js';
import { openDatabase } from './db/connection.js';
import { createSqliteRepository } from './repositories/sqlite.js';

// The server now keeps its data in a file, so it survives a restart.
const db = openDatabase(config.dbFile);
const repository = createSqliteRepository(db);
const server = createApp({ repository });

server.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`Database file: ${config.dbFile}`);
});