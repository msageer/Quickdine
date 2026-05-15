const fs = require('fs');
let c = fs.readFileSync('server.ts', 'utf8');

c = c.replace(/const checkExpiredSubscriptions = \(\) => {/g, 'const checkExpiredSubscriptions = async () => {');

// Fix 1487
c = c.replace(/const resId = await db\.run\('INSERT INTO restaurants([\s\S]*?)\]\)\.lastInsertRowid;/g, 
  "const resId = (await db.run('INSERT INTO restaurants$1])).lastInsertRowid;");

// Fix 1539 (transaction call)
c = c.replace(/const result = transaction\(\);/g, 'const result = await transaction();');

// Fix 1918? Let's check why orderResult is a promise.
// Ah, earlier in cleanup2.cjs I did: `c.replace(/const orderResult = insertOrder\.run\(([\s\S]*?)\);/g, 'const orderResult = await insertOrder.run($1);');`
// BUT insertOrder became db.run? Wait, the regex changed insertOrder.run to await db.run maybe? Or maybe it is missing await completely.
// Let's just fix it manually.
c = c.replace(/const orderResult = insertOrder\.run/g, 'const orderResult = await insertOrder.run');
c = c.replace(/const orderResult = await insertOrder\.run\(([\s\S]*?)\);/g, 'const orderResult = await insertOrder.run($1);');
// Wait, insertOrder might not be a prepare anymore. Oh, earlier I used prepare.
// `insertOrder.run` inside a transaction. Wait.
// Let's replace any missing `await ` for transaction execution:
c = c.replace(/transaction\(([\s\S]*?)\);/g, (match, p1) => {
    if (match.includes('=>') || p1.includes('async')) return match; // definition
    return 'await ' + match; // execute
});

fs.writeFileSync('server.ts', c);
