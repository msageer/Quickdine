const fs = require('fs');
let c = fs.readFileSync('server.ts', 'utf8');

c = c.replace(/= (\w+)\.run\(([\s\S]*?)\);/g, '= await $1.run($2);');
c = c.replace(/const orderResult = insertOrder\.run\(([\s\S]*?)\);/g, 'const orderResult = await insertOrder.run($1);');
// Fix any unresolved missing awaits
c = c.replace(/(?<!await\s)(\w+)\.run\(/g, 'await $1.run(');
c = c.replace(/await\s+await/g, 'await');
fs.writeFileSync('server.ts', c);
