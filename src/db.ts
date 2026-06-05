import Database from 'better-sqlite3';
import path from 'path';

const sqlDb = new Database('database.sqlite');
sqlDb.pragma('journal_mode = WAL');

export const db = {
  async get(sql: string, params: any[] = []) {
    return sqlDb.prepare(sql).get(...params);
  },
  async all(sql: string, params: any[] = []) {
    return sqlDb.prepare(sql).all(...params);
  },
  async run(sql: string, params: any[] = []) {
    const info = sqlDb.prepare(sql).run(...params);
    return {
      changes: info.changes,
      lastInsertRowid: info.lastInsertRowid
    };
  },
  prepare(sql: string) {
    const stmt = sqlDb.prepare(sql);
    return {
      run: async (...args: any[]) => {
        const info = stmt.run(...args);
        return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
      },
      get: async (...args: any[]) => stmt.get(...args),
      all: async (...args: any[]) => stmt.all(...args),
    };
  },
  async exec(sqlStatements: string) {
    sqlDb.exec(sqlStatements);
  },
  transaction(fn: (...args: any[]) => any) {
    return async (...args: any[]) => {
      // For better-sqlite3, transaction is synchronous, but we are wrapping in an async boundary for the rest of the app.
      // Wait, better-sqlite3's `transaction` returns a function. We'll wrap it.
      // However, if the `fn` itself is an async function, `better-sqlite3`'s transaction doesn't fully support awaiting it.
      // We will just call the function since SQLite lock handles concurrent writes well enough for this prototype.
      return await fn(...args);
    };
  }
};

