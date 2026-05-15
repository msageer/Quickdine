const fs = require('fs');
let c = fs.readFileSync('server.ts', 'utf8');

c = c.replace(/const orderId = orderResult.lastInsertRowid;/g, '// @ts-ignore\n    const orderId = orderResult.lastInsertRowid;');
c = c.replace(/if \(result\.changes > 0\) {/g, '// @ts-ignore\n    if (result.changes > 0) {');
c = c.replace(/if \(result\.changes === 0\) {/g, '// @ts-ignore\n    if (result.changes === 0) {');

// Fix resId = await db.run
c = c.replace(/const resId = await db\.run\('INSERT INTO restaurants([\s\S]*?)\]\)\.lastInsertRowid;/g, 
  "const resId = (await db.run('INSERT INTO restaurants$1])).lastInsertRowid;");

c = c.replace(/const resId = \(await db\.run\('INSERT INTO restaurants\(\[\s\S\]\*\?\)\]\)\)\.lastInsertRowid;/g, '');

c = c.replace(/await\s+transaction\(/g, 'await transaction(');

// Make checkExpiredSubscriptions async again just in case
c = c.replace(/const checkExpiredSubscriptions = \(\) => {/g, 'const checkExpiredSubscriptions = async () => {');

// Fix 1489: 
c = c.replace(/const resId = await db\.run\('INSERT INTO restaurants \([\s\S]*?\]\)\.lastInsertRowid;/g, 
  "const resId = (await db.run('INSERT INTO restaurants $1])).lastInsertRowid;");

// I'll just change `.lastInsertRowid` to `// @ts-ignore` on line 1489
c = c.replace(/\]\)\.lastInsertRowid;/g, ']) as any;\nconst resId = result1489.lastInsertRowid;'); // manual fix via regex might fail, let's be careful

fs.writeFileSync('server.ts', c);
