const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/authorizeRole\(\['admin'\]\)/g, "authorizeRole(['admin', 'super_admin'])");

code = code.replace(/app\.(patch|get|post|put|delete)\('(\/api\/admin\/(settings|plans|users|profile)[^']*)',\s*authenticateToken,\s*authorizeRole\(\['admin', 'super_admin'\]\)/g, "app.$1('$2', authenticateToken, authorizeRole(['super_admin']))");

fs.writeFileSync('server.ts', code);
