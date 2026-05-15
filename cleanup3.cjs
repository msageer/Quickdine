const fs = require('fs');
let c = fs.readFileSync('server.ts', 'utf8');

c = c.replace(/await uawait pdateSlug\.run/g, 'await updateSlug.run');
c = c.replace(/await uawait pdateStmt\.run/g, 'await updateStmt.run');
c = c.replace(/await iawait nsert/g, 'await insert');
c = c.replace(/await cawait atInsert/g, 'await catInsert');

// Look for any remaining 'await .*await '
// e.g. await uawait pdate
c = c.replace(/await (\w+)await (\w+)/g, (match, p1, p2) => {
    return 'await ' + p1 + p2;
});

// For line 299: uawait pdateSlug -> it's in a forEach!
// `restaurants.forEach(r => { await updateSlug.run(...) })`
// This breaks TS because forEach callback is not async!
// We should replace .forEach with a for...of loop so await works!
c = c.replace(/restaurants\.forEach\(r => {([\s\S]*?)await updateSlug\.run\((.*?)\);([\s\S]*?)}\);/g, 'for (const r of restaurants) {$1await updateSlug.run($2);$3}');


fs.writeFileSync('server.ts', c);
