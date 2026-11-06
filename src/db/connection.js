import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const schemaSql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

// ':memory:' gives a throwaway database (good for tests).
// A file path gives a database that survives a restart.
export function openDatabase(filename = ':memory:') {
  if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  // SQLite ignores FOREIGN KEY rules unless you switch them on for each connection.
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(schemaSql);
  return db;
}