var path = require('path');
const fs = require('fs');
const generatePredeployed = require('./generate');

let artifactsPath = path.join(path.resolve(__dirname), '..', 'artifacts.json');
let artifactsData;

if (process.argv[2] && process.argv[2] === '--npm') {
    artifactsData = generatePredeployed(true);
} else {
    artifactsData = generatePredeployed();
}

fs.writeFileSync(artifactsPath, JSON.stringify(artifactsData, null, '\t'));