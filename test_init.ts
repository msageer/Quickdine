import { db } from './src/db.js';

async function testInit() {
  console.log('Testing Init...');
  const alterQueries = [
    "ALTER TABLE restaurants ADD COLUMN status TEXT DEFAULT 'Pending'"
  ];

  const alterPromises = alterQueries.map(q => db.exec(q).catch(() => {}));
  await Promise.all(alterPromises);
  console.log('Init Complete!');
  process.exit(0);
}

testInit();
