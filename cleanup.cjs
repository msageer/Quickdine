const fs = require('fs');
let c = fs.readFileSync('server.ts', 'utf8');

c = c.replace(/iawait nsert/g, 'insert');
c = c.replace(/dawait b\.run/g, 'db.run');
c = c.replace(/uawait pdate/g, 'update'); // For updateSlug etc? Let's check
c = c.replace(/cawait at/g, 'cat'); // catInsert?
c = c.replace(/iawait tem/g, 'item'); // itemInsert?

// And fix any duplicate await
c = c.replace(/await\s+await/g, 'await');
c = c.replace(/\(await\s+await/g, '(await');

// To be safe, what other things were there?
// We had \w+.run. Words ending in `run`?
// Let's print out all `await ` where there's a weird word inside server.ts.
fs.writeFileSync('server.ts', c);
