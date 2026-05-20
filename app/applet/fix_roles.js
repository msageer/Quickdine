const fs = require('fs');
let code = fs.readFileSync('/app/applet/server.ts', 'utf8');

code = code.replace(/authorizeRole\(\['admin'\]\)/g, "authorizeRole(['admin', 'super_admin'])");

// Now revert the specific endpoints back to super_admin only
code = code.replace(/app\.(patch|get|post|put|delete)\('(\/api\/admin\/(settings|plans|users|profile)[^']*)',\s*authenticateToken,\s*authorizeRole\(\['admin', 'super_admin'\]\)/g, "app.$1('$2', authenticateToken, authorizeRole(['super_admin']))");

fs.writeFileSync('/app/applet/server.ts', code);
