// Settings that can change between machines. Read once, here.
export const config = {
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  publicDir: new URL('../public/', import.meta.url),
  // The database file. It survives a restart. Set DB_FILE to use another one.
  dbFile: process.env.DB_FILE ?? 'data/ticketing.db',
};