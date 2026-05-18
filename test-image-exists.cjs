const fs = require('fs');
console.log(fs.existsSync('/tmp/uploads/1779044508206-649067720.jpg'));
console.log(fs.existsSync(__dirname + '/uploads/1779044508206-649067720.jpg'));
