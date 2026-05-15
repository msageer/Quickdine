const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

// Fix 1: transaction callbacks
content = content.replace(/db\.transaction\(\((\w+)\)\s*=>/g, 'db.transaction(async ($1) =>');

// Fix 2: .run(...).lastInsertRowid -> (await xxx.run(...)).lastInsertRowid
// Let's just use regex for .run(.+)\.lastInsertRowid
content = content.replace(/(\w+)\.run\(([^)]*)\)\.lastInsertRowid/g, '(await $1.run($2)).lastInsertRowid');

// Fix 3: result = await db.run(...) ... if (result.changes === 0)
// The linter says: `Property 'changes' does not exist on type 'Promise<any>'` at 1539.
// "const result = db.prepare('UPDATE ...').run(...)" -> "const result = await db.run('UPDATE ...')"
// Wait, my previous refactor script didn't await db.prepare().run() ?
// Ah! It changed `db.prepare(x).run(y)` to `await db.run(x, [y])` but wait...
// "result.changes" says it's a Promise? No, maybe it was `result = insert.run(...)` without await?
// Let's replace `const result = (\w+)\.run\((.*?)\);` with `const result = await $1.run($2);`
content = content.replace(/const result = (\w+)\.run\((.*?)\);/g, 'const result = await $1.run($2);');
content = content.replace(/let result = (\w+)\.run\((.*?)\);/g, 'let result = await $1.run($2);');

// Fix 4: remaining un-awaited custom statement run calls: `stmt.run(...)`
content = content.replace(/(?<!await\s)(\w+)\.run\((.*?)\)/g, 'await $1.run($2)');

// Fix 5: remove (await (await ...
content = content.replace(/await \(await/g, '(await');

fs.writeFileSync('server.ts', content);
