const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

// 1. Make all (req, res) handler async
content = content.replace(/(?<!async\s)\(req,\s*res\)\s*=>/g, 'async (req, res) =>');
content = content.replace(/(?<!async\s)\(req,\s*res,\s*next\)\s*=>/g, 'async (req, res, next) =>');

// 2. Wrap transaction closures with async
content = content.replace(/db\.transaction\(\(\)\s*=>/g, 'db.transaction(async () =>');

// Helper to find balanced parens
function replaceDbPrepare(str) {
    let result = '';
    let i = 0;
    while (i < str.length) {
        let match = str.slice(i).match(/db\.prepare\s*\(/);
        if (!match) {
            result += str.slice(i);
            break;
        }
        let startIdx = i + match.index;
        result += str.slice(i, startIdx);
        
        // Find closing paren of prepare
        let parens = 1;
        let j = startIdx + match[0].length;
        while (j < str.length && parens > 0) {
            if (str[j] === '(') parens++;
            if (str[j] === ')') parens--;
            j++;
        }
        let queryArgs = str.slice(startIdx + match[0].length, j - 1);
        
        // Now look for .get(, .all(, or .run(
        let methodMatch = str.slice(j).match(/^\s*\.\s*(get|all|run)\s*\(/);
        if (!methodMatch) {
            // Not chained immediately
            result += `db.prepare(${queryArgs})`;
            i = j;
            continue;
        }
        
        let mStartIdx = j + methodMatch.index;
        let mParens = 1;
        let k = mStartIdx + methodMatch[0].length;
        while (k < str.length && mParens > 0) {
            if (str[k] === '(') mParens++;
            if (str[k] === ')') mParens--;
            k++;
        }
        
        let callArgs = str.slice(mStartIdx + methodMatch[0].length, k - 1);
        let methodName = methodMatch[1];
        
        let replacement = '';
        if (methodName === 'get') {
            replacement = `await db.get(${queryArgs}${callArgs ? ', [' + callArgs + ']' : ''})`;
        } else if (methodName === 'all') {
            replacement = `await db.all(${queryArgs}${callArgs ? ', [' + callArgs + ']' : ''})`;
        } else if (methodName === 'run') {
            replacement = `await db.run(${queryArgs}${callArgs ? ', [' + callArgs + ']' : ''})`;
        }
        
        result += replacement;
        i = k;
    }
    return result;
}

content = replaceDbPrepare(content);

// We must also handle db.exec -> await db.exec
content = content.replace(/db\.exec\s*\(([^)]+)\)/g, 'await db.exec($1)');

fs.writeFileSync('server.ts', content);
console.log('Done refactoring');
