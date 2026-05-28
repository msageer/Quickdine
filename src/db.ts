import { Pool } from 'pg';
import path from 'path';

let connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (connectionString) {
  try {
    const url = new URL(connectionString);
    if (url.password) {
      // Re-encode password properly if needed
      url.password = encodeURIComponent(decodeURIComponent(url.password));
    }
    url.searchParams.delete('sslmode');
    connectionString = url.toString();
  } catch (e) {
    // fallback to regex if URL parse fails
    connectionString = connectionString.replace(/\?sslmode=[^&]+&?/, '?');
    connectionString = connectionString.replace(/&sslmode=[^&]+/, '');
    connectionString = connectionString.replace(/\?$/, ''); // clean trailing ?
  }
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});


function convertQuery(sql: string, params: any[]): [string, any[]] {
  let newSql = sql;
  
  // Convert SQLite date functions to Postgres
  newSql = newSql.replace(/strftime\('%Y-%W',\s*([^)]+)\)/gi, "to_char($1, 'IYYY-IW')");
  newSql = newSql.replace(/strftime\('%Y-%m',\s*([^)]+)\)/gi, "to_char($1, 'YYYY-MM')");
  newSql = newSql.replace(/strftime\('%H',\s*([^)]+)\)/gi, "to_char($1, 'HH24')");
  newSql = newSql.replace(/date\('now',\s*'-(\d+)\s*days'\)/g, "CURRENT_DATE - INTERVAL '$1 days'");
  newSql = newSql.replace(/date\(([^)]+)\)/gi, "CAST($1 AS DATE)");
  newSql = newSql.replace(/login_time/g, "login_time"); // Safety
  
  // SQLite IFNULL -> COALESCE
  newSql = newSql.replace(/IFNULL/gi, "COALESCE");

  let i = 1;
  newSql = newSql.replace(/\?/g, () => `$${i++}`);
  return [newSql, params];
}

export const db = {
  async get(sql: string, params: any[] = []) {
    const [q, p] = convertQuery(sql, params);
    try {
      const result = await pool.query(q, p);
      return result.rows[0];
    } catch (e) {
      console.error("DB Get Error", e, q, p);
      throw e;
    }
  },
  async all(sql: string, params: any[] = []) {
    const [q, p] = convertQuery(sql, params);
    try {
      const result = await pool.query(q, p);
      return result.rows;
    } catch (e) {
      console.error("DB All Error", e, q, p);
      throw e;
    }
  },
  async run(sql: string, params: any[] = []) {
    const [q, p] = convertQuery(sql, params);
    let finalQuery = q;
    if (finalQuery.trim().toUpperCase().startsWith('INSERT') && !finalQuery.toUpperCase().includes('RETURNING')) {
      finalQuery += ' RETURNING id';
    }
    try {
      const result = await pool.query(finalQuery, p);
      return {
        changes: result.rowCount,
        lastInsertRowid: result.rows[0]?.id
      };
    } catch (e) {
      console.error("DB Run Error", e, finalQuery, p);
      throw e;
    }
  },
  prepare(sql: string) {
    return {
      run: async (...args: any[]) => this.run(sql, args),
      get: async (...args: any[]) => this.get(sql, args),
      all: async (...args: any[]) => this.all(sql, args),
    };
  },
  async exec(sqlStatements: string) {
    const statements = sqlStatements.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      let q = stmt.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
      // Replace SQLite PRAGMA
      if (q.trim().toUpperCase().startsWith('PRAGMA')) continue;
      q = q.replace(/\bREAL\b/gi, 'FLOAT');
      q = q.replace(/\bDATETIME\b/gi, 'TIMESTAMP');
      
      if (q.trim()) {
        try {
          await pool.query(q);
        } catch (e: any) {
          if (e && e.message && e.message.includes('already exists')) {
            // Ignore benign already exists errors
          } else {
            console.error("DB Exec Error", e instanceof Error ? e.message : e, q);
          }
        }
      }
    }
  },
  transaction(fn: (...args: any[]) => any) {
    return async (...args: any[]) => {
      // In this simple adapter, we just run the queries without true transaction isolation
      // because passing the PG client context around requires refactoring all DB calls to accept it. 
      return await fn(...args);
    };
  }
};
