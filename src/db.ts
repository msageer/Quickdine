import { Pool } from 'pg';
import path from 'path';

let connectionString = process.env.DATABASE_URL;
if (connectionString) {
  const lastAt = connectionString.lastIndexOf('@');
  if (lastAt !== -1) {
    const protocolEnd = connectionString.indexOf('://') + 3;
    const authPart = connectionString.substring(protocolEnd, lastAt);
    const firstColon = authPart.indexOf(':');
    if (firstColon !== -1) {
      const username = authPart.substring(0, firstColon);
      // Only encode if it's not already encoded (simple heuristic: contains # or special chars that break URL)
      // Actually, safest is to decode and then encode, or just encodeURIComponent if it contains #
      const password = authPart.substring(firstColon + 1);
      // To avoid double encoding, we check if it already seems encoded, 
      // but if it contains '#' it threw an error, so decodeURIComponent first to be safe, then encode
      let decodedPassword = password;
      try { decodedPassword = decodeURIComponent(password); } catch(e) {}
      connectionString = connectionString.substring(0, protocolEnd) + username + ':' + encodeURIComponent(decodedPassword) + connectionString.substring(lastAt);
    }
  }
}

const pool = new Pool({
  connectionString
});

function convertQuery(sql: string, params: any[]): [string, any[]] {
  let newSql = sql;
  
  // Convert SQLite date functions to Postgres
  newSql = newSql.replace(/strftime\('%Y-%m',\s*([^)]+)\)/g, "to_char($1, 'YYYY-MM')");
  newSql = newSql.replace(/date\('now',\s*'-(\d+)\s*days'\)/g, "CURRENT_DATE - INTERVAL '$1 days'");
  newSql = newSql.replace(/date\(([^)]+)\)/gi, "DATE($1)");
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
