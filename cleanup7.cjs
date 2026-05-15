const fs = require('fs');

const content = fs.readFileSync('server.ts', 'utf8');

// Find all top-level statements that use `await`.
// To do this simply, we'll wrap EVERYTHING from `// Initialize DB schema`
// all the way down to `startServer()` in an async IIFE? No, wait!
// If we wrap the routes in an IIFE, the routes won't be defined until it executes, 
// which is totally fine since they are registered synchronously inside the IIFE.
// Actually, wrapping all setup and routes in `async function initializeApp() { ... }` 
// and calling it inside `startServer()` is MUCH cleaner and 100% correct!

// Let's replace `// Initialize DB schema` with 
// `async function initializeDatabaseAndRoutes() {`
// And we put the closing brace `}` right before `async function startServer() {`
// Then inside `startServer()`, we call `await initializeDatabaseAndRoutes();` before `app.listen...`
let c = content.replace(/\/\/ Initialize DB schema/g, 'async function initializeDatabaseAndRoutes() {\n// Initialize DB schema');
c = c.replace(/async function startServer\(\) \{/g, '}\n\nasync function startServer() {\n  await initializeDatabaseAndRoutes();');

fs.writeFileSync('server.ts', c);
