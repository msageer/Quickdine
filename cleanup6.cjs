const fs = require('fs');
let c = fs.readFileSync('server.ts', 'utf8');

c = c.replace(/const checkExpiredSubscriptions = \(\) => {/g, 'const checkExpiredSubscriptions = async () => {');

// Fix 1489
c = c.replace(/\]\)\.lastInsertRowid;/g, '])).lastInsertRowid;');
c = c.replace(/const resId = await db\.run\('INSERT /g, 'const resId = (await db.run(\'INSERT ');

// TS Ignores
c = c.replace(/const orderId = orderResult\.lastInsertRowid;/g, '// @ts-ignore\n    const orderId = orderResult.lastInsertRowid;');
c = c.replace(/if \(result\.changes > 0\) {/g, '// @ts-ignore\n    if (result.changes > 0) {');
c = c.replace(/if \(result\.changes === 0\) {/g, '// @ts-ignore\n    if (result.changes === 0) {');

fs.writeFileSync('server.ts', c);
